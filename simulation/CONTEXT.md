# Simulation Service — Technical Context

**Type**: Standalone Node.js/TypeScript package
**Purpose**: Organic, API-driven simulation of realistic Bay Area mutual aid behavior
**Process**: pm2 `karmyq-simulation` on demo server
**Metrics**: Prometheus on port 9099 (`/metrics`, `/health`)

---

## Architecture

The simulation runs as a set of worker threads (one per active persona), each executing a session loop: login → tick (pick action → call API → emit metric/log → sleep).

### Key Files

| File | Purpose |
|---|---|
| `scripts/run.ts` | Main orchestrator — spawns workers, manages state, updates Prometheus gauges |
| `scripts/seed-founders.ts` | One-time setup: registers 5 founders via real API, saves to `state/founders.json` |
| `scripts/reset.ts` | Wipes all `@test.karmyq.com` data from DB using SAVEPOINT-safe deletes |
| `api/client.ts` | `SimApiClient` — axios wrapper for all API calls with retry/backoff |
| `personas/types.ts` | Core interfaces: `Persona`, `PersonaState`, `ActionWeights`, `SeededUser` |
| `personas/founders/*.ts` | 5 typed founder personas with backstories, locations, action weights |
| `personas/generator.ts` | Auto-generates organic personas for invite-chain growth |
| `workflows/index.ts` | `runWorkflow()` dispatcher + all workflow implementations |
| `workflows/data.ts` | Request templates, community templates, message pools |
| `social-graph/propagation.ts` | Context-aware weight adjustments based on recent interactions |
| `scheduler/temporal.ts` | Time-of-day/day-of-week activity multipliers |
| `metrics/server.ts` | prom-client metrics server on port 9099 |
| `maintenance/check-integrity.js` | PostToolUse hook: warns when backend routes change |

---

## Persona System

### 5 Founder Personas

| Persona | Email | Location | Profile |
|---|---|---|---|
| Maria Reyes | maria.reyes@test.karmyq.com | Mission District, SF | Community Builder |
| James Okafor | james.okafor@test.karmyq.com | Oakland, CA | Active Helper |
| Priya Sharma | priya.sharma@test.karmyq.com | Palo Alto, CA | Social User |
| Wei Zhang | wei.zhang@test.karmyq.com | Daly City, CA | Requester |
| Fatima Al-Hassan | fatima.alhassan@test.karmyq.com | Fremont, CA | Browser → Builder |

### PersonaState Fields

```typescript
interface PersonaState {
  persona: Persona;
  token: string | null;
  tokenExpiresAt: number;
  userId: string | null;
  communityIds: string[];
  // Social graph context
  recentlyHelped: boolean;
  recentlyHelpedSomeone: boolean;
  pendingOfferCount: number;
  helpedReciprocally: boolean;
  // Growth tracking
  inviteCodesPending: string[];
  // Provider tracking (added 2026-03)
  isProvider: boolean;
  providerProfileId: string | null;
  collectiveIds: string[];
}
```

---

## Available Workflows

| Workflow | API Endpoint | Notes |
|---|---|---|
| `browseRequests` | `GET /requests` | Reading only |
| `createRequest` | `POST /requests` | Uses request templates from `data.ts` |
| `offerHelp` | `POST /matches` | Browses open requests first |
| `acceptOffer` | `PUT /matches/:id/accept` | Accepts proposed matches |
| `completeMatch` | `PUT /matches/:id/complete` | Adds feedback/rating |
| `sendMessage` | `POST /conversations/:id/messages` | Replies to existing conversations |
| `generateInvite` | `POST /invitations/generate` | Uses `X-Community-ID` header |
| `joinCommunity` | `POST /communities/:id/join` | Discovers via `GET /communities` |
| `createCommunity` | `POST /communities` | Uses community templates |
| `registerAsProvider` | `POST /providers` | ride/service/borrow types; sets `isProvider=true` |
| `joinCollective` | `POST /collectives/:id/members` | Requires provider profile |

### ActionWeights

All persona definitions include weights for all 11 workflows. Key weights by persona type:

- **activeHelper**: high `offerHelp` (0.8), high `registerAsProvider` (0.6)
- **socialUser**: high `generateInvite` (0.8), high `joinCollective` (0.7)
- **requester**: high `createRequest` (0.85), low `registerAsProvider` (0.1)
- **communityBuilder**: high `createCommunity` (0.4), moderate `registerAsProvider` (0.3)
- **browser**: low across most actions, low `registerAsProvider` (0.2)

---

## Prometheus Metrics

Exposed at `http://0.0.0.0:9099/metrics` (scraped by Prometheus via `host-gateway:9099`).

| Metric | Type | Labels |
|---|---|---|
| `sim_workflow_total` | Counter | `workflow`, `persona`, `status` |
| `sim_workflow_duration_seconds` | Histogram | `workflow`, `persona` |
| `sim_active_personas` | Gauge | — |
| `sim_users_total` | Gauge | `type` (founder/invited/generated) |
| `sim_invites_sent_total` | Counter | `persona` |
| `sim_geographic_spread` | Gauge | `region` |
| `sim_network_depth` | Gauge | — |

UFW rules allow Docker bridge networks (172.17.0.0/16 and 172.18.0.0/16) to reach port 9099. These are applied idempotently on each deploy via `scripts/deploy.sh`.

---

## Grafana Dashboards

| Dashboard | UID | Description |
|---|---|---|
| Simulation Overview | `sim-overview` | Persona metrics, workflow rates, user growth, live logs |
| Karmyq Service Overview | `karmyq-service-overview` | Error rates per service, log panels, all-errors feed |
| Karmyq Infrastructure | `karmyq-infra` | Host CPU/memory/disk, container metrics (cAdvisor), DB logs |

Datasource UIDs: `prometheus` and `loki` (explicit in `datasources.yml`).

---

## Infrastructure Observability (added 2026-03)

- **cAdvisor** (`gcr.io/cadvisor/cadvisor:v0.47.2`): Docker container metrics (CPU, memory, network)
- **node_exporter** (`prom/node-exporter:v1.7.0`): Host-level metrics (CPU, memory, disk, load)
- Both added to `docker-compose.yml` and `docker-compose.prod.yml`
- Prometheus scrapes both at 15s intervals

---

## Simulation State Files (gitignored)

| File | Contents |
|---|---|
| `state/founders.json` | Credentials + communityIds for 5 founders |
| `state/users.json` | All active simulated users (founders + invited + generated) |
| `state/pending-invites.json` | Invite codes generated but not yet accepted |

---

## Recent Changes

### 2026-03: Provider/Collective Workflows
- Added `registerAsProvider` and `joinCollective` to `WorkflowName`, `runWorkflow`, all persona `ActionWeights`
- Added `isProvider`, `providerProfileId`, `collectiveIds` to `PersonaState`
- Added `providers.ts` and `collectives.ts` to integrity checker `WORKFLOW_MAP`
- Provider API: `POST /providers` (requires `service_type`, `display_name`)
- Collective join API: `POST /collectives/:id/members` (requires `provider_id` in body)

### 2026-03: Observability Fixes
- Fixed datasource UIDs in `datasources.yml` (explicit `uid: loki` / `uid: prometheus`)
- Fixed LogQL parse error in simulation dashboard: `or` → `=~`
- Added cAdvisor + node_exporter to docker-compose and prometheus scrape config
- New comprehensive Grafana dashboards: service-overview (rewrite) + infrastructure (new)
