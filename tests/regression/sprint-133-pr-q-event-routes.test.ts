/**
 * Sprint 133 PR Q (ADR-101, BUG-060). The routing table in packages/shared/events/routes.ts is the
 * single source of truth; this gate holds the live service source and services/registry.json to it.
 * Every rule has a negative fixture below proving it can fail. Sprint 134 PR L removed the legacy
 * shared-queue handlers, so no service may name `karmyq-events` at all.
 */
import { DEDICATED_EVENTS, EVENT_CONSUMERS, EVENT_ROUTES, UNCONSUMED_EVENTS, eventsFor } from '@karmyq/shared';
import type { EventConsumer } from '@karmyq/shared';
import * as ts from 'typescript';
import { read, tracked } from './helpers/workspaces';

type SourceFile = { path: string; text: string };
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
// The events routed to a service; [] for a service that is not an EVENT_CONSUMERS entry.
const routedFor = (service: string): string[] => {
  const consumer = service.replace(/-service$/, '');
  return (EVENT_CONSUMERS as readonly string[]).includes(consumer) ? eventsFor(consumer as EventConsumer) : [];
};

// A string or template literal in code (comments are not literals) that starts with a karmyq-events queue name.
// Consumers get their queue name from consumerQueueName, so a hard-coded one reopens a retired queue or bypasses the router.
function hardCodesQueueName(path: string, text: string): boolean {
  if (!text.includes('karmyq-events')) return false;
  let hit = false;
  const visit = (n: ts.Node): void => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.startsWith('karmyq-events')) hit = true;
    else if (ts.isTemplateExpression(n) && n.head.text.startsWith('karmyq-events')) hit = true;
    else ts.forEachChild(n, visit);
  };
  visit(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false));
  return hit;
}

