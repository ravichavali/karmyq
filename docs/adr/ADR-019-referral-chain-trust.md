# ADR-019: Referral Chain Trust System

**Date**: 2025-12-29
**Status**: Implemented (Phase 1 — invitation tracking and trust path integration)
**Deciders**: Development Team
**Related**: ADR-010 (JWT Multi-Community Auth), ADR-016 (Prestige Recognition)

## Context

Open community platforms face the "bad actor" problem. Traditional solutions:
- Centralized KYC/identity verification (privacy invasive, excludes marginalized)
- Algorithmic risk scoring (black box, discriminatory)
- Zero-trust design (assumes everyone is malicious, creates hostile environment)

Karmyq's philosophy: **people are fundamentally good**. We need safeguards that protect vulnerable members without recreating surveillance systems.

## Decision

**Implement referral chain accountability where new members are vouched for by existing members.**

### Referral Chain Model

**Seed Group (Founders)**:
- 5-7 trusted individuals who start the community
- High trust, shared vision, in-person relationships
- Responsible for setting culture and initial norms
- Each can invite 2-3 people in first wave

**Wave-Based Growth**:
```
Wave 1 (Seed): 5-7 people (founders)
Wave 2: 10-21 people (2-3 invites each)
Wave 3: 20-63 people (2-3 invites each)
Wave 4: 40-189 people (2-3 invites each)
```

**Referral Requirements**:
- Must be community member for 3+ months
- Must have completed 5+ successful exchanges
- Must have prestige score above baseline
- Limited to 2-3 active referrals at a time

### Accountability Chain

**Vouching Commitment**:
```javascript
{
  referrerId: "alice-uuid",
  refereeId: "bob-uuid",
  communityId: "portland-tools",
  vouchStatement: "Bob is my neighbor of 5 years. He's reliable and kind.",
  dateVouched: "2025-01-15",
  accountabilityPeriod: 6, // months
  status: "active"
}
```

**Voucher Responsibilities**:
- Introduce referee to community norms
- Available to answer referee's questions for first 3 months
- Share reputation risk if referee behaves harmfully (first 6 months)
- Help resolve conflicts involving referee

**Shared Reputation**:
- If referee accumulates negative karma, voucher's karma affected (-20%)
- Encourages vouchers to truly know who they're inviting
- Reputational risk, not permanent penalty
- Fades after 6-month accountability period

### Protection Mechanisms

**Progressive Trust**:
- New members start with limited privileges
- Can make basic requests after 1 exchange
- Can access higher-stakes requests after 5 exchanges
- Full privileges after 3 months + positive karma

**Community Veto**:
- Any member can flag a concerning referral
- Flagged referrals require 3 existing members to vouch
- Community can reject referral by majority vote
- Transparent process visible to all members

**Referral Suspension**:
- If 2+ referees cause problems, voucher loses referral privileges (temporary)
- Requires community review to restore
- Prevents serial bad vouching

### Privacy Considerations

**What's Visible**:
- That you were referred (not by whom, unless you choose to share)
- Number of successful referrals you've made
- Your own referral chain (who you vouched for)

**What's Private**:
- Your voucher's identity (unless they choose to reveal)
- Specific vouch statements (only to admins if needed)
- Referral rejection reasons (only to voucher)

## Consequences

### Positive

- **Natural Accountability**: Vouchers have skin in the game
- **Quality Over Quantity**: Slower growth ensures cultural coherence
- **Trust Scaffold**: Chain of personal relationships extends trust
- **Protects Vulnerable**: Bad actors less likely to gain access
- **Community Ownership**: Members decide who joins

### Negative

- **Slow Growth**: Limited to exponential waves, not viral
- **Exclusion Risk**: May recreate homogeneous social networks
- **Voucher Pressure**: Fear of reputation loss may prevent healthy invites
- **Gaming Potential**: Coordinated bad actors could vouch for each other

## Alternatives Considered

### Alternative 1: Open Registration

- **Why rejected**: Vulnerable to bad actors; loses cultural coherence

### Alternative 2: Admin-Only Approval

- **Why rejected**: Centralized gatekeeping; doesn't scale; creates power imbalance

### Alternative 3: Algorithmic Screening

- **Why rejected**: Black box; discriminatory; violates "people are good" principle

### Alternative 4: Paid Membership

- **Why rejected**: Excludes low-income; commercializes relationships

## Implementation Notes

### Phase 1: Basic Referrals (v9.0)
- Invitation code system
- Track who invited whom
- Display referral chain in profile

### Phase 2: Accountability (v10.0)
- Shared reputation during accountability period
- Community veto process
- Progressive trust for new members

### Phase 3: Advanced Features (v11.0+)
- Referral analytics (diversity metrics)
- Automated privilege escalation
- Cross-community referral transfer

### Database Schema

```sql
CREATE TABLE communities.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    referrer_id UUID NOT NULL REFERENCES auth.users(id),
    referee_id UUID NOT NULL REFERENCES auth.users(id),
    vouch_statement TEXT,
    vouch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accountability_end_date TIMESTAMP, -- vouch_date + 6 months
    status VARCHAR(50) DEFAULT 'active', -- active, completed, suspended
    shared_reputation_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities.referral_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES communities.referrals(id),
    flagger_id UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolution TEXT
);

CREATE TABLE communities.invitation_codes (
    code VARCHAR(20) PRIMARY KEY,
    community_id UUID NOT NULL REFERENCES communities.communities(id),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

```typescript
// POST /communities/:id/referrals
{
  "email": "bob@example.com",
  "vouchStatement": "Bob is my neighbor...",
  "sendInviteEmail": true
}

// GET /communities/:id/referrals/my-chain
{
  "referredBy": "alice-uuid",
  "myReferrals": ["bob-uuid", "carol-uuid"],
  "accountabilityActive": true,
  "referralsRemaining": 1
}

// POST /communities/:id/referrals/:referralId/flag
{
  "reason": "Concerning behavior in first interaction..."
}
```

### UI Components

**Referral Modal**:
- Explain accountability commitment
- Write vouch statement
- Preview invitation email
- Confirm understanding of shared reputation

**Referral Chain Visualization**:
- Tree diagram showing your referral network
- Badges for successful referrals
- Accountability period countdown

## References

- Six degrees of separation research
- Social network theory (strong vs weak ties)
- Dunbar's Number and referral chains
- Vouching systems in mutual credit networks
- Traditional apprenticeship models
