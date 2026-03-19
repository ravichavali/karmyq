// apps/frontend/src/pages/reputation/evolution.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { reputationService } from '../../lib/api';

const PARAMETER_LABELS: Record<string, string> = {
  cross_community_prior: 'Cross-Community Trust',
  depth_weight:          'Depth of Relationships',
  breadth_weight:        'Breadth of Connections',
};

const SIGNAL_LABELS: Record<string, string> = {
  cross_community_positive_feedback: 'You received positive feedback from a cross-community exchange',
  cross_community_negative_feedback: 'You received difficult feedback from a cross-community exchange',
  cross_community_match_completed:   'You completed a cross-community exchange',
  repeat_interaction_same_person:    'You\'ve exchanged with the same person 3+ times',
  diverse_community_interactions:    'You helped people across 3+ communities this month',
};

export default function TrustEvolutionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const communityId = router.query.communityId as string;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token) {
      router.push('/login');
      return;
    }

    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
  }, [router]);

  useEffect(() => {
    if (!user?.id || !communityId) return;
    reputationService.getTrustEvolutionHistory(user.id, communityId, { limit: 50 })
      .then((res: any) => setHistory(res.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [user?.id, communityId]);

  if (!communityId) return <div className="p-6">No community selected.</div>;
  if (loading) return <div className="p-6">Loading your trust journey…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">My Trust Journey</h1>
      <p className="text-gray-500 text-sm mb-6">
        How your trust model has calibrated based on experience.
        Each event reflects something real — in either direction.
      </p>

      {history.length === 0 ? (
        <div className="text-gray-400 text-sm border rounded-lg p-8 text-center">
          No evolution events yet.
          Turn on evolution and start making connections.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div key={entry.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">
                    {PARAMETER_LABELS[entry.parameter] ?? entry.parameter}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {SIGNAL_LABELS[entry.trigger_signal] ?? entry.trigger_signal}
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <span className="text-sm font-mono">
                    {entry.old_value ?? '—'} → {entry.new_value}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <a href="/reputation/trust" className="text-sm text-blue-600 hover:underline">
          ← Back to trust overview
        </a>
      </div>
    </div>
  );
}
