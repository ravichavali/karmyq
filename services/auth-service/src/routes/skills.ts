import express from 'express';
import { query } from '../database/db';
import { activeMemberSql, completedPairSql, skillVisibleToSql } from '../db/skillVisibility';
import { publishEndorsementChanged } from '../events/endorsementEvents';
import { resolveSkillSlug } from '../services/skillVocabulary';
import { sendSuccess, sendNotFound, sendValidationError, sendInternalError } from '@karmyq/shared/utils/response';

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same normalized free-text key used by request-service matching.
const normalizedSkillSql = (value: string) => `lower(regexp_replace(trim(${value}), '[^a-zA-Z0-9]+', '_', 'g'))`;
const skillKey = `COALESCE(t.skill_slug, ${normalizedSkillSql('t.tag_value')})`;

router.get('/users/:userId', async (req: any, res) => {
  if (!UUID.test(req.params.userId)) return sendValidationError(res, 'Invalid user ID', undefined, { requestId: req.id });
  try {
    // ADR-100: per skill, the active vouch count, whether the caller vouched, and whether the caller
    // may vouch (a completed match with the owner, either direction). Visibility gates the whole row.
    const result = await query(`SELECT COALESCE(jsonb_agg(
        jsonb_build_object('tag_id', t.id, 'label', t.tag_value, 'skill_slug', t.skill_slug,
          'endorsement_count', COALESCE(e.endorsement_count, 0), 'endorsed_by_me', COALESCE(e.endorsed_by_me, false),
          'can_endorse', pair.can_endorse)
        ORDER BY lower(t.tag_value), t.id) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS skills
      FROM auth.users u
      LEFT JOIN auth.user_privacy_settings ps ON ps.user_id = u.id
      CROSS JOIN LATERAL (SELECT u.id <> $2::uuid AND EXISTS (
        SELECT 1 FROM requests.matches m JOIN requests.help_requests r ON r.id = m.request_id
        WHERE ${completedPairSql('u.id', '$2')}) AS can_endorse) pair
      LEFT JOIN auth.user_tags t ON t.user_id = u.id AND t.tag_type = 'skill'
      LEFT JOIN LATERAL (SELECT COUNT(*)::int AS endorsement_count, bool_or(se.endorser_id = $2::uuid) AS endorsed_by_me
        FROM auth.skill_endorsements se WHERE se.user_tag_id = t.id AND se.withdrawn_at IS NULL) e ON true
      WHERE u.id = $1 AND ${skillVisibleToSql('u', '$2')}
      GROUP BY u.id, pair.can_endorse`, [req.params.userId, req.user.userId]);
    if (!result.rows.length) return sendNotFound(res, 'Skills', { requestId: req.id });
    sendSuccess(res, result.rows[0].skills, 200, { requestId: req.id });
  } catch (error) {
    req.logger?.error('Failed to fetch member skills', error instanceof Error ? error : new Error(String(error)), { userId: req.user.userId });
    sendInternalError(res, 'Failed to fetch skills', undefined, { requestId: req.id });
  }
});

// The initial lookup distinguishes an empty directory from an inaccessible community.
// Repeat membership in the data statement to fail closed if the caller leaves between queries.
async function isMember(communityId: string, viewerId: string): Promise<boolean> {
  const result = await query(`SELECT 1 AS allowed WHERE ${activeMemberSql('$1', '$2')}`, [communityId, viewerId]);
  return result.rows.length > 0;
}

const communityJoins = `FROM auth.user_tags t
  JOIN auth.users u ON u.id = t.user_id
  JOIN communities.members cm ON cm.user_id = u.id AND cm.community_id = $1 AND cm.status = 'active'
  LEFT JOIN auth.user_privacy_settings ps ON ps.user_id = u.id
  LEFT JOIN auth.skill_vocabulary v ON v.slug = t.skill_slug`;
const communityWhere = `t.tag_type = 'skill' AND ${activeMemberSql('$1', '$2')} AND ${skillVisibleToSql('u', '$2')}`;

