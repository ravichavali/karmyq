import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/router';
import { inventoryService, type InventoryItem } from '@/lib/api';

export default function AskToBorrow({ item, communityId }: { item: InventoryItem; communityId?: string }) {
  const router = useRouter();
  const id = useId();
  const [viewer, setViewer] = useState('');
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(1);
  const [note, setNote] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const choices = item.owner_community_id ? [{ id: item.owner_community_id, name: item.owner?.name ?? 'Owning community' }] : item.shared_with;
  const [chosen, setChosen] = useState(communityId ?? choices[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try { setViewer(JSON.parse(localStorage.getItem('user') ?? '{}').id ?? ''); } catch { setViewer(''); }
  }, []);
  useEffect(() => {
    const next = communityId ? (choices.some(c => c.id === communityId) ? communityId : '')
      : choices.some(c => c.id === chosen) ? chosen : choices[0]?.id ?? '';
    if (next !== chosen) setChosen(next);
  }, [communityId, choices, chosen]);
  if (!viewer || item.owner_user_id === viewer || item.status !== 'available' || !chosen) return null;
  async function send(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const res = await inventoryService.askToBorrow(item.id, {
        community_id: chosen, duration_days: duration,
        ...(note.trim() ? { description: note.trim() } : {}),
        ...(returnDate ? { return_date: new Date(`${returnDate}T00:00:00Z`).toISOString() } : {}),
      });
      await router.push(`/requests/${res.data.id}`);
    } catch (error: any) {
      setError(error.response?.status === 404
        ? `Sharing access changed. Refresh this item${choices.length > 1 ? ' or choose another community' : ''}.`
        : 'Could not send your private ask. Please try again.');
    }
    finally { setBusy(false); }
  }
  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>Ask to borrow</button>;
  return <form onSubmit={send} className="space-y-3">
    <p className="text-sm text-text-muted">Only you and {item.owner_user_id ? item.owner?.name ?? 'the owner' : 'the owning community’s admins'} can see this ask.</p>
    {!communityId && choices.length > 1 && <div>
      <label htmlFor={`${id}-community`}>Community</label>
      <select id={`${id}-community`} value={chosen} disabled={busy} onChange={e => setChosen(e.target.value)}>
        {choices.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>}
    <div><label htmlFor={`${id}-duration`}>Duration (days)</label>
      <input id={`${id}-duration`} type="number" min={1} max={30} required value={duration} disabled={busy} onChange={e => setDuration(Number(e.target.value))} /></div>
    <div><label htmlFor={`${id}-return`}>Return date (optional)</label>
      <input id={`${id}-return`} type="date" value={returnDate} disabled={busy} onChange={e => setReturnDate(e.target.value)} /></div>
    <div><label htmlFor={`${id}-note`}>Note (optional)</label>
      <textarea id={`${id}-note`} maxLength={2000} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></div>
    {error && <p role="alert">{error}</p>}
    <div className="flex gap-3"><button className="btn-primary" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send private ask'}</button>
      <button className="btn-secondary" disabled={busy} type="button" onClick={() => setOpen(false)}>Cancel</button></div>
  </form>;
}
