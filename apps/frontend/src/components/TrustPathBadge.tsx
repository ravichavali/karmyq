import React from 'react';

export interface TrustPath {
  degrees_of_separation: number | null;
  path?: Array<{
    id: string;
    name: string;
    karma?: number;
    invited_at?: string;
  }>;
  trust_score?: number;
  cached?: boolean;
}

interface TrustPathBadgeProps {
  trustPath: TrustPath | null;
  compact?: boolean; // Show condensed version for smaller spaces
  className?: string;
}

export default function TrustPathBadge({ trustPath, compact = false, className = '' }: TrustPathBadgeProps) {
  if (!trustPath || trustPath.degrees_of_separation === null || !trustPath.path) {
    return null; // No connection found
  }

  const { degrees_of_separation, path, trust_score } = trustPath;

  // Don't show badge for 4+ degree connections
  if (degrees_of_separation > 3) {
    return null;
  }

  // Degree badge colors
  const degreeColors = {
    1: 'bg-success-light text-success border-success',
    2: 'bg-primary-light text-primary-dark border-primary-medium',
    3: 'bg-surface text-text-muted border-border',
  };

  const degreeColor = degreeColors[degrees_of_separation as keyof typeof degreeColors] || 'bg-border-light text-text border-border';

  // Get connection text based on degree
  const getConnectionText = () => {
    if (degrees_of_separation === 1) {
      return 'Direct connection';
    } else if (degrees_of_separation === 2 && path.length >= 2) {
      // Show intermediary name: "Connected through Bob"
      return `Connected through ${path[1].name}`;
    } else if (degrees_of_separation === 3 && path.length >= 3) {
      // Show both intermediaries: "Connected through Bob → Charlie"
      return `Connected through ${path[1].name} → ${path[2].name}`;
    }
    return `${degrees_of_separation}° connection`;
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

  // Compact view: Just show the connection text
  if (compact) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${degreeColor}`}>
          <span className="text-base" aria-hidden="true">
            {degrees_of_separation === 1 ? '🔗' : degrees_of_separation === 2 ? '🤝' : '👥'}
          </span>
          {getConnectionText()}
        </span>
      </div>
    );
  }

  // Full view: Show path and details
  return (
    <div className={`border-l-4 ${degrees_of_separation === 1 ? 'border-karmyq-green-400 bg-success-light' : degrees_of_separation === 2 ? 'border-primary bg-primary-light' : 'border-karmyq-brown-400 bg-surface'} rounded-md p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            {degrees_of_separation === 1 ? '🔗' : degrees_of_separation === 2 ? '🤝' : '👥'}
          </span>
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-md border ${degreeColor}`}>
            {getConnectionText()}
          </span>
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

      {/* Invitation Details (optional) */}
      {path.length > 1 && path[1].invited_at && (
        <div className="mt-2 text-xs text-text-subtle">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Connected {new Date(path[1].invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
