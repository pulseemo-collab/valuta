# BUILD_ANDROID.md — Valuta Android Build Guide

## Prerequisites

- Node.js 18+
- EAS CLI: `npm install -g eas-cli`
- An Expo account at [expo.dev](https://expo.dev)
- Android device or emulator for testing

---

## 1. EAS Login

```sh
eas login
```

Enter your Expo account credentials. Verify with:

```sh
eas whoami
```

---

## 2. Link the Project to EAS (first time only)

```sh
eas init
```

This creates a project on expo.dev and writes the `projectId` into `app.json`.
If the project already exists on expo.dev, it will prompt you to link it.

---

## 3. Build Profiles

Defined in `eas.json`:

| Profile | Output | Use case |
|---|---|---|
| `preview` | `.apk` | Install directly on a real device for testing |
| `production` | `.aab` (App Bundle) | Upload to Google Play Store |
| `development` | `.apk` + dev client | Run the Expo dev client for local development |

---

## 4. APK Preview Build (install on a real phone)

```sh
eas build --platform android --profile preview
```

- Builds on EAS cloud servers (no local Android SDK required)
- When finished, EAS prints a download URL and a QR code
- On the phone: open the URL, download the APK, enable "Install from unknown sources" if prompted, and install

To install via ADB (USB-connected device):

```sh
adb install path/to/downloaded.apk
```

---

## 5. Production AAB Build (Google Play)

```sh
eas build --platform android --profile production
```

- Outputs a `.aab` file
- Download from the EAS dashboard
- Upload to [Google Play Console](https://play.google.com/console) under your app listing → Production / Internal Testing

---

## 6. Development Build (Expo dev client)

```sh
eas build --platform android --profile development
```

- Installs the custom Expo dev client APK on device
- Then start the local dev server:

```sh
npx expo start --dev-client
```

---

## 7. Environment Variables / Secrets

The app reads Supabase credentials from environment variables prefixed with `EXPO_PUBLIC_`.

For local development, create a `.env` file (not committed to git):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

For EAS cloud builds, set secrets via:

```sh
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```

Verify secrets are set:

```sh
eas secret:list
```

---

## 8. Version Management

Before every release, update `app.json`:

```json
"version": "1.0.1",
"android": {
  "versionCode": 2
}
```

Rules:
- `version` — user-facing version string displayed in the store
- `versionCode` — integer, must be **incremented on every Play Store upload** (never reuse)

---

## 9. Keystore Management

EAS automatically generates and stores the Android signing keystore on first build.
**Do not lose access to your EAS account** — the keystore is needed for all future updates.

To inspect or download the keystore:

```sh
eas credentials
```

---

## 10. Checking Build Status

View all builds in the terminal:

```sh
eas build:list
```

Or open the EAS dashboard: [expo.dev](https://expo.dev) → your project → Builds

---

## Android-Specific Notes

- **Safe areas**: Handled via `react-native-safe-area-context`. `SafeAreaProvider` is at the root, `useSafeAreaInsets()` is used in `CustomTabBar` for correct bottom padding. Edge-to-edge is enabled (`edgeToEdgeEnabled: true` in `app.json`).
- **Status bar**: Set to `style="light"` with `backgroundColor="#060B18"` in the root layout — correct for the dark theme.
- **Tab bar + FAB**: The custom tab bar applies `insets.bottom` so it sits above the gesture navigation bar on all Android device types.
- **Modal keyboard (shto.tsx)**: `KeyboardAvoidingView` uses `behavior="height"` on Android to prevent the keyboard from covering form fields.
- **Receipt scanning**: `tesseract.js` is a web-optimized OCR library. On Android native builds, OCR functionality may be limited. The camera/gallery picker still works.
- **Voice input**: The Web Speech API is browser-only. Voice input will not function on Android native builds. The app guards this via `isVoiceSupported()`, which returns `false` on native.
- **Permissions**: Camera and media permissions are declared in `app.json`. Expo's `expo-image-picker` plugin requests them at runtime when the user taps the scan button.