router.get('/communities/:communityId', async (req: any, res) => {
  const communityId = req.params.communityId;
  if (!UUID.test(communityId)) return sendValidationError(res, 'Invalid community ID', undefined, { requestId: req.id });
  try {
    if (!await isMember(communityId, req.user.userId)) return sendNotFound(res, 'Skills', { requestId: req.id });
    const result = await query(`SELECT ${skillKey} AS skill_key,
      MIN(COALESCE(v.label, t.tag_value)) AS label, COUNT(DISTINCT u.id)::int AS member_count
      ${communityJoins} WHERE ${communityWhere}
      GROUP BY ${skillKey} ORDER BY lower(MIN(COALESCE(v.label, t.tag_value))), ${skillKey}`,
      [communityId, req.user.userId]);
    sendSuccess(res, result.rows, 200, { requestId: req.id });
  } catch (error) {
    req.logger?.error('Failed to fetch skill directory', error instanceof Error ? error : new Error(String(error)), { communityId, userId: req.user.userId });
    sendInternalError(res, 'Failed to fetch skills', undefined, { requestId: req.id });
  }
});

router.get('/communities/:communityId/search', async (req: any, res) => {
  const communityId = req.params.communityId;
  const text = typeof req.query.skill === 'string' ? req.query.skill.trim() : '';
  if (!UUID.test(communityId) || !text || text.length > 100) return sendValidationError(res, 'A valid community ID and a skill of 1–100 characters are required', undefined, { requestId: req.id });
  try {
    if (!await isMember(communityId, req.user.userId)) return sendNotFound(res, 'Skills', { requestId: req.id });
    const key = await resolveSkillSlug(text) ?? text;
    const result = await query(`SELECT u.id AS user_id, u.name,
      jsonb_agg(jsonb_build_object('tag_id', t.id, 'label', t.tag_value) ORDER BY lower(t.tag_value), t.id) AS skills
      ${communityJoins} WHERE ${communityWhere} AND ${skillKey} = ${normalizedSkillSql('$3::text')}
      GROUP BY u.id, u.name ORDER BY lower(u.name), u.id LIMIT 50`,
      [communityId, req.user.userId, key]);
    sendSuccess(res, result.rows, 200, { requestId: req.id });
  } catch (error) {
    req.logger?.error('Failed to search community skills', error instanceof Error ? error : new Error(String(error)), { communityId, userId: req.user.userId });
    sendInternalError(res, 'Failed to fetch skills', undefined, { requestId: req.id });
  }
});

// ADR-100 eligibility, evaluated inside every statement that reads or writes an endorsement: the caller
// can see the skill (live co-membership + sharing on) AND has a completed match with its owner. One
// statement, so visibility cannot change between the check and the write. The most recent completed
// match is recorded; its request's communities decide where the vouch counts in the trust graph.
const eligibleEndorsementCte = `eligible AS (
  SELECT t.id AS tag_id, t.user_id AS endorsee_id, qm.match_id
  FROM auth.user_tags t
  JOIN auth.users u ON u.id = t.user_id
  LEFT JOIN auth.user_privacy_settings ps ON ps.user_id = u.id
  CROSS JOIN LATERAL (
    SELECT m.id AS match_id FROM requests.matches m JOIN requests.help_requests r ON r.id = m.request_id
    WHERE ${completedPairSql('u.id', '$2')}
    ORDER BY m.completed_at DESC NULLS LAST, m.id DESC LIMIT 1
  ) qm
  WHERE t.id = $1 AND t.tag_type = 'skill' AND u.id <> $2::uuid AND ${skillVisibleToSql('u', '$2')}
)`;

const endorsementShape = (row: any) => ({ id: row.id, tag_id: row.tag_id, endorsee_id: row.endorsee_id, created_at: row.created_at });

