# Tebnu iOS — push + Firebase config

Bundle ID: **`com.tebnu.app`**  
Firebase project: **`tebnu-3d438`** (optional for direct APNs)

## Push delivery

The API sends iOS notifications via **APNs HTTP/2** using the **native device token** (hex from Expo `getDevicePushTokenAsync()`), not FCM registration tokens.

Register with `POST /api/push/devices` and `platform: "ios"`.

## File

| Path | Purpose |
|------|---------|
| `GoogleService-Info.plist` | Firebase iOS config (optional if API talks to APNs directly) |

When you create the React Native app under `apps/mobile`, copy this file into the Xcode project:

```
ios/Tebnu/GoogleService-Info.plist
```

(or your app target folder — must be included in the app target, not only the project folder)

## Xcode setup

1. **Signing & Capabilities** → add **Push Notifications**.
2. **Signing & Capabilities** → **Background Modes** → enable **Remote notifications**.
3. (Optional) Drag `GoogleService-Info.plist` into the app target if you still use Firebase on device.

## Backend (server only)

```env
APNS_KEY_ID=...
APNS_TEAM_ID=...
APNS_BUNDLE_ID=com.tebnu.app
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APNS_PRODUCTION=false   # Xcode installs → sandbox
```

See [docs/PUSH_NOTIFICATIONS.md](../../docs/PUSH_NOTIFICATIONS.md).
