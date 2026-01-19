# PWA Setup Guide

This app is configured as a Progressive Web App (PWA) that can be installed on mobile devices and desktop.

## Features

- **Standalone Mode**: When installed, the app runs without browser UI (no address bar, back button, etc.)
- **Offline Support**: Service worker caches resources for offline access
- **App-like Experience**: Full-screen, native app feel

## Installation

### On Mobile (iOS/Android)

1. Open the app in Safari (iOS) or Chrome (Android)
2. Tap the share button (iOS) or menu (Android)
3. Select "Add to Home Screen" or "Install App"
4. The app will appear on your home screen with an icon
5. Launch it like a native app

### On Desktop (Chrome/Edge)

1. Look for the install icon in the address bar
2. Click "Install" when prompted
3. The app will open in its own window

## Icons

The app currently uses the default Vite icon. For production, you should:

1. Create proper app icons:
   - `icon-192.png` (192x192 pixels)
   - `icon-512.png` (512x512 pixels)
   - Apple touch icon (180x180 pixels for iOS)

2. Place them in the `/public` directory

3. Update `manifest.json` with the correct icon paths

## Service Worker

The service worker (`/public/sw.js`) handles:
- Caching static assets
- Offline functionality
- Background updates

The service worker is automatically registered when the app loads.

## Testing

1. Build the app: `npm run build`
2. Serve the build: `npm run preview`
3. Open in a browser and check:
   - Application tab → Service Workers (should show registered)
   - Application tab → Manifest (should show manifest details)
   - Try installing the app

## Troubleshooting

- **Service Worker not registering**: Ensure you're using HTTPS (or localhost for development)
- **App not installing**: Check that manifest.json is valid and accessible
- **Icons not showing**: Verify icon paths in manifest.json match actual files
