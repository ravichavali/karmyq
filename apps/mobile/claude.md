# Mobile Application

## Overview
React Native + Expo application for iOS and Android.

## Structure
```
├── app/              # Expo Router screens
│   ├── _layout.tsx   # Root layout
│   ├── index.tsx     # Home/Feed screen
│   ├── (tabs)/       # Tab-based navigation
│   └── (auth)/       # Auth screens
├── services/         # API service modules
│   ├── api.ts        # Base API client
│   ├── auth.ts       # Auth service
│   └── feed.ts       # Feed service
├── store/            # Redux Toolkit store
│   ├── index.ts      # Store configuration
│   ├── authSlice.ts  # Auth state
│   └── feedSlice.ts  # Feed state
├── components/       # Reusable components
└── constants/        # App constants
```

## Current Status
- Feed screen: Implemented
- Auth screens: Structure only
- Other screens: Pending

## Tech Stack
- Expo SDK 50+
- Expo Router (file-based routing)
- Redux Toolkit for state
- Axios for API calls
- React Native Paper (UI components)

## Development

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode (Mac only)
- Android: Android Studio with emulator

### Running
```bash
cd apps/mobile
npm install

# Start Expo
npx expo start

# Options:
# Press 'i' - iOS Simulator
# Press 'a' - Android Emulator
# Scan QR - Expo Go app on device
```

### Environment
Create `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

Note: Use your machine's IP instead of localhost for physical devices.

## API Pattern
```typescript
// services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// Add auth token from AsyncStorage
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
