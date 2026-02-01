/**
 * Extracted Data Chips Component
 * Shows parsed data from request description as interactive chips
 */

import React from 'react'
import { ParsedRequest } from '@/lib/requestParser'

interface ExtractedDataChipsProps {
  parsed: ParsedRequest
  onRemove: (type: string, index: number) => void
}

export default function ExtractedDataChips({ parsed, onRemove }: ExtractedDataChipsProps) {
  const { extractedData } = parsed

  const hasData =
    extractedData.locations?.length ||
    extractedData.times?.length ||
    extractedData.counts?.length ||
    extractedData.budget ||
    extractedData.urgency

  if (!hasData) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
      <div className="text-xs font-medium text-blue-700 flex items-center">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Detected:
      </div>

      {/* Locations */}
      {extractedData.locations?.map((location, idx) => (
        <Chip
          key={`location-${idx}`}
          label={location.display_name || location.text}
          icon="📍"
          badge={location.type === 'origin' ? 'From' : location.type === 'destination' ? 'To' : undefined}
          color="blue"
          onRemove={() => onRemove('location', idx)}
        />
      ))}

      {/* Times */}
      {extractedData.times?.map((time, idx) => (
        <Chip
          key={`time-${idx}`}
          label={time.text}
          icon="🕐"
          color="purple"
          onRemove={() => onRemove('time', idx)}
        />
      ))}

      {/* Counts */}
      {extractedData.counts?.map((count, idx) => (
        <Chip
          key={`count-${idx}`}
          label={`${count.value} ${count.type}`}
          icon={count.type === 'seats' ? '💺' : '👥'}
          color="green"
          onRemove={() => onRemove('count', idx)}
        />
      ))}

      {/* Budget */}
      {extractedData.budget && (
        <Chip
          label={`${extractedData.budget.currency} ${extractedData.budget.min}-${extractedData.budget.max}`}
          icon="💰"
          color="yellow"
          onRemove={() => onRemove('budget', 0)}
        />
      )}

      {/* Urgency */}
      {extractedData.urgency && (
        <Chip
          label={extractedData.urgency}
          icon={extractedData.urgency === 'high' ? '🔴' : extractedData.urgency === 'medium' ? '🟡' : '🟢'}
          color={extractedData.urgency === 'high' ? 'red' : extractedData.urgency === 'medium' ? 'orange' : 'green'}
          onRemove={() => onRemove('urgency', 0)}
        />
      )}
    </div>
  )
}

interface ChipProps {
  label: string
  icon: string
  badge?: string
  color: 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'orange'
  onRemove: () => void
}

function Chip({ label, icon, badge, color, onRemove }: ChipProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${colorClasses[color]}`}>
      <span>{icon}</span>
      {badge && <span className="opacity-75">{badge}:</span>}
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 hover:bg-white/50 rounded-full p-0.5 transition-colors"
        aria-label="Remove"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </span>
  )
}
