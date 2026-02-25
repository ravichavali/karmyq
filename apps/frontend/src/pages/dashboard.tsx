import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { requestService, communityService } from '@/lib/api'
import { feedApi } from '@/lib/api'
import Layout from '@/components/Layout'
import InlineChat from '@/components/InlineChat'
import LeftSidebar from '@/components/LeftSidebar'
import RightSidebar from '@/components/RightSidebar'
import MilestonePost from '@/components/MilestonePost'
import ExtractedDataChips from '@/components/ExtractedDataChips'
import EnhancedAutocomplete from '@/components/EnhancedAutocomplete'
import OfferItem from '@/components/OfferItem'
import TrustPathBadge, { TrustPathBadgeSkeleton } from '@/components/TrustPathBadge'
import { useTrustPath } from '@/hooks/useTrustPath'

function FeedPostTrustBadge({ requesterId }: { requesterId?: string }) {
  const { trustPath, loading } = useTrustPath(requesterId)
  if (loading) return <TrustPathBadgeSkeleton compact />
  if (!trustPath) return null
  return <TrustPathBadge trustPath={trustPath} compact />
}
import { parseRequestDescription, buildPayloadFromParsed, updateLocationCoordinates, getSuggestions, type ParsedRequest, type AutocompleteSuggestion } from '@/lib/requestParser'
import DynamicForm from '@/components/requests/DynamicForm'
import type { UISchema } from '@karmyq/shared/schemas/ui'

// Build a human-readable title + description from a structured form payload using the schema summary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFormSummary(schema: UISchema, payload: Record<string, any>): { title: string; description: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getNestedValue(obj: Record<string, any>, path: string): unknown {
    if (!path) return undefined
    return path.split('.').reduce((cur: any, key) => (cur != null ? cur[key] : undefined), obj)
  }
  function formatValue(raw: unknown): string {
    if (raw == null || raw === '') return ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof raw === 'object' && raw !== null && 'address' in raw) return String((raw as any).address)
    if (typeof raw === 'string' && /\d{4}-\d{2}-\d{2}T/.test(raw)) {
      try { return new Date(raw).toLocaleString() } catch { return raw }
    }
    return String(raw)
  }
  if (!schema.summary) {
    return { title: schema.label, description: schema.label + ' request' }
  }
  const parts = schema.summary.fields
    .map((key) => {
      const val = formatValue(getNestedValue(payload, key))
      if (!val) return null
      const label = schema.summary!.labels?.[key] || key
      return `${label}: ${val}`
    })
    .filter(Boolean) as string[]
  const description = parts.length > 0
    ? `${schema.label} — ${parts.join(' | ')}` 
    : schema.label + ' request'
  return { title: description.slice(0, 100), description }
}

// Per-session schema cache, keyed by build ID — a new deploy automatically busts all cached schemas
const BUILD_ID = typeof window !== "undefined" ? (window as any).__NEXT_DATA__?.buildId ?? "dev" : "dev"
const schemaCache: Record<string, UISchema> = {}

interface HelpRequest {
  id: string
  title: string
  description: string
  status: string
  urgency: string
  category: string
  community_id: string
  community_name: string
  requester_id: string
  requester_name?: string
  created_at: string
}

interface Match {
  id: string
  request_id: string
  responder_id: string
  status: string
  created_at: string
  responder_name?: string
  requester_name?: string
  request_description?: string
  request_type?: string
  payload?: Record<string, any>
  scheduled_at?: string
  request_title?: string
}

