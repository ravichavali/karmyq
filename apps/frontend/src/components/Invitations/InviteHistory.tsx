import React, { useEffect, useState } from 'react';
import { socialGraphService } from '../../lib/api';

interface Invitee {
  id: string;
  name: string;
  karma: number;
}

interface SentInvitation {
  id: string;
  invitation_code: string;
  invited_at: string;
  accepted_at: string | null;
  invitee: Invitee | null;
}

interface Inviter {
  id: string;
  name: string;
}

interface ReceivedInvitation {
  id: string;
  invitation_code: string;
  invited_at: string;
  accepted_at: string;
  inviter: Inviter;
}

interface InvitationHistory {
  sent: SentInvitation[];
  received: ReceivedInvitation | null;
}

export default function InviteHistory() {
  const [history, setHistory] = useState<InvitationHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await socialGraphService.getInvitations();
      setHistory(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load invitation history');
      console.error('Error fetching invitation history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  const acceptedInvites = history?.sent.filter(inv => inv.accepted_at) || [];
  const pendingInvites = history?.sent.filter(inv => !inv.accepted_at) || [];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Invitation History</h3>

      {/* Received Invitation */}
      {history?.received && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Invited By</h4>
          <div className="border border-green-200 bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{history.received.inviter.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Joined {new Date(history.received.accepted_at).toLocaleDateString()}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Your Inviter
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Accepted Invitations */}
      {acceptedInvites.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            People You Invited ({acceptedInvites.length})
          </h4>
          <div className="space-y-2">
            {acceptedInvites.map((invitation) => (
              <div
                key={invitation.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{invitation.invitee?.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-500">
                        Joined {new Date(invitation.accepted_at!).toLocaleDateString()}
                      </p>
                      {invitation.invitee && invitation.invitee.karma > 0 && (
                        <span className="inline-flex items-center text-xs text-amber-700">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {invitation.invitee.karma} karma
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Accepted
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Pending Invitations ({pendingInvites.length})
          </h4>
          <div className="space-y-2">
            {pendingInvites.map((invitation) => (
              <div
                key={invitation.id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <code className="text-sm font-mono text-gray-700">
                      {invitation.invitation_code}
                    </code>
                    <p className="text-xs text-gray-500 mt-1">
                      Created {new Date(invitation.invited_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {acceptedInvites.length === 0 && pendingInvites.length === 0 && !history?.received && (
        <div className="text-center py-8">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-500 text-sm">No invitations yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Generate an invitation code to invite someone to join
          </p>
        </div>
      )}
    </div>
  );
}
