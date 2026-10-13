import express from 'express';
import { query } from '../database/db';
import { activeMemberSql, skillVisibleToSql } from '../db/skillVisibility';
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
    const result = await query(`SELECT COALESCE(jsonb_agg(
        jsonb_build_object('tag_id', t.id, 'label', t.tag_value, 'skill_slug', t.skill_slug)
        ORDER BY lower(t.tag_value), t.id) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS skills
      FROM auth.users u
      LEFT JOIN auth.user_privacy_settings ps ON ps.user_id = u.id
      LEFT JOIN auth.user_tags t ON t.user_id = u.id AND t.tag_type = 'skill'
      WHERE u.id = $1 AND ${skillVisibleToSql('u', '$2')}
      GROUP BY u.id`, [req.params.userId, req.user.userId]);
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

export default router;
