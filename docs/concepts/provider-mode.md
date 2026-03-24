# Provider Mode

## The Dual-Role User

In Karmyq, the same person is often both a community member and a service provider. A tutor might request a ride from a neighbor (member role) and offer tutoring sessions for karma or compensation (provider role). These two roles share the same identity, karma balance, and trust graph — but they call for different views of the platform.

## How It Works

Provider Mode is a client-side view toggle stored in `localStorage` as `karmyq_provider_mode`. It never affects API calls or server state. When set to `'provider'`:

- The dashboard feed filters to requests matching the user's provider service type(s)
- A stats card surfaces provider-specific metrics (active commitments, completion rate, avg response)
- The notification system surfaces a separate provider stream via a second amber briefcase bell

Switching modes is instant — no page reload, no data re-fetch.

## Notification Separation

Notifications are split into two streams by type:

**Community notifications** (red bell): match offers, karma awards, community invites, join requests, messages

**Provider notifications** (amber bell): `preferred_provider_selected`, `provider_request_matched`, `provider_review_received`, `match_reminder`

The split is computed client-side by filtering `notification.type` against a constant set (`PROVIDER_NOTIFICATION_TYPES` in `lib/notificationCategories.ts`). No database column or server-side routing is needed — the full notification array is fetched once and split via `useMemo`.

## Provider Routing

When a new request is posted, the notification service sends two kinds of alerts additively:

1. `new_request` → all community members (the mutual aid layer)
2. `provider_request_matched` → providers whose service type matches (the service layer)

This is additive: disabling provider routing would never affect community notifications.

## Design Principle

Provider Mode is a lens, not a separate app. Both modes share all context — community membership, karma, social graph. This avoids the complexity of role-based routing while still giving providers a focused work surface.
