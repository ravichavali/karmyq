import type { InventoryItem } from '@/lib/api';
export default function InventoryItemCard({
  item,
  children,
}: {
  item: InventoryItem;
  children?: React.ReactNode;
}) {
  return (
    <article className="card p-5 space-y-3">
      <div className="flex justify-between gap-3">
        <h3 className="font-semibold text-lg">{item.name}</h3>
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
    </article>
  );
}
