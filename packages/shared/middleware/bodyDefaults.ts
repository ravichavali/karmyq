import { Request, Response, NextFunction } from 'express';

/**
 * Restore the Express 4 guarantee that `req.body` is always an object.
 *
 * body-parser 1 (Express 4) initialised `req.body` to `{}` on every request, so
 * `const { x } = req.body` was safe even when the caller sent no body. body-parser 2
 * (Express 5) leaves `req.body` **undefined** unless a body was actually parsed — which
 * turns that same destructure into a TypeError, caught by the route's try/catch and
 * returned as a 500.
 *
 * That pattern appears in **76 handlers across 7 services**, so this restores the old
 * default once, immediately after `express.json()`, instead of editing every call site
 * and inevitably missing one. Sprint 122 found it via
 * `POST /communities/:id/join`, which legitimately takes no body.
 *
 * Deliberately narrow: it only fills in a **missing** body. Any parsed body — an array, `0`,
 * `""` — is left exactly as body-parser produced it, so nothing that already works changes
 * shape. The guard tests `=== undefined` rather than falsiness precisely for that reason.
 *
 * On `null` specifically: under `express.json()`'s default `strict: true`, a bare `null` body
 * is rejected with a 400 `entity.parse.failed` and this middleware never runs, so the case
 * cannot arise in any Karmyq service today. The `undefined`-only guard still distinguishes it
 * correctly should a service ever opt into `strict: false`, and the test file pins both halves.
 *
 * Mount order matters: this must come *after* the body parser, or it will run before
 * parsing and be overwritten.
 */
export function normalizeRequestBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined) {
    req.body = {};
  }
  next();
}
