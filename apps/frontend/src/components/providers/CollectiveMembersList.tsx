import React from 'react';
import TrustScoreBadge from './TrustScoreBadge';
import { collectiveService, providerService } from '../../lib/api';

interface Member {
  collective_id: string;
  provider_id: string;
  role: 'member' | 'admin';
  joined_at: string;
  display_name?: string;
  service_type?: string;
  bio?: string;
  is_available?: boolean;
  trust_score?: number;
  avg_stars?: number;
}

interface CollectiveMembersListProps {
  collectiveId: string;
  members: Member[];
  currentUserId?: string;
  currentUserProviderId?: string;
  isCollectiveAdmin?: boolean;
  onMembershipChanged?: () => void;
  onAvailabilityChanged?: () => void;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
};

export default function CollectiveMembersList({
  collectiveId,
  members,
  currentUserProviderId,
  isCollectiveAdmin,
  onMembershipChanged,
  onAvailabilityChanged,
}: CollectiveMembersListProps) {
  const isMember = members.some(m => m.provider_id === currentUserProviderId);

  async function handleJoin() {
    try {
      await collectiveService.joinCollective(collectiveId);
      onMembershipChanged?.();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to join');
    }
  }

  async function handleLeave() {
    if (!currentUserProviderId) return;
    try {
      await collectiveService.leaveCollective(collectiveId, currentUserProviderId);
      onMembershipChanged?.();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to leave');
    }
  }

  async function handleRemove(providerId: string) {
    try {
      await collectiveService.leaveCollective(collectiveId, providerId);
      onMembershipChanged?.();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to remove member');
    }
  }

  async function handleToggleAvailability(member: Member) {
    try {
      await providerService.updateAvailability(member.provider_id, !member.is_available);
      onAvailabilityChanged?.();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to update availability');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">Members ({members.length})</h3>
        {currentUserProviderId && !isMember && (
          <button
            onClick={handleJoin}
            className="text-sm bg-primary text-white rounded-lg px-3 py-1.5 hover:bg-primary-dark transition"
          >
            Join collective
          </button>
        )}
        {currentUserProviderId && isMember && (
          <button
            onClick={handleLeave}
            className="text-sm text-text-muted border border-border rounded-lg px-3 py-1.5 hover:bg-surface-raised transition"
          >
            Leave
          </button>
        )}
      </div>

      {members.length === 0 && (
        <p className="text-sm text-text-muted">No members yet.</p>
      )}

      <div className="space-y-2">
        {members.map(member => {
          const isOwnRow = currentUserProviderId != null && member.provider_id === currentUserProviderId;
          return (
            <div key={member.provider_id} className="bg-surface-raised rounded-lg border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 bg-gradient-to-br from-karmyq-green-500 to-karmyq-teal-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {(member.display_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    {member.is_available && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-surface-raised" title="Available" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{member.display_name ?? 'Provider'}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {member.service_type && (
                        <span className="text-xs text-text-subtle">{SERVICE_TYPE_LABELS[member.service_type] ?? member.service_type}</span>
                      )}
                      {member.role === 'admin' && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-1.5 py-0.5">admin</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrustScoreBadge score={member.trust_score} size="sm" />
                  {isOwnRow && (
                    <button
                      onClick={() => handleToggleAvailability(member)}
                      className={`text-xs rounded-full px-2 py-0.5 border transition ${
                        member.is_available
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'text-text-muted border-border hover:bg-surface'
                      }`}
                    >
                      {member.is_available ? 'Available' : 'Mark available'}
                    </button>
                  )}
                  {isCollectiveAdmin && !isOwnRow && member.provider_id !== undefined && (
                    <button
                      onClick={() => handleRemove(member.provider_id)}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {member.bio && (
                <p className="mt-1.5 text-xs text-text-muted line-clamp-2 ml-9">{member.bio}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
