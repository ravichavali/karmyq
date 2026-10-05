import fs from 'fs';
import path from 'path';
import ts from 'typescript';
export type Surface = { file: string; line: number; sql: string };
import { createHash } from 'crypto';
// Jest compiles this helper; the standalone inventory command uses Node's TS loader.
// Keep the reviewed exception data portable across both module loaders.
function exceptionFile() {
  let directory = process.cwd();
  for (;;) {
    const file = path.join(directory, 'services/request-service/tests/helpers/directedSurfaceAllowlist.json');
    if (fs.existsSync(file)) return file;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error('Cannot locate reviewed directed SQL exceptions');
    directory = parent;
  }
}
const exceptions = JSON.parse(fs.readFileSync(exceptionFile(), 'utf8')) as {
  file: string; hash: string; label: string; reason: string;
}[];
export const ALLOWLIST = exceptions;
export const surfaceHash = (sql: string) => createHash('sha256').update(sql.trim()).digest('hex');
export const isAllowlisted = (hit: Surface) => ALLOWLIST.some(a => a.file === hit.file && a.hash === surfaceHash(hit.sql) && a.reason.trim());
export function scanFile(file: string, source: string): Surface[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const hits: Surface[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const sql = ts.isTemplateExpression(node) ? node.getText(ast) : node.text;
      if (/\b(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) && /\b(?:requests\.)?help_requests\b/i.test(sql))
        hits.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, sql });
      // Template interpolations are expressions, not independent SQL literals; still inspect
      // interpolations for nested string literals containing a separate SQL query.
    }
    ts.forEachChild(node, walk);
  };
  walk(ast); return hits;
}
export function scanServices(repo: string): Surface[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) files.push(full);
    }
  };
  for (const service of fs.readdirSync(path.join(repo, 'services')))
    if (fs.existsSync(path.join(repo, 'services', service, 'src'))) walk(path.join(repo, 'services', service, 'src'));
  return files.flatMap((file) => scanFile(path.relative(repo, file).replace(/\\/g, '/'), fs.readFileSync(file, 'utf8')));
}

function guardAlias(expression: ts.Expression): string | undefined {
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
    && ['notDirectedSql', 'directedAudienceSql', 'matchParticipantSql'].includes(expression.expression.text)) {
    const alias = expression.arguments[0];
    return alias && ts.isStringLiteral(alias) ? alias.text : undefined;
  }
  if (ts.isConditionalExpression(expression)) {
    const a = guardAlias(expression.whenTrue), b = guardAlias(expression.whenFalse);
    return a && a === b ? a : undefined;
  }
  return undefined;
}
function analyzableSql(sql: string): string {
  if (!sql.startsWith('`')) return sql;
  const ast = ts.createSourceFile('query.ts', `const value = ${sql};`, ts.ScriptTarget.Latest, true);
  const statement = ast.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) return '';
  const template = statement.declarationList.declarations[0].initializer;
  if (!template || !ts.isTemplateExpression(template)) return sql.slice(1, -1);
  let text = template.head.text;
  for (const span of template.templateSpans) {
    const alias = guardAlias(span.expression);
    text += (alias ? ` __privacy_${alias}__ ` : ' __interpolation__ ') + span.literal.text;
  }
  return text;
}
type Token = { text: string; depth: number; block: number };
// Deliberately conservative query-block/alias checks, not a general SQL authorization proof.
// Unknown dynamic statements require an exact reviewed exception and runtime tests.
function readsAreGuarded(sql: string): boolean {
  const clean = analyzableSql(sql)
    .replace(/\/\*[\s\S]*?\*\/|--[^\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, ' __value__ ')
    .replace(/\bNOT\s+([\w]+)\.is_directed\b/gi, ' __privacy_$1__ ');
  const words = clean.match(/[A-Za-z_][\w.]*(?:__)?|\$\d+|[^\s]/g) ?? [];
  const tokens: Token[] = []; let depth = 0, nextBlock = 0;
  const blocks: { id: number; depth: number }[] = [];
  for (const text of words) {
    if (text === ')') { depth--; while (blocks.length && blocks[blocks.length - 1].depth > depth) blocks.pop(); }
    if (/^(SELECT|UPDATE|INSERT|DELETE)$/i.test(text)) blocks.push({ id: ++nextBlock, depth });
    tokens.push({ text, depth, block: blocks[blocks.length - 1]?.id ?? 0 });
    if (text === '(') depth++;
  }
  const reads: { alias: string; block: number }[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^(FROM|JOIN|UPDATE|INTO)$/i.test(tokens[i].text) && /^(requests\.)?help_requests$/i.test(tokens[i + 1].text)) {
      let alias = tokens[i + 2]?.text;
      if (alias?.toUpperCase() === 'AS') alias = tokens[i + 3]?.text;
      if (!alias || /^(WHERE|ON|SET|LEFT|RIGHT|INNER|JOIN|GROUP|ORDER|LIMIT|RETURNING|VALUES)$/i.test(alias) || !/^\w+$/.test(alias)) alias = 'help_requests';
      reads.push({ alias, block: tokens[i].block });
    }
  }
  const guards = new Set<string>();
  const factorGuard = (factor: Token[]): string | undefined => {
    // Remove only parentheses enclosing the WHOLE factor, not an OR sibling.
    while (factor[0]?.text === '(' && factor[factor.length - 1]?.text === ')') {
      const base = factor[0].depth;
      if (factor.slice(1, -1).some(t => t.depth <= base)) break;
      factor = factor.slice(1, -1);
    }
    return factor.length === 1 ? /^__privacy_(\w+)__$/.exec(factor[0].text)?.[1] : undefined;
  };
  for (let i = 0; i < tokens.length; i++) {
    const begin = tokens[i];
    // ON can leave private rows on the preserved side of an outer join. Nullable-side
    // joins need an exact reviewed exception rather than a guessed join-semantics proof.
    if (!/^WHERE$/i.test(begin.text)) continue;
    const clause: Token[] = [];
    for (let j = i + 1; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.depth < begin.depth || (token.depth === begin.depth
        && /^(LEFT|RIGHT|INNER|FULL|CROSS|JOIN|WHERE|GROUP|HAVING|ORDER|LIMIT|UNION|RETURNING)$/i.test(token.text))) break;
      clause.push(token);
    }
    if (clause.some(t => t.depth === begin.depth && /^OR$/i.test(t.text))) continue;
    // An unparenthesized dynamic fragment can introduce an OR that bypasses a guard.
    if (clause.some(t => t.depth === begin.depth && t.text === '__interpolation__')) continue;
    let factor: Token[] = [];
    const accept = () => {
      const alias = factorGuard(factor);
      if (alias && factor[0].block === begin.block) guards.add(`${begin.block}:${alias}`);
      factor = [];
    };
    for (const token of clause) {
      if (token.depth === begin.depth && /^AND$/i.test(token.text)) accept();
      else factor.push(token);
    }
    accept();
  }
  return reads.length > 0 && reads.every(read => guards.has(`${read.block}:${read.alias}`));
}
export function unguarded(hits: Surface[]): Surface[] {
  return hits.filter(hit => !isAllowlisted(hit) && !readsAreGuarded(hit.sql));
}
