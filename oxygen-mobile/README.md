# M8M8S Mobile

A separate native Android implementation of M8M8S / Oxygen Desktop. It uses
TypeScript, Expo SDK 58, Expo Router and Material 3 React Native components.
The original website and Tauri application are not replaced.

## Start

```powershell
cd 'D:\PHONE WEBSITE\oxygen-mobile'
npm.cmd ci
# If .env.local is absent, copy .env.example and enter the EXISTING public values.
npm.cmd start
```

Use a development build rather than assuming the current Expo Go app supports
SDK 58 and every configured native capability. No Expo account is required for
the local Android build. EAS cloud builds require your own Expo sign-in.

```powershell
# Install/run a development client on a connected device or configured emulator:
npm.cmd run android

# Or build an ARM64 development-client APK locally:
$env:JAVA_HOME='C:\Program Files\Java\jdk-21' # This host also has GraalVM; use the standard JDK.
npm.cmd run build:android

# Attempt a bundled, standalone preview APK using the Expo template’s test signing:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Variant release
```

The script detects the installed Java 21 and `D:\Android\Sdk`, or respects
`JAVA_HOME` and `ANDROID_HOME`. It builds only this project. Build outputs are
copied into ignored `artifacts/` when successful. Install a resulting APK with:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r '.\artifacts\M8M8S-Mobile-0.1.1-debug.apk'
# For a development client, leave Metro running:
npm.cmd start
# Standalone preview (bundled JavaScript, no Metro needed):
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r '.\artifacts\M8M8S-Mobile-0.1.1-release.apk'
```

On this Windows workspace, prefer the APK script for local compilation: it applies
project-local CMake path hashing/staging to avoid Ninja's long-path failures.
Direct `expo run:android` does not apply that Gradle init script. The standard
JDK 21 is required here; the host's GraalVM installation failed the SDK image
transform during verification. No registry or shared SDK build tools were changed.

Use `eas.json` with `npx eas-cli build --platform android --profile development`
or `--profile preview` for your own EAS builds. Production uses an app bundle
and your release credentials. Do not publish the template debug signing key.

## Configuration and shared data

Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
required. Public values are visible in the app bundle, as on the website.
Never put a service-role key, password, or private token in `EXPO_PUBLIC_*`.
Use the original Supabase project; no migrations or RLS changes are required.

Auth, chat, public Gallery photos, tier lists and announcements use existing
contracts. Notes, tasks, events, private photos, documents, bookmarks, passport,
calculator history and preferences remain device-local. Clearing app data or
uninstalling can remove them. Export important data first.

Settings provides backup/import and standalone passport JSON import. To migrate
website text/preferences, run `scripts/export-website-data.js` manually in that
website’s DevTools console, transfer its JSON file, then choose **Settings →
Import device / website backup**. Private website photos and documents should be
downloaded from the website and selected with Gallery/Files in the native app.
The original website is not modified by the exporter.

Camera and photo permissions are requested at the point of use. Sharing uses the
system sheet; external websites use Android Custom Tabs. Background update checks
use OS scheduling and can be delayed by battery restrictions. Reminders are local,
not a server push service. Restoring a data backup does not recreate Android’s
scheduled alarms; recreate reminders you need on the restored device.

For optional email-auth deep links, the owner must allow the app’s
`m8m8s-mobile://account` redirect in Supabase Auth settings. Existing email/password
sign-in and the project’s existing email-confirmation behavior work without
changing the website. Redirect settings have not been changed automatically.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run doctor
npm.cmd run verify:source
node scripts/check-backend.mjs   # Read-only network contract checks
npx.cmd expo export --platform android --output-dir dist-android
```

See `MIGRATION_PROGRESS.md` for the complete inventory and intentional native
replacements. `TEST_RESULTS.md` records the actual check and build outcomes,
including anything not tested on a device.
