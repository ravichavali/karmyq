import type { InventoryItem } from '@/lib/api';
import Link from 'next/link';
import AskToBorrow from './AskToBorrow';
export default function InventoryItemCard({
  item,
  children,
  communityId,
}: {
  item: InventoryItem;
  children?: React.ReactNode;
  communityId?: string;
}) {
  return (
    <article className="card p-5 space-y-3">
      <div className="flex justify-between gap-3">
        <h3 className="font-semibold text-lg"><Link href={`/inventory/${item.id}`}>{item.name}</Link></h3>
        <span className="text-sm text-text-muted">
          {item.status === 'available' ? 'Available' : 'Unavailable'}
        </span>
      </div>
      {item.description && (
        <p className="text-text-muted whitespace-pre-wrap">{item.description}</p>
      )}
      <p className="text-sm text-text-muted">
        {item.category}
        {item.condition ? ` · ${item.condition.replace(/_/g, ' ')}` : ''}
      </p>
      {item.owner && <p className="text-sm">Shared by {item.owner.name}</p>}
      {children}
      {communityId && <AskToBorrow key={item.id} item={item} communityId={communityId} />}
    </article>
  );
}
