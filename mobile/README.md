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

## Push notifications (new SOS → volunteers)

How it works: the app saves its Expo push token in `push_tokens` after sign-in. A Supabase Database
Webhook calls `https://kupkop.vercel.app/api/push/new-report` on every new `sos_reports` row, and that
route alerts every volunteer and admin (except the reporter). Tapping the alert opens the case.

Push does **not** work in Expo Go on Android. Use a development build:

1. `npx eas-cli@latest init` (links this folder to an Expo project and writes the projectId to app.json).
2. Firebase (free): create a project, add an Android app with package `com.kupkop.app`, download
   `google-services.json` into `mobile/`, add `"googleServicesFile": "./google-services.json"` under
   `expo.android` in app.json. In Firebase → Project settings → Service accounts, generate a private key
   and upload it with `npx eas-cli@latest credentials` → Android → FCM V1.
3. `npx eas-cli@latest build --platform android --profile development`, install it, then `npx expo start`.

Server side (once): run `supabase/migrations/20261029000001_push_tokens.sql`; on Vercel add
`SUPABASE_SERVICE_ROLE_KEY` and `PUSH_WEBHOOK_SECRET` (any long random string) and redeploy; in Supabase
→ Database → Webhooks create one on `sos_reports` INSERT, HTTP POST to the URL above, with header
`x-webhook-secret: <the same secret>`.
