# simulation - Local Context

> **Note**: The simulation is a standalone package at the monorepo root. It targets the Karmyq API (not the DB directly) and runs as a pm2 process on the demo server.

## Quick Facts

- **Type**: Standalone Node.js/TypeScript package (not a Docker service)
- **Process Manager**: pm2 (`karmyq-simulation`)
- **Metrics Port**: 9099 (`/metrics`, `/health`)
- **State Directory**: `simulation/state/` (gitignored — runtime data)
- **Target**: `TARGET_API_URL` env var (default: `https://karmyq.com/api`)

## Architecture

```
simulation/
├── api/client.ts          ← Axios wrapper for all API calls (SimApiClient)
├── personas/
│   ├── founders/          ← 5 typed founder persona definitions
│   ├── generator.ts       ← Auto-generates organic invitee personas
│   └── types.ts           ← Persona, PersonaState, ActionWeights interfaces
├── workflows/
│   ├── index.ts           ← runWorkflow() dispatcher + all workflow functions
│   └── data.ts            ← Request templates, message pools, community templates
├── social-graph/
│   └── propagation.ts     ← Context-aware action weight adjustments
├── scheduler/
│   └── temporal.ts        ← Time-of-day/day-of-week activity multipliers
├── metrics/
│   └── server.ts          ← prom-client metrics server (port 9099)
├── scripts/
│   ├── reset.ts           ← Wipe all @test.karmyq.com data from DB
│   ├── seed-founders.ts   ← Register 5 founders + first community via API
│   └── run.ts             ← Main orchestrator (worker_threads, one per persona)
├── maintenance/
│   └── check-integrity.js ← Hook: warns when backend routes change that affect sim
└── state/                 ← Runtime (gitignored): users.json, founders.json, pending-invites.json
```

## Available Workflows

| Workflow | Description |
|---|---|
| `browseRequests` | Browse open help requests |
| `createRequest` | Post a new help request |
| `offerHelp` | Respond to an existing request |
| `acceptOffer` | Accept a proposed match |
| `completeMatch` | Mark a match complete with feedback |
| `sendMessage` | Reply to a conversation |
| `generateInvite` | Generate an invite code for a community |
| `joinCommunity` | Join a discovered community |
| `createCommunity` | Create a new community |
| `registerAsProvider` | Register a provider profile (ride/service/borrow) |
| `joinCollective` | Join a provider collective (requires provider profile) |

## Running the Simulation

```bash
# One-time setup (after fresh clone or reset)
npx ts-node simulation/scripts/reset.ts
npx ts-node simulation/scripts/seed-founders.ts

# Start simulation (picks up from state/users.json)
cd simulation && pm2 start "npx ts-node scripts/run.ts --load-profile=steady" --name karmyq-simulation && pm2 save

# Restart after code changes
pm2 restart karmyq-simulation --update-env

# View logs
pm2 logs karmyq-simulation
```

## Mandatory Checklist Before Editing

- [ ] If changing `api/client.ts`: verify endpoint paths and headers against the actual backend route
- [ ] If adding a new workflow: add to `WorkflowName` union, `runWorkflow` switch, and all persona `ActionWeights`
- [ ] If changing `PersonaState`: update state initialization in `scripts/run.ts`
- [ ] If backend routes changed: update `maintenance/check-integrity.js` WORKFLOW_MAP

## Known Issues / Recent Fixes

- Workers require `execArgv: ['--require', 'ts-node/register']` to load .ts files
- Invite generation uses `X-Community-ID` header (not request body)
- Metrics server must bind to `0.0.0.0` for Docker containers (Prometheus) to reach it
- Integration tests must run post-deploy (services must be up first)
