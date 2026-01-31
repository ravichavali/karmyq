import React from 'react';
import {
  RequestPayload,
  RequestType,
  TransportationPayload,
  MovingHelpPayload,
  ChildcarePayload,
  TechHelpPayload,
  HomeRepairPayload,
  FoodPayload,
} from '../../types/request-payloads';

interface RequestPayloadRendererProps {
  type: RequestType;
  payload: RequestPayload | null;
  requirements?: Record<string, string | number | boolean>;
  preferredStartDate?: string;
  className?: string;
}

/**
 * Renders type-specific request payload data
 */
export default function RequestPayloadRenderer({
  type,
  payload,
  requirements,
  preferredStartDate,
  className = '',
}: RequestPayloadRendererProps) {
  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-50 rounded-md p-4 space-y-3 ${className}`}>
      {type === 'transportation' && <TransportationDetails payload={payload as TransportationPayload} />}
      {type === 'moving_help' && <MovingHelpDetails payload={payload as MovingHelpPayload} />}
      {type === 'childcare' && <ChildcareDetails payload={payload as ChildcarePayload} />}
      {type === 'tech_help' && <TechHelpDetails payload={payload as TechHelpPayload} />}
      {type === 'home_repair' && <HomeRepairDetails payload={payload as HomeRepairPayload} />}
      {type === 'food' && <FoodDetails payload={payload as FoodPayload} />}

      {preferredStartDate && (
        <div className="flex items-center text-sm text-gray-700 pt-2 border-t border-gray-200">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="font-medium">Preferred date: </span>
          <span className="ml-1">{new Date(preferredStartDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}</span>
        </div>
      )}

      {requirements && Object.keys(requirements).length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Requirements</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(requirements).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {formatRequirement(key, value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransportationDetails({ payload }: { payload: TransportationPayload }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DetailItem
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          }
          label="Pickup"
          value={`${payload.pickup_location.address}, ${payload.pickup_location.city}`}
        />
        <DetailItem
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          }
          label="Dropoff"
          value={`${payload.dropoff_location.address}, ${payload.dropoff_location.city}`}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Passengers" value={payload.passengers.toString()} />
        <Badge label="Luggage" value={payload.luggage} />
        {payload.return_trip && <Badge label="Round trip" value="Yes" color="blue" />}
      </div>
    </>
  );
}

function MovingHelpDetails({ payload }: { payload: MovingHelpPayload }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DetailItem
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          }
          label="From"
          value={`${payload.current_address.address} (Floor ${payload.current_address.floor}${payload.current_address.has_elevator ? ', has elevator' : ', no elevator'})`}
        />
        <DetailItem
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          }
          label="To"
          value={`${payload.new_address.address} (Floor ${payload.new_address.floor}${payload.new_address.has_elevator ? ', has elevator' : ', no elevator'})`}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Distance" value={`${payload.distance_miles} miles`} />
        <Badge label="Est. duration" value={`${payload.estimated_duration_hours} hours`} />
        <Badge label="Helpers needed" value={payload.num_helpers_needed.toString()} />
        {payload.truck_needed && <Badge label="Truck needed" value="Yes" color="orange" />}
        {payload.heavy_items && <Badge label="Heavy items" value="Yes" color="red" />}
      </div>
    </>
  );
}

function ChildcareDetails({ payload }: { payload: ChildcarePayload }) {
  return (
    <>
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
        }
        label="Children"
        value={payload.children
          .map((child) => `${child.age} years old${child.special_needs ? ' (special needs)' : ''}`)
          .join(', ')}
      />
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        }
        label="Location"
        value={`${payload.location.address}, ${payload.location.city}`}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Duration" value={`${payload.duration_hours} hours`} />
        {payload.meal_prep_needed && <Badge label="Meal prep" value="Needed" color="green" />}
        {payload.homework_help_needed && <Badge label="Homework help" value="Needed" color="purple" />}
      </div>
    </>
  );
}

function TechHelpDetails({ payload }: { payload: TechHelpPayload }) {
  const urgencyColors: Record<TechHelpPayload['urgency_level'], 'green' | 'yellow' | 'red'> = {
    can_wait: 'green',
    soon: 'yellow',
    urgent: 'red',
  };

  return (
    <>
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
          </svg>
        }
        label="Device"
        value={payload.device_type.replace('_', ' ')}
      />
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        }
        label="Issue"
        value={payload.issue_description}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Urgency" value={payload.urgency_level.replace('_', ' ')} color={urgencyColors[payload.urgency_level]} />
        {payload.remote_help_acceptable && <Badge label="Remote OK" value="Yes" color="blue" />}
      </div>
    </>
  );
}

function HomeRepairDetails({ payload }: { payload: HomeRepairPayload }) {
  return (
    <>
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        }
        label="Repair type"
        value={payload.repair_type}
      />
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        }
        label="Location"
        value={payload.location_in_home.replace('_', ' ')}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Est. duration" value={`${payload.estimated_duration_hours} hours`} />
        {payload.tools_available && <Badge label="Tools available" value="Yes" color="green" />}
        {payload.materials_needed && <Badge label="Materials needed" value="Yes" color="orange" />}
      </div>
    </>
  );
}

function FoodDetails({ payload }: { payload: FoodPayload }) {
  return (
    <>
      <DetailItem
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        }
        label="Service"
        value={payload.service_type.replace('_', ' ')}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge label="Servings" value={payload.num_servings.toString()} />
        <Badge label="Budget" value={payload.budget} color="green" />
        {payload.dietary_restrictions.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {payload.dietary_restrictions.join(', ')}
          </span>
        )}
      </div>
    </>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start">
      <div className="flex-shrink-0 text-gray-500 mt-0.5">{icon}</div>
      <div className="ml-2">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Badge({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string;
  color?: 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple';
}) {
  const colors = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className="inline-flex items-center">
      <span className="text-gray-600 mr-1">{label}:</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{value}</span>
    </span>
  );
}

function formatRequirement(key: string, value: string | number | boolean): string {
  if (typeof value === 'boolean') {
    return key.replace(/_/g, ' ');
  }
  return `${key.replace(/_/g, ' ')}: ${value}`;
}
