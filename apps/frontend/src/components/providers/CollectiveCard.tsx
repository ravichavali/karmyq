import React from 'react';
import Link from 'next/link';
import TrustScoreBadge from './TrustScoreBadge';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
};

interface CollectiveCardProps {
  collective: {
    id: string;
    name: string;
    description?: string;
    service_types: string[];
    location_notes?: string;
    member_count?: number;
    avg_trust_score?: number;
  };
}

export default function CollectiveCard({ collective }: CollectiveCardProps) {
  return (
    <Link href={`/providers/collectives/${collective.id}`}>
      <div className="bg-surface-raised rounded-lg shadow-sm border border-border p-4 hover:shadow-md transition cursor-pointer h-full flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-karmyq-teal-500 to-karmyq-green-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {collective.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text truncate">{collective.name}</p>
              <p className="text-xs text-text-subtle">{collective.member_count ?? 0} provider{(collective.member_count ?? 0) !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <TrustScoreBadge score={collective.avg_trust_score} size="sm" />
        </div>

        {collective.description && (
          <p className="text-sm text-text-muted line-clamp-2">{collective.description}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {collective.service_types.map(type => (
            <span key={type} className="text-xs bg-primary-light text-primary rounded-full px-2 py-0.5">
              {SERVICE_TYPE_LABELS[type] ?? type}
            </span>
          ))}
          {collective.location_notes && (
            <span className="text-xs text-text-subtle">{collective.location_notes}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
