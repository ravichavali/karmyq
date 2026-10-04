import fs from 'fs';
import path from 'path';
import ts from 'typescript';
export type Surface = { file: string; line: number; sql: string };
const allow = (file: string, needle: string, reason: string) => ({ file: `services/${file}`, needle, reason });
export const ALLOWLIST = [
  allow('auth-service/src/services/demoSessionService.ts', 'SELECT id, requester_id FROM requests.help_requests WHERE id = $1', 'Fixed curated fixture identity lookup; no content returned.'),
  allow('cleanup-service/src/jobs/expirationJob.ts', 'SET expired = TRUE', 'Internal expiry mutation, no audience-facing output.'),
  allow('cleanup-service/src/jobs/expirationJob.ts', 'DELETE FROM requests.help_requests', 'Internal hard retention deletion.'),
  allow('cleanup-service/src/jobs/expireDibs.ts', "AND status = 'dibs_pending'", 'Internal expiry; directed asks cannot enter dibs.'),
  allow('cleanup-service/src/jobs/matchReminderJob.ts', 'm.travel_time_minutes,', 'Trusted reminders delivered only to matched participants.'),
  allow('cleanup-service/src/jobs/memoryRetentionJob.ts', 'SELECT h.id AS request_id,', 'Internal retention-window CTE.'),
  allow('cleanup-service/src/jobs/memoryRetentionJob.ts', 'forgotten_requests AS', 'Internal content erasure.'),
  allow('cleanup-service/src/jobs/memoryRetentionJob.ts', 'DELETE FROM requests.help_requests h', 'Internal retention deletion.'),
  allow('messaging-service/src/routes/messages.ts', 'JOIN requests.help_requests r ON m.request_id = r.id', 'Participant identity lookup; route checks JWT participation before conversation access.'),
  allow('notification-service/src/events/subscriber.ts', 'SELECT r.title, u.name as requester_name', 'Trusted match-created event delivers to its explicit requester.'),
  allow('notification-service/src/events/subscriber.ts', 'SELECT title FROM requests.help_requests WHERE id = $1', 'Trusted completion event delivers to its two participants.'),
  allow('reputation-service/src/database/feedbackDb.ts', 'SELECT hr.requester_id, m.responder_id, m.status,', 'Feedback participant validation; no request content.'),
  allow('reputation-service/src/events/subscriber.ts', 'SELECT COUNT(*) AS cnt', 'Internal pair karma computation; directed exchanges earn normal karma.'),
  ...['routes/health.ts', 'services/healthMetricsService.ts'].flatMap(file => [
    allow(`reputation-service/src/${file}`, 'SELECT COUNT(*) as total', 'Cohort-gated non-identifying health aggregate; no request listing or title.'),
    allow(`reputation-service/src/${file}`, 'COUNT(DISTINCT r.requester_id)', 'Cohort-gated aggregate participant breadth; no identities returned.'),
    allow(`reputation-service/src/${file}`, 'AVG(f.helpfulness)', 'Cohort-gated aggregate feedback quality; no request content.'),
  ]),
  allow('reputation-service/src/services/badgeService.ts', 'COUNT(*) FILTER', 'Internal badge projection.'),
  allow('reputation-service/src/services/networkCohesionService.ts', 'SELECT DISTINCT r.requester_id, m.responder_id', 'Internal graph reduced to cohort score; no request content.'),
  allow('reputation-service/src/services/standingBackfillService.ts', '/* standing-backfill:matches */', 'Operator standing projection.'),
  allow('reputation-service/src/services/standingProjector.ts', 'SELECT m.request_id, m.responder_id, m.status, m.completed_at,', 'Trusted standing projection.'),
  allow('request-service/src/db/inventoryDb.ts', 'INSERT INTO requests.help_requests', 'Creation authorizes item audience and selected live community in a transaction.'),
  allow('request-service/src/db/offersDb.ts', 'SELECT id FROM requests.help_requests WHERE id = $1 AND requester_id = $2', 'Requester-only lifecycle lookup; requester is always in audience.'),
  allow('request-service/src/db/offersDb.ts', 'SELECT o.*, hr.requester_id as requester_user_id', 'Single-offer lifecycle lookup; requester authorization precedes returned content.'),
  allow('request-service/src/db/offersDb.ts', "UPDATE requests.help_requests SET status = 'matched'", 'Mutation after requester authorization.'),
  allow('request-service/src/routes/feedback.ts', 'SELECT m.id, m.status, r.requester_id, m.responder_id,', 'JWT participant validation for feedback; no request title.'),
  allow('request-service/src/routes/feedback.ts', 'r.requester_visibility_consent,', 'Consent lookup after participant authorization; public stories exclude directed asks.'),
  allow('request-service/src/routes/feedback.ts', 'SELECT m.id, r.requester_id, m.responder_id, m.requester_visible', 'Participant feedback lookup; no ask content.'),
  allow('request-service/src/routes/matches.ts', 'SELECT request_type, payload FROM requests.help_requests WHERE id = $1', 'Scheduling lookup after audience-guarded participant acceptance.'),
  allow('request-service/src/routes/matches.ts', 'SELECT id FROM requests.help_requests WHERE id = $1 FOR UPDATE', 'Lifecycle lock after audience-guarded participation.'),
  ...['matched', 'open', 'completed'].map(status => allow('request-service/src/routes/matches.ts', `SET status = '${status}'`, 'Mutation after audience and participant validation.')),
  allow('request-service/src/routes/providerOffers.ts', 'SELECT requester_id FROM requests.help_requests WHERE id = $1', 'Recipient identity after directed reachability validation.'),
  allow('request-service/src/routes/requests.ts', 'INSERT INTO requests.help_requests', 'Ordinary creation rejects all directed fields.'),
  allow('request-service/src/routes/requests.ts', 'SELECT requester_id FROM requests.help_requests WHERE id = $1', 'Owner identity lookup; ownership checked before mutation.'),
  allow('request-service/src/routes/requests.ts', "${updates.join(', ')}", 'Fixed field owner-only update; directed routing fields cannot be edited.'),
  allow('request-service/src/routes/requests.ts', "SET status = 'cancelled'", 'Requester-only cancellation.'),
  allow('simulation-service/src/fixtures/curatedDemo/baselineWriter.ts', 'INSERT INTO requests.help_requests', 'Curated fixture write.'),
  allow('simulation-service/src/profiles/index.ts', 'SELECT COUNT(*) FROM requests.help_requests hr', 'Own simulation request budget; no other-user request content.'),
  allow('social-graph-service/src/database/relationshipContextDb.ts', 'completed_pairs AS', 'Internal topology projection; no request content.'),
  allow('social-graph-service/src/services/pathComputation.ts', 'SELECT m.completed_at', 'Pair relationship metadata; no request content.'),
];
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
export function unguarded(hits: Surface[]): Surface[] {
  return hits.filter(({ file, sql }) => {
    if (ALLOWLIST.some((a) => a.file === file && sql.includes(a.needle) && a.reason.trim())) return false;
    const reads = [...sql.matchAll(/(?:FROM|JOIN|UPDATE|INTO)\s+(?:requests\.)?help_requests\b/gi)].length;
    const guards = [...sql.matchAll(/\/\*\s*(?:not-directed|directed-audience)\s*\*\/|\b(?:notDirectedSql|directedAudienceSql)\s*\(/g)].length;
    return guards < reads;
  });
}
