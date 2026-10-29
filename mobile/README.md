# KupKop mobile (Expo / React Native)

The Android and iPhone app. It uses the same Supabase project as the web app, and calls the web app on
Vercel for Rafa (`/api/chat`), street names and email checks, so the Gemini key never ships in the app.

Shared logic comes straight from the web repo: `../src/lib/sos/escalation.ts`, `../src/lib/sos/geo.ts`
and `../src/types/database.ts` (imported as `@shared/...` and `@shared-types/...`). Change them once and
both apps get it.

## Run it on your phone (free)

1. Install **Expo Go** from the Play Store (or App Store).
2. In this folder:
   ```bash
   npm install
   cp .env.example .env      # then fill in the two Supabase values (same as the web .env.local)
   npx expo start
   ```
3. Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Phone and computer must be on the
   same Wi-Fi; if not, run `npx expo start --tunnel`.

## Build an installable Android app (APK)

```bash
npx eas-cli@latest login            # free Expo account
npx eas-cli@latest build --platform android --profile preview
```

EAS builds in the cloud and gives a download link for the `.apk`. Send that link to testers; they
install it directly (Android asks to allow installs from that source). Before the first build, add the
two `EXPO_PUBLIC_SUPABASE_*` values as EAS environment variables (expo.dev → project → Environment
variables), because `.env` is not uploaded.

iPhone: Expo Go works for testing. A real iPhone build (TestFlight / App Store) needs the
Apple Developer Program ($99/year).

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
