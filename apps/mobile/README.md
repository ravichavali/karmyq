# KarmyQ Mobile App

React Native mobile application for KarmyQ mutual aid platform, built with Expo.

## Features

### Core Features
- 📱 **Native iOS & Android apps** from single codebase
- 🔔 **Push notifications** for urgent help requests
- 📍 **Location services** to find nearby helpers
- 📷 **Camera integration** for documenting help exchanges
- 💬 **Real-time messaging** with Socket.IO
- 🗺️ **Maps integration** for location-based requests
- 🔒 **Secure storage** for authentication tokens
- 📴 **Offline support** with local caching

### Screens
- **Feed**: Personalized feed of community activity
- **Communities**: Browse and join local communities
- **Requests**: View and respond to help requests
- **Messages**: Real-time chat with community members
- **Profile**: View reputation, karma, and activity history

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **API**: Axios with TypeScript
- **Notifications**: Expo Notifications
- **Storage**: Expo Secure Store
- **Maps**: React Native Maps
- **Camera**: Expo Camera
- **Icons**: Expo Vector Icons (Ionicons)

## Prerequisites

- Node.js `^22.13.0 || ^24.3.0 || >=25.0.0` — 22.13.0+, 24.3.0+, or any release from 25 onward
- npm or yarn
- Expo CLI: use `npx expo <command>` (the global `expo-cli` package is deprecated)
- For iOS development: macOS with Xcode
- For Android development: Android Studio

## Installation

```bash
cd apps/mobile
npm install
```

## Development

### Start development server

```bash
npm start
```

This will open Expo DevTools in your browser. From there you can:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on physical device

### Run on specific platform

```bash
# iOS
npm run ios

# Android
npm run android

# Web (for debugging)
npm run web
```

## Configuration

### Environment Variables

Configure API endpoints in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-instance.org",
      "enablePushNotifications": true,
      "enableLocation": true
    }
  }
}
```

### API Endpoints

The app connects to KarmyQ backend services:

- Auth Service: Port 3001
- Community Service: Port 3002
- Request Service: Port 3003
- Reputation Service: Port 3004
- Notification Service: Port 3005
- Messaging Service: Port 3006
- Feed endpoints: Request Service port 3003 (`/requests/feed`)

## Building for Production

### iOS

1. **Prerequisites**
   - Apple Developer account
   - EAS CLI: `npm install -g eas-cli`

2. **Configure**
   ```bash
   eas build:configure
   ```

3. **Build**
   ```bash
   # For App Store
   eas build --platform ios

   # For TestFlight
   eas build --platform ios --profile preview
   ```

4. **Submit**
   ```bash
   eas submit --platform ios
   ```

### Android

1. **Prerequisites**
   - Google Play Console account
   - EAS CLI: `npm install -g eas-cli`

2. **Build**
   ```bash
   # For Play Store (AAB)
   eas build --platform android

   # For APK
   eas build --platform android --profile preview
   ```

3. **Submit**
   ```bash
   eas submit --platform android
   ```

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router app directory
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Entry point
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main app tabs
│   │   ├── feed.tsx
│   │   ├── communities.tsx
│   │   ├── requests.tsx
│   │   ├── messages.tsx
│   │   └── profile.tsx
│   └── [id]/              # Dynamic routes
├── components/            # Reusable components
│   ├── FeedItem.tsx
│   ├── CommunityCard.tsx
│   ├── RequestCard.tsx
│   └── ...
├── services/              # API and business logic
│   ├── api.ts            # API client
│   ├── notifications.ts  # Push notifications
│   └── location.ts       # Geolocation
├── store/                 # Zustand stores
│   ├── auth.ts
│   ├── feed.ts
│   └── ...
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── types/                 # TypeScript types
└── assets/               # Images, fonts, etc.
```

## Key Features Implementation

### Push Notifications

```typescript
import { registerForPushNotificationsAsync } from '@/services/notifications';

// Register for notifications
const token = await registerForPushNotificationsAsync();

// Handle notification tap
Notifications.addNotificationResponseReceivedListener(response => {
  const { type, requestId } = response.notification.request.content.data;
  // Navigate to appropriate screen
});
```

### Location Services

```typescript
import * as Location from 'expo-location';

// Request permission
const { status } = await Location.requestForegroundPermissionsAsync();

// Get current location
const location = await Location.getCurrentPositionAsync({});

// Watch location (for real-time updates)
Location.watchPositionAsync({
  accuracy: Location.Accuracy.High,
  distanceInterval: 10,
}, (location) => {
  console.log('New location:', location);
});
```

### Camera Integration

```typescript
import { Camera } from 'expo-camera';

// Request permission
const { status } = await Camera.requestCameraPermissionsAsync();

// Take photo
const photo = await cameraRef.current.takePictureAsync();

// Upload to help request
await api.uploadHelpPhoto(requestId, photo.uri);
```

### Offline Support

```typescript
// Check connectivity
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  console.log('Is connected?', state.isConnected);
});

// Cache API responses
// Store pending actions when offline
// Sync when back online
```

## Shared Code with Web

The mobile app shares TypeScript types and business logic with the web frontend:

```typescript
// Import shared types
import type { Community, HelpRequest, User } from '@/shared/types';

// Use shared utilities
import { calculateKarma } from '@/shared/utils/reputation';
```

## Testing

```bash
# Unit tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Troubleshooting

### iOS Simulator Issues

```bash
# Clear Expo cache
expo start -c

# Reset Metro bundler
expo start --reset-cache
```

### Android Emulator Issues

```bash
# List devices
adb devices

# Reverse port for API
adb reverse tcp:3001 tcp:3001
adb reverse tcp:3002 tcp:3002
# ... repeat for all services
```

### Build Errors

```bash
# Clear node modules
rm -rf node_modules
npm install

# Clear Expo cache
expo prebuild --clean
```

## Performance Optimization

### Images
- Use `expo-image` for optimized image loading
- Lazy load images below the fold
- Use appropriate image sizes

### Lists
- Use `FlatList` for long lists
- Implement `getItemLayout` for fixed-height items
- Use `windowSize` prop to control render buffer

### Navigation
- Use React Navigation's `lazy` option
- Preload critical screens
- Optimize screen transitions

## Security

### Secure Storage
All sensitive data (auth tokens, user data) stored in `expo-secure-store`:

```typescript
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('auth_token', token);
const token = await SecureStore.getItemAsync('auth_token');
```

### API Security
- HTTPS only in production
- Certificate pinning (optional)
- Token refresh mechanism
- Automatic logout on 401

## Accessibility

- Screen reader support
- Dynamic font sizes
- High contrast mode
- Touch target sizes (minimum 44x44)

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

AGPL-3.0-or-later - See [LICENSE](../../LICENSE) for details.

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Navigation](https://reactnavigation.org/)
