# Service Dependency Graph

**Generated**: 2026-01-22T14:53:22.025Z

## Legend

- 🔴 Red nodes: **Critical** services (system fails if down)
- 🟡 Yellow nodes: **Important** services (degraded experience if down)
- ⚪ White nodes: **Optional** services
- 🔘 Gray nodes: **Deprecated** services
- Solid arrows: Service dependencies
- Dotted arrows: Infrastructure dependencies

```mermaid
graph TD
  auth-service["auth-service\nPort: 3001\ncritical"]:::critical
  community-service["community-service\nPort: 3002\ncritical"]:::critical
  request-service["request-service\nPort: 3003\ncritical"]:::critical
  reputation-service["reputation-service\nPort: 3004\ncritical"]:::critical
  notification-service["notification-service\nPort: 3005\nimportant"]:::important
  messaging-service["messaging-service\nPort: 3006\ncritical"]:::critical
  feed-service["feed-service\nPort: 3007\nimportant"]:::important
  cleanup-service["cleanup-service\nPort: 3008\nimportant"]:::important
  geocoding-service["geocoding-service\nPort: 3009\noptional"]
  social-graph-service["social-graph-service\nPort: 3010\ncritical"]:::critical
  simulation-service["simulation-service\nPort: N/A\noptional"]

  community-service --> auth-service
  request-service --> auth-service
  request-service --> community-service
  reputation-service --> auth-service
  notification-service --> auth-service
  messaging-service --> auth-service
  messaging-service --> community-service
  feed-service --> auth-service
  social-graph-service --> auth-service
  social-graph-service --> community-service
  simulation-service --> all

  auth-service -.-> postgres[(postgres)]
  auth-service -.-> redis[(redis)]
  community-service -.-> postgres[(postgres)]
  community-service -.-> redis[(redis)]
  community-service -.-> bull-queue[(bull-queue)]
  request-service -.-> postgres[(postgres)]
  request-service -.-> redis[(redis)]
  request-service -.-> bull-queue[(bull-queue)]
  reputation-service -.-> postgres[(postgres)]
  reputation-service -.-> redis[(redis)]
  reputation-service -.-> bull-queue[(bull-queue)]
  notification-service -.-> postgres[(postgres)]
  notification-service -.-> redis[(redis)]
  notification-service -.-> bull-queue[(bull-queue)]
  messaging-service -.-> postgres[(postgres)]
  messaging-service -.-> redis[(redis)]
  feed-service -.-> postgres[(postgres)]
  feed-service -.-> redis[(redis)]
  cleanup-service -.-> postgres[(postgres)]
  cleanup-service -.-> redis[(redis)]
  geocoding-service -.-> redis[(redis)]
  social-graph-service -.-> postgres[(postgres)]
  social-graph-service -.-> redis[(redis)]

  classDef critical fill:#ff6b6b,stroke:#c92a2a,color:#fff
  classDef important fill:#ffd93d,stroke:#f08c00,color:#000
  classDef deprecated fill:#868e96,stroke:#495057,color:#fff
```
