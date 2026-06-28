# Tebnu iOS — Firebase config

Bundle ID: **`com.tebnu.app`**  
Firebase project: **`tebnu-3d438`**

## File

| Path | Purpose |
|------|---------|
| `GoogleService-Info.plist` | Firebase iOS config (from Firebase Console) |

When you create the React Native app under `apps/mobile`, copy this file into the Xcode project:

```
ios/Tebnu/GoogleService-Info.plist
```

(or your app target folder — must be included in the app target, not only the project folder)

## Xcode setup

1. Drag `GoogleService-Info.plist` into the app target in Xcode (**Copy items if needed**).
2. **Signing & Capabilities** → add **Push Notifications**.
3. **Signing & Capabilities** → **Background Modes** → enable **Remote notifications**.
4. In Firebase Console → **Cloud Messaging** → upload your **APNs Authentication Key** (.p8) for iOS delivery.

## React Native Firebase

If using `@react-native-firebase/app`, the plist is picked up automatically when placed in the iOS app directory and linked to the target.

## Backend (server only)

Push sending uses the Firebase **service account** on `apps/api`, not this plist:

```env
FIREBASE_PROJECT_ID=tebnu-3d438
```

See [docs/PUSH_NOTIFICATIONS.md](../../docs/PUSH_NOTIFICATIONS.md).
