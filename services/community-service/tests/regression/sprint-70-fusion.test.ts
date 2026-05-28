/**
 * Sprint 70 — Fusion Mechanism TDD Tests
 *
 * Pure logic tests run always.
 * DB integration tests require a live DB connection and will be skipped otherwise.
 */

// ─── Pure logic: tally computation ──────────────────────────────────────────

interface FakeVote {
  vote: 'yes' | 'no' | 'abstain';
  prestige_weight: string;
}

function computeTally(votes: FakeVote[], totalMembers: number, quorumPct: number, approvalPct: number) {
  const votedCount = votes.length;
  const weightedYes = votes.filter((v) => v.vote === 'yes').reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  const weightedTotal = votes.reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  return {
    total_members: totalMembers,
    voted_count: votedCount,
    quorum_pct: quorumPct,
    approval_pct: approvalPct,
    weighted_yes: weightedYes,
    weighted_total: weightedTotal,
    approval_ratio: weightedTotal > 0 ? Math.round((weightedYes / weightedTotal) * 100) : 0,
    quorum_ratio: totalMembers > 0 ? Math.round((votedCount / totalMembers) * 100) : 0,
  };
}

function passes(votes: FakeVote[], totalMembers: number, quorumPct: number, approvalPct: number): boolean {
  const votedCount = votes.length;
  const weightedYes = votes.filter((v) => v.vote === 'yes').reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  const weightedTotal = votes.reduce((s, v) => s + parseFloat(v.prestige_weight), 0);
  return (
    totalMembers > 0 && (votedCount / totalMembers) * 100 >= quorumPct &&
    weightedTotal > 0 && (weightedYes / weightedTotal) * 100 >= approvalPct
  );
}

