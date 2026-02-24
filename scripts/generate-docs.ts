/**
 * generate-docs.ts — Build-time documentation generator
 *
 * Reads source documentation files from across the monorepo and writes
 * JSON data files into apps/landing/src/data/docs/ for the Next.js
 * static export to consume.
 *
 * Usage: npx tsx scripts/generate-docs.ts
 * Called automatically via apps/landing prebuild script.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'apps', 'landing', 'src', 'data', 'docs');

// ─── Helpers ──────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Extract title from markdown (first # heading or filename) */
function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/** Extract first paragraph as description */
function extractDescription(content: string): string {
  const lines = content.split('\n');
  let inHeading = false;
  for (const line of lines) {
    if (line.startsWith('#')) { inHeading = true; continue; }
    if (inHeading && line.trim() === '') continue;
    if (inHeading && line.trim()) return line.trim().slice(0, 200);
  }
  return '';
}

/** Extract ADR status from content (Status: accepted, etc.) */
function extractAdrStatus(content: string): string {
  const match = content.match(/\*?\*?Status\*?\*?:\s*(\w+)/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

/** Extract API endpoints from CONTEXT.md */
function extractEndpoints(content: string): Array<{ method: string; path: string; description: string }> {
  const endpoints: Array<{ method: string; path: string; description: string }> = [];
  const regex = /###\s+(GET|POST|PUT|DELETE|PATCH)\s+(.+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1];
    const endpointPath = match[2].trim();
    // Get the line after the heading as description
    const afterIdx = content.indexOf('\n', match.index + match[0].length);
    const nextLines = content.slice(afterIdx, afterIdx + 200).trim().split('\n');
    const desc = nextLines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('```'))?.trim() || '';
    endpoints.push({ method, path: endpointPath, description: desc });
  }
  return endpoints;
}

// ─── Service Catalog ──────────────────────────────────────────────────

function generateServiceCatalog() {
  console.log('  Generating service catalog...');
  const registryPath = path.join(ROOT, 'services', 'registry.json');
  const registry = JSON.parse(readFile(registryPath) || '{}');

  const services = Object.entries(registry.services || {}).map(([name, config]: [string, any]) => ({
    name,
    port: config.port,
    status: config.status,
    criticality: config.criticality,
    owner: config.owner,
    path: config.path,
    apis: config.apis?.provides || [],
    dependencies: config.dependencies?.services || [],
    infrastructure: config.dependencies?.infrastructure || [],
    events: config.events || { publishes: [], subscribes: [] },
    healthCheck: config.health_check,
    notes: config.notes || '',
    databaseSchemas: config.database_schemas || [],
  }));

  writeJson(path.join(OUT_DIR, 'services.json'), {
    services,
    statistics: registry.statistics,
    infrastructure: registry.infrastructure,
    updated: registry.updated,
  });

  return services;
}

// ─── Individual Service Docs ──────────────────────────────────────────

function generateServiceDocs(services: Array<{ name: string; path: string }>) {
  console.log('  Generating individual service docs...');
  const serviceDocs: Array<{ name: string; hasContext: boolean }> = [];

  for (const service of services) {
    if (!service.path) continue;
    const contextPath = path.join(ROOT, service.path, 'CONTEXT.md');
    const content = readFile(contextPath);

    if (content) {
      const endpoints = extractEndpoints(content);
      writeJson(path.join(OUT_DIR, 'services', `${service.name}.json`), {
        name: service.name,
        title: extractTitle(content, service.name),
        description: extractDescription(content),
        content,
        endpoints,
      });
      serviceDocs.push({ name: service.name, hasContext: true });
    } else {
      serviceDocs.push({ name: service.name, hasContext: false });
    }
  }

  return serviceDocs;
}

// ─── API Reference ────────────────────────────────────────────────────

function generateApiReference(services: Array<{ name: string; path: string }>) {
  console.log('  Generating API reference...');
  const apiGroups: Array<{
    service: string;
    port: number | null;
    endpoints: Array<{ method: string; path: string; description: string }>;
  }> = [];

  const registryPath = path.join(ROOT, 'services', 'registry.json');
  const registry = JSON.parse(readFile(registryPath) || '{}');

  for (const service of services) {
    if (!service.path) continue;
    const contextPath = path.join(ROOT, service.path, 'CONTEXT.md');
    const content = readFile(contextPath);
    if (!content) continue;

    const endpoints = extractEndpoints(content);
    if (endpoints.length > 0) {
      const config = registry.services?.[service.name];
      apiGroups.push({
        service: service.name,
        port: config?.port || null,
        endpoints,
      });
    }
  }

  writeJson(path.join(OUT_DIR, 'api.json'), { groups: apiGroups });
}

