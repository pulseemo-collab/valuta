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

The app reads Supabase credentials from two environment variables. These must be present at **build time** — Metro bundles them into the JS bundle when building the APK. They are NOT loaded at runtime from a file.

### 7a. Local development (.env)

Create `.env` in the project root (never commit this file):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get the values from your Supabase dashboard → Project Settings → API.

### 7b. EAS cloud builds (required for APK/AAB)

EAS secrets are injected as environment variables during the cloud build. Without them the APK will have empty strings and Supabase will fail with "Network request failed".

**Step 1 — Create the secrets (one-time setup)**

```sh
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project-id.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

> The secret names must match exactly (including the `EXPO_PUBLIC_` prefix and exact casing).

**Step 2 — Verify secrets exist**

```sh
eas secret:list
```

Both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` must appear in the output.

**Step 3 — Rebuild**

After adding secrets, you must trigger a new build — secrets are baked in at build time, not applied to existing APKs:

```sh
eas build --platform android --profile preview
```

### 7c. Diagnosing a missing-config build

If the APK shows **"Konfigurimi i Supabase mungon në build-in Android."** on the login or register screen, or the Metro logs show `[Supabase] EXPO_PUBLIC_SUPABASE_URL is missing`, the secrets were not injected. Check:

1. `eas secret:list` — both names must be present with scope `project`
2. The secret names match exactly (no typos, no extra spaces)
3. You triggered a **new build** after creating the secrets (old APKs cannot be patched)
4. `eas.json` has the `env` section for the build profile you used (already set in this repo)

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
