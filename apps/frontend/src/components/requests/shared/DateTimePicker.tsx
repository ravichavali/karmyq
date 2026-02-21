/**
 * DateTime Picker Component
 * Two-field design (date + time) for reliable cross-browser support (including Safari/iOS).
 * Outputs a full ISO 8601 string with UTC offset.
 */

import React, { useState, useEffect } from 'react'

interface DateTimePickerProps {
  label: string
  value: string          // ISO string in, ISO string out
  onChange: (isoString: string) => void
  required?: boolean
  minDate?: string       // ISO string — defaults to today
  helpText?: string
}

function pad(n: number) { return String(n).padStart(2, '0') }

/** Format a local Date as YYYY-MM-DD */
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Format a local Date as HH:MM */
function toTimeInput(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Build an ISO string from separate date (YYYY-MM-DD) and time (HH:MM) strings */
function buildISO(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return ''
  return new Date(`${dateStr}T${timeStr}:00`).toISOString()
}

export default function DateTimePicker({
  label,
  value,
  onChange,
  required = false,
  minDate,
  helpText,
}: DateTimePickerProps) {
  const today = toDateInput(new Date())
  const minDateStr = minDate ? toDateInput(new Date(minDate)) : today

  // Initialise date/time from incoming ISO value
  const initial = value ? new Date(value) : null
  const [dateStr, setDateStr] = useState(initial ? toDateInput(initial) : '')
  const [timeStr, setTimeStr] = useState(initial ? toTimeInput(initial) : '')

  // Sync if parent resets value to ''
  useEffect(() => {
    if (!value) {
      setDateStr('')
      setTimeStr('')
    }
  }, [value])

  const handleDateChange = (d: string) => {
    setDateStr(d)
    const iso = buildISO(d, timeStr)
    if (iso) onChange(iso)
  }

  const handleTimeChange = (t: string) => {
    setTimeStr(t)
    const iso = buildISO(dateStr, t)
    if (iso) onChange(iso)
  }

  // Human-friendly preview
  const preview = dateStr && timeStr
    ? new Date(`${dateStr}T${timeStr}:00`).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {/* Date */}
        <div>
          <p className="text-xs text-text-subtle mb-1">Date</p>
          <input
            type="date"
            value={dateStr}
            min={minDateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            required={required}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Time */}
        <div>
          <p className="text-xs text-text-subtle mb-1">Time</p>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => handleTimeChange(e.target.value)}
            required={required}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Human-readable confirmation */}
      {preview && (
        <p className="text-sm text-primary-dark mt-2 font-medium">📅 {preview}</p>
      )}

      {helpText && (
        <p className="text-text-subtle text-xs mt-1">{helpText}</p>
      )}
    </div>
  )
}
