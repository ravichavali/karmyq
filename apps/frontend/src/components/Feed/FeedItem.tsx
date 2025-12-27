import React from 'react';
import Link from 'next/link';
import TrustPathBadge, { TrustPathBadgeSkeleton } from '../TrustPathBadge';
import { useTrustPath } from '../../hooks/useTrustPath';

interface FeedItemProps {
  item: {
    id: string;
    type: 'community_activity' | 'open_request' | 'suggested_request' | 'story';
    priority: number;
    created_at: string;
    data: any;
  };
  onDismiss?: (itemId: string) => void;
}

export default function FeedItem({ item, onDismiss }: FeedItemProps) {
  switch (item.type) {
    case 'community_activity':
      return <CommunityActivityItem data={item.data} itemId={item.id} onDismiss={onDismiss} />;
    case 'open_request':
      return <OpenRequestItem data={item.data} itemId={item.id} onDismiss={onDismiss} />;
    case 'suggested_request':
      return <SuggestedRequestItem data={item.data} itemId={item.id} onDismiss={onDismiss} />;
    case 'story':
      return <StoryItem data={item.data} itemId={item.id} onDismiss={onDismiss} />;
    default:
      return null;
  }
}

function CommunityActivityItem({ data, itemId, onDismiss }: any) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{data.community_name}</h3>
            <p className="text-sm text-gray-500">Your community</p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(itemId)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-sm">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-700">
            <strong>{data.exchanges_completed_week}</strong> exchanges completed this week
          </span>
        </div>

        {data.recent_helpers && data.recent_helpers.length > 0 && (
          <div className="flex items-start text-sm">
            <svg className="w-4 h-4 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span className="text-gray-700">
              Top helpers: {data.recent_helpers.map((h: any) => `${h.name} (${h.help_count})`).join(', ')}
            </span>
          </div>
        )}

        {data.new_members_count > 0 && (
          <div className="flex items-center text-sm">
            <svg className="w-4 h-4 text-purple-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            <span className="text-gray-700">
              <strong>{data.new_members_count}</strong> new members this week
            </span>
          </div>
        )}
      </div>

      {data.open_requests_count > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-orange-600 mb-2">
            📢 {data.open_requests_count} request{data.open_requests_count !== 1 ? 's' : ''} need{data.open_requests_count === 1 ? 's' : ''} help
          </p>
          <Link
            href={`/communities/${data.community_id}`}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View requests
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

function OpenRequestItem({ data, itemId, onDismiss }: any) {
  const urgencyColors = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200'
  };

  // Fetch trust path to the requester
  const { trustPath, loading: loadingPath } = useTrustPath(data.requester_id);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${urgencyColors[data.urgency as keyof typeof urgencyColors]}`}>
              {data.urgency}
            </span>
            {data.offers_count === 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                New - no offers yet
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{data.title}</h3>
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{data.description}</p>
          <div className="flex items-center text-xs text-gray-500 space-x-4">
            <span>Posted by {data.author_name}</span>
            <span>•</span>
            <span>{data.community_name}</span>
            <span>•</span>
            <span>{data.expected_duration}</span>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(itemId)}
            className="ml-4 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Trust Path Badge */}
      {loadingPath && <TrustPathBadgeSkeleton className="mb-4" />}
      {!loadingPath && trustPath && <TrustPathBadge trustPath={trustPath} className="mb-4" />}

      {data.required_skills && data.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.required_skills.map((skill: string, index: number) => (
            <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex space-x-3">
        <Link
          href={`/requests/${data.request_id}`}
          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View Details
        </Link>
        <Link
          href={`/requests/${data.request_id}?offer=true`}
          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Offer to Help
        </Link>
      </div>
    </div>
  );
}

function SuggestedRequestItem({ data, itemId, onDismiss }: any) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-sm border border-purple-200 p-6 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center mb-2">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-2">
            <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-purple-700">Suggested for You</span>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(itemId)}
            className="text-purple-400 hover:text-purple-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{data.title}</h3>
      <p className="text-sm text-gray-700 mb-3 line-clamp-2">{data.description}</p>

      <div className="bg-white bg-opacity-60 rounded-md p-3 mb-4">
        <p className="text-xs text-purple-800 mb-1">
          <strong>Why suggested:</strong>
        </p>
        <p className="text-xs text-gray-700">{data.reason}</p>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
        <span>From: {data.community_name}</span>
        <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800">
          {data.match_score}% match
        </span>
      </div>

      <div className="flex space-x-3">
        <Link
          href={`/requests/${data.request_id}`}
          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-purple-300 shadow-sm text-sm font-medium rounded-md text-purple-700 bg-white hover:bg-purple-50"
        >
          View Request
        </Link>
        <Link
          href={`/communities/${data.community_id}`}
          className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
        >
          Explore Community
        </Link>
      </div>
    </div>
  );
}

function StoryItem({ data, itemId, onDismiss }: any) {
  const storyIcons = {
    first_timer: '🌱',
    milestone: '🏆',
    pay_it_forward: '🔄',
    unexpected_match: '💡'
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-sm border border-green-200 p-6 mb-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">{storyIcons[data.type as keyof typeof storyIcons]}</span>
            <h3 className="text-base font-semibold text-gray-900">{data.title}</h3>
          </div>
          <p className="text-sm text-gray-700 mb-2">{data.description}</p>
          {data.community_name && (
            <p className="text-xs text-gray-500">in {data.community_name}</p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(itemId)}
            className="ml-4 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
