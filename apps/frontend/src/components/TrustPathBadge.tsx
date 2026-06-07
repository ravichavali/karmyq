import React from 'react';
import type { DecayTier } from '@karmyq/shared/trust/decayTier';

// Sprint 90 / ADR-070 — the shared relationship face fades by decayTier. Human-readable labels are
// shown on hover so the fade is legible, not mysterious.
const DECAY_TIER_LABEL: Record<DecayTier, string> = {
  strong: 'Strong bond',
  warm: 'Warm bond',
  fading: 'This bond is fading',
  nearly_forgotten: 'Nearly forgotten — reconnect to keep it',
  swept: 'Faded away',
};

/** Build the fade className + hover label for a decayTier (no-op when undefined or strong). */
export function decayPresentation(decayTier?: DecayTier): { className: string; title?: string } {
  if (!decayTier || decayTier === 'strong') return { className: '' };
  return { className: ` kq-decay kq-decay-${decayTier}`, title: DECAY_TIER_LABEL[decayTier] };
}

export interface TrustPath {
  degrees_of_separation: number | null;
  path?: Array<{
    id: string;
    name: string;
    karma?: number;
    exchanged_at?: string;
    invited_at?: string;
  }>;
  trust_score?: number;
  cached?: boolean;
  connection_type?: 'exchange' | 'community_member' | 'invitation_chain';
  community_name?: string;
}

interface TrustPathBadgeProps {
  trustPath: TrustPath | null;
  compact?: boolean; // Show condensed version for smaller spaces
  className?: string;
  presentation?: 'default' | 'feed';
  decayTier?: DecayTier; // Sprint 90: fade the badge by how quiet the bond has gone
}

