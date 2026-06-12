import { validateSubmission } from '../../src/routes/foundingCircle';

describe('validateSubmission (founding-circle intake)', () => {
  const valid = {
    email: 'you@example.com',
    lens: 'community organizer',
    contribution: 'I can host monthly skill-shares.',
    concern: 'Worried about trust at scale.',
    website: '',
  };

  it('accepts a valid body and returns trimmed values', () => {
    const result = validateSubmission({
      ...valid,
      email: '  you@example.com  ',
      lens: '  community organizer  ',
    });
    expect(result.ok).toBe(true);
    expect(result.drop).toBeFalsy();
    expect(result.value).toEqual({
      email: 'you@example.com',
      lens: 'community organizer',
      contribution: 'I can host monthly skill-shares.',
      concern: 'Worried about trust at scale.',
      source_page: 'join',
    });
  });

  it('defaults optional fields to null when absent', () => {
    const result = validateSubmission({ email: 'you@example.com' });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      email: 'you@example.com',
      lens: null,
      contribution: null,
      concern: null,
      source_page: 'join',
    });
  });

  it('rejects a missing email', () => {
    const result = validateSubmission({ lens: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects a blank/whitespace email', () => {
    const result = validateSubmission({ email: '   ' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects a malformed email', () => {
    for (const bad of ['notanemail', 'foo@', '@bar.com', 'a b@c.com', 'foo@bar']) {
      const result = validateSubmission({ email: bad });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/email/i);
    }
  });

  it('rejects an email over 320 chars', () => {
    const longLocal = 'a'.repeat(320);
    const result = validateSubmission({ email: `${longLocal}@example.com` });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects a lens over 200 chars', () => {
    const result = validateSubmission({ email: 'you@example.com', lens: 'x'.repeat(201) });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/lens/i);
  });

  it('rejects contribution over 4000 chars', () => {
    const result = validateSubmission({ email: 'you@example.com', contribution: 'x'.repeat(4001) });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/contribution/i);
  });

  it('rejects concern over 4000 chars', () => {
    const result = validateSubmission({ email: 'you@example.com', concern: 'x'.repeat(4001) });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/concern/i);
  });

  it('silently drops when honeypot (website) is non-empty', () => {
    const result = validateSubmission({ ...valid, website: 'http://spam.example' });
    expect(result.ok).toBe(true);
    expect(result.drop).toBe(true);
    expect(result.value).toBeUndefined();
  });

  it('treats a whitespace-only honeypot as empty (not a drop)', () => {
    const result = validateSubmission({ ...valid, website: '   ' });
    expect(result.ok).toBe(true);
    expect(result.drop).toBeFalsy();
  });

  it('ignores unknown/extra fields', () => {
    const result = validateSubmission({
      email: 'you@example.com',
      status: 'reviewed',
      id: 'attacker-controlled',
      created_at: '1999-01-01',
    } as any);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      email: 'you@example.com',
      lens: null,
      contribution: null,
      concern: null,
      source_page: 'join',
    });
  });

  it('rejects a non-object body', () => {
    expect(validateSubmission(null as any).ok).toBe(false);
    expect(validateSubmission(undefined as any).ok).toBe(false);
    expect(validateSubmission('nope' as any).ok).toBe(false);
  });
});
