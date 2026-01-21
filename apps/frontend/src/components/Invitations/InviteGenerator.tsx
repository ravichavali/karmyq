import React, { useState, useEffect } from 'react';
import { socialGraphService, communityService } from '../../lib/api';

interface GeneratedInvite {
  code: string;
  url: string;
  created_at: string;
  expires_at: string | null;
}

export default function InviteGenerator() {
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [communityId, setCommunityId] = useState<string | null>(null);

  useEffect(() => {
    // Get user's communities and use the first one
    const fetchUserCommunities = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
          const response = await communityService.getMyCommunities(user.id);
          const communities = response.data?.communities || response.data;
          if (communities && communities.length > 0) {
            setCommunityId(communities[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching communities:', err);
      }
    };
    fetchUserCommunities();
  }, []);

  const handleGenerateCode = async () => {
    if (!communityId) {
      setError('Please join a community first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await socialGraphService.generateInvitationCode(communityId);
      setGeneratedInvite(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate invitation code');
      console.error('Error generating invitation code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedInvite) return;

    try {
      await navigator.clipboard.writeText(generatedInvite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedInvite) return;

    try {
      await navigator.clipboard.writeText(generatedInvite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Invite Friends</h3>
          <p className="text-sm text-gray-500 mt-1">
            Generate an invitation code to invite someone to join your community
          </p>
        </div>
        <button
          onClick={handleGenerateCode}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Code
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {generatedInvite && (
        <div className="space-y-4">
          {/* Invitation Code */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invitation Code
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-base font-mono text-gray-900 select-all">
                {generatedInvite.code}
              </code>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Shareable Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedInvite.url}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer select-all"
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start p-3 bg-blue-50 rounded-md">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">Share this link with someone to invite them</p>
              <p className="mt-1 text-blue-700">
                When they sign up using this code, they'll be connected to you in the social graph.
              </p>
            </div>
          </div>

          {generatedInvite.created_at && (
            <p className="text-xs text-gray-500">
              Generated {new Date(generatedInvite.created_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {!generatedInvite && !error && (
        <div className="text-center py-8">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="text-gray-500 text-sm">
            Click the button above to generate an invitation code
          </p>
        </div>
      )}
    </div>
  );
}
