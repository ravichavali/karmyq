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
import { execSync } from 'child_process';

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
  const match = content.match(/\*?\*?Status\*?\*?:\s*[^a-zA-Z]*(\w+)/i);
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
  'the-village-model',
  'ux-design-principles',
  'neighborhood-service-layer',
  'what-is-karma',
  'trust-and-karma',
  'trust-score',
  'trust-paths',
  'trust-path',
  'reputation-decay',
  'why-ratings-are-private',
  'community-design',
  'community-home',
  'group-communities',
  'designed-to-forget',
  'community-and-provider-two-facets',
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
  'dashboard-home',
  'making-requests-guide',
  'fulfilling-requests-guide',
  'managing-commitments-guide',
  'match-lifecycle',
  'finding-communities-guide',
  'admin-community-guide',
  'group-communities-guide',
  'community-trust-model-guide',
  'understanding-karma-guide',
  'trust-connections-guide',
  'using-service-providers-guide',
  'provider-mode-guide',
  'provider-dibs-guide',
  'dibs-request',
  'managing-notifications-guide',
  'understanding-trust',
  'profile-guide',
  'onboarding-guide',
  'trust-graph',
  'interaction-half-life',
  'community-fission',
  'fusion',
  'your-memory-and-relationships-guide',
  'demo-data',
];

const GUIDE_LABELS: Record<string, string> = {
  'getting-started-guide': 'Getting Started',
  'dashboard-home': 'Your Dashboard Home',
  'making-requests-guide': 'Asking for Help',
  'fulfilling-requests-guide': 'Helping Others',
  'managing-commitments-guide': 'Managing Your Commitments',
  'finding-communities-guide': 'Finding Communities',
  'admin-community-guide': 'Running a Community',
  'group-communities-guide': 'Using Group Communities',
  'community-trust-model-guide': "Setting Your Community's Trust Model",
  'understanding-karma-guide': 'Your Karma & Reputation',
  'trust-connections-guide': 'Trust Connections in Your Feed',
  'using-service-providers-guide': 'Using the Service Provider Directory',
  'provider-mode-guide': 'Using Provider Mode',
  'provider-dibs-guide': 'Dibs: Trusted First-Ask',
  'dibs-request': 'Sending a Private Request (Dibs)',
  'match-lifecycle': 'Match Lifecycle',
  'managing-notifications-guide': 'Managing Your Notifications',
  'understanding-trust': 'Understanding Trust on Karmyq',
  'profile-guide': 'Your Profile',
  'onboarding-guide': 'Getting Started with Karmyq',
  'trust-graph': 'Understanding Your Community\'s Trust Graph',
  'interaction-half-life': 'Interaction Half-Life: How Trust Fades and Endures',
  'community-fission': 'Splitting a Community',
  'fusion': 'Community Fusion',
  'your-memory-and-relationships-guide': 'Your Memory & Relationships',
  'demo-data': 'Understanding the Demo',
};