// ─── Architecture ─────────────────────────────────────────────────────

function generateArchitecture() {
  console.log('  Generating architecture doc...');
  const archPath = path.join(ROOT, 'docs', 'ARCHITECTURE.md');
  const content = readFile(archPath);

  const depGraphPath = path.join(ROOT, 'services', 'dependency-graph.md');
  const depGraph = readFile(depGraphPath);

  writeJson(path.join(OUT_DIR, 'architecture.json'), {
    title: 'System Architecture',
    content: content || '# Architecture\n\nDocumentation coming soon.',
    dependencyGraph: depGraph || '',
  });
}

// ─── Concepts (ADRs) ─────────────────────────────────────────────────

function generateConcepts() {
  console.log('  Generating concepts from ADRs...');
  const adrDir = path.join(ROOT, 'docs', 'adr');
  const files = fs.readdirSync(adrDir).filter(f => f.startsWith('ADR-') && f.endsWith('.md')).sort();

  const concepts: Array<{
    slug: string;
    number: string;
    title: string;
    status: string;
    description: string;
    filename: string;
  }> = [];

  for (const file of files) {
    const content = readFile(path.join(adrDir, file));
    if (!content) continue;

    const numberMatch = file.match(/ADR-(\d+)/);
    const number = numberMatch ? numberMatch[1] : '000';
    const slug = file.replace('.md', '').toLowerCase();
    const title = extractTitle(content, file.replace('.md', ''));
    const status = extractAdrStatus(content);
    const description = extractDescription(content);

    // Write individual concept file
    writeJson(path.join(OUT_DIR, 'concepts', `${slug}.json`), {
      slug,
      number,
      title,
      status,
      description,
      content,
      filename: file,
    });

    concepts.push({ slug, number, title, status, description, filename: file });
  }

  // Write concept index
  writeJson(path.join(OUT_DIR, 'concepts.json'), { concepts });
  return concepts;
}

// ─── Platform Concept Pages ───────────────────────────────────────────

interface ConceptPage {
  slug: string;
  title: string;
  description: string;
}

// Preferred reading order for the Concepts nav section
const CONCEPT_ORDER = [
  'platform-overview',
  'what-is-karma',
  'trust-score',
  'trust-paths',
  'reputation-decay',
  'community-design',
];

