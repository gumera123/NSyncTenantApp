# NSync Mobile App

NSync is a branded standalone React Native app for tenant workspace management.

## Branding

- App name: NSync
- Core visual identity: dark ink + green accent on the S in NSync
- Deep link scheme: nsync

## Development

1. Install dependencies:

   npm install

2. Start Metro and launch app:

   npm run android

You can also run:

- npm run start
- npm run ios
- npm run web

## Super Admin Dashboard

The web dashboard is available at:

- http://localhost:8081/admin

Run it with:

1. Install dependencies:

   npm install

2. Start the Expo web app:

   npm run web

3. Open `/admin` in your browser.

Super Admin login uses Firebase Auth. The signed-in account must be allowed in one of these simple ways:

- Add `isSuperAdmin: true` to that user's Firestore document in the `users` collection.
- Set the user's `role` to `Super Admin`.
- Or set `EXPO_PUBLIC_SUPER_ADMIN_EMAIL=admin@example.com` before starting the app.

The dashboard reads the existing Firestore collections:

- `users`
- `boards`
- `tasks`
- `notifications` for recent activity when available

User deactivation marks the Firestore profile with `isActive: false`. Deleting a user from this dashboard removes the Firestore profile only; deleting the Firebase Auth account still requires the Firebase console or a trusted admin backend.

## Main Source Structure

- App bootstrap: App.js
- Navigation: src/navigation
- Screens: src/screens
- Shared UI: src/components/ui
- Super Admin web dashboard: src/admin
- Branding tokens: src/config/uiTokens.js

## Android App Identity

- Display name: NSync
- Manifest scheme: nsync
