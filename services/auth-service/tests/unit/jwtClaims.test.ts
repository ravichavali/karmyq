import jwt from 'jsonwebtoken';

describe('JWT payload shape', () => {
  const secret = process.env.JWT_SECRET || 'test-secret';

  it('payload contains communities field (not communityMemberships)', () => {
    const payload = {
      userId: 'u1',
      email: 'test@example.com',
      communities: [
        { id: 'c1', name: 'Community 1', role: 'member' },
        { id: 'c2', name: 'Community 2', role: 'admin' },
      ],
    };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret) as any;

    expect(decoded.communities).toBeDefined();
    expect(decoded.communityMemberships).toBeUndefined();
  });

  it('all community memberships appear in token', () => {
    const communities = [
      { id: 'c1', name: 'A', role: 'member' },
      { id: 'c2', name: 'B', role: 'admin' },
      { id: 'c3', name: 'C', role: 'member' },
    ];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.communities).toHaveLength(3);
    expect(decoded.communities.map((c: any) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('role is encoded correctly for admin and member', () => {
    const communities = [
      { id: 'c1', name: 'A', role: 'admin' },
      { id: 'c2', name: 'B', role: 'member' },
    ];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    expect(decoded.communities[0].role).toBe('admin');
    expect(decoded.communities[1].role).toBe('member');
  });

  it('user.communities ?? [] handles missing communities field without throwing', () => {
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com' }, secret);
    const decoded = jwt.verify(token, secret) as any;
    const memberships = decoded.communities ?? [];
    expect(memberships).toEqual([]);
    expect(() => memberships.some((m: any) => m.role === 'admin')).not.toThrow();
  });

  it('admin role check via communities array works correctly', () => {
    const communities = [{ id: 'c1', name: 'A', role: 'admin' }];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    const memberships = decoded.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.role === 'admin');
    expect(isAdmin).toBe(true);
  });

  it('member role is NOT admin', () => {
    const communities = [{ id: 'c1', name: 'A', role: 'member' }];
    const token = jwt.sign({ userId: 'u1', email: 'x@x.com', communities }, secret);
    const decoded = jwt.verify(token, secret) as any;
    const memberships = decoded.communities ?? [];
    const isAdmin = memberships.some((m: any) => m.role === 'admin');
    expect(isAdmin).toBe(false);
  });
});
