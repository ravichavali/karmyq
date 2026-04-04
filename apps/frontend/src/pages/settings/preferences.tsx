/**
 * User Preferences Settings Page - Day 8
 *
 * Allows users to manage request type subscriptions and interests
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { userSettingsService } from '../../lib/api';

interface RequestTypePreference {
  request_type: string;
  subscribed: boolean;
  updated_at?: string;
}

interface Interest {
  id: string;
  interest_type: string;
  interest_value: string;
  created_at: string;
}

const REQUEST_TYPE_INFO = {
  generic: {
    label: 'General Help',
    icon: '🤝',
    description: 'Any help that doesn\'t fit other categories',
    examples: 'Moving furniture, advice, quick tasks',
  },
  ride: {
    label: 'Ride Share',
    icon: '🚗',
    description: 'Transportation requests',
    examples: 'Rides to airport, grocery store pickups',
  },
  service: {
    label: 'Service Requests',
    icon: '🔧',
    description: 'Professional services and skills',
    examples: 'Plumbing, tutoring, tech support',
  },
  event: {
    label: 'Event Help',
    icon: '🎉',
    description: 'Community events and volunteering',
    examples: 'Food drives, cleanup days, fundraisers',
  },
  borrow: {
    label: 'Borrow Items',
    icon: '📦',
    description: 'Temporarily borrow tools or equipment',
    examples: 'Ladders, power tools, camping gear',
  },
};

const SERVICE_CATEGORIES = [
  'plumbing', 'electrical', 'carpentry', 'tutoring', 'consulting',
  'repair', 'cleaning', 'gardening', 'pet_care', 'childcare',
  'elder_care', 'tech_support', 'legal', 'financial', 'other',
];

const ITEM_CATEGORIES = [
  'tools', 'electronics', 'furniture', 'sports_equipment', 'party_supplies',
  'camping_gear', 'baby_items', 'books', 'vehicles', 'appliances', 'other',
];

const EVENT_TYPES = [
  'volunteer', 'community_cleanup', 'fundraiser', 'workshop', 'meetup',
  'sports', 'cultural', 'educational', 'social', 'other',
];

export default function PreferencesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Request type preferences
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    generic: true,
    ride: true,
    service: true,
    event: true,
    borrow: true,
  });

  // User interests
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<Record<string, Set<string>>>({
    service_category: new Set(),
    item_category: new Set(),
    event_type: new Set(),
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
        fetchPreferences();
      } else {
        router.push('/login');
      }
    }
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);

      // Fetch request type preferences
      const prefsResponse = await userSettingsService.getRequestTypePreferences();
      if (prefsResponse.data.success) {
        const prefs: Record<string, boolean> = {};
        prefsResponse.data.data.preferences.forEach((pref: RequestTypePreference) => {
          prefs[pref.request_type] = pref.subscribed;
        });
        setPreferences(prefs);
      }

      // Fetch interests
      const interestsResponse = await userSettingsService.getInterests();
      if (interestsResponse.data.success) {
        setInterests(interestsResponse.data.data.interests);

        // Convert to Set for easier management
        const selected: Record<string, Set<string>> = {
          service_category: new Set(),
          item_category: new Set(),
          event_type: new Set(),
        };

        interestsResponse.data.data.interests.forEach((interest: Interest) => {
          selected[interest.interest_type]?.add(interest.interest_value);
        });

        setSelectedInterests(selected);
      }
    } catch (error) {
      console.error('Error fetching preferences', { error: error instanceof Error ? error.message : String(error) });
      alert('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (requestType: string) => {
    const newValue = !preferences[requestType];

    try {
      await userSettingsService.updateRequestTypePreference({
        request_type: requestType,
        subscribed: newValue,
      });

      setPreferences({ ...preferences, [requestType]: newValue });
    } catch (error) {
      console.error('Error updating preference', { error: error instanceof Error ? error.message : String(error) });
      alert('Failed to update preference');
    }
  };

  const handleToggleInterest = async (interestType: string, interestValue: string) => {
    const isCurrentlySelected = selectedInterests[interestType]?.has(interestValue);

    try {
      if (isCurrentlySelected) {
        // Remove interest
        const interest = interests.find(
          (i) => i.interest_type === interestType && i.interest_value === interestValue
        );

        if (interest) {
          await userSettingsService.removeInterest(interest.id);

          // Update local state
          const newSelected = { ...selectedInterests };
          newSelected[interestType] = new Set(newSelected[interestType]);
          newSelected[interestType].delete(interestValue);
          setSelectedInterests(newSelected);

          setInterests(interests.filter((i) => i.id !== interest.id));
        }
      } else {
        // Add interest
        const response = await userSettingsService.addInterest({
          interest_type: interestType,
          interest_value: interestValue,
        });

        if (response.data.success && response.data.data.isNew) {
          // Update local state
          const newSelected = { ...selectedInterests };
          newSelected[interestType] = new Set(newSelected[interestType]);
          newSelected[interestType].add(interestValue);
          setSelectedInterests(newSelected);

          setInterests([
            ...interests,
            {
              id: response.data.data.id,
              interest_type: interestType,
              interest_value: interestValue,
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error toggling interest', { error: error instanceof Error ? error.message : String(error) });
      alert('Failed to update interest');
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);

      // Build preferences array
      const prefsArray = Object.entries(preferences).map(([request_type, subscribed]) => ({
        request_type,
        subscribed,
      }));

      await userSettingsService.bulkUpdatePreferences(prefsArray);

      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences', { error: error instanceof Error ? error.message : String(error) });
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Preferences">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-text-muted mt-4">Loading preferences...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Feed Preferences - Karmyq</title>
      </Head>
      <Layout title="Feed Preferences">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-surface-raised rounded-lg shadow-sm p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-text">Feed Preferences</h1>
              <p className="text-text-muted mt-2">
                Customize which types of requests you see in your curated feed
              </p>
            </div>

            {/* Request Type Preferences */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-text mb-4">Request Types</h2>
              <p className="text-sm text-text-muted mb-6">
                Choose which types of requests you want to see in your feed. You can always change these later.
              </p>

              <div className="space-y-4">
                {Object.entries(REQUEST_TYPE_INFO).map(([type, info]) => (
                  <div
                    key={type}
                    className="border border-border rounded-lg p-6 hover:border-primary-medium transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <span className="text-4xl">{info.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-text">{info.label}</h3>
                            {preferences[type] && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-light text-green-800">
                                Subscribed
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-muted mb-2">{info.description}</p>
                          <p className="text-xs text-text-subtle italic">Examples: {info.examples}</p>
                        </div>
                      </div>

                      <label className="flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={preferences[type] || false}
                          onChange={() => handleTogglePreference(type)}
                          className="w-6 h-6 text-primary border-border rounded focus:ring-primary"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Specific Interests */}
            <div className="mb-8 pt-8 border-t">
              <h2 className="text-xl font-semibold text-text mb-4">Specific Interests</h2>
              <p className="text-sm text-text-muted mb-6">
                Select specific categories you're interested in to further refine your feed
              </p>

              {/* Service Categories */}
              {preferences.service && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-text mb-3">Service Categories I Can Help With</h3>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_CATEGORIES.map((category) => {
                      const isSelected = selectedInterests.service_category?.has(category);
                      return (
                        <button
                          key={category}
                          onClick={() => handleToggleInterest('service_category', category)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                            isSelected
                              ? 'bg-primary-light border-primary text-primary-dark'
                              : 'bg-surface-raised border-border text-text-muted hover:border-karmyq-brown-400'
                          }`}
                        >
                          {category.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Item Categories */}
              {preferences.borrow && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-text mb-3">Items I Can Lend</h3>
                  <div className="flex flex-wrap gap-2">
                    {ITEM_CATEGORIES.map((category) => {
                      const isSelected = selectedInterests.item_category?.has(category);
                      return (
                        <button
                          key={category}
                          onClick={() => handleToggleInterest('item_category', category)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                            isSelected
                              ? 'bg-karmyq-orange-100 border-karmyq-brown-500 text-karmyq-brown-800'
                              : 'bg-surface-raised border-border text-text-muted hover:border-karmyq-brown-400'
                          }`}
                        >
                          {category.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Event Types */}
              {preferences.event && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-text mb-3">Event Types I'm Interested In</h3>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map((eventType) => {
                      const isSelected = selectedInterests.event_type?.has(eventType);
                      return (
                        <button
                          key={eventType}
                          onClick={() => handleToggleInterest('event_type', eventType)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                            isSelected
                              ? 'bg-accent-light border-karmyq-orange-500 text-accent-dark'
                              : 'bg-surface-raised border-border text-text-muted hover:border-karmyq-brown-400'
                          }`}
                        >
                          {eventType.replace(/_/g, ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-primary-light border border-primary-medium rounded-lg p-6 mb-6">
              <h3 className="font-medium text-primary-dark mb-2">Your Feed Summary</h3>
              <div className="text-sm text-primary-dark space-y-1">
                <p>
                  <strong>Subscribed to:</strong>{' '}
                  {Object.entries(preferences)
                    .filter(([_, subscribed]) => subscribed)
                    .map(([type]) => REQUEST_TYPE_INFO[type as keyof typeof REQUEST_TYPE_INFO].label)
                    .join(', ')}
                </p>
                <p>
                  <strong>Total interests:</strong> {interests.length}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex-1 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save All Preferences'}
              </button>
              <button
                onClick={() => router.push('/requests')}
                className="flex-1 bg-gray-200 text-text-muted px-6 py-3 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Back to Feed
              </button>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
