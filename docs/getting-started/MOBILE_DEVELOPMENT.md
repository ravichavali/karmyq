# Mobile Development Guide

Guide for developing and deploying the KarmyQ mobile applications.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Code Sharing Strategy](#code-sharing-strategy)
4. [Mobile-Specific Features](#mobile-specific-features)
5. [State Management](#state-management)
6. [Navigation](#navigation)
7. [API Integration](#api-integration)
8. [Push Notifications](#push-notifications)
9. [Offline Support](#offline-support)
10. [Testing](#testing)
11. [Deployment](#deployment)

---

## Architecture Overview

### Why React Native + Expo?

**Benefits:**
- ✅ Single codebase for iOS & Android
- ✅ Share TypeScript types with web frontend
- ✅ Fast development with hot reload
- ✅ Over-the-air updates (no app store review for fixes)
- ✅ Rich ecosystem of libraries
- ✅ Native performance

**Tradeoffs:**
- ⚠️ Slightly larger app size than native
- ⚠️ Some native features require custom modules
- ⚠️ Less control over low-level optimizations

### App Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  UI Layer    │  │  State Mgmt  │  │  Services    │  │
│  │              │  │              │  │              │  │
│  │ - Screens    │  │ - Zustand    │  │ - API        │  │
│  │ - Components │  │ - Stores     │  │ - Location   │  │
│  │ - Navigation │  │ - Hooks      │  │ - Camera     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                   Shared Code Layer                     │
│  - TypeScript types                                     │
│  - Business logic                                       │
│  - Validation rules                                     │
│  - Constants                                            │
├─────────────────────────────────────────────────────────┤
│                  Native Modules                         │
│  - Push Notifications                                   │
│  - Geolocation                                          │
│  - Camera                                               │
│  - Secure Storage                                       │
└─────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
    iOS (Swift)                         Android (Kotlin)
```

---

## Development Setup

### Initial Setup

```bash
# Install Expo CLI globally
npm install -g expo-cli eas-cli

# Navigate to mobile app
cd apps/mobile

# Install dependencies
npm install

# Start development server
npm start
```

### iOS Development

**Requirements:**
- macOS computer
- Xcode 14+ installed
- iOS Simulator or physical device

```bash
# Install iOS dependencies
npx pod-install

# Run on iOS simulator
npm run ios

# Run on specific simulator
npm run ios -- --simulator="iPhone 15 Pro"

# Run on physical device
# 1. Open Expo Go app on iPhone
# 2. Scan QR code from terminal
```

### Android Development

**Requirements:**
- Android Studio installed
- Android SDK configured
- Android emulator or physical device

```bash
# Run on Android emulator
npm run android

# Run on specific emulator
npm run android -- --device="Pixel_7_API_34"

# Run on physical device
# 1. Enable developer mode on Android device
# 2. Enable USB debugging
# 3. Connect via USB
# 4. npm run android
```

---

## Code Sharing Strategy

### Shared Types

```typescript
// packages/shared/types/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

// Used in both web and mobile
import type { User, Community } from '@/shared/types';
```

### Shared Business Logic

```typescript
// packages/shared/utils/karma.ts
export function calculateKarmaLevel(points: number): string {
  if (points < 10) return 'Newcomer';
  if (points < 50) return 'Helper';
  if (points < 150) return 'Community Champion';
  return 'Mutual Aid Hero';
}

// Import in mobile
import { calculateKarmaLevel } from '@/shared/utils/karma';
```

### Shared Constants

```typescript
// packages/shared/constants/index.ts
export const URGENCY_LEVELS = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

export const KARMA_THRESHOLDS = {
  firstHelp: 15,
  milestone10: 10,
  milestone50: 50,
  milestone100: 100,
};
```

### Platform-Specific Code

```typescript
// Mobile-specific implementation
// apps/mobile/services/storage.ts
import * as SecureStore from 'expo-secure-store';

export const storage = {
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  getItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
};

// Web-specific implementation
// apps/frontend/lib/storage.ts
export const storage = {
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  getItem: (key: string) => {
    return localStorage.getItem(key);
  },
};
```

---

## Mobile-Specific Features

### 1. Push Notifications

**Implementation:**

```typescript
// services/notifications.ts
import * as Notifications from 'expo-notifications';

export async function registerForPushNotifications() {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  // Get token
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Register with backend
  await api.registerPushToken(userId, token);

  return token;
}

// Handle notification taps
Notifications.addNotificationResponseReceivedListener(response => {
  const { type, id } = response.notification.request.content.data;

  switch (type) {
    case 'new_request':
      router.push(`/requests/${id}`);
      break;
    case 'match_created':
      router.push(`/matches/${id}`);
      break;
    case 'new_message':
      router.push(`/messages/${id}`);
      break;
  }
});
```

**Backend Support:**

```typescript
// Add endpoint to notification service
router.post('/notifications/:userId/push-token', async (req, res) => {
  const { userId } = req.params;
  const { token, platform } = req.body;

  await query(`
    INSERT INTO notifications.push_tokens (user_id, token, platform)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, platform)
    DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()
  `, [userId, token, platform]);

  res.json({ success: true });
});

// Send push notification
async function sendPushNotification(userId: string, notification: any) {
  const tokens = await query(`
    SELECT token FROM notifications.push_tokens
    WHERE user_id = $1 AND active = true
  `, [userId]);

  for (const { token } of tokens.rows) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      }),
    });
  }
}
```

### 2. Geolocation

**Finding Nearby Help:**

```typescript
// hooks/useLocation.ts
import * as Location from 'expo-location';

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  return { location, error };
}

// Usage in component
function NearbyRequestsScreen() {
  const { location } = useLocation();

  const nearbyRequests = useQuery({
    queryKey: ['requests', 'nearby', location],
    queryFn: () => api.getNearbyRequests({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      radius: 10, // km
    }),
    enabled: !!location,
  });

  return (
    <MapView
      initialRegion={{
        latitude: location?.coords.latitude || 0,
        longitude: location?.coords.longitude || 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {nearbyRequests.data?.map(request => (
        <Marker
          key={request.id}
          coordinate={{
            latitude: request.latitude,
            longitude: request.longitude,
          }}
          title={request.title}
          onPress={() => router.push(`/requests/${request.id}`)}
        />
      ))}
    </MapView>
  );
}
```

### 3. Camera Integration

**Document Help Exchange:**

```typescript
// screens/CaptureHelpPhotoScreen.tsx
import { Camera } from 'expo-camera';

export function CaptureHelpPhotoScreen({ route }) {
  const { matchId } = route.params;
  const cameraRef = useRef<Camera>(null);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    const photo = await cameraRef.current.takePictureAsync();

    // Upload to backend
    const formData = new FormData();
    formData.append('photo', {
      uri: photo.uri,
      name: 'help-photo.jpg',
      type: 'image/jpeg',
    } as any);

    await api.uploadMatchPhoto(matchId, formData);

    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <Camera style={{ flex: 1 }} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Text style={styles.text}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
}
```

### 4. QR Code Scanning

**Quick Join Community:**

```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';

export function ScanCommunityQRScreen() {
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // data format: karmyq://community/uuid-here
    const communityId = data.split('/').pop();
    router.push(`/communities/${communityId}`);
  };

  return (
    <BarCodeScanner
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
  );
}
```

---

## State Management

Using Zustand for lightweight, performant state management:

```typescript
// store/requests.ts
import { create } from 'zustand';

interface RequestsStore {
  requests: HelpRequest[];
  loading: boolean;
  error: string | null;

  fetchRequests: () => Promise<void>;
  createRequest: (data: CreateRequestData) => Promise<void>;
  respondToRequest: (requestId: string, offerId: string) => Promise<void>;
}

export const useRequestsStore = create<RequestsStore>((set, get) => ({
  requests: [],
  loading: false,
  error: null,

  fetchRequests: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.getRequests();
      set({ requests: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createRequest: async (data) => {
    const response = await api.createRequest(data);
    set(state => ({
      requests: [response.data, ...state.requests],
    }));
  },

  respondToRequest: async (requestId, offerId) => {
    await api.respondToRequest(requestId, offerId);
    await get().fetchRequests(); // Refresh
  },
}));
```

---

## Navigation

Using Expo Router (file-based routing):

```
app/
├── _layout.tsx           # Root layout
├── index.tsx             # Entry point (redirect logic)
├── (auth)/
│   ├── _layout.tsx       # Auth layout (no tabs)
│   ├── login.tsx         # /login
│   └── register.tsx      # /register
├── (tabs)/
│   ├── _layout.tsx       # Tab layout
│   ├── feed.tsx          # /(tabs)/feed
│   ├── communities.tsx   # /(tabs)/communities
│   ├── requests.tsx      # /(tabs)/requests
│   ├── messages.tsx      # /(tabs)/messages
│   └── profile.tsx       # /(tabs)/profile
├── requests/
│   └── [id].tsx          # /requests/:id
├── communities/
│   └── [id].tsx          # /communities/:id
└── matches/
    └── [id].tsx          # /matches/:id
```

**Navigation Examples:**

```typescript
import { router } from 'expo-router';

// Navigate
router.push('/communities/123');

// Navigate with params
router.push({
  pathname: '/requests/[id]',
  params: { id: '456' },
});

// Go back
router.back();

// Replace (no back button)
router.replace('/login');
```

---

## API Integration

Centralized API client with auth handling:

```typescript
// services/api.ts
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    // Add auth token
    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          await SecureStore.deleteItemAsync('auth_token');
          router.replace('/login');
        }
        return Promise.reject(error);
      }
    );
  }

  // Methods...
}
```

---

## Push Notifications

### Notification Types

```typescript
type NotificationType =
  | 'new_request'
  | 'match_created'
  | 'match_completed'
  | 'new_message'
  | 'karma_awarded'
  | 'community_invitation';

interface PushNotification {
  title: string;
  body: string;
  data: {
    type: NotificationType;
    id: string;
    [key: string]: any;
  };
}
```

### Sending from Backend

```typescript
// services/notification-service/src/services/pushNotifications.ts
export async function sendPushToUser(
  userId: string,
  notification: PushNotification
) {
  const tokens = await getPushTokensForUser(userId);

  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data,
  }));

  await expo.sendPushNotificationsAsync(messages);
}
```

---

## Offline Support

### Caching Strategy

```typescript
// utils/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const cache = {
  async set(key: string, value: any, ttl = 3600) {
    const item = {
      value,
      expires: Date.now() + ttl * 1000,
    };
    await AsyncStorage.setItem(key, JSON.stringify(item));
  },

  async get(key: string) {
    const item = await AsyncStorage.getItem(key);
    if (!item) return null;

    const { value, expires } = JSON.parse(item);
    if (Date.now() > expires) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return value;
  },
};