interface Community {
  id: string
  name: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Quick create state
  const [description, setDescription] = useState('')
  const [postingMode, setPostingMode] = useState<'all' | 'specific'>('all')
  const [visibilityScope, setVisibilityScope] = useState<'community' | 'trust_network' | 'platform'>('community')
  const [selectedCommunity, setSelectedCommunity] = useState<string>('')
  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [creating, setCreating] = useState(false)
  const [requestType, setRequestType] = useState<string | null>(null)
  const [availableTypes, setAvailableTypes] = useState<{ value: string; label: string; icon: string }[]>([
    { value: 'generic', label: 'General', icon: '🤝' },
    { value: 'ride', label: 'Ride', icon: '🚗' },
    { value: 'service', label: 'Service', icon: '🔧' },
    { value: 'event', label: 'Event', icon: '🎉' },
    { value: 'borrow', label: 'Borrow', icon: '📦' },
  ])
  const [parsedRequest, setParsedRequest] = useState<ParsedRequest | null>(null)
  const [currentSchema, setCurrentSchema] = useState<UISchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [dynamicPayload, setDynamicPayload] = useState<Record<string, any>>({})
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [autocompleteTrigger, setAutocompleteTrigger] = useState<'@' | '#' | '$' | '!' | '..' | '>>' | null>(null)
  const [autocompleteTriggerPosition, setAutocompleteTriggerPosition] = useState<number>(-1)
  const [searchQuery, setSearchQuery] = useState('')
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)

  // Unified feed
  const [feedItems, setFeedItems] = useState<any[]>([])
  const [milestones, setMilestones] = useState<any[]>([])
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [activeCommunityId, setActiveCommunityId] = useState<string>('')

  useEffect(() => {
    // Only run on client-side (not during SSR)
    if (typeof window === 'undefined') {
      return
    }

    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      router.push('/login')
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      fetchDashboardData(parsedUser.id)
    }

    setLoading(false)

    // Fetch all published schemas to populate request type buttons
    requestService.getSchemas().then((res) => {
      const schemas = res.data?.schemas ?? res.data ?? []
      if (Array.isArray(schemas) && schemas.length > 0) {
        const BUILT_IN = new Set(['generic', 'ride', 'service', 'event', 'borrow'])
        const custom = schemas
          .filter((s: any) => !BUILT_IN.has(s.type))
          .map((s: any) => ({ value: s.type, label: s.label ?? s.type, icon: s.icon ?? '✨' }))
        if (custom.length > 0) {
          setAvailableTypes((prev) => {
            const existing = new Set(prev.map((t) => t.value))
            const deduped = custom.filter((t: { value: string }) => !existing.has(t.value))
            return deduped.length > 0 ? [...prev, ...deduped] : prev
          })
        }
      }
    }).catch(() => { /* silently ignore — built-in types still show */ })
  }, [router])

  const handleCommunityChange = (communityId: string) => {
    setActiveCommunityId(communityId)
    // Refresh milestones for the new community
    if (communityId) {
      fetchMilestonesForCommunity(communityId)
    }
  }

  const fetchMilestonesForCommunity = async (communityId: string) => {
    try {
      const milestonesRes = await feedApi.get(`/feed/milestones?community_id=${communityId}&limit=5`)
      setMilestones(milestonesRes.data || [])
    } catch (err) {
      console.error('Failed to fetch milestones:', err)
      setMilestones([])
    }
  }

  const fetchDashboardData = async (userId: string) => {
    try {
      setLoading(true)

      // Fetch all data in parallel
      const [myRequestsRes, allMatchesRes, suggestedRes, matchedRequestsRes, communitiesRes] = await Promise.all([
        requestService.getRequests({ requester_id: userId, limit: 50 }), // Get MY requests (all statuses)
        requestService.getMatches({ limit: 100 }),
        requestService.getRequests({ status: 'open', limit: 50 }), // Get community requests (open only)
        requestService.getRequests({ status: 'matched', limit: 50 }), // Get matched requests (for offers I'm helping with)
        communityService.getMyCommunities(userId),
      ])

      // Fetch milestones for first community
      try {
        const communities = communitiesRes.data.communities || []
        if (communities.length > 0) {
          // Set the first community as active if not already set
          if (!activeCommunityId) {
            setActiveCommunityId(communities[0].id)
          }
          // TODO: Re-enable when milestone_events table is created (See ROADMAP.md Backlog #24)
          // const communityToUse = activeCommunityId || communities[0].id
          // const milestonesRes = await feedApi.get(`/feed/milestones?community_id=${communityToUse}&limit=5`)
          // setMilestones(milestonesRes.data || [])
          setMilestones([]) // Temporarily disabled
        }
      } catch (err) {
        console.error('Failed to fetch milestones:', err)
        setMilestones([])
      }

      const allRequests = myRequestsRes.data.requests || []
      const allMatches = allMatchesRes.data.matches || []
      const suggestedRequests = suggestedRes.data.requests || []
      const matchedRequests = matchedRequestsRes.data.requests || []

      // Combine all requests (my requests + open requests + matched requests) for lookup
      const allRequestsCombined = [...allRequests, ...suggestedRequests, ...matchedRequests]

      // Build unified feed with post-and-comment structure
      // Priority order: matched requests → accepted offers → community requests → global posts
      const feed: any[] = []

      // No more deduplication needed! Backend now creates ONE request per logical post
      // (linked to multiple communities via junction table)

      // PRIORITY 1: My Requests with Matched/Accepted Offers (Amber - Highest Priority)
      const myRequestsMatched = allRequests.filter(
        (r: HelpRequest) =>
          r.requester_id === userId &&
          allMatches.some((m: Match) => m.request_id === r.id && m.status === 'matched')
      )

      myRequestsMatched.forEach((request: HelpRequest) => {
        const matches = allMatches.filter((m: Match) => m.request_id === request.id)
        feed.push({
          type: 'post',
          priority: 1,
          post: request,
          comments: matches, // All offers/matches are "comments"
          isMyPost: true,
          hasAcceptedOffer: matches.some((m: Match) => m.status === 'matched'),
          timestamp: request.created_at,
        })
      })

      // PRIORITY 2: My Accepted Offers (Blue - I'm helping, they accepted)
      const myAcceptedOffers = allMatches.filter(
        (m: Match) => m.responder_id === userId && m.status === 'matched'
      )

      // Get the unique requests for these offers
      const acceptedOfferRequestIds = new Set(myAcceptedOffers.map((m: Match) => m.request_id))
      const acceptedOfferRequests = allRequestsCombined.filter((r: HelpRequest) => acceptedOfferRequestIds.has(r.id))

      acceptedOfferRequests.forEach((request: HelpRequest) => {
        const myMatch = allMatches.find(
          (m: Match) => m.request_id === request.id && m.responder_id === userId && m.status === 'matched'
        )
        if (myMatch) {
          feed.push({
            type: 'post',
            priority: 2,
            post: request,
            comments: [myMatch], // Only show my thread with the poster
            isMyPost: false,
            isMyOffer: true,
            myMatch,
            timestamp: myMatch.created_at, // Sort by when I offered
          })
        }
      })

      // PRIORITY 3: My Requests with Pending Offers (Amber)
      const myRequestsPending = allRequests.filter(
        (r: HelpRequest) =>
          r.requester_id === userId &&
          r.status === 'open' &&
          !allMatches.some((m: Match) => m.request_id === r.id && m.status === 'matched')
      )

      myRequestsPending.forEach((request: HelpRequest) => {
        const matches = allMatches.filter((m: Match) => m.request_id === request.id)
        feed.push({
          type: 'post',
          priority: 3,
          post: request,
          comments: matches,
          isMyPost: true,
          hasAcceptedOffer: false,
          timestamp: request.created_at,
        })
      })

      // PRIORITY 4: My Pending Offers (Blue - waiting for response)
      const myPendingOffers = allMatches.filter(
        (m: Match) => m.responder_id === userId && m.status === 'proposed'
      )

      const pendingOfferRequestIds = new Set(myPendingOffers.map((m: Match) => m.request_id))
      const pendingOfferRequests = allRequestsCombined.filter((r: HelpRequest) => pendingOfferRequestIds.has(r.id))

      pendingOfferRequests.forEach((request: HelpRequest) => {
        const myMatch = allMatches.find(
          (m: Match) => m.request_id === request.id && m.responder_id === userId && m.status === 'proposed'
        )
        if (myMatch) {
          feed.push({
            type: 'post',
            priority: 4,
            post: request,
            comments: [myMatch], // Only my thread
            isMyPost: false,
            isMyOffer: true,
            myMatch,
            timestamp: myMatch.created_at,
          })
        }
      })

      // PRIORITY 5: Community Requests (White - from my communities, not responded)
      const respondedRequestIds = new Set(
        allMatches.filter((m: Match) => m.responder_id === userId).map((m: Match) => m.request_id)
      )

      const communityReqs = suggestedRequests.filter(
        (r: HelpRequest) => r.requester_id !== userId && !respondedRequestIds.has(r.id)
      )

      communityReqs.forEach((request: HelpRequest) => {
        feed.push({
          type: 'post',
          priority: 5,
          post: request,
          comments: [], // No comments visible (not my post, haven't offered)
          isMyPost: false,
          isMyOffer: false,
          timestamp: request.created_at,
        })
      })

      // Sort by priority first, then by timestamp within each priority
      feed.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority // Lower priority number = higher importance
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setFeedItems(feed)
      setUserCommunities(communitiesRes.data.communities || [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSchema = async (type: string) => {
    if (type === 'generic') {
      setCurrentSchema(null)
      return
    }
    // Use cache only if schema has sections (guards against stale empty-section schemas)
    const cacheKey = BUILD_ID + ":" + type
    const cached = schemaCache[cacheKey]
    if (cached && cached.sections && cached.sections.length > 0) {
      setCurrentSchema(cached)
      return
    }
    try {
      setSchemaLoading(true)
      const response = await requestService.getSchema(type)
      const schema = (response.data?.schema ?? response.data) as UISchema
      if (!schema || !Array.isArray(schema.sections)) {
        setCurrentSchema(null)
        return
      }
      // Normalize: ensure every section has a fields array
      schema.sections = schema.sections.map((s: any) => ({ ...s, fields: s.fields ?? [] }))
      schemaCache[cacheKey] = schema
      setCurrentSchema(schema)
    } catch (error) {
      console.error('Error fetching schema:', error)
      setCurrentSchema(null)
    } finally {
      setSchemaLoading(false)
    }
  }

  const handleDescriptionChange = (newDescription: string, cursorPos?: number) => {
    console.log('📝 handleDescriptionChange called:', { text: newDescription, cursorPos, requestType })
    setDescription(newDescription)

    // Parse in real-time
    if (newDescription.trim()) {
      const parsed = parseRequestDescription(newDescription, requestType ?? 'generic')
      setParsedRequest(parsed)
    } else {
      setParsedRequest(null)
    }

    // Show autocomplete suggestions and extract search query
    const pos = cursorPos ?? newDescription.length
    const { suggestions, trigger } = getSuggestions(newDescription, pos, requestType ?? 'generic')
    console.log('💡 getSuggestions returned:', { trigger, suggestionsCount: suggestions.length })

    // Extract search query for async geocoding
    // Detect location context even without @ trigger
    const beforeCursor = newDescription.slice(0, pos)
    console.log('🔎 beforeCursor:', beforeCursor)

    if (trigger === '@') {
      // User explicitly used @ for location
      setAutocompleteSuggestions(suggestions)
      setAutocompleteTrigger(trigger)

      const triggerIndex = beforeCursor.lastIndexOf(trigger)
      if (triggerIndex !== -1) {
        const rawQuery = beforeCursor.slice(triggerIndex + trigger.length)
        const query = rawQuery.trim()
        console.log('🔑 @ trigger detected! Query extracted:', {
          triggerIndex,
          rawQuery: `"${rawQuery}"`,
          query: `"${query}"`,
          queryLength: query.length
        })
        setSearchQuery(query)
        setAutocompleteTriggerPosition(triggerIndex)
      } else {
        console.log('❌ @ trigger found but no triggerIndex')
        setSearchQuery('')
        setAutocompleteTriggerPosition(-1)
      }
    } else if (requestType === 'ride') {
      // Smart detection: look for location keywords like "from", "to"
      // Match patterns like: "from San" or "to San" where cursor is after the word
      // IMPORTANT: Both patterns should stop at keywords
      // Use word boundary to ensure " to" is a complete word
      const fromMatch = beforeCursor.match(/from\s+([a-zA-Z0-9\s\-]+?)(?:\s+to(?:\s|$)|$)/i)
      // Fixed: "to" pattern should stop at time keywords (tomorrow, today, at, @) or end
      const toMatch = beforeCursor.match(/to\s+([a-zA-Z0-9\s\-]*?)(?:\s+(?:tomorrow|today|tonight|at|@)|\s*$)/i)

      console.log('🔍 Smart detection:', {
        beforeCursor,
        fromMatch: fromMatch?.[0],
        toMatch: toMatch?.[0],
        requestType
      })

      if (fromMatch || toMatch) {
        // IMPORTANT: Prefer "to" match over "from" match when both exist
        // This ensures that when typing "from X to Y", we autocomplete Y, not X
        const locationText = (toMatch?.[1] || fromMatch?.[1] || '').trim()
        console.log('📍 Location text detected:', locationText, 'Length:', locationText.length)

        // Calculate trigger position for natural language
        // IMPORTANT: Check "to" first since it's closer to cursor in "from X to Y" pattern
        let naturalTriggerPos = -1
        if (toMatch) {
          naturalTriggerPos = beforeCursor.lastIndexOf('to ') + 3 // Start of location text after "to "
        } else if (fromMatch) {
          naturalTriggerPos = beforeCursor.lastIndexOf('from ') + 5 // Start of location text after "from "
        }

        if (locationText.length >= 2) {
          // Trigger geocoding for location context
          // Provide minimal initial suggestions to show the autocomplete
          setAutocompleteSuggestions([
            { value: '@loading', label: 'Searching...', description: 'Loading addresses', icon: '🔍', category: 'location' }
          ])
          setAutocompleteTrigger('@') // Pretend it's @ trigger for autocomplete
          setAutocompleteTriggerPosition(naturalTriggerPos)
          setSearchQuery(locationText)
        } else if (locationText.length > 0) {
          // Show placeholder while typing
          setAutocompleteSuggestions([
            { value: '@typing', label: 'Keep typing...', description: 'Type 2+ characters', icon: '⌨️', category: 'location' }
          ])
          setAutocompleteTrigger('@')
          setAutocompleteTriggerPosition(naturalTriggerPos)
          setSearchQuery('')
        } else {
          setAutocompleteSuggestions([])
          setAutocompleteTrigger(null)
          setAutocompleteTriggerPosition(-1)
          setSearchQuery('')
        }
      } else {
        setAutocompleteSuggestions(suggestions)
        setAutocompleteTrigger(trigger)
        setSearchQuery('')
      }
    } else {
      setAutocompleteSuggestions(suggestions)
      setAutocompleteTrigger(trigger)
      setSearchQuery('')
    }
  }

  const handleSelectSuggestion = (value: string, lat?: number, lng?: number, displayName?: string, category?: string) => {
    if (!textareaRef) return

    const cursorPos = textareaRef.selectionStart
    const beforeCursor = description.slice(0, cursorPos)
    const afterCursor = description.slice(cursorPos)

    // Find where the text to replace starts
    let triggerStart = cursorPos
    let finalValue = value

    // IMPORTANT: Use the saved autocompleteTriggerPosition for all cases
    // This position was calculated correctly during detection and handles "from X to Y" patterns
    if (autocompleteTrigger === '@' && autocompleteTriggerPosition !== -1) {
      // Use the saved trigger position for all @ triggers (including natural language)
      triggerStart = autocompleteTriggerPosition
      // Remove @ prefix for natural language contexts (from/to)
      finalValue = value.replace(/^@/, '')
    } else if (autocompleteTrigger === '..' || autocompleteTrigger === '>>') {
      triggerStart = cursorPos - 2
    } else if (autocompleteTrigger === '@') {
      // Fallback for @ trigger without saved position
      const atIndex = beforeCursor.lastIndexOf('@')
      if (atIndex !== -1) {
        triggerStart = atIndex
      } else {
        triggerStart = cursorPos - 1
      }
    } else {
      triggerStart = cursorPos - 1
    }

    // Replace from trigger to cursor with the selected value
    const newDescription = beforeCursor.slice(0, triggerStart) + finalValue + ' ' + afterCursor

    handleDescriptionChange(newDescription, triggerStart + finalValue.length + 1)

    // Store coordinates and display_name if this is a geocoded location
    if (lat !== undefined && lng !== undefined && parsedRequest) {
      // Extract the address from the value (remove @ prefix)
      const address = value.replace(/^@/, '').trim()
      const updatedRequest = updateLocationCoordinates(parsedRequest, address, lat, lng, displayName)
      setParsedRequest(updatedRequest)
      console.log(`Stored location: "${address}" (${displayName}) at ${lat}, ${lng}`)
    }

    // Clear autocomplete
    setAutocompleteSuggestions([])
    setAutocompleteTrigger(null)
    setAutocompleteTriggerPosition(-1)
    setSearchQuery('')

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.focus()
      const newPos = triggerStart + finalValue.length + 1
      textareaRef.setSelectionRange(newPos, newPos)
    }, 0)
  }

  const handleCloseAutocomplete = () => {
    setAutocompleteSuggestions([])
    setAutocompleteTrigger(null)
    setAutocompleteTriggerPosition(-1)
  }

  const handleRemoveExtractedData = (type: string, index: number) => {
    // Remove extracted data chip (just visual feedback for now)
    // User can manually edit description to remove
    console.log('Remove', type, index)
  }

  const handleCreateRequest = async () => {
    const hasStructuredFormData = currentSchema && currentSchema.sections.length > 0 && Object.keys(dynamicPayload).length > 0
    if (!description.trim() && !hasStructuredFormData) return

    try {
      setCreating(true)

      // Build payload: prefer dynamicPayload (schema-driven), fall back to NLP-parsed
      const hasStructuredForm = currentSchema && currentSchema.sections.length > 0
      const nlpPayload = parsedRequest ? buildPayloadFromParsed(parsedRequest, requestType ?? 'generic') : {}
      const payload = hasStructuredForm
        ? { ...nlpPayload, ...dynamicPayload }
        : nlpPayload

      // Use urgency from parsed data if available
      const urgency = parsedRequest?.extractedData.urgency || 'medium'

      // Generate title and description from the form summary when no text description is provided
      const formSummary = hasStructuredForm && currentSchema
        ? generateFormSummary(currentSchema, dynamicPayload)
        : null

      const requestData = {
        post_to_all_communities: postingMode === 'all',
        community_id: postingMode === 'specific' ? selectedCommunity : undefined,
        title: formSummary?.title || description.trim().slice(0, 100) || 'Help request',
        description: (() => {
          // For structured forms: combine schema summary with any additional context the user typed
          if (formSummary) {
            const extra = description.trim()
            return extra ? formSummary.description + '\n\n' + extra : formSummary.description
          }
          return parsedRequest?.cleanDescription || description.trim() || 'Help request'
        })(),
        request_type: requestType ?? 'generic',
        urgency,
        payload: Object.keys(payload).length > 0 ? payload : undefined,
        visibility_scope: visibilityScope,
      }

      // DEBUG: Log what we're sending
      console.log('=== CREATE REQUEST DEBUG ===')
      console.log('Original description:', description)
      console.log('Request type:', requestType)
      console.log('Parsed request:', parsedRequest)
      console.log('Built payload:', payload)
      console.log('Final request data:', requestData)
      console.log('===========================')

      console.log('About to call requestService.createRequest...')
      const result = await requestService.createRequest(requestData)
      console.log('Request created successfully!', result)

      // Clear form and refresh
      setDescription('')
      setParsedRequest(null)
      setPostingMode('all')
      setSelectedCommunity('')
      setVisibilityScope('community')
      setRequestType('generic')
      setCurrentSchema(null)
      setDynamicPayload({})

      // Add small delay to ensure backend has processed the request before refreshing
      if (user) {
        setTimeout(async () => {
          await fetchDashboardData(user.id)
        }, 500)
      }
    } catch (error: any) {
      console.error('Error creating request:', error)
      console.error('Error response:', error.response?.data)

      // Show detailed validation errors
      const errorMessage = error.response?.data?.message || 'Failed to create request'
      const errorDetails = error.response?.data?.errors
        ? '\n\nValidation errors:\n' + JSON.stringify(error.response.data.errors, null, 2)
        : ''

      alert(errorMessage + errorDetails)
    } finally {
      setCreating(false)
    }
  }

  const handleOfferToHelp = async (requestId: string) => {
    if (!user) return

    try {
      await requestService.createMatch({
        request_id: requestId,
        responder_id: user.id,
      })

      // Refresh data to show as "YOUR OFFER" - no popup needed
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error offering to help:', error)
      // Only show alert on error
      alert(error.response?.data?.message || 'Failed to offer help')
    }
  }

  const handleAcceptMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.acceptMatch(matchId, user.id)
      // Refresh data to show updated status
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error accepting match:', error)
      alert(error.response?.data?.message || 'Failed to accept offer')
    }
  }

  const handleRejectMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.rejectMatch(matchId, user.id)
      // Refresh data
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error rejecting match:', error)
      alert(error.response?.data?.message || 'Failed to reject offer')
    }
  }

  const handleCompleteMatch = async (matchId: string) => {
    if (!user) return

    try {
      await requestService.completeMatch(matchId, user.id)
      // Refresh data to show completed status
      await fetchDashboardData(user.id)
    } catch (error: any) {
      console.error('Error completing match:', error)
      alert(error.response?.data?.message || 'Failed to mark complete')
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-text-muted mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard - Karmyq</title>
      </Head>
      <Layout>
        <div className="min-h-screen bg-surface">
          {/* 3-Column Layout */}
          <div className="container mx-auto px-4 py-4 max-w-7xl">
            <div className="grid grid-cols-12 gap-4">
              {/* Left Sidebar - 25% */}
              <div className="col-span-12 lg:col-span-3 hidden lg:block">
                <div className="sticky top-4">
                  <LeftSidebar
                    user={user}
                    communities={userCommunities}
                    activeCommunityId={activeCommunityId || userCommunities[0]?.id}
                  />
                </div>
              </div>

              {/* Center Feed - 50% */}
              <div className="col-span-12 lg:col-span-6">
                {/* Quick Create - Compact */}
                <div className="bg-surface-raised rounded-xl shadow-sm p-4 mb-4 border border-border">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  {/* Request Type Selector — always visible, no default */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {availableTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setRequestType(type.value)
                          setDynamicPayload({})
                          fetchSchema(type.value)
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          requestType === type.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-border-light text-text-muted hover:bg-gray-200'
                        }`}
                      >
                        <span className="mr-1">{type.icon}</span>
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Form body — only shown after type is selected */}
                  {requestType && (
                    <>
                      {/* Schema-driven dynamic form for structured types */}
                      {schemaLoading && (
                        <div className="text-xs text-text-subtle py-2">Loading form…</div>
                      )}
                      {!schemaLoading && currentSchema && currentSchema.sections.length > 0 && (
                        <div className="mb-3">
                          <DynamicForm
                            schema={currentSchema}
                            value={dynamicPayload}
                            onChange={setDynamicPayload}
                          />
                        </div>
                      )}

                      {/* Textarea: plain for structured forms, smart for generic */}
                      {currentSchema && currentSchema.sections.length > 0 ? (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-text-muted mb-1">Additional context <span className="text-text-subtle font-normal">(optional — appended to your post)</span></p>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add any extra context for community members..."
                            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            rows={2}
                          />
                        </div>
                      ) : (
                        <div className="relative mb-2">
                          <textarea
                            ref={setTextareaRef}
                            value={description}
                            onChange={(e) => handleDescriptionChange(e.target.value, e.target.selectionStart)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' && autocompleteSuggestions.length > 0) {
                                e.preventDefault()
                                handleCloseAutocomplete()
                              }
                            }}
                            placeholder="What do you need help with? Tip: Use @time, @location, #count, $budget, !urgent"
                            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            rows={2}
                          />
                          {autocompleteSuggestions.length > 0 && (
                            <EnhancedAutocomplete
                              suggestions={autocompleteSuggestions}
                              onSelect={handleSelectSuggestion}
                              onClose={handleCloseAutocomplete}
                              triggerChar={autocompleteTrigger}
                              searchQuery={searchQuery}
                            />
                          )}
                        </div>
                      )}

                      {parsedRequest && !currentSchema && (
                        <ExtractedDataChips
                          parsed={parsedRequest}
                          onRemove={handleRemoveExtractedData}
                        />
                      )}
                    </>
                  )}

                  {!requestType && (
                    <p className="text-xs text-text-subtle mb-2">Select a type above to get started</p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPostingMode('all')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          postingMode === 'all'
                            ? 'bg-primary-light text-primary-dark'
                            : 'bg-border-light text-text-muted hover:bg-gray-200'
                        }`}
                      >
                        All Communities
                      </button>
                      <button
                        onClick={() => setPostingMode('specific')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          postingMode === 'specific'
                            ? 'bg-primary-light text-primary-dark'
                            : 'bg-border-light text-text-muted hover:bg-gray-200'
                        }`}
                      >
                        Specific
                      </button>
                    </div>
                    <button
                      onClick={handleCreateRequest}
                      disabled={!requestType || creating || (!description.trim() && !(currentSchema && currentSchema.sections.length > 0 && Object.keys(dynamicPayload).length > 0))}
                      className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {creating ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                  {postingMode === 'specific' && (
                    <div className="mt-2">
                      <select
                        value={selectedCommunity}
                        onChange={(e) => setSelectedCommunity(e.target.value)}
                        className="w-full px-3 py-1.5 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      >
                        <option value="">Select a community...</option>
                        {userCommunities.map((community) => (
                          <option key={community.id} value={community.id}>
                            {community.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-text-subtle mb-1.5">Who can see this request?</p>
                    <div className="flex items-center gap-2">
                      {([
                        { value: 'community', label: '🏘 Community', title: 'My community only' },
                        { value: 'trust_network', label: '🤝 Trust network', title: 'My connections up to 3°' },
                        { value: 'platform', label: '🌐 Everyone', title: 'All Karmyq members' },
                      ] as const).map(({ value, label, title }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVisibilityScope(value)}
                          title={title}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            visibilityScope === value
                              ? 'bg-primary-light text-primary-dark'
                              : 'bg-border-light text-text-muted hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

                {/* Feed Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-text">Your Feed</h2>
                  <button className="text-xs text-text-subtle hover:text-text-muted">
                    Filter
                  </button>
                </div>

                {/* Milestone Posts - Compact */}
                {milestones.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {milestones.map((milestone: any) => (
                      <MilestonePost
                        key={milestone.id}
                        {...milestone}
                      />
                    ))}
                  </div>
                )}

                {feedItems.length === 0 ? (
                  <div className="bg-surface-raised rounded-xl p-8 text-center border border-border">
                    <div className="text-4xl mb-3">🤝</div>
                    <h3 className="text-lg font-semibold text-text-muted mb-2">No activity yet</h3>
                    <p className="text-sm text-text-subtle">
                      Create a request above or check back later
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                  {feedItems.map((item, index) => {
                    const { post, comments, isMyPost, isMyOffer, hasAcceptedOffer, myMatch, priority } = item

                    // Determine post styling based on type
                    let bgColor = 'bg-surface-raised'
                    let borderColor = 'border-border'
                    let badgeColor = 'bg-border-light text-text-muted'
                    let badgeText = ''

                    if (isMyPost && hasAcceptedOffer) {
                      bgColor = 'bg-karmyq-orange-50'
                      borderColor = 'border-l-4 border-amber-400'
                      badgeColor = 'bg-karmyq-orange-100 text-karmyq-orange-700'
                      badgeText = '✓ YOUR REQUEST - MATCHED'
                    } else if (isMyPost) {
                      bgColor = 'bg-karmyq-orange-50'
                      borderColor = 'border-l-4 border-amber-400'
                      badgeColor = 'bg-karmyq-orange-100 text-karmyq-orange-700'
                      badgeText = 'YOUR REQUEST'
                    } else if (isMyOffer && myMatch?.status === 'matched') {
                      bgColor = 'bg-primary-light'
                      borderColor = 'border-l-4 border-primary'
                      badgeColor = 'bg-primary-light text-primary-dark'
                      badgeText = '✓ YOU\'RE HELPING'
                    } else if (isMyOffer && myMatch?.status === 'proposed') {
                      bgColor = 'bg-primary-light'
                      borderColor = 'border-l-4 border-primary'
                      badgeColor = 'bg-primary-light text-primary-dark'
                      badgeText = 'YOUR OFFER'
                    }

                    return (
                      <div
                        key={`post-${post.id}-${index}`}
                        className={`${bgColor} ${borderColor} rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                      >
                        <div className="p-4">
                          {/* Post Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                {post.requester_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-text flex items-center gap-1 flex-wrap">
                                  <span className="truncate">{post.requester_name || 'Unknown'}</span>
                                  {!isMyPost && <FeedPostTrustBadge requesterId={post.requester_id} />}
                                </p>
                                <p className="text-xs text-text-subtle">{formatTime(post.created_at)}</p>
                              </div>
                            </div>
                            {badgeText && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeColor} whitespace-nowrap`}>{badgeText}</span>
                            )}
                          </div>

                          {/* Post Content */}
                          <p className="text-text text-sm leading-relaxed mb-2">{post.description}</p>

                          {/* Post Meta */}
                          <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              {post.community_name}
                            </span>
                            {comments.length > 0 && isMyPost && (
                              <span className="text-text-muted font-medium">
                                💬 {comments.length} {comments.length === 1 ? 'offer' : 'offers'}
                              </span>
                            )}
                          </div>

                          {/* Action Button - Only for community requests */}
                          {!isMyPost && !isMyOffer && (
                            <button
                              onClick={() => handleOfferToHelp(post.id)}
                              className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                            >
                              💬 Offer to Help
                            </button>
                          )}

                          {/* Comments Section - Offers/Responses */}
                          {comments.length > 0 && (() => {
                            // Sort comments: accepted first, then by created_at
                            const sortedComments = [...comments].sort((a, b) => {
                              // Accepted (matched) come first
                              if (a.status === 'matched' && b.status !== 'matched') return -1
                              if (a.status !== 'matched' && b.status === 'matched') return 1
                              // Otherwise sort by creation time (newest first)
                              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                            })

                            // Show top 3 comments by default, or all if expanded
                            const isExpanded = expandedPosts.has(post.id)
                            const visibleComments = isExpanded ? sortedComments : sortedComments.slice(0, 3)
                            const hasMore = sortedComments.length > 3

                            return (
                            <div className="mt-4 pt-4 border-t border-border">
                              <h3 className="text-sm font-semibold text-text mb-3">
                                {isMyPost ? `Responses (${comments.length})` : 'Your Conversation'}
                              </h3>
                              <div className="space-y-3">
                                {visibleComments.map((comment: Match) => (
                                  <OfferItem
                                    key={comment.id}
                                    comment={comment}
                                    isMyPost={isMyPost}
                                    currentUserId={user.id}
                                    onAccept={handleAcceptMatch}
                                    onReject={handleRejectMatch}
                                    onComplete={handleCompleteMatch}
                                    formatTime={formatTime}
                                  />
                                ))}

                                {/* Show More/Less Button */}
                                {hasMore && (
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedPosts)
                                      if (isExpanded) {
                                        newExpanded.delete(post.id)
                                      } else {
                                        newExpanded.add(post.id)
                                      }
                                      setExpandedPosts(newExpanded)
                                    }}
                                    className="w-full py-2 text-sm text-primary hover:text-primary-dark font-medium transition-colors"
                                  >
                                    {isExpanded
                                      ? `Show Less ↑`
                                      : `Show ${sortedComments.length - 3} More Responses ↓`
                                    }
                                  </button>
                                )}
                              </div>
                            </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>

              {/* Right Sidebar - 25% */}
              <div className="col-span-12 lg:col-span-3 hidden lg:block">
                <div className="sticky top-4">
                  <RightSidebar communityId={activeCommunityId || userCommunities[0]?.id} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
