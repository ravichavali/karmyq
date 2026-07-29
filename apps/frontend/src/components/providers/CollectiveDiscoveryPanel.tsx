import React, { useEffect, useState } from 'react';
import { collectiveService } from '../../lib/api';
import CollectiveCardRich from './CollectiveCardRich';

interface CollectiveDiscoveryPanelProps {
  communityId: string;
  onLinked: () => void;
}

export default function CollectiveDiscoveryPanel({ communityId, onLinked }: CollectiveDiscoveryPanelProps) {
  const [collectives, setCollectives] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const response = await collectiveService.discoverCollectives({ unlinked_from: communityId });
        setCollectives(response.data.data ?? response.data ?? []);
      } catch {}
      finally { setLoading(false); }
    }
    fetch();
  }, [communityId]);

  const filtered = search
    ? collectives.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : collectives;

  async function handleLink(collectiveId: string) {
    setLinking(collectiveId);
    try {
      await collectiveService.linkCommunity(collectiveId, communityId);
      setCollectives(prev => prev.filter(c => c.id !== collectiveId));
      onLinked();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to link collective');
    } finally {
      setLinking(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted py-3">Loading collectives...</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search collectives by name..."
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
      />
      {filtered.length === 0 && (
        <p className="text-sm text-text-muted">
          {search ? 'No collectives match your search.' : 'No other collectives available to link.'}
        </p>
      )}
      <div className="space-y-2">
        {filtered.map(collective => (
          <div key={collective.id} className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <CollectiveCardRich collective={collective} />
            </div>
            <button
              onClick={() => handleLink(collective.id)}
              disabled={linking === collective.id}
              className="flex-shrink-0 mt-1 text-sm bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark transition disabled:opacity-50"
            >
              {linking === collective.id ? 'Linking...' : 'Link'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
