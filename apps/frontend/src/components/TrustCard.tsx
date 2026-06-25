import { useEffect, useState } from 'react';
import { socialGraphApi } from '@/lib/api';

interface TrustPathNode {
  id: string;
  name: string;
  exchanged_at?: string;
  invited_at?: string;
}

// Sprint 112 (ADR-082): the trust card shows authorized identity + connection structure only —
// another member's karma and karma-derived trust tier are no longer disclosed.
interface TrustCardData {
  targetUser: { id: string; name: string };
  trustPath: TrustPathNode[];
  invitationPath: TrustPathNode[] | null;
  degrees: number | null;
  path_type: string | null;
}

const pathTypeLabel: Record<string, string> = {
  exchange: 'Connected through shared exchanges',
  community: 'Connected through community membership',
  invitation_chain: 'Connected through invitation chain',
};

export function TrustCard({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<TrustCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socialGraphApi.get(`/trust-card/${userId}`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-16 bg-gray-100 rounded" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg text-gray-900">{data.targetUser.name}</h2>
                {data.degrees != null && (
                  <span className="text-xs text-gray-500">
                    {data.degrees === 1 ? 'Directly connected' : `${data.degrees} degrees away`}
                  </span>
                )}
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {data.trustPath.length > 1 ? (
              <div className="mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Connection path</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {data.trustPath.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-1">
                      <span className="flex flex-col items-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                          {node.name.charAt(0)}
                        </span>
                        <span className="text-xs text-gray-600 max-w-[60px] truncate text-center">{node.name}</span>
                      </span>
                      {i < data.trustPath.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  ))}
                </div>
                {data.path_type && (
                  <p className="text-xs text-gray-400 mt-2">{pathTypeLabel[data.path_type] ?? data.path_type}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No direct connection found — you may be meeting someone new.</p>
            )}

            {data.invitationPath && data.invitationPath.length > 1 &&
              JSON.stringify(data.invitationPath) !== JSON.stringify(data.trustPath) && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Invitation chain</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {data.invitationPath.map((node, i) => (
                    <span key={node.id} className="flex items-center gap-1">
                      <span className="text-xs text-gray-600">{node.name}</span>
                      {i < data.invitationPath!.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">Could not load trust information.</p>
        )}
      </div>
    </div>
  );
}
