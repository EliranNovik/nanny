# Push notifications (iOS + Android)

Tebnu uses **Firebase Cloud Messaging (FCM)** for both Android and iOS. FCM delivers to Android directly and to iOS via **APNs** (configured inside the Firebase console).

Architecture:

1. **Postgres triggers** enqueue rows in `push_notification_queue` when events happen (message, match, like, etc.).
2. **`apps/api`** cron worker reads the queue and sends via **FCM HTTP v1** (`firebase-admin`).
3. **Mobile app** registers FCM tokens via `POST /api/push/devices`.
4. **Web app** lets users edit preferences on **Profile → My account**; tokens are registered from native apps only.

---

## 1. Run the SQL migration

In **Supabase Dashboard → SQL Editor**, run the full file:

```
db/sql/101_push_notifications.sql
```

This creates:

| Table | Purpose |
|-------|---------|
| `push_device_tokens` | FCM tokens per user/device (`ios` \| `android` \| `web`) |
| `push_notification_preferences` | Per-user toggles + expiry reminder timing |
| `push_notification_queue` | Outbox processed by API worker |
| `push_post_expiry_schedules` | Scheduled expiry reminders |

Also adds **triggers** on messages, job matches, confirmations, likes, comments, favorites, and expiry schedules.

### Expiry reminder timing (`post_expiry_timing`)

| Value | Meaning |
|-------|---------|
| `at_expiry` | Notify when the listing actually expires (**now**) |
| `today` | Notify at **09:00** on the expiry day (user timezone) |
| `tomorrow` | Notify at **09:00** the day **before** expiry |

Applies to **community posts** (`expires_at`) and **open help requests** (`when_timeframe` / `custom_when_at`).

---

## 2. Firebase setup (required for delivery)

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Add **Android app** with package name **`com.tebnu.app`**.
3. Download `google-services.json` → already in repo at `apps/mobile/android/app/google-services.json`.
4. Configure Gradle (see **Android Gradle setup** below).
5. Add **iOS app** (bundle ID `com.tebnu.app`).
6. Download `GoogleService-Info.plist` → already in repo at `apps/mobile/ios/GoogleService-Info.plist`.
7. **iOS**: Upload **APNs Authentication Key** (.p8) in Firebase → Project settings → Cloud Messaging.
8. Download **Service account JSON** (Project settings → Service accounts → Generate new private key).

### Android Gradle setup

To expose `google-services.json` to Firebase SDKs, add the **Google services Gradle plugin**.

**Kotlin DSL** (`build.gradle.kts`) — reference copies in `apps/mobile/android/`:

Root-level `android/build.gradle.kts`:

```kotlin
plugins {
    // ...
    id("com.google.gms.google-services") version "4.5.0" apply false
}
```

App-level `android/app/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    // ...
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.15.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-analytics")
}
```

**Groovy** (`build.gradle`) — typical React Native projects:

Root `android/build.gradle`:

```groovy
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.5.0")
    }
}
```

App `android/app/build.gradle`:

```groovy
apply plugin: "com.google.gms.google-services"

dependencies {
    implementation platform("com.google.firebase:firebase-bom:34.15.0")
    implementation "com.google.firebase:firebase-messaging"
    implementation "com.google.firebase:firebase-analytics"
}
```

After adding the plugin and SDKs, sync Gradle. Full notes: `apps/mobile/android/README.md`.

### API environment (`apps/api/.env`)

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

FIREBASE_PROJECT_ID=tebnu-3d438
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

PUSH_CRON_SECRET=your-long-random-secret
PUSH_CRON_ENABLED=true
PUSH_CRON_INTERVAL_MS=120000
```

```bash
cd apps/api && npm install && npm run dev
```

When the API starts with `PUSH_CRON_SECRET` set, an **in-process scheduler** runs every 2 minutes by default. Disable it with `PUSH_CRON_ENABLED=false` if you use external cron instead (e.g. multiple API instances).

---

## 3. Cron worker (optional external trigger)

The in-process scheduler handles this automatically in dev/single-server deploys. You can also trigger manually or via external cron:

Every **1–2 minutes**:

```bash
curl -X POST "https://YOUR_API_HOST/api/push/process-queue" \
  -H "x-cron-secret: YOUR_PUSH_CRON_SECRET"
```

No user JWT required — only `x-cron-secret`.

---

## 4. API endpoints

All user routes: `Authorization: Bearer <supabase_access_token>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/push/devices` | Register FCM token |
| `DELETE` | `/api/push/devices` | Unregister token |
| `GET` | `/api/push/preferences` | Get preferences |
| `PATCH` | `/api/push/preferences` | Update preferences |
| `GET` | `/api/push/status` | Health check |
| `POST` | `/api/push/process-queue` | Cron (`x-cron-secret`) |

See full preference schema and payload shapes in this doc’s sections below.

---

## 5. React Native handoff (for native app AI)

### Env

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_BASE_URL=https://YOUR_API_HOST
```

Use the same Supabase JWT as web for `/api/push/*`.

### Libraries

- **Bare RN**: `@react-native-firebase/app`, `@react-native-firebase/messaging`
- **Expo**: `expo-notifications` + FCM via EAS; register **FCM token** with this backend

### iOS

- `GoogleService-Info.plist` → copy from `apps/mobile/ios/GoogleService-Info.plist` into Xcode app target
- Push Notifications + Background Modes → Remote notifications in Xcode
- APNs key in Firebase
- See `apps/mobile/ios/README.md`

### Android

- `google-services.json`
- Notification channel id: **`tebnu_default`**
- Request `POST_NOTIFICATIONS` on Android 13+

### Register token after login

```typescript
const token = await messaging().getToken();
await fetch(`${API_BASE}/api/push/devices`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  }),
});
```

Re-register on `onTokenRefresh` and each cold start.

### Unregister on logout

`DELETE /api/push/devices` with `{ token }`.

### Handle taps

Read `remoteMessage.data.link` or `type` + IDs:

- `message` → chat screen (`conversation_id`)
- `new_match` → job match (`job_id`)
- `request_accepted` / `match_selected` → job detail
- `comment` / `like` → profile or jobs
- `post_expiry` → community posts or client jobs

### Preferences

Sync via `GET/PATCH /api/push/preferences` or rely on web **My account** page.

### Debug SQL

```sql
select * from push_notification_queue order by created_at desc limit 20;
select * from push_device_tokens where user_id = 'YOUR_USER_UUID';
```

---

## 6. Web frontend (this repo)

- **Profile → My account**: `ProfilePushPreferences` component
- Routes: `/client/profile/account`, `/freelancer/profile/account`
- Web does not register device tokens (mobile only)

---

## 7. Notification types

| Type | Event |
|------|-------|
| `message` | New chat message |
| `new_match` | Job invite to helper |
| `request_accepted` | Helper confirmed available |
| `match_selected` | Client selected helper |
| `favorite_profile_post` | Saved profile posted |
| `comment` | Comment on your content |
| `like` | Like on your content |
| `post_expiry` | Listing / request window ended |

---

## 8. File map

| Path | Role |
|------|------|
| `db/sql/101_push_notifications.sql` | Schema, triggers, RLS |
| `apps/api/src/routes/push.ts` | API routes |
| `apps/api/src/lib/push/fcm.ts` | FCM sender |
| `apps/api/src/lib/push/processQueue.ts` | Queue worker |
| `apps/mobile/android/app/google-services.json` | Firebase Android config |
| `apps/mobile/ios/GoogleService-Info.plist` | Firebase iOS config |
| `apps/web/src/components/profile/ProfilePushPreferences.tsx` | Web UI |
