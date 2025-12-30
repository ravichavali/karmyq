import React from 'react';
import TrustPathBadge, { TrustPathBadgeSkeleton } from './TrustPathBadge';
import { useTrustPath } from '../hooks/useTrustPath';
import InlineChat from './InlineChat';

interface Match {
  id: string;
  request_id: string;
  responder_id: string;
  responder_name?: string;
  status: string;
  created_at: string;
}

interface OfferItemProps {
  comment: Match;
  isMyPost: boolean;
  currentUserId: string;
  onAccept: (matchId: string) => void;
  onReject: (matchId: string) => void;
  onComplete: (matchId: string) => void;
  formatTime: (date: string) => string;
}

export default function OfferItem({
  comment,
  isMyPost,
  currentUserId,
  onAccept,
  onReject,
  onComplete,
  formatTime,
}: OfferItemProps) {
  // Get trust path to the responder
  const { trustPath: offerTrustPath, loading: loadingOfferPath } = useTrustPath(comment.responder_id);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {comment.responder_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{comment.responder_name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">offered {formatTime(comment.created_at)}</p>
          </div>
        </div>

        {/* Action buttons for poster */}
        {isMyPost && comment.status === 'proposed' && (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(comment.id)}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Accept
            </button>
            <button
              onClick={() => onReject(comment.id)}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Decline
            </button>
          </div>
        )}

        {/* Status badges */}
        {comment.status === 'matched' && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">
              ✓ Accepted
            </span>
            <button
              onClick={() => onComplete(comment.id)}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Mark Complete
            </button>
          </div>
        )}

        {comment.status === 'completed' && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-medium">
            ✓ Completed
          </span>
        )}
      </div>

      {/* Trust Path Badge */}
      {loadingOfferPath && <TrustPathBadgeSkeleton compact className="mb-3" />}
      {!loadingOfferPath && offerTrustPath && <TrustPathBadge trustPath={offerTrustPath} compact className="mb-3" />}

      {/* Inline Chat */}
      {(comment.status === 'proposed' || comment.status === 'matched') && (
        <InlineChat
          matchId={comment.id}
          currentUserId={currentUserId}
          isRequester={isMyPost}
          matchStatus={comment.status}
          otherParticipantName={comment.responder_name || 'Unknown'}
        />
      )}
    </div>
  );
}
