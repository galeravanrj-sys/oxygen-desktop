# M8M8S Mobile validation

Validation date: 20 November 2026 (Asia/Manila). This is a separate Expo project;
implementation coverage is listed in `MIGRATION_PROGRESS.md`.

## Completed checks

| Check                              | Actual result                                                                                                 | Command / evidence                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| TypeScript                         | Passed, no diagnostics                                                                                        | `npm.cmd run typecheck`                                            |
| ESLint                             | Passed, no errors or warnings                                                                                 | `npm.cmd run lint`                                                 |
| Domain tests                       | 7 passed, 0 failed                                                                                            | `npm.cmd test`                                                     |
| Expo Doctor                        | All 20 checks passed after adding the required direct `expo-asset` dependency                                 | `npm.cmd run doctor`                                               |
| Original project preservation      | All 105 recorded source/assets/backend/pipeline hashes match the pre-migration baseline                       | `npm.cmd run verify:source`                                        |
| Existing backend contracts         | 14 read-only checks passed                                                                                    | `node scripts/check-backend.mjs`; `docs/backend-checks.json`       |
| Android native generation          | Passed                                                                                                        | `npx.cmd expo prebuild --platform android --no-install`            |
| Android JavaScript / Hermes export | Passed                                                                                                        | `npx.cmd expo export --platform android --output-dir dist-android` |
| Web preview export                 | Passed                                                                                                        | `npx.cmd expo export --platform web --output-dir dist-web`         |
| Preview interactions/routes        | Passed: note/task persistence, calculator, all 19 app routes, account route, no uncaught browser errors       | `docs/preview-checks.json`                                         |
| Responsive launcher preview        | Passed: no horizontal page overflow at 320x740, 414x896, 768x1024 and 960x540; screenshots visually inspected | `.qa/apps-*.png`                                                   |

The standalone ARM64 preview APK also built successfully. Signature verification
and package-manifest inspection passed; see the native build details below.

The domain tests exercise decimal arithmetic and invalid calculator input,
category/role ranking isolation, malformed/duplicate passport records, backup and
unsafe-URL validation, byte-bounded SecureStore chunking and failed-write recovery,
notification baselines/deduplication, and registration of all 19 actual source apps.

Read-only network checks compare public Gallery listings from website and mobile
clients, read the existing chat/reaction contracts and room-activity RPC, validate
anonymous admin denial, load announcements and all five remote ranking feeds,
and fetch GamerPower and Open-Meteo. No database migration, message, reaction,
report, upload, deletion or announcement publication was performed by these checks.
This proves shared reads/contracts; bidirectional authenticated writes remain unverified.

## Native build investigation

Local build command:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Variant release
```

The installed SDK and Gradle downloaded the required build dependencies. Initial
attempts failed on Windows Ninja/CMake paths in Reanimated and generated gesture
handler code. A temporary `subst` alias was also attempted, but Expo/Gradle resolved
different drive roots. That alias was removed; the build script does not use it.

The current script uses a project-scoped Gradle init script to hash long CMake
object paths and shorten this app's native staging directory. With this change,
the previously failing C++ stages passed. The next attempt failed during the
Android JDK image transform using the host's GraalVM JDK. A standard installed
JDK 21 retry **succeeded** (`BUILD SUCCESSFUL in 5m 28s`, 898 actionable tasks).
That build is recorded in `logs/android-final.log`; the final frozen-source rebuild
is recorded in `logs/android-final-verified.log` and also succeeded in 4m 46s.
The generated Android bundle timestamp was checked to be later than the final
source correction, and the resulting artifact was verified again.

`apksigner verify --print-certs` passed. `aapt dump badging` confirmed:

- Package: `com.m8m8s.oxygen.mobile`, version `0.1.0`, code `1`.
- App label: `M8M8S Mobile`; launchable `MainActivity` present.
- Minimum Android SDK 24; target SDK 36; compiled with SDK 37.
- Native architecture: `arm64-v8a`.
- Certificate: Android Debug (preview/test signing).

Artifact size and final SHA-256 are recorded in `docs/android-artifact.json`.

Build outputs and logs are ignored. A successful script copies the APK into
`artifacts/` and prints its SHA-256; it throws on failure. The release variant uses
Expo template test signing, so it is a preview build. Production signing and store
submission have not been performed. The local script targets ARM64 only.

## Runtime validation limits

No Android device or configured emulator was available (`adb devices` returned
no device). Physical Android testing has therefore not been completed.

The browser preview uses AsyncStorage for its session adapter; Android retains
Expo SecureStore. Browser checks cannot establish native permission, storage,
media, notification, or lifecycle correctness. Initial Metro preview navigation
timeouts were worked around using the exported static preview. Completed preview
checks are recorded separately in `docs/preview-checks.json`. The test runner waited
for local-state hydration after reload and used exact calculator accessibility labels.

Before release, verify on an Android phone and a tablet:

- Sign in, confirm signup, restart with a persisted session, refresh tokens,
  sign out, and open an allowed `m8m8s-mobile://account` email redirect.
- Send/reply/react/report/delete as authorized accounts; observe a website write
  on Android and an Android write on the website. Repeat for public Gallery and
  announcements with an authorized admin. Confirm RLS rejects unauthorized actions.
- Deny and grant camera/media/notification permissions; capture both cameras,
  check orientation, select large photos, publish/share/save, swipe and slideshow.
- Import documents/audio, rename/move/copy/delete nested folders, share files,
  export/import backups, and confirm media survives a cold restart.
- Test audio seek/volume, track completion, headset interruptions, lock-screen
  controls and background playback across navigation.
- Schedule/cancel reminders, tap notifications, test background checks under
  Android battery restrictions, and verify the initial feed baseline stays quiet.
- Test Android back and predictive back, keyboard, TalkBack/font scaling,
  dark/light appearance, offline recovery, rotation and tablet layouts.

Imported backups restore data but do not recreate Android notification schedules.
No production account credentials were available for authenticated testing.

## Launch and repeat checks

```powershell
cd 'D:\PHONE WEBSITE\oxygen-mobile'
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run doctor
npm.cmd run verify:source
node scripts/check-backend.mjs
npm.cmd start
# In another terminal, with a device connected:
npm.cmd run android
# Local development APK (requires Java 21 and Android SDK):
npm.cmd run build:android
```

Public Supabase values are already configured in ignored `.env.local` in this
workspace. For a fresh checkout, use `.env.example` with the same existing project.
See `README.md` for installation, EAS build profiles and website-data transfer.
