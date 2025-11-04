# Cross-Platform Development Guide

This guide explains how Karmyq maintains a single codebase for web, iOS, and Android while maximizing code sharing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Karmyq Platform                       │
├─────────────┬─────────────┬──────────────┬─────────────┤
│   Web       │   iOS       │   Android    │  Backend    │
│  (Next.js)  │  (Expo)     │   (Expo)     │ (Microserv) │
└──────┬──────┴──────┬──────┴──────┬───────┴──────┬──────┘
       │             │              │              │
       └─────────────┴──────────────┴──────────────┘
                         │
              ┌──────────┴───────────┐
              │   Shared Code Layer  │
              ├──────────────────────┤
              │  - API Client        │
              │  - TypeScript Types  │
              │  - Business Logic    │
              │  - Constants         │
              └──────────────────────┘
```

## Code Sharing Strategy

### 100% Shared (Zero Duplication)

**Location**: `shared/`

1. **TypeScript Types** (`shared/types/index.ts`)
   - User, Community, Request types
   - API request/response interfaces
   - Used by: Backend, Web, Mobile

2. **API Client** (`shared/api/client.ts`)
   - All HTTP requests
   - Authentication logic
   - Error handling
   - Used by: Web, Mobile

3. **Constants** (`shared/constants/config.ts`)
   - App configuration
   - Request categories
   - Urgency levels
   - Used by: Web, Mobile

### Platform-Specific Adapters

**Location**: `shared/api/`

Different platforms need different storage mechanisms:

```typescript
// Web uses localStorage
class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
}

// Mobile uses AsyncStorage
class MobileStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }
}
```

API Client accepts either adapter:
```typescript
const apiClient = new ApiClient({
  baseURL: API_CONFIG.BASE_URL,
  storage: new WebStorageAdapter(), // or MobileStorageAdapter
});
```

### Platform-Specific Code

**Web**: `frontend/`
- Next.js pages and routing
- Web-optimized components
- SEO metadata
- Server-side rendering

**Mobile**: `mobile/`
- React Native screens
- Native navigation
- Platform-specific features (camera, push notifications)
- App store builds

## Development Workflow

### Working on Shared Code

When modifying shared code, test on both platforms:

```bash
# Terminal 1: Start backend
docker-compose up

# Terminal 2: Start web
cd frontend
npm run dev

# Terminal 3: Start mobile
cd mobile
npm start
```

### Adding a New API Endpoint

1. **Backend**: Add endpoint to microservice
2. **Shared Types**: Update `shared/types/index.ts`
3. **Shared API Client**: Add method to `shared/api/client.ts`
4. **Web**: Use new method in Next.js components
5. **Mobile**: Use new method in React Native screens

**Example**:

```typescript
// 1. Backend (services/community-service/routes/communities.ts)
router.post('/communities', async (req, res) => {
  // Create community logic
});

// 2. Shared Types (shared/types/index.ts)
export interface CreateCommunityRequest {
  name: string;
  description: string;
}

// 3. Shared API Client (shared/api/client.ts)
async createCommunity(data: CreateCommunityRequest) {
  const response = await this.client.post('/communities', data);
  return response.data;
}

// 4. Web (frontend/src/pages/create-community.tsx)
const { apiClient } = useApi();
await apiClient.createCommunity({ name, description });

// 5. Mobile (mobile/src/screens/CreateCommunityScreen.tsx)
const { apiClient } = useAuth();
await apiClient.createCommunity({ name, description });
```

### TypeScript Configuration

Each platform has its own `tsconfig.json` that references shared code:

**Web** (`frontend/tsconfig.json`):
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

**Mobile** (`mobile/tsconfig.json`):
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

## Platform Differences

### Navigation

**Web** (Next.js):
```typescript
import { useRouter } from 'next/router';

const router = useRouter();
router.push('/communities');
```

**Mobile** (React Navigation):
```typescript
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();
navigation.navigate('Communities');
```

### Styling

**Web** (Tailwind CSS):
```tsx
<div className="bg-blue-500 text-white p-4 rounded-lg">
  Hello
</div>
```

**Mobile** (StyleSheet):
```tsx
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>

const styles = StyleSheet.create({
  container: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 8 },
  text: { color: '#FFFFFF' }
});
```

### Storage

**Web**:
```typescript
localStorage.setItem('token', token);
const token = localStorage.getItem('token');
```

**Mobile**:
```typescript
await AsyncStorage.setItem('token', token);
const token = await AsyncStorage.getItem('token');
```

**Abstracted** (via StorageAdapter):
```typescript
await storage.setItem('token', token);
const token = await storage.getItem('token');
```

## Best Practices

### 1. Keep Business Logic in Shared Code

❌ **Bad**: Duplicate logic
```typescript
// frontend/src/utils/validation.ts
export function validateEmail(email: string) { ... }

