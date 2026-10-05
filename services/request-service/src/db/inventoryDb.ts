import { query, withTransaction } from '../database/db';
import { directedAudienceSql } from './directedAudience';

// Only internal callers supply SQL identifiers/parameter positions. Viewer values stay bound.
export function itemManagerSql(alias: string, viewerParam: string): string {
  return `(${alias}.owner_user_id = ${viewerParam} OR (${alias}.owner_community_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM communities.members manager WHERE manager.community_id = ${alias}.owner_community_id
      AND manager.user_id = ${viewerParam} AND manager.status = 'active' AND manager.role = 'admin')))`;
}

export function itemAudienceSql(alias: string, viewerParam: string): string {
  return `(${itemManagerSql(alias, viewerParam)} OR (${alias}.status = 'available' AND (
    (${alias}.owner_community_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM communities.members member WHERE member.community_id = ${alias}.owner_community_id
        AND member.user_id = ${viewerParam} AND member.status = 'active'))
    OR (${alias}.owner_user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM inventory.item_shares audience_share
      JOIN communities.members viewer ON viewer.community_id = audience_share.community_id
        AND viewer.user_id = ${viewerParam} AND viewer.status = 'active'
      JOIN communities.members owner ON owner.community_id = audience_share.community_id
        AND owner.user_id = ${alias}.owner_user_id AND owner.status = 'active'
      WHERE audience_share.item_id = ${alias}.id)))))`;
}

export class InventoryError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export interface ItemInput {
  name: string;
  description?: string | null;
  category: string;
  condition?: string | null;
  owner_community_id?: string;
}
export type ItemPatch = Partial<
  Pick<ItemInput, 'name' | 'description' | 'category' | 'condition'>
> & { status?: string };

// A read viewer learns only the shares they themselves belong to. Managers can see the full
// configured set, including withdrawn shares, to remove it or restore it after rejoining.
// Other viewers get only shares with a currently active owner as well as their own membership.
function sharedWithSql(alias: string, viewerParam: string): string {
  return `COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.name, c.id)
    FROM inventory.item_shares s JOIN communities.communities c ON c.id = s.community_id
    WHERE s.item_id = ${alias}.id AND (${itemManagerSql(alias, viewerParam)} OR EXISTS (
      SELECT 1 FROM communities.members sm WHERE sm.community_id = s.community_id
        AND sm.user_id = ${viewerParam} AND sm.status = 'active' AND EXISTS (
          SELECT 1 FROM communities.members share_owner WHERE share_owner.community_id = s.community_id
            AND share_owner.user_id = ${alias}.owner_user_id AND share_owner.status = 'active')))), '[]'::jsonb)`;
}

