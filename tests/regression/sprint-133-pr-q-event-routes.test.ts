/**
 * Sprint 133 PR Q (ADR-101, BUG-060). The routing table in packages/shared/events/routes.ts is the
 * single source of truth; this gate holds the live service source and services/registry.json to it.
 * Every rule has a negative fixture below proving it can fail.
 */
import { DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, UNCONSUMED_EVENTS, eventsFor } from '@karmyq/shared';
import type { EventConsumer } from '@karmyq/shared';
import { read, tracked } from './helpers/workspaces';

type SourceFile = { path: string; text: string };
const LEGACY_SUBSCRIBERS = [
  'services/notification-service/src/events/subscriber.ts',
  'services/reputation-service/src/events/subscriber.ts',
  'services/social-graph-service/src/events/subscriber.ts',
];
const INTERCEPTOR = 'services/request-service/src/events/publisher.ts';
// A service's publisher module forwards its callers' names to the shared publisher (request-service also intercepts the
// dedicated ones). Its callers' literal names are scanned, so a dynamic name is allowed there and nowhere else.
const PUBLISHER_MODULE = /^services\/[^/]+\/src\/events\/publisher\.ts$/;

// Tracked files only (the shared live arbiter); `**` needs :(glob) magic or git silently drops src/index.ts.
const loadServiceSources = (): SourceFile[] =>
  tracked(':(glob)services/*/src/**/*.ts').filter((p) => !p.includes('/__tests__/')).map((path) => ({ path, text: read(path) }));
const serviceOf = (path: string) => path.split('/')[1];
const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);
const hasOwn = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key); // 'constructor' in {} is true

