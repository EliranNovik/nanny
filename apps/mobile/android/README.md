# Tebnu Android — Firebase config

Package: **`com.tebnu.app`**  
Firebase project: **`tebnu-3d438`**

## Files

| Path | Purpose |
|------|---------|
| `app/google-services.json` | Firebase Android config (from Firebase Console) |
| `build.gradle.kts` | Root Gradle — Google services plugin |
| `app/build.gradle.kts` | App module — plugin + Firebase BoM + Messaging |

When you create the React Native app under `apps/mobile`, copy or merge these into the generated `android/` folder, then sync Gradle.

## Kotlin DSL (`build.gradle.kts`)

### Root-level (`android/build.gradle.kts`)

```kotlin
plugins {
    // ...
    id("com.google.gms.google-services") version "4.5.0" apply false
}
```

### App-level (`android/app/build.gradle.kts`)

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

Sync the Android project after adding the plugin and dependencies.

## Groovy (`build.gradle`) — React Native default

If your RN project uses Groovy instead of Kotlin DSL:

**Root `android/build.gradle`:**

```groovy
buildscript {
    dependencies {
        classpath("com.google.gms:google-services:4.5.0")
    }
}
```

**App `android/app/build.gradle`:**

```groovy
apply plugin: "com.android.application"
apply plugin: "com.google.gms.google-services"

dependencies {
    implementation platform("com.google.firebase:firebase-bom:34.15.0")
    implementation "com.google.firebase:firebase-messaging"
    implementation "com.google.firebase:firebase-analytics"
}
```

Place `google-services.json` at **`android/app/google-services.json`**.

## Backend env (server only)

Set on `apps/api` (from Firebase service account, not this file):

```env
FIREBASE_PROJECT_ID=tebnu-3d438
```

See [docs/PUSH_NOTIFICATIONS.md](../../../docs/PUSH_NOTIFICATIONS.md).
