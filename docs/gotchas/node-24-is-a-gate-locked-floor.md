Container images run `node:24-alpine`, the root `engines.node` is `>=24.0.0`, and CI's
`NODE_VERSION` is `24.x`. Per ADR-090 these are **gate-locked to one major** — changing any one
of them alone puts the runtime, the manifest and CI out of agreement.

Older majors install with `EBADENGINE` warnings rather than failing outright, so the breakage is
quiet until something else surfaces it.

This entry carries a `json_equals` check, so bumping the floor without updating this gotcha fails
the build — which is the point: the entry and the fact move together.
