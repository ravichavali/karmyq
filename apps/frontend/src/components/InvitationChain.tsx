import React from 'react';

export interface InvitationChainNode {
  id: string;
  name: string;
  invited_at?: string;
}

interface InvitationChainProps {
  chain: InvitationChainNode[] | null;
  currentUserId: string;
  className?: string;
}

/**
 * InvitationChain Component
 * Displays how a user joined the platform through their invitation ancestry
 * Shows the chain from the current user back to the person who invited them
 */
export default function InvitationChain({ chain, currentUserId, className = '' }: InvitationChainProps) {
  if (!chain || chain.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${className}`}>
        <div className="flex items-center text-gray-500">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm">No invitation history available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-5 border border-blue-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center mb-4">
        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900">Invitation Chain</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        This shows how you joined the platform through your network
      </p>

      {/* Chain Display */}
      <div className="space-y-3">
        {chain.map((node, index) => {
          const isCurrentUser = node.id === currentUserId;
          const isLast = index === chain.length - 1;

          return (
            <div key={node.id} className="flex items-start">
              {/* Vertical Line */}
              {!isLast && (
                <div className="absolute ml-4 mt-10 h-8 w-0.5 bg-blue-300" />
              )}

              {/* Node Content */}
              <div className="flex items-center w-full">
                {/* Avatar Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold z-10 ${
                  isCurrentUser
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600'
                    : 'bg-gradient-to-br from-gray-500 to-gray-600'
                }`}>
                  {node.name.charAt(0).toUpperCase()}
                </div>

                {/* Name and Details */}
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${isCurrentUser ? 'text-blue-700' : 'text-gray-900'}`}>
                        {isCurrentUser ? 'You' : node.name}
                      </p>
                      {node.invited_at && (
                        <p className="text-xs text-gray-500">
                          Joined {new Date(node.invited_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      )}
                    </div>

                    {/* Role Badge */}
                    {isCurrentUser && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        You
                      </span>
                    )}
                    {isLast && !isCurrentUser && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                        Original Inviter
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {chain.length > 1 && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-blue-700">{chain.length - 1}</span> degree
            {chain.length - 1 !== 1 ? 's' : ''} of separation from {chain[chain.length - 1].name}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Loading skeleton for InvitationChain
 */
export function InvitationChainSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-50 rounded-lg p-5 border border-gray-200 animate-pulse ${className}`}>
      <div className="h-6 w-40 bg-gray-200 rounded mb-3"></div>
      <div className="h-4 w-3/4 bg-gray-200 rounded mb-4"></div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div className="ml-3 flex-1">
              <div className="h-4 w-32 bg-gray-200 rounded mb-1"></div>
              <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