// mobile/src/utils/validation.ts
export function validateEmail(email: string) { ... }
```

✅ **Good**: Share logic
```typescript
// shared/utils/validation.ts
export function validateEmail(email: string) { ... }

// Both platforms import from shared
import { validateEmail } from '@shared/utils/validation';
```

### 2. Use Platform-Specific UI, Shared Data

❌ **Bad**: Different data structures
```typescript
// Web: { userId, userName }
// Mobile: { user_id, user_name }
```

✅ **Good**: Same data, different UI
```typescript
// Both use: User type from shared/types
interface User {
  id: string;
  name: string;
}

// Web renders with Tailwind
<div className="...">{user.name}</div>

// Mobile renders with StyleSheet
<Text style={...}>{user.name}</Text>
```

### 3. API Client is Single Source of Truth

All API calls go through the shared client:

```typescript
// ❌ Bad: Direct axios calls
import axios from 'axios';
const response = await axios.post('/auth/login', data);

// ✅ Good: Use shared client
import { apiClient } from '@shared/api/client';
const response = await apiClient.login(email, password);
```

### 4. Environment Variables

Both platforms use environment variables:

**Web** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Mobile** (`.env`):
```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

**Shared** (`shared/constants/config.ts`):
```typescript
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL ||
            process.env.EXPO_PUBLIC_API_URL ||
            'http://localhost:3001',
};
```

## Testing Strategy

### Unit Tests (Shared Code)

Test shared code once, works everywhere:

```typescript
// shared/utils/__tests__/validation.test.ts
import { validateEmail } from '../validation';

test('validates correct email', () => {
  expect(validateEmail('test@example.com')).toBe(true);
});
```

### Integration Tests (Platform-Specific)

Test API integration on each platform:

**Web**:
```typescript
// frontend/tests/integration/auth.test.ts
import { apiClient } from '@shared/api/client';

test('web login flow', async () => {
  const result = await apiClient.login('test@example.com', 'password');
  expect(result.user).toBeDefined();
});
```

**Mobile**:
```typescript
// mobile/tests/integration/auth.test.ts
import { apiClient } from '@shared/api/client';

test('mobile login flow', async () => {
  const result = await apiClient.login('test@example.com', 'password');
  expect(result.user).toBeDefined();
});
```

## Maintenance Checklist

When adding a feature, ensure consistency:

- [ ] Backend endpoint implemented
- [ ] Types added to `shared/types/index.ts`
- [ ] API method added to `shared/api/client.ts`
- [ ] Web UI implemented (Next.js)
- [ ] Mobile UI implemented (React Native)
- [ ] Both platforms tested manually
- [ ] Integration tests added
- [ ] Documentation updated

## Migration Strategy

### Converting Web Feature to Mobile

1. **Identify shared logic**: What can be extracted?
2. **Move to shared/**: Types, API calls, utilities
3. **Create mobile UI**: Match functionality, not appearance
4. **Test thoroughly**: Both platforms should work

**Example**: Adding "Create Request" feature

```typescript
// 1. Already exists in web
// frontend/src/pages/create-request.tsx

// 2. Extract API call (already in shared)
// shared/api/client.ts - createHelpRequest()

// 3. Create mobile screen
// mobile/src/screens/CreateRequestScreen.tsx
// Uses same apiClient.createHelpRequest()

// 4. Different UI, same backend
// Web: Form with Tailwind
// Mobile: Form with React Native components
```

## Performance Considerations

### Bundle Size

**Web**:
- Next.js automatically code-splits
- Shared code is tree-shaken

**Mobile**:
- Expo handles bundling
- Shared code increases app size minimally (~50KB)

### API Calls

Both platforms use the same caching strategy:
- Token stored locally
- Retry logic built-in
- Error handling consistent

## Future Enhancements

### Potential Improvements

1. **Shared Components Library**: Create platform-agnostic component wrappers
2. **Shared State Management**: Redux or Zustand for consistent state
3. **Shared Hooks**: Custom React hooks in `shared/hooks/`
4. **Shared Testing Utilities**: Mock generators, test helpers

### React Native Web (Optional)

For maximum code sharing, consider React Native Web:
- Single codebase for all platforms
- 90%+ code sharing
- Trade-off: Less optimized web experience

## Summary

**Current Approach**: Hybrid
- **Code Sharing**: 60-70% (API, types, utils)
- **Platform-Specific**: 30-40% (UI, navigation, native features)

**Benefits**:
- ✅ Share business logic
- ✅ Consistent API layer
- ✅ Type safety across platforms
- ✅ Optimized UX per platform
- ✅ Independent deployment

**Trade-offs**:
- ⚠️ Some code duplication (UI)
- ⚠️ Two separate builds
- ⚠️ Platform-specific testing needed

This approach provides the best balance of code reuse and platform optimization for Karmyq's use case.
