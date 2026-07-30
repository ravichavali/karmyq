import { createRequire } from 'module';
import express from 'express';
import request from 'supertest';

/**
 * Walk the prototype chain and return the object that OWNS `prop`, plus its descriptor.
 * Needed because Express's request chain is 3 deep: the incoming req -> `app.request`
 * (Object.create'd per app) -> `express.request` (the shared prototype where the getter
 * is defined). Asserting on `Object.getPrototypeOf(req)` inspects `app.request`, which
 * owns nothing — it returns undefined even on a CORRECT Express 5 install.
 */
function findOwner(obj: object, prop: string) {
  let cursor: object | null = obj;
  let depth = 0;
  while (cursor) {
    const descriptor = Object.getOwnPropertyDescriptor(cursor, prop);
    if (descriptor) return { depth, descriptor, owner: cursor };
    cursor = Object.getPrototypeOf(cursor);
    depth++;
  }
  return null;
}

type OwnerHit = NonNullable<ReturnType<typeof findOwner>>;

describe('Sprint 122 — express 5 runtime contract', () => {
  it('EXPRESS resolves body-parser 2.x (not the override-pinned 1.20.6)', () => {
    // Resolve from Express's own location. A bare require() here reports whichever copy
    // THIS file resolves, which can differ from the one Express actually loads.
    const requireFromExpress = createRequire(require.resolve('express'));
    const bodyParser = requireFromExpress('body-parser/package.json') as { version: string };
    expect(bodyParser.version).toMatch(/^2\./);
  });

  it('parses a JSON body end-to-end through express.json()', async () => {
    const app = express();
    app.use(express.json());
    app.post('/echo', (req, res) => {
      res.json({ got: req.body });
    });
    const res = await request(app).post('/echo').send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ got: { a: 1 } });
  });

  it('query lives on express.request as a setter-less getter (express 5), not as an own property (express 4)', async () => {
    // Measured on the installed Express 4.22.2: `query` is an OWN, writable property of the
    // incoming request (depth 0, writable: true), and `express.request` owns no `query`
    // descriptor at all. Express 5 inverts both halves. Assert both, so the test cannot pass
    // for the wrong reason.
    let ownedByRequestItself: boolean | undefined;
    let found: OwnerHit | null = null;
    let assignmentError: unknown = null;

    const app = express();
    app.get('/q', (req, res) => {
      ownedByRequestItself = Object.prototype.hasOwnProperty.call(req, 'query');
      found = findOwner(req, 'query');
      try {
        (req as unknown as { query: unknown }).query = { hacked: true };
      } catch (e) {
        assignmentError = e;
      }
      res.json({ q: req.query });
    });

    const res = await request(app).get('/q?x=1&y=2');

    // 1. the shared prototype Express exports owns an accessor
    const shared = Object.getOwnPropertyDescriptor(express.request, 'query');
    expect(shared).toBeDefined();
    expect(typeof shared!.get).toBe('function');
    expect(shared!.set).toBeUndefined();

    // 2. and the incoming request inherits it rather than owning a writable copy
    expect(ownedByRequestItself).toBe(false);
    expect(found).not.toBeNull();
    const hit = found as OwnerHit | null;
    expect(hit!.owner).toBe(express.request);
    expect(typeof hit!.descriptor.get).toBe('function');
    expect(hit!.descriptor.writable).toBeUndefined();

    // 3. a setter-less inherited accessor rejects assignment under strict mode
    expect(assignmentError).toBeInstanceOf(TypeError);

    // 4. and reading still works
    expect(res.body.q).toEqual({ x: '1', y: '2' });
  });
});