const GUIDE_SLUGS: Record<string, string> = {
  'getting-started-guide': 'getting-started',
  'making-requests-guide': 'making-requests',
  'fulfilling-requests-guide': 'fulfilling-requests',
  'managing-commitments-guide': 'managing-commitments',
  'finding-communities-guide': 'finding-communities',
  'admin-community-guide': 'admin-community',
  'group-communities-guide': 'group-communities',
  'community-trust-model-guide': 'community-trust-model',
  'understanding-karma-guide': 'understanding-karma',
  'trust-connections-guide': 'trust-connections',
  'using-service-providers-guide': 'using-service-providers',
  'provider-mode-guide': 'provider-mode',
  'provider-dibs-guide': 'provider-dibs',
  'dibs-request': 'dibs-request',
  'match-lifecycle': 'match-lifecycle',
  'managing-notifications-guide': 'managing-notifications',
  'understanding-trust': 'understanding-trust',
  'profile-guide': 'profile-guide',
  'onboarding-guide': 'onboarding',
  'trust-graph': 'trust-graph',
  'interaction-half-life': 'interaction-half-life',
  'community-fission': 'community-fission',
  'fusion': 'fusion',
  'your-memory-and-relationships-guide': 'your-memory-and-relationships',
  'demo-data': 'demo-data',
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

// ADR groupings for the curated Technical nav
const ADR_GROUPS: Array<{ label: string; slugs: string[] }> = [
  {
    label: '— Foundation —',
    slugs: [
      'adr-004-microservices-event-driven',
      'adr-010-jwt-multi-community-auth',
      'adr-013-monorepo-turborepo',
      'adr-065-karmyq-org-and-com-domain-roles',
      'adr-075-karmyq-org-multi-route-relaunch',
      'adr-076-founding-circle-intake',
      'adr-003-multi-tenant-rls',
      'adr-006-standardized-api-response',
      'adr-074-canonical-error-response-contract',
      'adr-007-polymorphic-request-system',
      'adr-005-minimalist-dashboard',
      'adr-008-three-column-dashboard',
    ],
  },
  {
    label: '— Trust & Reputation —',
    slugs: [
      'adr-020-trust-first-design',
      'adr-036-private-feedback-model',
      'adr-037-multi-signal-trust-score',
      'adr-038-cross-community-trust',
      'adr-039-trust-score-decay-consistency',
      'adr-040-community-trust-score',
      'adr-044-community-trust-questionnaire',
      'adr-045-network-cohesion-score',
      'adr-046-trust-model-evolution',
      'adr-047-community-evolution-engine',
      'adr-011-reputation-decay',
      'adr-016-prestige-based-recognition',
      'adr-043-three-score-model',
      'adr-035-karma-allocation-trust-score-strategy',
      'adr-054-trust-graph-architecture',
      'adr-055-trust-governance-architecture',
      'adr-056-intrinsic-trust-decay',
      'adr-057-fission-mechanism',
      'adr-058-fusion-mechanism',
      'adr-063-canonical-trust-metric-and-unified-graph',
      'adr-069-data-retention-and-forgetting',
      'adr-070-visible-decay-model',
      'adr-077-trust-path-platform-topology',
      'adr-078-community-connection-reconciliation',
    ],
  },
  {
    label: '— Community & Scale —',
    slugs: [
      'adr-017-cohort-based-community-layers',
      'adr-018-community-splitting-mechanics',
      'adr-019-referral-chain-trust',
      'adr-021-trust-path-filtering',
      'adr-050-group-communities',
      'adr-062-community-identity-idempotent-creation',
    ],
  },
  {
    label: '— Requests & Matching —',
    slugs: [
      'adr-022-multi-tier-feed-architecture',
      'adr-031-unified-trust-scored-feed',
      'adr-048-feed-ranking-v2',
      'adr-032-server-driven-ui-dynamic-schemas',
      'adr-034-multi-layer-trust-computation',
      'adr-041-two-layer-mutual-aid-services',
      'adr-042-provider-trust-score',
      'adr-051-explore-exploit-dibs',
      'adr-072-dibs-scope',
      'adr-073-provider-community-linkup',
      'adr-052-security-hardening',
      'adr-053-feed-design-philosophy',
      'adr-033-offer-fulfillment-workflow',
      'adr-066-unified-feed-model',
      'adr-067-request-type-payload-vocabulary',
      'adr-068-community-page-information-architecture',
    ],
  },
  {
    label: '— Infrastructure —',
    slugs: [
      'adr-071-service-consolidation-feed-service',
      'adr-028-npm-workspace-docker-build',
      'adr-029-tdd-test-framework',
      'adr-030-community-configuration-system',
      'adr-009-ephemeral-data',
      'adr-015-observability-stack',
      'adr-049-error-visibility',
      'adr-001-natural-language-location-parsing',
      'adr-002-geocoding-cache-architecture',
      'adr-012-realtime-communication',
      'adr-014-testing-strategy',
      'adr-023-infrastructure-standardization',
      'adr-024-synthetic-user-simulation',
      'adr-027-docker-image-optimization-deferred',
      'adr-059-dependency-security-gate',
      'adr-060-code-scanning-gate',
      'adr-061-supply-chain-and-secrets-hardening',
      'adr-064-authorize-from-authenticated-identity',
    ],
  },
];

function generateNav(
  services: Array<{ name: string }>,
  adrs: Array<{ slug: string; title: string; status: string }>,
  conceptPages: ConceptPage[],
  guides: GuidePage[]
) {
  console.log('  Generating navigation...');

  const adrBySlug = new Map(adrs.map(a => [a.slug, a]));

  // Build grouped ADR items
  const adrItems: Array<{ label: string; href: string; divider?: boolean }> = [
    { label: 'All ADRs', href: '/docs/concepts' },
  ];
  for (const group of ADR_GROUPS) {
    adrItems.push({ label: group.label, href: '/docs/concepts', divider: true });
    for (const slug of group.slugs) {
      const adr = adrBySlug.get(slug);
      if (adr) {
        adrItems.push({
          label: adr.title.replace(/^ADR-\d+[:\s-]+/, '').slice(0, 80),
          href: `/docs/concepts/${adr.slug}`,
        });
      }
    }
  }

  // Non-technical concept pages (split into Why Karmyq / How It Works)
  const whyKarmyq = ['platform-overview', 'the-village-model', 'neighborhood-service-layer', 'community-design'];
  const howItWorks = ['trust-and-karma', 'trust-score', 'reading-the-trust-graph', 'what-is-karma', 'trust-paths', 'trust-path', 'reputation-decay', 'designed-to-forget', 'why-ratings-are-private', 'unified-feed', 'community-home', 'community-and-provider-two-facets', 'community-scale', 'community-identity', 'network-cohesion', 'trust-model-evolution', 'community-evolution', 'fractal-feed', 'community-discovery', 'provider-mode', 'trust-questions', 'governance', 'observability'];

  const nav = {
    sections: [
      {
        title: 'Why Karmyq',
        items: whyKarmyq
          .map(slug => conceptPages.find(p => p.slug === slug))
          .filter(Boolean)
          .map(p => ({ label: p!.title, href: `/docs/concepts/${p!.slug}` })),
      },
      {
        title: 'How It Works',
        items: howItWorks
          .map(slug => conceptPages.find(p => p.slug === slug))
          .filter(Boolean)
          .map(p => ({ label: p!.title, href: `/docs/concepts/${p!.slug}` })),
      },
      {
        title: 'User Guides',
        items: guides.map(g => ({
          label: GUIDE_LABELS[Object.keys(GUIDE_SLUGS).find(k => GUIDE_SLUGS[k] === g.slug) || ''] || g.title,
          href: `/docs/guides/${g.slug}`,
        })),
      },
      {
        title: 'Architecture Decisions',
        items: adrItems,
      },
      {
        title: 'API Reference',
        items: [
          { label: 'All Endpoints', href: '/docs/api' },
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
    ],
  };

  writeJson(path.join(OUT_DIR, 'nav.json'), nav);
}

// ─── Main ─────────────────────────────────────────────────────────────

function generateBuildStamp(adrCount: number) {
  let commitSha = 'unknown';
  let commitDate = new Date().toISOString();
  try {
    commitSha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    commitDate = execSync('git log -1 --format=%cI', { cwd: ROOT }).toString().trim();
  } catch {
    // git not available (e.g. fresh checkout without git)
  }
  writeJson(path.join(OUT_DIR, 'build.json'), {
    commitSha,
    commitDate,
    adrCount,
    generatedAt: new Date().toISOString(),
  });
}

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
  generateBuildStamp(adrs.length);

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
