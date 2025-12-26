# Polymorphic Request Forms - Implementation Complete ✅

## Summary

All 5 polymorphic request form components have been successfully implemented, along with the two-step wizard orchestration in the main request creation page.

---

## Components Created

### 1. **RequestTypeSelector.tsx** ✅
**Location**: `apps/frontend/src/components/requests/RequestTypeSelector.tsx`

**Features**:
- Visual card-based selector with icons and descriptions
- 5 request types: Generic, Ride, Service, Event, Borrow
- Color-coded cards with hover states
- Selected state with checkmark indicator
- Helpful descriptions for each type

**Props**:
```typescript
{
  selectedType: RequestType | null
  onSelectType: (type: RequestType) => void
}
```

---

### 2. **Shared Components** ✅

#### **LocationPicker.tsx**
**Location**: `apps/frontend/src/components/requests/shared/LocationPicker.tsx`

**Features**:
- Address input with GPS coordinate capture
- Returns `{ address, lat, lng }` format
- Placeholder geocoding (generates SF Bay Area coordinates)
- TODO: Integrate real geocoding API (Google Maps/Mapbox)

**Props**:
```typescript
{
  label: string
  value: Location | null
  onChange: (location: Location) => void
  placeholder?: string
  required?: boolean
}
```

#### **DateTimePicker.tsx**
**Location**: `apps/frontend/src/components/requests/shared/DateTimePicker.tsx`

**Features**:
- ISO 8601 datetime input/output
- Converts between ISO and `datetime-local` format
- Minimum date validation
- Optional help text

**Props**:
```typescript
{
  label: string
  value: string  // ISO 8601
  onChange: (datetime: string) => void
  minDate?: string
  required?: boolean
  helpText?: string
}
```

---

### 3. **RideRequestForm.tsx** ✅
**Location**: `apps/frontend/src/components/requests/RideRequestForm.tsx`

**Features**:
- Origin/destination location pickers
- Seats needed selector (1-6)
- Departure time picker
- Preference checkboxes:
  - Women-only ride
  - Pet-friendly
  - Wheelchair accessible
- Trip summary display

**Payload Interface**:
```typescript
{
  origin: Location
  destination: Location
  seats_needed: number
  departure_time: string
  preferences?: {
    women_only?: boolean
    pet_friendly?: boolean
    wheelchair_accessible?: boolean
  }
}
```

---

### 4. **ServiceRequestForm.tsx** ✅
**Location**: `apps/frontend/src/components/requests/ServiceRequestForm.tsx`

**Features**:
- 15 service categories (plumbing, electrical, tutoring, etc.)
- Skill level selector (beginner, intermediate, expert)
- Location type (on-site, remote, hybrid)
- Duration input
- Budget range with currency
- Preferred schedule:
  - Days of week selector
  - Time of day (morning, afternoon, evening, flexible)
- Service summary display

**Payload Interface**:
```typescript
{
  service_category: string
  skill_level_required?: 'beginner' | 'intermediate' | 'expert'
  estimated_duration_hours?: number
  location_type?: 'remote' | 'on_site' | 'hybrid'
  budget_range?: {
    min: number
    max: number
    currency: 'USD' | 'EUR' | 'GBP'
  }
  preferred_schedule?: {
    days: string[]
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible'
  }
}
```

---

### 5. **EventRequestForm.tsx** ✅
**Location**: `apps/frontend/src/components/requests/EventRequestForm.tsx`

**Features**:
- 10 event types (volunteer, cleanup, workshop, meetup, etc.)
- Event date & time picker
- Duration input
- Virtual/physical location toggle:
  - Physical: Address picker
  - Virtual: Optional meeting link
- Participants needed
- Optional requirements:
  - Minimum age
  - Background check required
  - Experience required
- Recurring event support:
  - Frequency (daily, weekly, biweekly, monthly)
  - End date
- Event summary display