function scan(files: SourceFile[]) {
  const published: Array<{ service: string; path: string; name: string; via: 'router' | 'direct' }> = [];
  const dynamic: string[] = [];
  const legacyTouches: string[] = [];
  const registered: Record<string, string[]> = {};
  const intercepted = new Set<string>();
  for (const f of files) {
    for (const name of matches(f.text, /\bpublishEvent\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'router' });
    if (/from 'bull'/.test(f.text)) {
      for (const name of matches(f.text, /\.add\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'direct' });
    }
    if (/\bpublishEvent\(\s*(?!['"])[^\s)]/.test(f.text.replace(/function publishEvent\(/g, ''))) dynamic.push(f.path);
    if (/['"]karmyq-events['"]/.test(f.text)) legacyTouches.push(f.path);
    const regs = matches(f.text, /\bregister\(\s*['"]([^'"]+)['"]/g);
    if (regs.length) registered[serviceOf(f.path)] = regs.sort();
    if (f.path === INTERCEPTOR) for (const name of matches(f.text, /type === ['"]([^'"]+)['"]/g)) intercepted.add(name);
  }
  return { published, dynamic, legacyTouches, registered, intercepted };
}

function violations(files: SourceFile[], registry: any): string[] {
  const out: string[] = [];
  const s = scan(files);
  for (const p of s.published) {
    const dedicated = hasOwn(DEDICATED_EVENTS, p.name);
    if (p.via === 'direct' && !dedicated) out.push(`direct queue add of non-dedicated ${p.name} in ${p.path}`);
    if (p.via === 'router' && !hasOwn(EVENT_ROUTES, p.name) && !UNCONSUMED_EVENTS.has(p.name)) {
      if (!(dedicated && p.service === 'request-service' && s.intercepted.has(p.name))) out.push(`unclassified ${p.name} in ${p.path}`);
    }
  }
  for (const name of s.intercepted) if (!hasOwn(DEDICATED_EVENTS, name)) out.push(`interceptor routes non-dedicated ${name}`);
  for (const path of s.dynamic) if (!PUBLISHER_MODULE.test(path)) out.push(`dynamic publishEvent name in ${path}`);
  for (const path of s.legacyTouches) if (!LEGACY_SUBSCRIBERS.includes(path)) out.push(`karmyq-events referenced outside the legacy subscribers: ${path}`);
  for (const c of EVENT_CONSUMERS) {
    const got = JSON.stringify(s.registered[`${c}-service`] ?? []);
    if (got !== JSON.stringify(eventsFor(c))) out.push(`${c}-service registers ${got}, routes say ${JSON.stringify(eventsFor(c))}`);
  }
  for (const [service, def] of Object.entries<any>(registry.services)) {
    const pubs = [...new Set(s.published.filter((p) => p.service === service).map((p) => p.name))].sort();
    const consumer = service.replace(/-service$/, '');
    const subs = [
      ...((EVENT_CONSUMERS as readonly string[]).includes(consumer) ? eventsFor(consumer as EventConsumer) : []),
      ...Object.entries(DEDICATED_EVENTS).filter(([, d]) => d.consumers.includes(consumer)).map(([n]) => n),
    ].sort();
    const want = { publishes: pubs, subscribes: subs };
    const have = { publishes: [...(def.events?.publishes ?? [])].sort(), subscribes: [...(def.events?.subscribes ?? [])].sort() };
    if (JSON.stringify(want) !== JSON.stringify(have)) out.push(`registry ${service}.events ${JSON.stringify(have)} != source ${JSON.stringify(want)}`);
  }
  return out;
}

const registry = JSON.parse(read('services/registry.json'));
const live = loadServiceSources(); // scanned once; every case below reuses it

describe('Sprint 133 PR Q: event routing gate (ADR-101)', () => {
  it('the live source and registry have no violations', () => {
    expect(violations(live, registry)).toEqual([]);
  });

  it('scans enough to mean something', () => {
    const s = scan(live);
    expect(new Set(s.published.map((p) => p.service)).size).toBeGreaterThanOrEqual(5);
    expect(s.published.length).toBeGreaterThanOrEqual(40); // 46 sites on 2026-10-15; a floor, not a count, so new publishes don't break it
    expect([...s.intercepted].sort()).toEqual(['directed_request_created', 'match_completed']);
  });

  describe('negative fixtures: each rule can fail', () => {
    const withFile = (f: SourceFile) => [...live, f];
    it('flags an unclassified publish', () => {
      expect(violations(withFile({ path: 'services/request-service/src/x.ts', text: "await publishEvent('not_a_real_event', {})" }), registry))
        .toContain('unclassified not_a_real_event in services/request-service/src/x.ts');
    });
    it('flags an inherited object key as unclassified', () => {
      expect(violations(withFile({ path: 'services/request-service/src/x.ts', text: "await publishEvent('constructor', {})" }), registry))
        .toContain('unclassified constructor in services/request-service/src/x.ts');
    });
    it('flags a new karmyq-events user', () => {
      expect(violations(withFile({ path: 'services/cleanup-service/src/x.ts', text: "new Queue('karmyq-events')" }), registry))
        .toContain('karmyq-events referenced outside the legacy subscribers: services/cleanup-service/src/x.ts');
    });
    it('flags a direct add of a routed event', () => {
      expect(violations(withFile({ path: 'services/cleanup-service/src/y.ts', text: "import Queue from 'bull';\nq.add('dibs_expired', {})" }), registry))
        .toContain('direct queue add of non-dedicated dibs_expired in services/cleanup-service/src/y.ts');
    });
    it('flags a consumer whose registrations drift from the routes', () => {
      const drifted = live.map((f) => f.path === 'services/reputation-service/src/events/subscriber.ts'
        ? { ...f, text: f.text.replace("register('interaction_feedback_submitted'", "register('typo_event'") } : f);
      expect(violations(drifted, registry).some((v) => v.startsWith('reputation-service registers ["typo_event"]'))).toBe(true);
    });
    it('flags a registry that disagrees with the source', () => {
      const stale = JSON.parse(JSON.stringify(registry));
      stale.services['notification-service'].events.subscribes.push('user_joined_community');
      expect(violations(live, stale).some((v) => v.startsWith('registry notification-service.events'))).toBe(true);
    });
    it('flags a dynamic event name', () => {
      expect(violations(withFile({ path: 'services/community-service/src/z.ts', text: 'await publishEvent(name, {})' }), registry))
        .toContain('dynamic publishEvent name in services/community-service/src/z.ts');
      expect(violations(withFile({ path: 'services/community-service/src/events/publisher.ts', text: 'return shared.publishEvent(type, payload)' }), registry)
        .filter((v) => v.startsWith('dynamic'))).toEqual([]);
    });
  });
});
