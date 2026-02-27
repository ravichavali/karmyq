export interface ProviderProfile {
  id: string;
  user_id: string;
  service_type: string;
  display_name: string;
  bio?: string;
  pricing_notes?: string;
  is_active: boolean;
  location_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  avg_stars?: number;
  total_reviews?: number;
  trust_score?: number;
  ride_details?: ProviderRideDetails;
}

export interface ProviderRideDetails {
  provider_id: string;
  vehicle_type?: string;
  max_passengers: number;
  typical_routes?: string;
  advance_booking_required: boolean;
}

export interface ProviderReview {
  id: string;
  provider_id: string;
  reviewer_id: string;
  match_id?: string;
  stars: number;
  review_text?: string;
  created_at: string;
}

export interface ProviderTrustScore {
  provider_id: string;
  avg_stars: number;
  total_reviews: number;
  completion_rate: number;
  response_rate: number;
  trust_score: number;
  last_calculated: string;
}

export interface CreateProviderProfileInput {
  service_type: string;
  display_name: string;
  bio?: string;
  pricing_notes?: string;
  location_notes?: string;
  ride_details?: Omit<ProviderRideDetails, 'provider_id'>;
}

export interface CreateProviderReviewInput {
  provider_id: string;
  match_id?: string;
  stars: number;
  review_text?: string;
}

export const PROVIDER_SERVICE_TYPES = ['ride', 'tradesperson', 'tutor', 'other'] as const;
export type ProviderServiceType = typeof PROVIDER_SERVICE_TYPES[number];
