import React from 'react';
import CollectiveCard from './CollectiveCard';

interface CollectiveStats {
  total_requests_matched: number;
  fulfillment_rate: number;
  avg_completion_hours: number | null;
  communities_served_count: number;
  available_member_count: number;
}

interface CollectiveCardRichProps {
  collective: {
    id: string;
    name: string;
    description?: string;
    service_types: string[];
    location_notes?: string;
    member_count?: number;
    avg_trust_score?: number;
  };
  stats?: CollectiveStats | null;
}

export default function CollectiveCardRich({ collective, stats }: CollectiveCardRichProps) {
  return (
    <div className="flex flex-col">
      <CollectiveCard collective={collective} />
      {stats && (
        <div className="flex gap-4 mt-2 px-1">
          <span className="text-xs text-text-muted">
            <span className="font-medium text-text">{stats.fulfillment_rate}%</span> fulfilled
          </span>
          <span className="text-xs text-text-muted">
            <span className="font-medium text-text">{stats.available_member_count}</span> available now
          </span>
          <span className="text-xs text-text-muted">
            <span className="font-medium text-text">{stats.total_requests_matched}</span> matched
          </span>
        </div>
      )}
    </div>
  );
}
