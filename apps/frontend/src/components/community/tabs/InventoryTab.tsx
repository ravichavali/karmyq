import { useCallback, useEffect, useState } from 'react';
import InventoryItemCard from '@/components/inventory/InventoryItemCard';
import InventoryItemForm from '@/components/inventory/InventoryItemForm';
import { inventoryService, type InventoryItem, type InventoryItemInput } from '@/lib/api';

// A community change remounts all scoped state. Late reads/mutations belong to the old
// instance and cannot populate the new community or leave its management controls behind.
export default function InventoryTab(props: { communityId: string; isAdmin: boolean }) {
  return <CommunityInventory key={props.communityId} {...props} />;
}

function CommunityInventory({ communityId, isAdmin }: { communityId: string; isAdmin: boolean }) {
  const [data, setData] = useState<{
    community_owned: InventoryItem[];
    shared_by_members: InventoryItem[];
  }>({ community_owned: [], shared_by_members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData({ community_owned: [], shared_by_members: [] });
    try {
      const res = await inventoryService.listForCommunity(communityId);
      setData(res.data);
    } catch {
      setError('Could not load shared things. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [communityId]);
  useEffect(() => {
    void load();
    setEditing(undefined);
  }, [load]);
  async function save(input: InventoryItemInput) {
    const res = editing
      ? await inventoryService.update(editing.id, input)
      : await inventoryService.create({ ...input, owner_community_id: communityId });
    setData((current) => ({
      ...current,
      community_owned: editing
        ? current.community_owned.map((i) => (i.id === editing.id ? res.data : i))
        : [...current.community_owned, res.data],
    }));
    setEditing(undefined);
  }
  async function change(item: InventoryItem, remove = false) {
    setBusy(item.id);
    setError(null);
    try {
      if (remove) {
        await inventoryService.remove(item.id);
        setData((current) => ({
          ...current,
          community_owned: current.community_owned.filter((i) => i.id !== item.id),
        }));
        setConfirmDelete(null);
      } else {
        const res = await inventoryService.update(item.id, {
          status: item.status === 'available' ? 'unavailable' : 'available',
        });
        setData((current) => ({
          ...current,
          community_owned: current.community_owned.map((i) => (i.id === item.id ? res.data : i)),
        }));
      }
    } catch {
      setError('Could not save your change. Please try again.');
    } finally {
      setBusy(null);
    }
  }
  if (loading) return <p role="status">Loading shared things…</p>;
  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="card p-4">
          <p>{error}</p>
          <button className="btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Community-owned things</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setEditing(null)}>
            Add community item
          </button>
        )}
      </div>
      {isAdmin && editing !== undefined && (
        <InventoryItemForm
          key={editing?.id ?? 'new'}
          item={editing ?? undefined}
          onSave={save}
          onCancel={() => setEditing(undefined)}
        />
      )}
      {!error && data.community_owned.length === 0 && (
        <p className="text-text-muted">No community-owned things yet.</p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {data.community_owned.map((item) => (
          <InventoryItemCard key={item.id} item={item} communityId={communityId}>
            {isAdmin && (
              <div className="flex flex-wrap gap-3 text-sm">
                <button onClick={() => setEditing(item)}>Edit {item.name}</button>
                <button disabled={busy === item.id} onClick={() => void change(item)}>
                  {item.status === 'available' ? 'Mark unavailable' : 'Mark available'}
                </button>
                {confirmDelete === item.id ? (
                  <>
                    <button disabled={busy === item.id} onClick={() => void change(item, true)}>
                      Confirm delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)}>Keep item</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(item.id)}>Delete {item.name}</button>
                )}
              </div>
            )}
          </InventoryItemCard>
        ))}
      </div>
      <h2 className="text-xl font-semibold">Shared by members</h2>
      {!error && data.shared_by_members.length === 0 && (
        <p className="text-text-muted">
          No members have shared things here yet. Add yours in My things.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {data.shared_by_members.map((item) => (
          <InventoryItemCard key={item.id} item={item} communityId={communityId} />
        ))}
      </div>
    </div>
  );
}
