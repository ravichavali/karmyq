import React from 'react';
import Link from 'next/link';
import TrustScoreBadge from './TrustScoreBadge';

interface ProviderCardProps {
  provider: {
    id: string;
    display_name: string;
    service_type: string;
    bio?: string;
    pricing_notes?: string;
    location_notes?: string;
    avg_stars?: number | string;
    total_reviews?: number;
    trust_score?: number | string;
  };
}

function renderStars(avg: number | string | undefined) {
  const n = Number(avg);
  if (!avg || !n) return null;
  const full = Math.round(n);
  return (
    <span className="text-yellow-500 text-sm">
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      <span className="text-text-muted ml-1 font-normal">{n.toFixed(1)}</span>
    </span>
  );
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
};

export default function ProviderCard({ provider }: ProviderCardProps) {
  return (
    <Link href={`/providers/${provider.id}`}>
      <div className="bg-surface-raised rounded-lg shadow-sm border border-border p-4 hover:shadow-md transition cursor-pointer h-full flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-karmyq-green-500 to-karmyq-teal-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {provider.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text truncate">{provider.display_name}</p>
              <span className="inline-block text-xs bg-primary-light text-primary rounded-full px-2 py-0.5 mt-0.5">
                {SERVICE_TYPE_LABELS[provider.service_type] ?? provider.service_type}
              </span>
            </div>
          </div>
          <TrustScoreBadge score={provider.trust_score != null ? Number(provider.trust_score) : undefined} size="sm" />
        </div>

        {provider.bio && (
          <p className="text-sm text-text-muted line-clamp-2">{provider.bio}</p>
        )}

        <div className="mt-auto flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            {renderStars(provider.avg_stars)}
            {provider.total_reviews !== undefined && provider.total_reviews > 0 && (
              <span className="text-xs text-text-subtle">({provider.total_reviews})</span>
            )}
          </div>
          {provider.pricing_notes && (
            <span className="text-xs text-text-subtle truncate max-w-[140px]">{provider.pricing_notes}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
