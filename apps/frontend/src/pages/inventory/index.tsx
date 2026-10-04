import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import InventoryItemForm from '@/components/inventory/InventoryItemForm';
import InventoryItemCard from '@/components/inventory/InventoryItemCard';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { useOnboarding } from '@/hooks/useOnboarding';
import { WORKFLOWS } from '@/lib/onboarding/workflows';
import {
  inventoryService,
  communityService,
  type InventoryItem,
  type InventoryItemInput,
} from '@/lib/api';

export default function InventoryPage() {
  const router = useRouter();
  const { shouldShow, markSeen } = useOnboarding('inventory');
  const shareLookup = useRef(0);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null | undefined>(undefined);
  const [sharing, setSharing] = useState<InventoryItem | null>(null);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [shareReady, setShareReady] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inventoryService.listMine();
      setItems(res.data.items);
    } catch {
      setError('Could not load your things. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login');
      return;
    }
    void load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(input: InventoryItemInput) {
    const res = editing
      ? await inventoryService.update(editing.id, input)
      : await inventoryService.create(input);
    setItems((current) =>
      editing ? current.map((i) => (i.id === editing.id ? res.data : i)) : [res.data, ...current]
    );
    setEditing(undefined);
  }
  async function openSharing(item: InventoryItem) {
    const generation = ++shareLookup.current;
    setSharing(item);
    setSelected(item.shared_with.map((c) => c.id));
    setShareReady(false);
    setError(null);
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? 'null');
      if (!user?.id) throw new Error('Missing current user');
      const res = await communityService.getMyCommunities(user.id);
      if (generation !== shareLookup.current) return;
      setCommunities(res.data.communities);
      setShareReady(true);
    } catch {
      if (generation !== shareLookup.current) return;
      setError('Could not load your communities. Close sharing and try again.');
    }
  }
  async function change(action: () => Promise<void>, id: string) {
    setBusy(id);
    setError(null);
    try {
      await action();
    } catch {
      setError('Could not save your change. Please try again.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <Layout>
      {shouldShow && <OnboardingOverlay workflow={WORKFLOWS.inventory} onDismiss={markSeen} />}
      <Head>
        <title>My things · Karmyq</title>
      </Head>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">My things</h1>
            <p className="text-text-muted mt-2">
              Keep track of things you can share with your communities.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setSharing(null);
            }}
          >
            Add item
          </button>
        </div>
        {error && (
          <div role="alert" className="card p-4 text-error">
            <p>{error}</p>
            <button className="btn-secondary mt-3" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}
        {editing !== undefined && (
          <InventoryItemForm
            key={editing?.id ?? 'new'}
            item={editing ?? undefined}
            onSave={save}
            onCancel={() => setEditing(undefined)}
          />
        )}
        {loading ? (
          <p role="status">Loading your things…</p>
        ) : !error && items.length === 0 ? (
          <div className="card p-8">
            <h2 className="text-xl font-semibold">What could you share?</h2>
            <p className="text-text-muted mt-2">
              Add a ladder, a book, or a camping kit. Your things are private until you share them
              with a community.
            </p>
          </div>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <InventoryItemCard key={item.id} item={item}>
              <p className="text-sm text-text-muted">
                {item.shared_with.length
                  ? `Shared with ${item.shared_with.map((c) => c.name).join(', ')}`
                  : 'Private — only you can see this'}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  onClick={() => {
                    setEditing(item);
                    setSharing(null);
                  }}
                >
                  Edit {item.name}
                </button>
                <button disabled={busy!==null} onClick={() => void openSharing(item)}>Share {item.name}</button>
                <button
                  disabled={busy === item.id}
                  onClick={() =>
                    void change(async () => {
                      const res = await inventoryService.update(item.id, {
                        status: item.status === 'available' ? 'unavailable' : 'available',
                      });
                      setItems((current) => current.map((i) => (i.id === item.id ? res.data : i)));
                    }, item.id)
                  }
                >
                  {item.status === 'available' ? 'Mark unavailable' : 'Mark available'}
                </button>
                <button onClick={() => setConfirmDelete(item.id)}>Delete {item.name}</button>
              </div>
              {confirmDelete === item.id && (
                <div className="space-x-3">
                  <span>Remove this item?</span>
                  <button
                    disabled={busy === item.id}
                    onClick={() =>
                      void change(async () => {
                        await inventoryService.remove(item.id);
                        setItems((current) => current.filter((i) => i.id !== item.id));
                        setConfirmDelete(null);
                        if (sharing?.id === item.id) setSharing(null);
                      }, item.id)
                    }
                  >
                    Confirm delete
                  </button>
                  <button onClick={() => setConfirmDelete(null)}>Keep item</button>
                </div>
              )}
            </InventoryItemCard>
          ))}
        </div>
        {sharing && (
          <section
            className="card p-5 space-y-3"
            aria-label={`Share ${sharing.name} with communities`}
          >
            <h2 className="text-xl font-semibold">Share {sharing.name} with…</h2>
            <p className="text-sm text-text-muted">
              Uncheck every community to make it private. Unavailable things are hidden from other
              members.
            </p>
            {!shareReady ? (
              <p>Loading communities…</p>
            ) : (
              <>
                {communities.length === 0 && <p>Join a community to share your things.</p>}
                {communities.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked
                            ? [...current, c.id]
                            : current.filter((id) => id !== c.id)
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
                {sharing.shared_with
                  .filter((c) => !communities.some((active) => active.id === c.id))
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={() =>
                          setSelected((current) => current.filter((id) => id !== c.id))
                        }
                      />
                      {c.name} (membership inactive; uncheck to remove)
                    </label>
                  ))}
              </>
            )}
            <div className="flex gap-3">
              <button
                className="btn-primary"
                disabled={!shareReady || busy === sharing.id}
                onClick={() =>
                  void change(async () => {
                    const res = await inventoryService.replaceShares(sharing.id, selected);
                    setItems((current) =>
                      current.map((i) =>
                        i.id === sharing.id ? { ...i, shared_with: res.data.shared_with } : i
                      )
                    );
                    setSharing(null);
                  }, sharing.id)
                }
              >
                Save sharing
              </button>
              <button className="btn-secondary" disabled={busy!==null} onClick={() => {shareLookup.current++;setSharing(null);}}>
                Close sharing
              </button>
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
}
