/**
 * Type definitions for polymorphic request payloads
 */

export interface Location {
  address: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
}

export interface LocationWithFloor extends Location {
  floor: number;
  has_elevator: boolean;
}

export interface TransportationPayload {
  pickup_location: Location;
  dropoff_location: Location;
  passengers: number;
  luggage: 'none' | 'small' | 'medium' | 'large';
  return_trip: boolean;
}

export interface MovingHelpPayload {
  current_address: LocationWithFloor;
  new_address: LocationWithFloor;
  distance_miles: number;
  estimated_duration_hours: number;
  truck_needed: boolean;
  heavy_items: boolean;
  num_helpers_needed: number;
}

export interface Child {
  age: number;
  special_needs?: boolean;
}

export interface ChildcarePayload {
  children: Child[];
  location: Location;
  duration_hours: number;
  meal_prep_needed: boolean;
  homework_help_needed: boolean;
}

export interface TechHelpPayload {
  device_type: 'laptop' | 'desktop' | 'phone' | 'tablet' | 'smart_home' | 'network';
  issue_description: string;
  remote_help_acceptable: boolean;
  urgency_level: 'can_wait' | 'soon' | 'urgent';
}

export interface HomeRepairPayload {
  repair_type: 'plumbing' | 'electrical' | 'carpentry' | 'painting' | 'appliance';
  location_in_home: 'kitchen' | 'bathroom' | 'bedroom' | 'living_room' | 'garage';
  tools_available: boolean;
  materials_needed: boolean;
  estimated_duration_hours: number;
}

export interface FoodPayload {
  service_type: 'meal_prep' | 'cooking_lesson' | 'grocery_shopping' | 'food_delivery';
  dietary_restrictions: string[];
  num_servings: number;
  budget: string;
}

export interface PetCarePayload {
  pet_type: 'dog' | 'cat' | 'other';
  pet_size?: 'small' | 'medium' | 'large';
  service_type: 'walking' | 'sitting' | 'boarding' | 'grooming';
  duration_hours: number;
  location: Location;
  special_instructions?: string;
}

export interface EventHelpPayload {
  event_type: 'party' | 'moving' | 'yard_work' | 'community' | 'other';
  location: Location;
  attendees: number;
  setup_needed: boolean;
  cleanup_needed: boolean;
  duration_hours: number;
}

export type RequestPayload =
  | TransportationPayload
  | MovingHelpPayload
  | ChildcarePayload
  | TechHelpPayload
  | HomeRepairPayload
  | FoodPayload
  | PetCarePayload
  | EventHelpPayload;

export type RequestType =
  | 'transportation'
  | 'moving_help'
  | 'childcare'
  | 'tech_help'
  | 'home_repair'
  | 'food'
  | 'pet_care'
  | 'event_help'
  | 'other';