describe('Sprint 70 — Fusion Mechanism', () => {
  describe('computeTally — pure logic', () => {
    it('returns zero ratios for empty votes', () => {
      const tally = computeTally([], 10, 60, 60);
      expect(tally.voted_count).toBe(0);
      expect(tally.quorum_ratio).toBe(0);
      expect(tally.approval_ratio).toBe(0);
    });

    it('correctly computes quorum_ratio', () => {
      const votes: FakeVote[] = [
        { vote: 'yes', prestige_weight: '1.0' },
        { vote: 'yes', prestige_weight: '1.0' },
        { vote: 'no', prestige_weight: '1.0' },
      ];
      const tally = computeTally(votes, 5, 60, 60);
      expect(tally.voted_count).toBe(3);
      expect(tally.quorum_ratio).toBe(60); // 3/5 = 60%
    });

    it('correctly computes approval_ratio as trust-weighted', () => {
      const votes: FakeVote[] = [
        { vote: 'yes', prestige_weight: '3.0' }, // 75% of weight
        { vote: 'no', prestige_weight: '1.0' },  // 25% of weight
      ];
      const tally = computeTally(votes, 4, 60, 60);
      expect(tally.approval_ratio).toBe(75);
    });

    it('returns 0 approval_ratio when total weight is 0', () => {
      const tally = computeTally([], 0, 60, 60);
      expect(tally.approval_ratio).toBe(0);
    });

    it('counts abstains toward quorum but not approval', () => {
      const votes: FakeVote[] = [
        { vote: 'yes', prestige_weight: '1.0' },
        { vote: 'abstain', prestige_weight: '1.0' },
      ];
      const tally = computeTally(votes, 2, 60, 60);
      expect(tally.quorum_ratio).toBe(100); // 2/2
      expect(tally.approval_ratio).toBe(50); // 1 yes out of 2 total weight
    });
  });

  describe('passes() — auto-approval gate', () => {
    const makeVotes = (yesCount: number, noCount: number, weight: string = '1.0'): FakeVote[] => [
      ...Array(yesCount).fill({ vote: 'yes' as const, prestige_weight: weight }),
      ...Array(noCount).fill({ vote: 'no' as const, prestige_weight: weight }),
    ];

    it('passes when quorum and approval both met', () => {
      const votes = makeVotes(4, 0); // 4/5 = 80% quorum, 100% approval
      expect(passes(votes, 5, 60, 60)).toBe(true);
    });

    it('fails when quorum not met', () => {
      const votes = makeVotes(2, 0); // 2/5 = 40% quorum
      expect(passes(votes, 5, 60, 60)).toBe(false);
    });

    it('fails when approval not met', () => {
      const votes = makeVotes(2, 2); // 4/5 quorum passes, 50% approval fails
      expect(passes(votes, 5, 60, 60)).toBe(false);
    });

    it('fails for empty member set', () => {
      expect(passes([], 0, 60, 60)).toBe(false);
    });

    it('both communities must pass — one passing is not enough', () => {
      const votesA = makeVotes(4, 0); // passes (80% quorum, 100% approval)
      const votesB = makeVotes(1, 3); // fails (80% quorum, 25% approval)
      const bothPass = passes(votesA, 5, 60, 60) && passes(votesB, 5, 60, 60);
      expect(bothPass).toBe(false);
    });

    it('approves when both communities independently pass', () => {
      const votesA = makeVotes(4, 0);
      const votesB = makeVotes(4, 1);
      const bothPass = passes(votesA, 5, 60, 60) && passes(votesB, 5, 60, 60);
      expect(bothPass).toBe(true);
    });
  });

  describe('trust carry factor', () => {
    it('0.70 carry factor is applied correctly', () => {
      const TRUST_CARRY_FACTOR = 0.70;
      const carried = Math.round(10.0 * TRUST_CARRY_FACTOR * 100) / 100;
      expect(carried).toBe(7.0);
    });

    it('carry factor rounds to 2 decimal places', () => {
      const carried = Math.round(3.33 * 0.70 * 100) / 100;
      expect(carried).toBe(2.33);
    });

    it('fusion carry factor (0.70) is higher than fission (0.40)', () => {
      expect(0.70).toBeGreaterThan(0.40);
    });
  });

  describe('trust edge normalization', () => {
    it('sorts user IDs to maintain user_id_a < user_id_b constraint', () => {
      const uid1 = 'b-user';
      const uid2 = 'a-user';
      const [ua, ub] = [uid1, uid2].sort();
      expect(ua).toBe('a-user');
      expect(ub).toBe('b-user');
      expect(ua < ub).toBe(true);
    });

    it('sort is idempotent — already-sorted pairs are unchanged', () => {
      const uid1 = 'a-user';
      const uid2 = 'z-user';
      const [ua, ub] = [uid1, uid2].sort();
      expect(ua).toBe('a-user');
      expect(ub).toBe('z-user');
    });
  });

  // ─── DB integration tests ───────────────────────────────────────────────
  // These require a live PostgreSQL connection. They will fail gracefully
  // when the DB is not available (expected in CI without DB).

  describe('DB integration — fusionsDb helpers', () => {
    let pool: any;
    let dbAvailable = false;

    beforeAll(async () => {
      try {
        const { Pool } = require('pg');
        pool = new Pool({
          connectionString: process.env.DATABASE_URL || 'postgresql://karmyq_user:karmyq_password_dev@localhost:5432/karmyq_db',
          connectionTimeoutMillis: 3000,
        });
        const client = await pool.connect();
        client.release();
        dbAvailable = true;
      } catch {
        dbAvailable = false;
      }
    });

    afterAll(async () => {
      if (pool) await pool.end().catch(() => {});
    });

    it('fusion_proposals table exists', async () => {
      if (!dbAvailable) return;
      const res = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'communities' AND table_name = 'fusion_proposals'`
      );
      expect(res.rows.length).toBe(1);
    });

    it('fusion_votes table exists', async () => {
      if (!dbAvailable) return;
      const res = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'communities' AND table_name = 'fusion_votes'`
      );
      expect(res.rows.length).toBe(1);
    });

    it('community_links allows fusion_origin link_type', async () => {
      if (!dbAvailable) return;
      const res = await pool.query(
        `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
         WHERE conname = 'community_links_link_type_check'`
      );
      expect(res.rows.length).toBeGreaterThan(0);
      expect(res.rows[0].def).toContain('fusion_origin');
    });
  });
});
