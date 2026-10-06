import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { inventoryService, type InventoryItem } from '@/lib/api';
import InventoryItemCard from '@/components/inventory/InventoryItemCard';
import AskToBorrow from '@/components/inventory/AskToBorrow';

export default function InventoryItemPage() {
  const { query } = useRouter();
  const id = typeof query.id === 'string' ? query.id : undefined;
  return <ItemView key={id} id={id} />;
}
function ItemView({ id }: { id?: string }) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (id) inventoryService.getVisible(id).then(res => { if (active) setItem(res.data); })
      .catch(() => { if (active) setError('This item is unavailable or could not be loaded.'); });
    return () => { active = false; };
  }, [id]);
  return <div className="kq-page py-8 space-y-4">
    <Link href="/inventory">My things</Link>
    {error ? <p role="alert">{error}</p> : item ? <InventoryItemCard item={item}><AskToBorrow item={item} /></InventoryItemCard> : <p role="status">Loading item…</p>}
  </div>;
}