// Usage
const cachedRequests = await cache.get('requests');
if (cachedRequests) {
  return cachedRequests;
}

const requests = await api.getRequests();
await cache.set('requests', requests, 300); // 5 minutes
```

### Queue Offline Actions

```typescript
// utils/offlineQueue.ts
export const offlineQueue = {
  async add(action: OfflineAction) {
    const queue = await this.getQueue();
    queue.push(action);
    await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
  },

  async process() {
    const queue = await this.getQueue();
    for (const action of queue) {
      try {
        await this.executeAction(action);
      } catch (error) {
        console.error('Failed to execute offline action:', error);
      }
    }
    await AsyncStorage.setItem('offline_queue', JSON.stringify([]));
  },
};

// When back online
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    offlineQueue.process();
  }
});
```

---

## Testing

### Unit Tests

```typescript
// __tests__/services/api.test.ts
import { api } from '@/services/api';

describe('API Service', () => {
  it('should login successfully', async () => {
    const result = await api.login('test@example.com', 'password');
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
  });
});
```

### Component Tests

```typescript
// __tests__/components/FeedItem.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import FeedItem from '@/components/FeedItem';

describe('FeedItem', () => {
  it('should render request title', () => {
    const item = {
      type: 'open_request',
      data: { title: 'Need help moving' },
    };

    const { getByText } = render(<FeedItem item={item} />);
    expect(getByText('Need help moving')).toBeTruthy();
  });
});
```

---

## Deployment

### Build Configuration

```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "API_URL": "https://api.karmyq.org"
      },
      "distribution": "store",
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "env": {
        "API_URL": "https://staging-api.karmyq.org"
      },
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json"
      }
    }
  }
}
```

### Build Commands

```bash
# Production build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production

# Over-the-air update (for JS/assets only)
eas update --branch production --message "Bug fixes"
```

---

## Best Practices

1. **Performance**
   - Use `FlatList` for long lists
   - Implement `React.memo` for expensive components
   - Lazy load screens with React Suspense

2. **Security**
   - Use SecureStore for sensitive data
   - Implement certificate pinning for API calls
   - Validate all user input

3. **UX**
   - Show loading states
   - Handle errors gracefully
   - Provide offline feedback
   - Use native UI patterns

4. **Accessibility**
   - Add `accessibilityLabel` to all interactive elements
   - Support screen readers
   - Ensure sufficient color contrast
   - Make touch targets at least 44x44

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios)
- [Material Design Guidelines](https://material.io/design)