export default function TrustPathBadge({ trustPath, compact = false, className = '', presentation = 'default', decayTier }: TrustPathBadgeProps) {
  if (!trustPath || trustPath.degrees_of_separation === null || !trustPath.path) {
    return null; // No connection found
  }

  const { degrees_of_separation, path, trust_score, connection_type = 'exchange', community_name } = trustPath;

  // Don't show badge for 4+ degree connections
  if (degrees_of_separation > 3) {
    return null;
  }

  const isCommunityMember = connection_type === 'community_member';
  const isInvitationChain = connection_type === 'invitation_chain';

  // Badge colors by connection type and degree
  const getBadgeColor = () => {
    if (isCommunityMember) return 'bg-accent-light text-accent-dark border-accent';
    if (isInvitationChain) return 'bg-yellow-50 text-yellow-800 border-yellow-300';
    // Exchange colors by degree
    const colors: Record<number, string> = {
      1: 'bg-success-light text-success border-success',
      2: 'bg-primary-light text-primary-dark border-primary-medium',
      3: 'bg-surface text-text-muted border-border',
    };
    return colors[degrees_of_separation] || 'bg-border-light text-text border-border';
  };

  const badgeColor = getBadgeColor();
  const decay = decayPresentation(decayTier);

  // Get icon based on connection type
  const getIcon = () => {
    if (isCommunityMember) return '🏘';
    if (isInvitationChain) return '🤝';
    if (degrees_of_separation === 1) return '🔗';
    if (degrees_of_separation === 2) return '🤝';
    return '👥';
  };

  // Get connection text based on type and degree
  const getConnectionText = () => {
    if (isCommunityMember) {
      const adminName = path.length >= 2 ? path[1]?.name : null;
      if (adminName && degrees_of_separation === 2) {
        return `Fellow member via ${adminName}`;
      }
      return community_name ? `Member of ${community_name}` : 'Fellow community member';
    }

    if (isInvitationChain) {
      const inviterName = path.length >= 2 ? path[1]?.name : null;
      return inviterName ? `Joined through ${inviterName}` : 'Connected via invitation';
    }

    // Exchange paths
    if (degrees_of_separation === 1) {
      return 'Direct connection';
    } else if (degrees_of_separation === 2 && path.length >= 2) {
      return `Connected through ${path[1].name}`;
    } else if (degrees_of_separation === 3 && path.length >= 3) {
      return `Connected through ${path[1].name} → ${path[2].name}`;
    }
    return `${degrees_of_separation}° connection`;
  };

  const getFeedConnectionText = () => {
    if (isCommunityMember) {
      const adminName = path.length >= 2 ? path[1]?.name : null;
      if (adminName && degrees_of_separation === 2) return `via ${adminName}`;
      return community_name ? `in ${community_name}` : 'fellow member';
    }

    if (isInvitationChain) {
      const inviterName = path.length >= 2 ? path[1]?.name : null;
      return inviterName ? `through ${inviterName}` : 'invited connection';
    }

    if (degrees_of_separation === 1) return 'direct connection';
    if (degrees_of_separation === 2 && path.length >= 2) return `via ${path[1].name}`;
    if (degrees_of_separation === 3 && path.length >= 3) return `via ${path[1].name} + ${path[2].name}`;
    return `${degrees_of_separation}° connection`;
  };

  const getFeedAvatarLabel = () => {
    if (degrees_of_separation === 1) return path[path.length - 1]?.name ?? 'Connection';
    return path[1]?.name ?? path[path.length - 1]?.name ?? 'Connection';
  };

  // Trust score stars (out of 5)
  const renderTrustStars = (score: number) => {
    const stars = Math.min(5, Math.floor((score / 100) * 5));
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className={`w-3 h-3 ${i < stars ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  // Full border color for left-border decoration
  const getBorderColor = () => {
    if (isCommunityMember) return 'border-accent bg-accent-light';
    if (isInvitationChain) return 'border-yellow-400 bg-yellow-50';
    if (degrees_of_separation === 1) return 'border-karmyq-green-400 bg-success-light';
    if (degrees_of_separation === 2) return 'border-primary bg-primary-light';
    return 'border-karmyq-brown-400 bg-surface';
  };

  // Compact view: Just show the connection text
  if (compact) {
    if (presentation === 'feed') {
      const avatarLabel = getFeedAvatarLabel();
      return (
        <span className={`kq-path-badge ${className}${decay.className}`} aria-label={getConnectionText()} title={decay.title}>
          <span className="kq-path-avatar" aria-hidden="true">{avatarLabel.charAt(0).toUpperCase()}</span>
          {getFeedConnectionText()}
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium ${badgeColor} ${className}${decay.className}`} title={decay.title}>
        <span aria-hidden="true">{getIcon()}</span>
        {getConnectionText()}
      </span>
    );
  }

  // Full view: Show path and details
  return (
    <div className={`border-l-4 ${getBorderColor()} rounded-md p-3 ${className}${decay.className}`} title={decay.title}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">{getIcon()}</span>
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-md border ${badgeColor}`}>
            {getConnectionText()}
          </span>
          {isCommunityMember && community_name && (
            <span className="text-xs text-text-subtle">in {community_name}</span>
          )}
        </div>
        {trust_score !== undefined && trust_score > 0 && (
          <div className="flex items-center">
            {renderTrustStars(trust_score)}
            <span className="ml-1 text-xs text-text-muted">{trust_score}</span>
          </div>
        )}
      </div>

      {/* Connection Path */}
      <div className="flex items-center text-sm text-text-muted">
        {path.map((node, index) => (
          <React.Fragment key={node.id}>
            {index === 0 ? (
              <span className="font-semibold text-primary-dark">You</span>
            ) : (
              <span className="font-medium">{node.name}</span>
            )}

            {index < path.length - 1 && (
              <svg className="w-4 h-4 mx-1.5 text-text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Exchange timestamp (for exchange-based paths) */}
      {!isCommunityMember && !isInvitationChain && path.length > 1 && path[1].exchanged_at && (
        <div className="mt-2 text-xs text-text-subtle">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Exchanged {new Date(path[1].exchanged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for TrustPathBadge
 */
export function TrustPathBadgeSkeleton({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="h-5 w-24 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className={`border-l-4 border-border bg-surface rounded-md p-3 animate-pulse ${className}`}>
      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-48 bg-gray-200 rounded"></div>
    </div>
  );
}
