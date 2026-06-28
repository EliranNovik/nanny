// Module (app-level) Gradle file for Tebnu Android (Firebase + FCM).
// Merge into android/app/build.gradle.kts when the native app is created.
// Package name must stay com.tebnu.app (matches google-services.json).

plugins {
    id("com.android.application")
    // Add the Google services Gradle plugin
    id("com.google.gms.google-services")
}

dependencies {
    // Import the Firebase BoM
    implementation(platform("com.google.firebase:firebase-bom:34.15.0"))

    // Push notifications (required for Tebnu backend FCM integration)
    implementation("com.google.firebase:firebase-messaging")

    // Optional — included in Firebase setup wizard
    implementation("com.google.firebase:firebase-analytics")
}