function generateConceptPages(): ConceptPage[] {
  console.log('  Generating platform concept pages...');
  const conceptsDir = path.join(ROOT, 'docs', 'concepts');
  if (!fs.existsSync(conceptsDir)) return [];

  const allFiles = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.md'));
  // Sort by CONCEPT_ORDER first, then alphabetically for any extras
  const files = allFiles.sort((a, b) => {
    const ai = CONCEPT_ORDER.indexOf(a.replace('.md', ''));
    const bi = CONCEPT_ORDER.indexOf(b.replace('.md', ''));
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  const pages: ConceptPage[] = [];

  for (const file of files) {
    const content = readFile(path.join(conceptsDir, file));
    if (!content) continue;

    const slug = file.replace('.md', '');
    const title = extractTitle(content, slug);
    const description = extractDescription(content);

    writeJson(path.join(OUT_DIR, 'concepts', `${slug}.json`), {
      slug,
      title,
      description,
      content,
    });

    pages.push({ slug, title, description });
  }

  return pages;
}

// ─── User Guides ──────────────────────────────────────────────────────

interface GuidePage {
  slug: string;
  title: string;
  description: string;
}

// Ordered list controls sidebar display order
const GUIDE_ORDER = [
  'getting-started-guide',
  'making-requests-guide',
  'fulfilling-requests-guide',
  'community-admin-guide',
  'understanding-karma-guide',
  'trust-connections-guide',
];

const GUIDE_LABELS: Record<string, string> = {
  'getting-started-guide': 'Getting Started',
  'making-requests-guide': 'Asking for Help',
  'fulfilling-requests-guide': 'Helping Others',
  'community-admin-guide': 'Running a Community',
  'understanding-karma-guide': 'Your Karma & Reputation',
  'trust-connections-guide': 'Trust Connections in Your Feed',
};

const GUIDE_SLUGS: Record<string, string> = {
  'getting-started-guide': 'getting-started',
  'making-requests-guide': 'making-requests',
  'fulfilling-requests-guide': 'fulfilling-requests',
  'community-admin-guide': 'community-admin',
  'understanding-karma-guide': 'understanding-karma',
  'trust-connections-guide': 'trust-connections',
};

function generateGuides(): GuidePage[] {
  console.log('  Generating user guides...');
  const guidesDir = path.join(ROOT, 'docs', 'guides');
  if (!fs.existsSync(guidesDir)) return [];

  const pages: GuidePage[] = [];

  for (const fileBase of GUIDE_ORDER) {
    const filePath = path.join(guidesDir, `${fileBase}.md`);
    const content = readFile(filePath);
    if (!content) continue;

    const navSlug = GUIDE_SLUGS[fileBase] || fileBase;
    const title = extractTitle(content, GUIDE_LABELS[fileBase] || fileBase);
    const description = extractDescription(content);

    writeJson(path.join(OUT_DIR, 'guides', `${navSlug}.json`), {
      slug: navSlug,
      title,
      description,
      content,
    });

    pages.push({ slug: navSlug, title, description });
  }

  return pages;
}

// ─── Navigation ───────────────────────────────────────────────────────

function generateNav(
  services: Array<{ name: string }>,
  adrs: Array<{ slug: string; title: string; status: string }>,
  conceptPages: ConceptPage[],
  guides: GuidePage[]
) {
  console.log('  Generating navigation...');

  const nav = {
    sections: [
      {
        title: 'Getting Started',
        items: [
          { label: 'Overview', href: '/docs' },
          { label: 'Architecture', href: '/docs/architecture' },
        ],
      },
      {
        title: 'Services',
        items: [
          { label: 'All Services', href: '/docs/services' },
          ...services.map(s => ({
            label: s.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(' Service', ''),
            href: `/docs/services/${s.name}`,
          })),
        ],
      },
      {
        title: 'API Reference',
        items: [
          { label: 'All Endpoints', href: '/docs/api' },
        ],
      },
      {
        title: 'Concepts',
        items: conceptPages.map(p => ({
          label: p.title,
          href: `/docs/concepts/${p.slug}`,
        })),
      },
      {
        title: 'Architecture Decisions',
        items: [
          { label: 'All ADRs', href: '/docs/concepts' },
          ...adrs.map(c => ({
            label: c.title.replace(/^ADR-\d+[:\s-]+/, '').slice(0, 50),
            href: `/docs/concepts/${c.slug}`,
          })),
        ],
      },
      {
        title: 'User Guides',
        items: guides.map(g => ({
          label: GUIDE_LABELS[Object.keys(GUIDE_SLUGS).find(k => GUIDE_SLUGS[k] === g.slug) || ''] || g.title,
          href: `/docs/guides/${g.slug}`,
        })),
      },
    ],
  };

  writeJson(path.join(OUT_DIR, 'nav.json'), nav);
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  console.log('Generating documentation data...\n');

  // Clean output directory
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true });
  }
  ensureDir(OUT_DIR);

  // Generate all docs
  const services = generateServiceCatalog();
  const serviceDocs = generateServiceDocs(services);
  generateApiReference(services);
  generateArchitecture();
  const adrs = generateConcepts();
  const conceptPages = generateConceptPages();
  const guides = generateGuides();
  generateNav(services, adrs, conceptPages, guides);

  // Summary
  console.log('\nDoc generation complete:');
  console.log(`  Services: ${services.length}`);
  console.log(`  Service docs: ${serviceDocs.filter(s => s.hasContext).length} with CONTEXT.md`);
  console.log(`  ADRs: ${adrs.length}`);
  console.log(`  Concept pages: ${conceptPages.length}`);
  console.log(`  User guides: ${guides.length}`);
  console.log(`  Output: ${OUT_DIR}\n`);
}

main();
