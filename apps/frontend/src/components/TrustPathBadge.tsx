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

  // Degree badge colors
  const degreeColors = {
    1: 'bg-green-100 text-green-800 border-green-300',
    2: 'bg-blue-100 text-blue-800 border-blue-300',
    3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    4: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const degreeColor = degreeColors[degrees_of_separation as keyof typeof degreeColors] || 'bg-gray-100 text-gray-800 border-gray-300';

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

  // Compact view: Just show the degree badge
  if (compact) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${degreeColor}`}>
          {degrees_of_separation}° connection
        </span>
      </div>
    );
  }

  // Full view: Show path and details
  return (
    <div className={`border-l-4 border-blue-400 bg-blue-50 rounded-md p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <svg className="w-4 h-4 text-blue-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${degreeColor}`}>
            {degrees_of_separation}° Connection
          </span>
        </div>
        {trust_score !== undefined && trust_score > 0 && (
          <div className="flex items-center">
            {renderTrustStars(trust_score)}
            <span className="ml-1 text-xs text-gray-600">{trust_score}</span>
          </div>
        )}
      </div>

      {/* Connection Path */}
      <div className="flex items-center text-sm text-gray-700">
        {path.map((node, index) => (
          <React.Fragment key={node.id}>
            {index === 0 ? (
              <span className="font-semibold text-blue-700">You</span>
            ) : (
              <span className="font-medium">{node.name}</span>
            )}

            {index < path.length - 1 && (
              <svg className="w-4 h-4 mx-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Invitation Details (optional) */}
      {path.length > 1 && path[1].invited_at && (
        <div className="mt-2 text-xs text-gray-500">
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
    <div className={`border-l-4 border-gray-300 bg-gray-50 rounded-md p-3 animate-pulse ${className}`}>
      <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-48 bg-gray-200 rounded"></div>
    </div>
  );
}
