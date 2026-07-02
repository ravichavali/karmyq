import {
  compileManifest,
  semanticUuid,
} from '../../src/fixtures/curatedDemo/compiler';
import {
  CURATED_DEMO_MANIFEST,
  getProtectedFixtureEmails,
} from '../../src/fixtures/curatedDemo/manifest';

const A = new Date('2026-07-02T12:00:00.000Z');
const B = new Date('2027-01-15T09:30:00.000Z');

describe('Sprint 117 curated manifest compiler', () => {
  it('derives stable UUIDs while shifting every age by the reset anchor', () => {
    expect(semanticUuid('person.maria')).toBe(semanticUuid('person.maria'));
    expect(semanticUuid('person.maria')).not.toBe(semanticUuid('person.helper'));
    const a = compileManifest(CURATED_DEMO_MANIFEST, A);
    const b = compileManifest(CURATED_DEMO_MANIFEST, B);
    expect(a.people.map(x => x.id)).toEqual(b.people.map(x => x.id));
    expect(b.requests[0].createdAt.getTime() - a.requests[0].createdAt.getTime())
      .toBe(B.getTime() - A.getTime());
  });

  it('keeps Maria active, member-only, protected, and outside every admin role', () => {
    const compiled = compileManifest(CURATED_DEMO_MANIFEST, A);
    const maria = compiled.people.find(p => p.key === 'person.maria')!;
    const memberships = compiled.memberships.filter(m => m.userId === maria.id);
    expect(maria.classification).toBe('protected');
    expect(memberships.some(m => m.status === 'active')).toBe(true);
    expect(memberships.every(m => m.role === 'member')).toBe(true);
    expect(getProtectedFixtureEmails()).toContain(maria.email);
  });

  it('rejects dangling references, impossible lifecycle, low cohorts, and a tunable-away rich floor', () => {
    expect(() => compileManifest({ ...CURATED_DEMO_MANIFEST, memberships: [{ user: 'missing', community: 'missing', role: 'member', status: 'active', joinedAge: 'P1D' }] }, A))
      .toThrow(/unknown semantic key/i);
    expect(() => compileManifest({ ...CURATED_DEMO_MANIFEST, tuning: { ...CURATED_DEMO_MANIFEST.tuning, minSharedPeople: 0 } }, A))
      .toThrow(/hard floor/i);
  });
});
