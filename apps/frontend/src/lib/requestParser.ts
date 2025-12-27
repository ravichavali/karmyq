/**
 * Smart Request Parser
 * Extracts structured data from natural language using shortcuts
 *
 * Syntax:
 * - @location - Location references
 * - .. from/origin
 * - >> to/destination
 * - @time - Temporal references (tomorrow, monday, 5pm, etc.)
 * - #count - Participant/seat counts
 * - $min-max - Budget ranges
 * - !urgency - Urgency level
 */

export interface LocationData {
  text: string // Short version for parsing (e.g., "San Francisco")
  display_name?: string // Full human-readable address (e.g., "San Francisco, California, USA")
  type: 'origin' | 'destination' | 'general'
  lat?: number
  lng?: number
}

export interface ParsedRequest {
  description: string
  extractedData: {
    locations?: Array<LocationData>
    times?: Array<{ text: string; raw: string }>
    counts?: Array<{ value: number; type: 'seats' | 'people' | 'volunteers' }>
    budget?: { min: number; max: number; currency: string }
    urgency?: 'low' | 'medium' | 'high'
  }
  cleanDescription: string // Description with shortcuts removed
}

/**
 * Update location coordinates and display name in parsed request
 * Also updates cleanDescription to use full display names
 */
export function updateLocationCoordinates(
  parsed: ParsedRequest,
  address: string,
  lat: number,
  lng: number,
  displayName?: string
): ParsedRequest {
  if (!parsed.extractedData.locations) return parsed

  const updated = { ...parsed }
  updated.extractedData = { ...parsed.extractedData }
  updated.extractedData.locations = parsed.extractedData.locations.map(loc =>
    loc.text === address ? { ...loc, lat, lng, display_name: displayName } : loc
  )

  // Update cleanDescription to use full display names where available
  let cleanDescription = parsed.cleanDescription
  if (displayName && address) {
    // Replace the short address with full display name in cleanDescription
    // This handles patterns like "from San Francisco" -> "from San Francisco, California, USA"
    const addressPattern = new RegExp(`\\b${escapeRegex(address)}\\b`, 'gi')
    cleanDescription = cleanDescription.replace(addressPattern, displayName)
  }
  updated.cleanDescription = cleanDescription

  return updated
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseRequestDescription(text: string, requestType: string): ParsedRequest {
  const extractedData: ParsedRequest['extractedData'] = {}
  let cleanText = text

  // Extract locations (@location)
  const locationMatches = text.matchAll(/@([a-zA-Z0-9\s\-]+?)(?=\s|,|$|@|>>|\.\.|#|\$|!)/g)
  const locations: Array<{ text: string; type: 'origin' | 'destination' | 'general' }> = []

  for (const match of locationMatches) {
    const location = match[1].trim()
    // Skip time-like patterns (tomorrow, monday, 5pm, etc.)
    if (!isTimePattern(location)) {
      locations.push({ text: location, type: 'general' })
      // Replace @location with just location (remove @ but keep the name)
      cleanText = cleanText.replace(match[0], location)
    }
  }

  // Extract origin/destination using natural language patterns
  // Priority 1: "from @X to @Y" or "from X to Y" pattern
  // NOTE: We DON'T remove natural language from cleanText - it's already readable!
  let originDestMatch = text.match(/from\s+@?([a-zA-Z0-9\s\-]+?)\s+to\s+@?([a-zA-Z0-9\s\-]+?)(?=\s+@|\s+#|\s+\$|\s+!|$)/i)
  if (originDestMatch) {
    const origin = originDestMatch[1].trim()
    const destination = originDestMatch[2].trim()

    // Update existing locations to mark them as origin/destination
    const originLoc = locations.find(l => l.text === origin)
    const destLoc = locations.find(l => l.text === destination)

    if (originLoc) originLoc.type = 'origin'
    else locations.push({ text: origin, type: 'origin' })

    if (destLoc) destLoc.type = 'destination'
    else locations.push({ text: destination, type: 'destination' })

    // DON'T remove natural language - keep "from X to Y" in description
  } else {
    // Priority 2: "to @X" or "to X" pattern (just destination)
    const toMatch = text.match(/(?:ride\s+)?to\s+@?([a-zA-Z0-9\s\-]+?)(?=\s+@|\s+#|\s+\$|\s+!|$)/i)
    if (toMatch) {
      const destination = toMatch[1].trim()
      const destLoc = locations.find(l => l.text === destination)
      if (destLoc) destLoc.type = 'destination'
      else locations.push({ text: destination, type: 'destination' })
      // DON'T remove natural language - keep "to X" in description
    }
  }

  // Priority 3: Optional shorthand syntax (.. >> for power users who prefer it)
  // This SHOULD be removed because it's not readable
  if (!originDestMatch) {
    const shorthandMatch = text.match(/\.\.\s*([^\s>]+?)(?:\s+(?:to|from))?\s*>>\s*([^\s@#$!]+)/i)
    if (shorthandMatch) {
      const origin = shorthandMatch[1].trim()
      const destination = shorthandMatch[2].trim()
      locations.push({ text: origin, type: 'origin' })
      locations.push({ text: destination, type: 'destination' })
      cleanText = cleanText.replace(shorthandMatch[0], '') // Remove shorthand syntax
    }
  }

  if (locations.length > 0) {
    extractedData.locations = locations
  }

  // Extract times (@tomorrow, @5pm, @monday, etc.)
  // Also handles standalone times like "5:30PM" (no space) without @
  const timeMatches = text.matchAll(/@(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|next\s+month|\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)|(\d{1,2}:\d{2}\s*(?:am|pm|AM|PM|Am|Pm))/gi)
  const times: Array<{ text: string; raw: string }> = []

  for (const match of timeMatches) {
    const timeText = (match[1] || match[2] || '').trim()
    if (timeText) {
      times.push({ text: timeText, raw: match[0] })
      // Replace @tomorrow with "tomorrow", @5pm with "5pm", etc. (remove @ but keep time)
      const readableTime = match[0].startsWith('@') ? timeText : match[0]
      cleanText = cleanText.replace(match[0], readableTime)
    }
  }

  if (times.length > 0) {
    extractedData.times = times
  }

  // Extract counts (#2seats, #15people, #20volunteers)
  // Also handle bare numbers like #2
  const countMatches = text.matchAll(/#(\d+)\s*(seats?|people|volunteers?|participants?)?/gi)
  const counts: Array<{ value: number; type: 'seats' | 'people' | 'volunteers' }> = []

  for (const match of countMatches) {
    const value = parseInt(match[1])
    const typeText = match[2]?.toLowerCase() || ''
    const type = typeText.includes('seat') ? 'seats' :
                 typeText.includes('volunteer') ? 'volunteers' :
                 typeText.includes('participant') ? 'people' : 'people'
    counts.push({ value, type })
    // Replace #2 with "2 people/seats" for readability
    const readable = typeText ? `${value} ${match[2]}` : `${value} people`
    cleanText = cleanText.replace(match[0], readable)
  }

  if (counts.length > 0) {
    extractedData.counts = counts
  }

  // Extract budget ($50-100, $100-200)
  const budgetMatch = text.match(/\$(\d+)-(\d+)/i)
  if (budgetMatch) {
    extractedData.budget = {
      min: parseInt(budgetMatch[1]),
      max: parseInt(budgetMatch[2]),
      currency: 'USD'
    }
    // Replace $50-100 with "$50-100" (keep it readable)
    cleanText = cleanText.replace(budgetMatch[0], budgetMatch[0])
  }

  // Extract urgency (!urgent, !high, !low)
  const urgencyMatch = text.match(/!(urgent|high|medium|low)/i)
  if (urgencyMatch) {
    const urgencyText = urgencyMatch[1].toLowerCase()
    extractedData.urgency = urgencyText === 'urgent' ? 'high' : urgencyText as 'high' | 'medium' | 'low'
    // Replace !urgent with " urgent" for readability (add leading space)
    cleanText = cleanText.replace(urgencyMatch[0], ' ' + urgencyText)
  }

  // Clean up extra spaces
  cleanText = cleanText.replace(/\s+/g, ' ').trim()

  return {
    description: text,
    extractedData,
    cleanDescription: cleanText
  }
}

function isTimePattern(text: string): boolean {
  const timePatterns = [
    /^(tomorrow|today|tonight)$/i,
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    /^next\s+(week|month)$/i,
    /^\d{1,2}(am|pm|:\d{2})$/i,
    /^[a-z]{3}-\d{1,2}$/i,
    /^\d{4}-\d{2}-\d{2}$/i
  ]
  return timePatterns.some(pattern => pattern.test(text.trim()))
}

/**
 * Convert extracted data to structured payload for backend
 */
export function buildPayloadFromParsed(
  parsed: ParsedRequest,
  requestType: 'ride' | 'service' | 'event' | 'borrow' | 'generic'
): any {
  const { extractedData } = parsed

  if (requestType === 'ride') {
    const origin = extractedData.locations?.find(l => l.type === 'origin')
    const destination = extractedData.locations?.find(l => l.type === 'destination')
    const seats = extractedData.counts?.find(c => c.type === 'seats')

    // Smart time parsing: combine date + time if both present
    let departureTime: string
    if (extractedData.times && extractedData.times.length > 0) {
      // Check if we have both a date (tomorrow, monday) AND a time (3:30 PM)
      const dateTime = extractedData.times.find(t => /tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(t.text))
      const clockTime = extractedData.times.find(t => /\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)/i.test(t.text))

      if (dateTime && clockTime) {
        // Combine them: use date from dateTime, time from clockTime
        departureTime = combineDateTime(dateTime.text, clockTime.text)
      } else {
        // Use the first time we have
        departureTime = parseTimeToISO(extractedData.times[0].text)
      }
    } else {
      // No time specified, default to tomorrow at current time
      departureTime = new Date(Date.now() + 24*60*60*1000).toISOString()
    }

    // Only build payload if we have the required fields for a ride
    if (origin && destination) {
      const payload: any = {
        origin: {
          address: origin.text,
          lat: origin.lat || 0, // Use real coordinates if available
          lng: origin.lng || 0
        },
        destination: {
          address: destination.text,
          lat: destination.lat || 0, // Use real coordinates if available
          lng: destination.lng || 0
        },
        seats_needed: seats?.value || 1, // Default to 1 seat if not specified
        departure_time: departureTime
      }
      return payload
    }
  }

  if (requestType === 'service' && extractedData.budget) {
    return {
      budget_range: extractedData.budget
    }
  }

  if (requestType === 'event') {
    const location = extractedData.locations?.[0]
    const time = extractedData.times?.[0]
    const participants = extractedData.counts?.find(c => c.type === 'people' || c.type === 'volunteers')

    if (location || time || participants) {
      return {
        location: location ? {
          address: location.text,
          lat: 0,
          lng: 0,
          is_virtual: false
        } : undefined,
        event_date: time ? parseTimeToISO(time.text) : undefined,
        participants_needed: participants?.value
      }
    }
  }

  if (requestType === 'borrow') {
    // Extract duration from "X days" pattern
    const durationMatch = parsed.description.match(/(\d+)[-\s]?days?/i)
    if (durationMatch) {
      return {
        duration_days: parseInt(durationMatch[1])
      }
    }
  }

  return {}
}

/**
 * Combine date and time strings into a single ISO datetime
 * Example: combineDateTime("tomorrow", "3:30 PM") → tomorrow at 3:30 PM
 */
function combineDateTime(dateText: string, timeText: string): string {
  const now = new Date()
  let targetDate = new Date(now)

  // Parse date part
  if (/tomorrow/i.test(dateText)) {
    targetDate.setDate(targetDate.getDate() + 1)
  } else if (/today/i.test(dateText)) {
    // Keep current date
  } else {
    // Day of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayMatch = dateText.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i)
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch[0].toLowerCase())
      const currentDay = now.getDay()
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7
      targetDate.setDate(targetDate.getDate() + daysUntil)
    }
  }

  // Parse time part
  const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const meridiem = timeMatch[3]?.toLowerCase()

    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0

    targetDate.setHours(hours, minutes, 0, 0)
  }

  return targetDate.toISOString()
}

/**
 * Parse natural language time to ISO string
 */
function parseTimeToISO(timeText: string): string {
  const now = new Date()

  // Tomorrow
  if (/tomorrow/i.test(timeText)) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString()
  }

  // Today
  if (/today|tonight/i.test(timeText)) {
    return now.toISOString()
  }

  // Day of week
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayMatch = timeText.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i)
  if (dayMatch) {
    const targetDay = days.indexOf(dayMatch[0].toLowerCase())
    const currentDay = now.getDay()
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + daysUntil)
    return targetDate.toISOString()
  }

  // Time (5pm, 14:30, 3:30 PM, 3:30PM)
  const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const meridiem = timeMatch[3]?.toLowerCase()

    if (meridiem === 'pm' && hours < 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0

    const targetDate = new Date(now)
    targetDate.setHours(hours, minutes, 0, 0)

    // If the time has already passed today, assume they mean tomorrow
    if (targetDate < now) {
      targetDate.setDate(targetDate.getDate() + 1)
    }

    return targetDate.toISOString()
  }

  // ISO date
  if (/\d{4}-\d{2}-\d{2}/.test(timeText)) {
    return new Date(timeText).toISOString()
  }

  return now.toISOString()
}

/**
 * Get suggestions for autocomplete
 */
export interface AutocompleteSuggestion {
  value: string
  label: string
  description?: string
  icon?: string
  category?: 'time' | 'location' | 'count' | 'budget' | 'urgency' | 'navigation'
}

export function getSuggestions(
  text: string,
  cursorPos: number,
  requestType: string
): { suggestions: AutocompleteSuggestion[]; trigger: '@' | '#' | '$' | '!' | '..' | '>>' | null } {
  const beforeCursor = text.slice(0, cursorPos)
  const lastChar = beforeCursor[beforeCursor.length - 1]
  const lastTwoChars = beforeCursor.slice(-2)

  // .. suggestions (origin)
  if (lastTwoChars === '..') {
    return {
      trigger: '..',
      suggestions: [
        { value: '.. downtown', label: 'downtown', description: 'City center', icon: '🏙️', category: 'location' },
        { value: '.. home', label: 'home', description: 'My address', icon: '🏠', category: 'location' },
        { value: '.. airport', label: 'airport', description: 'Local airport', icon: '✈️', category: 'location' },
        { value: '.. office', label: 'office', description: 'Work location', icon: '🏢', category: 'location' },
      ]
    }
  }

  // >> suggestions (destination)
  if (lastTwoChars === '>>') {
    return {
      trigger: '>>',
      suggestions: [
        { value: '>> airport', label: 'airport', description: 'Local airport', icon: '✈️', category: 'location' },
        { value: '>> downtown', label: 'downtown', description: 'City center', icon: '🏙️', category: 'location' },
        { value: '>> home', label: 'home', description: 'My address', icon: '🏠', category: 'location' },
        { value: '>> station', label: 'station', description: 'Train/bus station', icon: '🚉', category: 'location' },
      ]
    }
  }

  // @ suggestions (locations and times)
  // Check if we're typing after an @ symbol (not just immediately after)
  const atMatch = beforeCursor.match(/@([a-zA-Z0-9\s\-]*)$/i)
  if (lastChar === '@' || atMatch) {
    const suggestions: AutocompleteSuggestion[] = [
      // Times (always show)
      { value: '@tomorrow', label: 'tomorrow', description: 'Next day', icon: '📅', category: 'time' },
      { value: '@today', label: 'today', description: 'Same day', icon: '📅', category: 'time' },
      { value: '@tonight', label: 'tonight', description: 'This evening', icon: '🌙', category: 'time' },
      { value: '@monday', label: 'monday', description: 'Next Monday', icon: '📅', category: 'time' },
      { value: '@friday', label: 'friday', description: 'Next Friday', icon: '📅', category: 'time' },
      { value: '@saturday', label: 'saturday', description: 'Next Saturday', icon: '📅', category: 'time' },
      { value: '@sunday', label: 'sunday', description: 'Next Sunday', icon: '📅', category: 'time' },
      { value: '@5pm', label: '5pm', description: '5:00 PM', icon: '🕔', category: 'time' },
      { value: '@9am', label: '9am', description: '9:00 AM', icon: '🕘', category: 'time' },
      { value: '@next week', label: 'next week', description: '7 days from now', icon: '📅', category: 'time' },
    ]

    // Add location suggestions for ride/event types
    if (requestType === 'ride' || requestType === 'event' || requestType === 'service') {
      suggestions.push(
        { value: '@downtown', label: 'downtown', description: 'City center', icon: '🏙️', category: 'location' },
        { value: '@home', label: 'home', description: 'My address', icon: '🏠', category: 'location' },
        { value: '@airport', label: 'airport', description: 'Local airport', icon: '✈️', category: 'location' },
        { value: '@office', label: 'office', description: 'Work location', icon: '🏢', category: 'location' },
        { value: '@park', label: 'park', description: 'Local park', icon: '🌳', category: 'location' },
        { value: '@beach', label: 'beach', description: 'Nearest beach', icon: '🏖️', category: 'location' },
      )
    }

    return { trigger: '@', suggestions }
  }

  // # suggestions (counts based on request type)
  if (lastChar === '#') {
    const suggestions: AutocompleteSuggestion[] = []

    if (requestType === 'ride') {
      suggestions.push(
        { value: '#1seat', label: '1 seat', description: 'Solo passenger', icon: '💺', category: 'count' },
        { value: '#2seats', label: '2 seats', description: 'Two passengers', icon: '💺', category: 'count' },
        { value: '#3seats', label: '3 seats', description: 'Three passengers', icon: '💺', category: 'count' },
        { value: '#4seats', label: '4 seats', description: 'Four passengers', icon: '💺', category: 'count' },
      )
    } else if (requestType === 'event') {
      suggestions.push(
        { value: '#5people', label: '5 people', description: 'Small group', icon: '👥', category: 'count' },
        { value: '#10people', label: '10 people', description: 'Medium group', icon: '👥', category: 'count' },
        { value: '#20volunteers', label: '20 volunteers', description: 'Community event', icon: '🙋', category: 'count' },
        { value: '#50participants', label: '50 participants', description: 'Large event', icon: '👥', category: 'count' },
      )
    } else {
      suggestions.push(
        { value: '#1', label: '1', description: 'Single item/person', icon: '1️⃣', category: 'count' },
        { value: '#2', label: '2', description: 'Two items/people', icon: '2️⃣', category: 'count' },
        { value: '#5', label: '5', description: 'Five items/people', icon: '5️⃣', category: 'count' },
      )
    }

    return { trigger: '#', suggestions }
  }

  // $ suggestions (budget)
  if (lastChar === '$') {
    return {
      trigger: '$',
      suggestions: [
        { value: '$0-50', label: '$0-50', description: 'Budget friendly', icon: '💵', category: 'budget' },
        { value: '$50-100', label: '$50-100', description: 'Moderate cost', icon: '💵', category: 'budget' },
        { value: '$100-200', label: '$100-200', description: 'Standard rate', icon: '💰', category: 'budget' },
        { value: '$200-500', label: '$200-500', description: 'Premium service', icon: '💰', category: 'budget' },
        { value: '$500-1000', label: '$500-1000', description: 'High-end service', icon: '💎', category: 'budget' },
      ]
    }
  }

  // ! suggestions (urgency)
  if (lastChar === '!') {
    return {
      trigger: '!',
      suggestions: [
        { value: '!urgent', label: 'urgent', description: 'Need help ASAP', icon: '🔴', category: 'urgency' },
        { value: '!high', label: 'high', description: 'High priority', icon: '🟠', category: 'urgency' },
        { value: '!medium', label: 'medium', description: 'Normal priority', icon: '🟡', category: 'urgency' },
        { value: '!low', label: 'low', description: 'Can wait', icon: '🟢', category: 'urgency' },
      ]
    }
  }

  return { trigger: null, suggestions: [] }
}
