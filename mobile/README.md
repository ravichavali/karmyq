# Karmyq Mobile App

React Native mobile application built with Expo for iOS and Android.

## Features

- Cross-platform (iOS & Android)
- Shared API client with web frontend
- Native authentication flow
- Push notifications support
- Camera and location access
- Offline-first architecture (coming soon)

## Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation
- **Axios** - HTTP client
- **AsyncStorage** - Local storage

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac only) or Android Studio
- Expo Go app on your physical device (optional)

## Getting Started

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure API URL

Create a `.env` file in the `mobile/` directory:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

**Important**: For physical devices, use your computer's local IP address, not `localhost`.

To find your IP:
- **Mac/Linux**: `ifconfig | grep "inet "`
- **Windows**: `ipconfig` (look for IPv4 Address)

### 3. Start Development Server

```bash
npm start
```

This opens Expo DevTools in your browser.

### 4. Run on Device/Simulator

**Option A: Physical Device (Easiest)**
1. Install "Expo Go" app from App Store or Play Store
2. Scan the QR code from Expo DevTools
3. App will load on your device

**Option B: iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Android Emulator**
```bash
npm run android
```

## Project Structure

```
mobile/
├── src/
│   ├── screens/          # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── CommunitiesScreen.tsx
│   │   ├── RequestsScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── context/          # React Context providers
│   │   └── AuthContext.tsx
│   ├── components/       # Reusable components
│   └── utils/           # Utility functions
├── assets/              # Images, fonts, etc.
├── App.tsx              # Root component
├── app.json            # Expo configuration
├── package.json
└── tsconfig.json
```

## Shared Code with Web

The mobile app shares code with the web frontend:

```
shared/
├── api/
│   ├── client.ts          # API client (shared)
│   ├── web-storage.ts     # Web localStorage adapter
│   └── mobile-storage.ts  # Mobile AsyncStorage adapter
├── types/
│   └── index.ts          # TypeScript types (shared)
├── utils/                # Utility functions (shared)
└── constants/
    └── config.ts         # App constants (shared)
```

**Benefits**:
- Single API client for all platforms
- Consistent type definitions
- Shared business logic
- Reduced maintenance

## Key Features

### Authentication

The app uses JWT token authentication:
- Login/Register screens
- Token stored in AsyncStorage
- Auto-login on app restart
- Automatic token refresh

### Navigation

Two navigation stacks:
1. **Auth Stack**: Login → Register (unauthenticated)
2. **Main Tabs**: Dashboard, Communities, Requests, Profile (authenticated)

### API Client

Platform-agnostic API client:

```typescript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { apiClient } = useAuth();

  // All API calls use the shared client
  const communities = await apiClient.getCommunities();
}
```

## Development Tips

### Hot Reloading

Expo supports hot reloading. Changes to your code will automatically reflect in the app.

### Debugging

1. **Console Logs**: Appear in terminal where you ran `npm start`
2. **React DevTools**: Available in Expo DevTools
3. **Network Requests**: Use Expo DevTools → Network tab

### Testing on Physical Device

For API calls to work on physical devices:
1. Ensure your device is on the same WiFi as your computer
2. Use your computer's local IP in `EXPO_PUBLIC_API_URL`
3. Make sure Docker services are running

### Common Issues

**Issue**: "Network request failed"
- **Solution**: Check API_URL uses your local IP, not localhost
- **Solution**: Ensure backend is running: `docker-compose up`

**Issue**: "Unable to resolve module"
- **Solution**: Clear cache: `expo start -c`

**Issue**: Metro bundler errors
- **Solution**: Delete `node_modules` and reinstall

## Building for Production

### Development Builds (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Classic Builds

```bash
# iOS (Mac only)
expo build:ios

# Android
expo build:android
```

## Environment Variables

The app uses Expo's environment system:

- `EXPO_PUBLIC_API_URL` - Backend API URL

Access in code:
```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
```

## Native Features

### Push Notifications

```typescript
import * as Notifications from 'expo-notifications';

// Request permissions
const { status } = await Notifications.requestPermissionsAsync();

// Get push token
const token = await Notifications.getExpoPushTokenAsync();
```

### Camera Access

```typescript
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
});
```

### Location

```typescript
import * as Location from 'expo-location';

const { status } = await Location.requestForegroundPermissionsAsync();
const location = await Location.getCurrentPositionAsync({});
```

## Next Steps

- [ ] Implement community creation/joining flows
- [ ] Add help request creation
- [ ] Implement real-time messaging
- [ ] Add push notifications
- [ ] Implement offline support
- [ ] Add image upload for profiles
- [ ] Build production apps

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Karmyq API Docs](../docs/API.md)

## Support

For issues specific to the mobile app, check:
1. Expo DevTools console
2. Terminal logs
3. Backend logs: `docker-compose logs auth-service`

For general project help, see [main README](../README.md).
