# NSync Mobile App

NSync is a branded standalone React Native app for tenant workspace management.

## Branding

- App name: NSync
- Core visual identity: dark ink + green accent on the S in NSync
- Deep link scheme: nsync

## Screenshot

- <img width="250" alt="Fir" src="https://github.com/user-attachments/assets/bc5ef7ee-30a8-4d45-9c92-134ab4ccd17f" />
- <img width="250" alt="sec" src="https://github.com/user-attachments/assets/ba4f9aa2-daba-4381-b2ef-4a5b43656bcc" />
- <img width="250" alt="thi" src="https://github.com/user-attachments/assets/389d5e00-259c-40d0-a3b7-8eff4507cf7c" />


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

- https://nsynctenantapp.web.app/admin

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