**Payload Interface**:
```typescript
{
  event_type: string
  event_date: string
  event_duration_hours: number
  location: {
    address: string
    lat: number
    lng: number
    is_virtual: boolean
    virtual_link?: string | null
  }
  participants_needed: number
  requirements?: {
    age_minimum?: number
    background_check?: boolean
    experience_required?: boolean
  }
  recurring?: {
    is_recurring: boolean
    frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    end_date?: string
  }
}
```

---

### 6. **BorrowRequestForm.tsx** ✅
**Location**: `apps/frontend/src/components/requests/BorrowRequestForm.tsx`

**Features**:
- 8 item categories (tools, electronics, camping, etc.)
- Duration selector with quick-pick buttons (1, 2, 3, 7, 14, 30 days)
- Custom duration input (max 30 days)
- Return date picker
- Condition minimum selector (fair, good, like new, new)
- Helpful borrowing tips
- Borrow summary display

**Payload Interface**:
```typescript
{
  item_category: string
  duration_days: number
  condition_min?: 'fair' | 'good' | 'like_new' | 'new'
  return_date?: string
}
```

---

### 7. **GenericRequestForm.tsx** ✅
**Location**: `apps/frontend/src/components/requests/GenericRequestForm.tsx`

**Features**:
- No additional payload fields
- Helpful guidance on what to include in title/description
- Example requests
- Suggestions to consider other specialized types
- Lightweight component that maintains consistent interface

---

### 8. **Updated requests/new.tsx** ✅
**Location**: `apps/frontend/src/pages/requests/new.tsx`

**Features**:
- **Two-step wizard**:
  1. Select request type
  2. Fill in details
- Progress indicator showing current step
- Type-specific form rendering
- Back button to change request type
- Validation with helpful error messages
- Payload handling for each type
- Generic requests don't send payload
- Specialized requests include type-specific payload

**Key Changes**:
- Added `selectedType` state for wizard
- Added `payload` state for type-specific data
- Conditional rendering of forms based on `selectedType`
- Updated submit handler to include `request_type` and `payload`
- Better error handling with validation feedback

---

## How It Works

### User Flow

1. **User visits** `/requests/new`
2. **Step 1**: User sees RequestTypeSelector with 5 visual cards
3. **User selects** a request type (e.g., "Ride Share")
4. **Step 2**: Wizard transitions to form details:
   - Community selector
   - Title input
   - Description textarea
   - Urgency selector
   - **Type-specific form** (RideRequestForm in this case)
5. **User fills** type-specific fields (origin, destination, seats, etc.)
6. **User submits**: Request is created with proper payload structure

### Data Flow

```typescript
// Example: Ride request submission
{
  community_id: "uuid",
  request_type: "ride",
  title: "Ride to airport Friday morning",
  description: "Need ride to SFO for 6am flight",
  urgency: "high",
  payload: {
    origin: { address: "123 Main St", lat: 37.7749, lng: -122.4194 },
    destination: { address: "SFO Airport", lat: 37.6213, lng: -122.3790 },
    seats_needed: 2,
    departure_time: "2024-06-15T05:30:00Z",
    preferences: {
      women_only: false,
      pet_friendly: true,
      wheelchair_accessible: false
    }
  }
}
```

---

## Backend Compatibility

All forms generate payloads that match the Zod schemas in:
- `packages/shared/src/schemas/requests/ride.ts`
- `packages/shared/src/schemas/requests/service.ts`
- `packages/shared/src/schemas/requests/event.ts`
- `packages/shared/src/schemas/requests/borrow.ts`
- `packages/shared/src/schemas/requests/generic.ts`

The backend validates these payloads using the same schemas.

---

## Testing Next Steps

### ✅ Completed
1. Created all 7 form components
2. Updated requests/new.tsx orchestration
3. Implemented two-step wizard UI