function scan(files: SourceFile[]) {
  const published: Array<{ service: string; path: string; name: string; via: 'router' | 'direct' }> = [];
  const dynamic: string[] = [];
  const queueNameLiterals: string[] = [];
  const foreignConsumerQueues: Array<{ consumer: string; path: string }> = [];
  const registered: Record<string, string[]> = {};
  const intercepted = new Set<string>();
  for (const f of files) {
    for (const name of matches(f.text, /\bpublishEvent\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'router' });
    if (/from 'bull'/.test(f.text)) {
      for (const name of matches(f.text, /\.add\(\s*['"]([^'"]+)['"]/g)) published.push({ service: serviceOf(f.path), path: f.path, name, via: 'direct' });
    }
    if (/\bpublishEvent\(\s*(?!['"])[^\s)]/.test(f.text.replace(/function publishEvent\(/g, ''))) dynamic.push(f.path);
    if (hardCodesQueueName(f.path, f.text)) queueNameLiterals.push(f.path);
    // One queue per consumer, one consumer per queue: only the consumer's own service may open or start its queue.
    for (const consumer of matches(f.text, /\b(?:consumerQueueName|startConsumerQueue)\(\s*['"]([^'"]+)['"]/g)) {
      if (`${consumer}-service` !== serviceOf(f.path)) foreignConsumerQueues.push({ consumer, path: f.path });
    }
    const regs = matches(f.text, /\bregister\(\s*['"]([^'"]+)['"]/g);
    if (regs.length) (registered[serviceOf(f.path)] ??= []).push(...regs);
    if (f.path === INTERCEPTOR) for (const name of matches(f.text, /type === ['"]([^'"]+)['"]/g)) intercepted.add(name);
  }
  for (const regs of Object.values(registered)) regs.sort();
  return { published, dynamic, queueNameLiterals, foreignConsumerQueues, registered, intercepted };
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
  for (const path of s.queueNameLiterals) out.push(`hard-coded karmyq-events queue name in ${path}`);
  for (const { consumer, path } of s.foreignConsumerQueues) out.push(`${consumer} consumer queue opened in ${path}`);
  // Every consumer registers exactly its routes, and a service that is not a consumer registers nothing.
  for (const service of new Set([...Object.keys(s.registered), ...EVENT_CONSUMERS.map((c) => `${c}-service`)])) {
    const got = JSON.stringify(s.registered[service] ?? []);
    const want = JSON.stringify(routedFor(service));
    if (got !== want) out.push(`${service} registers ${got}, routes say ${want}`);
  }
  for (const [service, def] of Object.entries<any>(registry.services)) {
    const pubs = [...new Set(s.published.filter((p) => p.service === service).map((p) => p.name))].sort();
    const consumer = service.replace(/-service$/, '');
    const subs = [
      ...routedFor(service),
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
        .toContain('hard-coded karmyq-events queue name in services/cleanup-service/src/x.ts');
    });
    it('flags a karmyq-events queue reopened in a former legacy subscriber', () => {
      const path = 'services/notification-service/src/events/subscriber.ts';
      const reopened = live.map((f) => f.path === path ? { ...f, text: `${f.text}\nconst eventQueue = new Queue('karmyq-events', REDIS_URL);` } : f);
      expect(violations(reopened, registry)).toContain(`hard-coded karmyq-events queue name in ${path}`);
    });
    it('flags any hard-coded karmyq-events-* name, quoted or templated, but not one in a comment', () => {
      const files = [
        { path: 'services/reputation-service/src/q1.ts', text: "new Queue('karmyq-events-reputation', REDIS_URL)" },
        { path: 'services/reputation-service/src/q2.ts', text: 'new Queue(`karmyq-events-${consumer}`, REDIS_URL)' },
        { path: 'services/reputation-service/src/q3.ts', text: "// the old `karmyq-events` queue\n/** the shared `karmyq-events` queue */\n/*\n * a `karmyq-events-reputation` note\n */" },
      ];
      const flagged = violations([...live, ...files], registry).filter((v) => v.startsWith('hard-coded karmyq-events'));
      expect(flagged).toEqual(['services/reputation-service/src/q1.ts', 'services/reputation-service/src/q2.ts'].map((p) => `hard-coded karmyq-events queue name in ${p}`));
    });
    it('flags a queue name in code that shares its line with a comment, or a spaced template', () => {
      const files = [
        { path: 'services/reputation-service/src/q4.ts', text: "/* legacy */ const q = new Queue('karmyq-events', REDIS_URL);" },
        { path: 'services/reputation-service/src/q5.ts', text: 'new Queue(`karmyq-events-${ consumer }`, REDIS_URL)' },
      ];
      const flagged = violations([...live, ...files], registry).filter((v) => v.startsWith('hard-coded karmyq-events'));
      expect(flagged).toEqual(files.map((f) => `hard-coded karmyq-events queue name in ${f.path}`));
    });
    it("flags a service that opens another consumer's queue, by name or by starting it", () => {
      const files = [
        { path: 'services/reputation-service/src/q6.ts', text: "new Queue(consumerQueueName('notification'), REDIS_URL).process('request_created', h);" },
        { path: 'services/reputation-service/src/q7.ts', text: "startConsumerQueue('notification', handlers, REDIS_URL);" },
      ];
      const flagged = violations([...live, ...files], registry).filter((v) => v.includes('consumer queue opened in'));
      expect(flagged).toEqual(files.map((f) => `notification consumer queue opened in ${f.path}`));
    });
    it("judges a consumer's registrations across all of its files", () => {
      const extra = { path: 'services/notification-service/src/events/more.ts', text: "register('typo_event', h);" };
      const drift = violations([...live, extra], registry).find((v) => v.startsWith('notification-service registers ['));
      expect(drift).toBeDefined();
      expect(JSON.parse(drift!.split(' registers ')[1].split(', routes say ')[0])).toEqual([...eventsFor('notification'), 'typo_event'].sort());
    });
    it('flags routed handlers registered by a service that is not an event consumer', () => {
      const path = 'services/reputation-service/src/events/subscriber.ts';
      const planted = live.map((f) => f.path === path ? { ...f, text: `${f.text}\nregister('interaction_feedback_submitted', handler);` } : f);
      expect(violations(planted, registry)).toContain('reputation-service registers ["interaction_feedback_submitted"], routes say []');
    });
    it('flags a direct add of a routed event', () => {
      expect(violations(withFile({ path: 'services/cleanup-service/src/y.ts', text: "import Queue from 'bull';\nq.add('dibs_expired', {})" }), registry))
        .toContain('direct queue add of non-dedicated dibs_expired in services/cleanup-service/src/y.ts');
    });
    it('flags a consumer whose registrations drift from the routes', () => {
      const drifted = live.map((f) => f.path === 'services/notification-service/src/events/subscriber.ts'
        ? { ...f, text: f.text.replace("register('request_created'", "register('typo_event'") } : f);
      expect(violations(drifted, registry).some((v) => v.startsWith('notification-service registers [') && v.includes('"typo_event"'))).toBe(true);
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