export async function isActiveAdmin(communityId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2
    AND status = 'active' AND role = 'admin'`,
    [communityId, userId]
  );
  return result.rows.length > 0;
}
export async function isActiveMember(communityId: string, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM communities.members WHERE community_id = $1 AND user_id = $2
    AND status = 'active'`,
    [communityId, userId]
  );
  return result.rows.length > 0;
}
export async function listMine(userId: string) {
  const result = await query(
    `SELECT i.*, ${sharedWithSql('i', '$1')} AS shared_with FROM inventory.items i
    WHERE i.owner_user_id = $1 AND ${itemAudienceSql('i', '$1')} ORDER BY i.created_at DESC, i.id`,
    [userId]
  );
  return result.rows;
}
export async function getVisible(itemId: string, viewerId: string) {
  const result = await query(
    `SELECT i.*, ${sharedWithSql('i', '$2')} AS shared_with FROM inventory.items i
    WHERE i.id = $1 AND ${itemAudienceSql('i', '$2')}`,
    [itemId, viewerId]
  );
  return result.rows[0] ?? null;
}
export async function listForCommunity(communityId: string, viewerId: string) {
  // Bind membership in the listing itself as well as the route's 403 check.
  const result = await query(
    `SELECT i.*, CASE WHEN i.owner_user_id IS NOT NULL
    THEN jsonb_build_object('id', u.id, 'name', u.name) ELSE NULL END AS owner,
    ${sharedWithSql('i', '$2')} AS shared_with FROM inventory.items i
    LEFT JOIN auth.users u ON u.id = i.owner_user_id
    WHERE EXISTS (SELECT 1 FROM communities.members gate WHERE gate.community_id=$1
      AND gate.user_id=$2 AND gate.status='active')
      AND (i.owner_community_id = $1 OR (i.owner_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM inventory.item_shares s WHERE s.item_id = i.id AND s.community_id = $1)))
      AND ${itemAudienceSql('i', '$2')}
      -- The chosen community's share must still be live, even if the viewer can see the item
      -- through another community or is its owner.
      AND (i.owner_community_id = $1 OR EXISTS (SELECT 1 FROM communities.members sharer
        WHERE sharer.community_id=$1 AND sharer.user_id=i.owner_user_id AND sharer.status='active'))
    ORDER BY i.name, i.id`,
    [communityId, viewerId]
  );
  return {
    community_owned: result.rows.filter((i) => i.owner_community_id !== null),
    shared_by_members: result.rows.filter((i) => i.owner_user_id !== null),
  };
}
export async function create(userId: string, input: ItemInput) {
  return withTransaction(async (q) => {
    if (input.owner_community_id) {
      const admin = await q(
        `SELECT 1 FROM communities.members WHERE community_id=$1 AND user_id=$2
        AND status='active' AND role='admin' FOR SHARE`,
        [input.owner_community_id, userId]
      );
      if (!admin.rows.length)
        throw new InventoryError(
          403,
          'FORBIDDEN',
          'Only active community admins can add community items'
        );
    }
    const result = await q(
      `INSERT INTO inventory.items
      (owner_user_id, owner_community_id, name, description, category, condition, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.owner_community_id ? null : userId,
        input.owner_community_id ?? null,
        input.name,
        input.description ?? null,
        input.category,
        input.condition ?? null,
        userId,
      ]
    );
    return { ...result.rows[0], shared_with: [] };
  });
}

type TransactionQuery = (text: string, params?: any[]) => Promise<any>;
async function requireManager(q: TransactionQuery, itemId: string, viewerId: string) {
  const result = await q(
    `SELECT i.*, ${itemManagerSql('i', '$2')} AS can_manage FROM inventory.items i
    WHERE i.id=$1 AND ${itemAudienceSql('i', '$2')} FOR UPDATE OF i`,
    [itemId, viewerId]
  );
  const item = result.rows[0];
  if (!item) throw new InventoryError(404, 'NOT_FOUND', 'Item not found');
  if (!item.can_manage)
    throw new InventoryError(
      403,
      'FORBIDDEN',
      'Only the owner or active community admins can change this item'
    );
  if (item.owner_community_id) {
    const admin = await q(
      `SELECT 1 FROM communities.members WHERE community_id=$1 AND user_id=$2
      AND status='active' AND role='admin' FOR SHARE`,
      [item.owner_community_id, viewerId]
    );
    if (!admin.rows.length)
      throw new InventoryError(403, 'FORBIDDEN', 'Active admin membership required');
  }
  return item;
}
export async function update(itemId: string, userId: string, patch: ItemPatch) {
  return withTransaction(async (q) => {
    await requireManager(q, itemId, userId);
    // Fixed column allowlist: never interpolate a client property into SQL.
    const columns = ['name', 'description', 'category', 'condition', 'status'].filter((k) =>
      Object.prototype.hasOwnProperty.call(patch, k)
    );
    const values = columns.map((k) => patch[k as keyof ItemPatch]);
    const assignments = columns.map((k, index) => `${k}=$${index + 3}`).join(', ');
    const result = await q(
      `UPDATE inventory.items i SET ${assignments}, updated_at=NOW()
      WHERE i.id=$1 AND ${itemManagerSql('i', '$2')} RETURNING i.*`,
      [itemId, userId, ...values]
    );
    if (!result.rows.length)
      throw new InventoryError(403, 'FORBIDDEN', 'Management access changed');
    const shares = await q(
      `SELECT ${sharedWithSql('i', '$2')} AS shared_with FROM inventory.items i
      WHERE i.id=$1 AND ${itemAudienceSql('i', '$2')}`,
      [itemId, userId]
    );
    return { ...result.rows[0], shared_with: shares.rows[0]?.shared_with ?? [] };
  });
}
export async function remove(itemId: string, userId: string) {
  return withTransaction(async (q) => {
    await requireManager(q, itemId, userId);
    const result = await q(
      `DELETE FROM inventory.items i WHERE i.id=$1 AND ${itemManagerSql('i', '$2')} RETURNING i.id`,
      [itemId, userId]
    );
    if (!result.rows.length)
      throw new InventoryError(403, 'FORBIDDEN', 'Management access changed');
  });
}
export async function replaceShares(itemId: string, ownerId: string, communityIds: string[]) {
  return withTransaction(async (q) => {
    const item = await requireManager(q, itemId, ownerId);
    if (item.owner_community_id)
      throw new InventoryError(400, 'VALIDATION_ERROR', 'Community-owned items cannot be shared');
    if (communityIds.length) {
      const members = await q(
        `SELECT community_id FROM communities.members WHERE user_id=$1
        AND community_id = ANY($2::uuid[]) AND status='active' FOR SHARE`,
        [ownerId, communityIds]
      );
      if (members.rows.length !== communityIds.length)
        throw new InventoryError(
          400,
          'VALIDATION_ERROR',
          'Share only with communities you actively belong to'
        );
    }
    await q('DELETE FROM inventory.item_shares WHERE item_id=$1', [itemId]);
    if (communityIds.length)
      await q(
        `INSERT INTO inventory.item_shares (item_id, community_id)
      SELECT $1, unnest($2::uuid[])`,
        [itemId, communityIds]
      );
    const shares = await q(
      `SELECT ${sharedWithSql('i', '$2')} AS shared_with FROM inventory.items i
      WHERE i.id=$1 AND ${itemAudienceSql('i', '$2')}`,
      [itemId, ownerId]
    );
    return shares.rows[0]?.shared_with ?? [];
  });
}

export interface BorrowInput {
  community_id: string;
  duration_days: number;
  return_date?: string;
  description?: string;
}

export async function createBorrow(itemId: string, requesterId: string, input: BorrowInput) {
  return withTransaction(async (q) => {
    const visible = await q(`SELECT i.* FROM inventory.items i
      WHERE i.id=$1 AND ${itemAudienceSql('i', '$2')} FOR UPDATE OF i`, [itemId, requesterId]);
    const item = visible.rows[0];
    if (!item) throw new InventoryError(404, 'NOT_FOUND', 'Item not found');
    if (item.owner_user_id === requesterId) throw new InventoryError(400, 'OWN_ITEM', 'You cannot borrow your own item');
    if (item.status !== 'available') throw new InventoryError(400, 'ITEM_UNAVAILABLE', 'This item is unavailable');
    // Re-check the chosen community, not just visibility through some other live share.
    // Item lock serializes share/edit/delete operations; member locks keep this transaction's
    // authorization and recipient resolution consistent with concurrent leave/demotion writes.
    const members = await q(`SELECT member.user_id FROM communities.members member
      WHERE member.community_id=$1 AND member.status='active'
        AND member.user_id=ANY($2::uuid[]) FOR SHARE`,
      [input.community_id, item.owner_user_id ? [requesterId, item.owner_user_id] : [requesterId]]);
    const required = item.owner_user_id ? [requesterId, item.owner_user_id] : [requesterId];
    if (required.some((id) => !members.rows.some((m: any) => m.user_id === id)))
      throw new InventoryError(404, 'NOT_FOUND', 'Item not found');
    if (item.owner_community_id) {
      if (item.owner_community_id !== input.community_id) throw new InventoryError(404, 'NOT_FOUND', 'Item not found');
    } else {
      const share = await q('SELECT 1 FROM inventory.item_shares WHERE item_id=$1 AND community_id=$2', [itemId, input.community_id]);
      if (!share.rows.length) throw new InventoryError(404, 'NOT_FOUND', 'Item not found');
    }
    const admins = item.owner_community_id ? await q(`SELECT user_id FROM communities.members
      WHERE community_id=$1 AND status='active' AND role='admin' ORDER BY user_id FOR SHARE`, [item.owner_community_id]) : null;
    const recipients = item.owner_user_id ? [item.owner_user_id] : admins!.rows.map((m: any) => m.user_id).filter((id: string) => id !== requesterId);
    if (!recipients.length) throw new InventoryError(400, 'NO_RECIPIENT', 'No other active admin can receive this ask');
    // Item lock serializes duplicate submissions. Retain the original ask's terms/attribution.
    const existing = await q(`SELECT r.* FROM requests.help_requests r
      WHERE r.inventory_item_id=$1 AND r.requester_id=$2 AND r.is_directed
        AND r.status='open' AND r.expired=FALSE AND r.expires_at>NOW()
      ORDER BY r.created_at DESC LIMIT 1`, [itemId, requesterId]);
    if (existing.rows.length) return { ask: existing.rows[0], event: null };
    const settings = await q('SELECT request_ttl_days FROM communities.settings WHERE community_id=$1', [input.community_id]);
    const ttl = settings.rows[0]?.request_ttl_days ?? 60;
    const title = `Ask to borrow ${item.name}`;
    const defaultDescription = `I'd like to borrow ${item.name} for ${input.duration_days} days.`;
    const note = input.description?.trim();
    const description = note ? (note.length >= 10 ? note : `${defaultDescription}\n\n${note}`) : defaultDescription;
    const payload = { item_category: item.category, duration_days: input.duration_days,
      ...(item.condition ? { condition_min: item.condition } : {}), ...(input.return_date ? { return_date: input.return_date } : {}) };
    const result = await q(`INSERT INTO requests.help_requests
      (requester_id,title,description,category,request_type,payload,status,urgency,visibility_scope,
       is_directed,directed_to_user_id,directed_to_community_id,inventory_item_id,expires_at)
      VALUES ($1,$2,$3,'borrow','borrow',$4,'open','medium','community',TRUE,$5,$6,$7,NOW()+($8 * INTERVAL '1 day')) RETURNING *`,
      [requesterId, title, description,
        JSON.stringify(payload), item.owner_user_id, item.owner_community_id, itemId, ttl]);
    const ask = result.rows[0];
    await q('INSERT INTO requests.request_communities (request_id,community_id) VALUES ($1,$2)', [ask.id, input.community_id]);
    const event = { request_id: ask.id, requester_id: requesterId, recipient_user_ids: recipients, title, inventory_item_id: itemId };
    await q('INSERT INTO inventory.borrow_notification_outbox (request_id,payload) VALUES ($1,$2)', [ask.id, JSON.stringify(event)]);
    return { ask, event };
  });
}

export async function markDirectedNotificationPublished(requestId: string) {
  await query('UPDATE inventory.borrow_notification_outbox SET published_at=NOW() WHERE request_id=$1 AND published_at IS NULL', [requestId]);
}

export async function listIncomingAsks(viewerId: string) {
  const result = await query(`SELECT r.id,r.title,r.description,r.requester_id,r.payload,r.inventory_item_id,r.created_at,
    u.name AS requester_name FROM requests.help_requests r
    JOIN auth.users u ON u.id=r.requester_id
    WHERE r.is_directed AND ${directedAudienceSql('r', '$1', false)} AND r.requester_id <> $1
      AND r.status = 'open' AND r.expired = FALSE AND r.expires_at > NOW()
      AND NOT EXISTS (SELECT 1 FROM requests.matches incoming_match
        WHERE incoming_match.request_id=r.id AND incoming_match.responder_id = $1
          AND incoming_match.status IN ('proposed', 'matched'))
    ORDER BY r.created_at DESC,r.id LIMIT 100`, [viewerId]);
  return result.rows;
}