router.post('/endorsements', async (req: any, res) => {
  const tagId = req.body?.tag_id;
  if (typeof tagId !== 'string' || !UUID.test(tagId)) return sendValidationError(res, 'A valid tag_id is required', undefined, { requestId: req.id });
  const caller = req.user.userId;
  try {
    // Insert, or revive a withdrawn row. An active row is left untouched (no revision bump, no event).
    const changed = await query(`WITH ${eligibleEndorsementCte}
      INSERT INTO auth.skill_endorsements (endorser_id, endorsee_id, user_tag_id, match_id)
      SELECT $2::uuid, endorsee_id, tag_id, match_id FROM eligible
      ON CONFLICT ON CONSTRAINT skill_endorsements_one_per_tag DO UPDATE
        SET withdrawn_at = NULL, match_id = EXCLUDED.match_id, updated_at = now(),
            revision = skill_endorsements.revision + 1
        WHERE skill_endorsements.withdrawn_at IS NOT NULL
      RETURNING id, user_tag_id AS tag_id, endorsee_id, created_at, revision, (xmax = 0) AS inserted`, [tagId, caller]);
    const row = changed.rows[0];
    if (row) {
      await publishEndorsementChanged({ rowId: row.id, revision: row.revision, endorser_id: caller, endorsee_id: row.endorsee_id });
      return sendSuccess(res, endorsementShape(row), row.inserted ? 201 : 200, { requestId: req.id });
    }
    // Nothing changed: your own skill (400), already active (200 no-op) or not eligible (404). Eligibility
    // excludes your own tags, so the self check only runs on this path. The read is gated by the same
    // eligibility, so an active vouch on a now-hidden skill answers like a missing one.
    const own = await query('SELECT 1 AS own FROM auth.user_tags WHERE id = $1 AND user_id = $2', [tagId, caller]);
    if (own.rows.length) return sendValidationError(res, 'You cannot vouch for your own skill', undefined, { requestId: req.id });
    const existing = await query(`WITH ${eligibleEndorsementCte}
      SELECT se.id, se.user_tag_id AS tag_id, se.endorsee_id, se.created_at
      FROM auth.skill_endorsements se JOIN eligible ON eligible.tag_id = se.user_tag_id
      WHERE se.endorser_id = $2::uuid AND se.withdrawn_at IS NULL`, [tagId, caller]);
    if (!existing.rows.length) return sendNotFound(res, 'Skill', { requestId: req.id });
    sendSuccess(res, endorsementShape(existing.rows[0]), 200, { requestId: req.id });
  } catch (error: any) {
    // The tag was deleted between eligibility and insert: same answer as a missing tag.
    if (error?.code === '23503') return sendNotFound(res, 'Skill', { requestId: req.id });
    req.logger?.error('Failed to endorse skill', error instanceof Error ? error : new Error(String(error)), { userId: caller });
    sendInternalError(res, 'Failed to endorse skill', undefined, { requestId: req.id });
  }
});

// Withdrawing your own vouch needs no eligibility: it only ever removes trust. Idempotent.
router.delete('/endorsements/:tagId', async (req: any, res) => {
  const tagId = req.params.tagId;
  if (!UUID.test(tagId)) return sendValidationError(res, 'Invalid tag ID', undefined, { requestId: req.id });
  const caller = req.user.userId;
  try {
    const withdrawn = await query(`UPDATE auth.skill_endorsements
      SET withdrawn_at = now(), updated_at = now(), revision = revision + 1
      WHERE endorser_id = $1 AND user_tag_id = $2 AND withdrawn_at IS NULL
      RETURNING id, endorsee_id, revision`, [caller, tagId]);
    const row = withdrawn.rows[0];
    if (row) await publishEndorsementChanged({ rowId: row.id, revision: row.revision, endorser_id: caller, endorsee_id: row.endorsee_id });
    sendSuccess(res, { withdrawn: true }, 200, { requestId: req.id });
  } catch (error) {
    req.logger?.error('Failed to withdraw endorsement', error instanceof Error ? error : new Error(String(error)), { userId: caller });
    sendInternalError(res, 'Failed to withdraw endorsement', undefined, { requestId: req.id });
  }
});

export default router;