### ⏳ Remaining
1. **Add client-side Zod validation** (optional but recommended)
2. **Test each request type end-to-end**:
   - Create ride request → verify in database
   - Create service request → verify in database
   - Create event request → verify in database
   - Create borrow request → verify in database
   - Create generic request → verify in database
3. **Fix any validation errors**
4. **Integrate real geocoding API** for LocationPicker
5. **Run E2E tests** using Playwright
6. **Generate large dataset** using polymorphic script

---

## How to Test

### Manual Testing
```bash
# Start frontend
cd apps/frontend
npm run dev

# Visit http://localhost:3000/requests/new
# Login with test account
# Try creating each request type
```

### API Testing (Current)
```bash
# Generates polymorphic test data
cd scripts
node populate-polymorphic-data.js

# Large dataset (100-500 requests)
node generate-large-dataset.js 100
```

### E2E Testing (Future)
```bash
# After all types work manually
npm run test:e2e
```

---

## Known Issues

### 1. LocationPicker Uses Placeholder Geocoding
**Current**: Generates random SF Bay Area coordinates
**Fix Needed**: Integrate Google Maps Geocoding API or Mapbox
**File**: `apps/frontend/src/components/requests/shared/LocationPicker.tsx:24-32`

**Integration Example**:
```typescript
// Install Google Maps SDK
npm install @googlemaps/google-maps-services-js

// Update LocationPicker to use real geocoding
const geocodeAddress = async (address: string) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
  )
  const data = await response.json()
  if (data.results[0]) {
    const { lat, lng } = data.results[0].geometry.location
    return { address, lat, lng }
  }
  throw new Error('Address not found')
}
```

### 2. No Client-Side Validation Yet
**Current**: Validation happens on backend only
**Recommended**: Add Zod validation in frontend for better UX

**Example**:
```typescript
import { CreateRequestSchema } from '@karmyq/shared/schemas'

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  // Validate before sending
  const validation = CreateRequestSchema.safeParse(requestData)
  if (!validation.success) {
    alert(`Validation errors: ${JSON.stringify(validation.error.format())}`)
    return
  }

  // Continue with submission...
}
```

---

## File Structure

```
apps/frontend/src/
  components/
    requests/
      RequestTypeSelector.tsx         ✅ Type selection UI
      RideRequestForm.tsx             ✅ Ride-specific fields
      ServiceRequestForm.tsx          ✅ Service-specific fields
      EventRequestForm.tsx            ✅ Event-specific fields
      BorrowRequestForm.tsx           ✅ Borrow-specific fields
      GenericRequestForm.tsx          ✅ Generic help guidance
      shared/
        LocationPicker.tsx            ✅ Address + GPS input
        DateTimePicker.tsx            ✅ ISO datetime picker
  pages/
    requests/
      new.tsx                         ✅ Two-step wizard orchestration
```

---

## Next Phase: Large-Scale Data Generation

Now that UI supports all 5 request types, we can proceed with:

1. **Phase 2**: API-Based User Flow Tests (see `docs/testing/TEST_DATA_STRATEGY.md`)
2. **Phase 3**: Large-Scale Data Generation (2000 users, 100 communities)
3. **Phase 4**: UI Automation Tests (Playwright)

**Ready to generate realistic test data!** 🎉

---

## Documentation References

- [POLYMORPHIC_REQUESTS_GUIDE.md](../../docs/POLYMORPHIC_REQUESTS_GUIDE.md) - Complete API guide
- [TEST_DATA_STRATEGY.md](../../docs/testing/TEST_DATA_STRATEGY.md) - Test data generation plan
- [Backend Schemas](../../packages/shared/src/schemas/requests/) - Validation schemas
- [Matching Algorithms](../../packages/shared/src/matching/matchers/) - Type-specific matching

---

## Questions?

See the implementation guide for detailed templates and patterns:
- [POLYMORPHIC_FORMS_IMPLEMENTATION.md](POLYMORPHIC_FORMS_IMPLEMENTATION.md)
