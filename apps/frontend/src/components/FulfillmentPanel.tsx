import React, { useState } from 'react';

interface Location {
  lat?: number;
  lng?: number;
  address?: string;
}

interface RidePayload {
  origin?: Location;
  destination?: Location;
  departure_time?: string;
  [key: string]: any;
}

interface FulfillmentPanelProps {
  requestType: string;
  payload: Record<string, any>;
  scheduledAt?: string;
  requestTitle?: string;
  travelTimeMinutes?: number;
  onTravelTimeChange?: (minutes: number) => void;
}

const TRAVEL_TIME_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
];

function formatGoogleCalendarDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  );
}

function buildCalendarUrl(
  title: string,
  departureTime: string,
  origin?: Location,
  destination?: Location
): string {
  const start = formatGoogleCalendarDate(departureTime);
  // Event duration: 1 hour
  const endDate = new Date(new Date(departureTime).getTime() + 60 * 60 * 1000);
  const end = formatGoogleCalendarDate(endDate.toISOString());

  const details = [
    origin?.address ? `From: ${origin.address}` : '',
    destination?.address ? `To: ${destination.address}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Ride: ${title}`,
    dates: `${start}/${end}`,
    ...(details && { details }),
    ...(origin?.address && { location: origin.address }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMapsUrl(origin?: Location, destination?: Location): string {
  if (!destination?.lat || !destination?.lng) return '';

  const params = new URLSearchParams({ api: '1', travelmode: 'driving' });

  if (origin?.lat && origin?.lng) {
    params.set('waypoints', `${origin.lat},${origin.lng}`);
  }

  params.set('destination', `${destination.lat},${destination.lng}`);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function formatDepartureTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export default function FulfillmentPanel({
  requestType,
  payload,
  scheduledAt,
  requestTitle = 'your commitment',
  travelTimeMinutes = 60,
  onTravelTimeChange,
}: FulfillmentPanelProps) {
  const [localTravelTime, setLocalTravelTime] = useState(travelTimeMinutes);

  const handleTravelTimeChange = (minutes: number) => {
    setLocalTravelTime(minutes);
    onTravelTimeChange?.(minutes);
  };

  if (requestType !== 'ride') {
    return (
      <div className="mt-3 pt-3 border-t border-border text-sm text-text-subtle">
        ✓ Accepted — you'll get a reminder before it starts.
      </div>
    );
  }

  const ridePayload = payload as RidePayload;
  const departureTime = scheduledAt || ridePayload.departure_time;
  const origin = ridePayload.origin;
  const destination = ridePayload.destination;

  const calendarUrl = departureTime
    ? buildCalendarUrl(requestTitle, departureTime, origin, destination)
    : null;

  const mapsUrl = buildMapsUrl(origin, destination);

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {/* Departure time */}
      {departureTime && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">🕐</span>
          <div>
            <span className="font-medium text-text">Departure: </span>
            <span className="text-text-subtle">{formatDepartureTime(departureTime)}</span>
          </div>
        </div>
      )}

      {/* Travel time selector */}
      {onTravelTimeChange && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-subtle uppercase tracking-wide">
            How long to reach pickup?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TRAVEL_TIME_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleTravelTimeChange(value)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors font-medium ${
                  localTravelTime === value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-text-muted border-border hover:border-primary hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex flex-wrap gap-2">
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors font-medium"
          >
            📅 Add to Calendar
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors font-medium"
          >
            🗺 Get Directions
          </a>
        )}
        {!calendarUrl && !mapsUrl && (
          <p className="text-sm text-text-subtle">✓ Accepted — you'll get a reminder before it starts.</p>
        )}
      </div>
    </div>
  );
}
