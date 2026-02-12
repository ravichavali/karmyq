import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import FeedItem from './FeedItem';
import { API_CONFIG } from '../../lib/api';
import { FeedItem as FeedItemType } from '../../types/feed-items';

interface FeedProps {
  userId: number;
  limit?: number;
}

export default function Feed({ userId, limit = 20 }: FeedProps) {
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_CONFIG.FEED_API_URL}/feed?limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': userId.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }

      const data = await response.json();
      setFeedItems(data.data.items || []);
    } catch (err) {
      console.error('Error fetching feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDismiss = async (itemId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_CONFIG.FEED_API_URL}/feed/dismiss/${itemId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-user-id': userId.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        // Remove item from feed
        setFeedItems(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (err) {
      console.error('Error dismissing item:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface-raised rounded-lg shadow-sm border border-border p-6 animate-pulse">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              <div className="h-3 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-red-800 font-medium mb-2">Failed to load feed</p>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={() => fetchFeed()}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <svg className="w-16 h-16 text-text-subtle mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 className="text-lg font-medium text-text mb-2">Your feed is empty</h3>
        <p className="text-text-muted mb-4">
          Join communities and start helping to see activity here!
        </p>
        <Link
          href="/communities"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
        >
          Explore Communities
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-text">Your Feed</h2>
        <button
          onClick={() => fetchFeed(true)}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm font-medium rounded-md text-text-muted bg-surface-raised hover:bg-surface disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-0">
        {feedItems.map(item => (
          <FeedItem
            key={item.id}
            item={item}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {feedItems.length >= limit && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchFeed()}
            className="text-primary hover:text-primary-dark font-medium text-sm"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
