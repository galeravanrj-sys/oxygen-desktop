# M8M8S for Android

The website and Android app share the existing React/TypeScript frontend. Tauri 2 supplies the Rust application layer and Android WebView host. The Android app bundles the frontend locally; it is not a shortcut to the hosted website.

## Build on this Windows PC

From `D:\PHONE WEBSITE\oxygen-desktop`:

```powershell
npm run android:doctor
npm run android:build
```

The build produces an **ARM64 debug APK** for Android 7.0/API 24 or newer. This is a testing build, with the application ID `com.m8m8s.oxygen.debug`. Release builds use `com.m8m8s.oxygen`; production signing and Play Store publication are not configured.

Find the debug APK under:

```text
src-tauri/gen/android/app/build/outputs/apk/arm64/debug/
```

Windows machines that block symbolic links automatically use a copy-based packaging fallback after Rust compilation. This fallback is limited to the provided ARM64 debug build and does not change Windows security settings. `android:dev` and other Tauri build modes may still need Windows Developer Mode.

## Installed tooling

- Official stable Rust toolchain in `%USERPROFILE%\.cargo`, with `aarch64-linux-android`.
- Existing Visual Studio C++ tools for host build scripts.
- Existing JDK 21 in `C:\Program Files\Java\jdk-21`.
- Android command-line SDK at `D:\Android\Sdk`, including API 36, build tools, platform tools, and NDK r29.

`scripts/android.mjs` discovers these locations for its child processes. It does not globally replace your Java installation or system PATH. Override `ANDROID_HOME`, `NDK_HOME`, or `M8M8S_JAVA_HOME` if you move the tools. On another PC install the prerequisites, run `npm ci`, and then `npm run android:init`. The generated Android project currently targets stable API 36.

## Physical-device development

Enable Developer options and USB debugging on your Android phone, connect it by USB, and authorize the computer on the phone. Check connection with `npm run android:doctor`. No phone was connected during initial setup.

```powershell
npm run android:dev
```

For a debug APK you can also use Android's package installer after transferring the APK to your phone. Allow installation from your chosen file manager if Android asks. Do not distribute debug builds as production releases.

## Web and Android assets

| Command | Output | Asset base |
| --- | --- | --- |
| `npm run build` | `dist/` | `/oxygen-desktop/` for GitHub Pages |
| `npm run build:android` | `dist-android/` | `/` for the bundled app |
| `npm run dev:android` | Vite port 1420 | `/` |

The GitHub Pages workflow still uses `npm run build`. It does not require Rust or the Android SDK. Do not commit SDKs, Rust targets, Gradle caches, APK build output, local SDK paths, or signing keys.

## What to test on a phone

- App/window gestures, safe areas, keyboard behavior, and Android Back behavior.
- Supabase email/password sign-in, public chat, and Gallery sync.
- Camera permission and capture. Camera is declared optional in the manifest; device behavior still needs testing.
- File pickers, downloads, note/passport exports, media playback and calculator clipboard. Existing browser download APIs may need native adapters on Android WebView; setup does not claim those paths are device-verified.
- External guide/giveaway links use the system browser via the scoped opener plugin.

Personal tasks, notes, settings, and local photos live in the Android app's own WebView storage. They do not automatically transfer from Chrome or sync across devices. Shared public Gallery/chat/tier data continues using the existing hosted services and requires internet access. Supabase settings and secrets are unchanged.

Email confirmation may finish in the website; after confirming, return to the app and sign in with the same email/password. OAuth, app links and password-reset deep links are separate future configuration work.

Official setup reference: https://v2.tauri.app/start/prerequisites/

## Mobile interface (0.2.0)

The APK uses a dedicated mobile shell with Home, Games, Apps, and You tabs. Apps open full-screen with a back button; the desktop website keeps its existing window layout. Favorites, task summaries, recent apps, search, notifications, and appearance use the existing app data. Calculator history opens as a panel on phones. Browser layout checks cover 320–768px; physical-device testing is still required.

## Phone notifications (0.3.0)

Open the bell on the mobile home screen, choose **Enable phone alerts**, and allow Android's notification permission. Use **Send test** to verify the notification drawer. Tier-list changes and free-game alerts follow the category switches in the notification panel. **Android settings** opens system notification controls, including the separate tier and giveaway channels.

A native WorkManager job checks the existing public feeds approximately every 15 minutes, even while the WebView is closed. Android may delay work during Doze, battery saving, or manufacturer restrictions; this is periodic background checking, not instant FCM push. Force-stopping the app prevents checks until it is opened again. No backend deployment, Firebase account, private tokens, or new secrets are required.

The first successful check quietly establishes a baseline. Only actual ranking changes and previously unseen active game giveaways create phone alerts. Failed/stale responses retain the previous baseline. Turning alerts off cancels scheduled checks and clears this app's visible notifications. Notification taps open the relevant tier list or giveaway.

Verification: five native ranking fingerprint tests cover timestamp/image-only changes, reordered lists, changed ranks, role grids, and stale/unavailable feeds. Browser bridge simulations cover permission, enable, test, disable, desktop separation, and existing mobile navigation. The signed APK builds; notification delivery, process death/reboot scheduling, and tap routing still require physical-device checks.

References: https://developer.android.com/reference/androidx/work/PeriodicWorkRequest and https://developer.android.com/develop/ui/compose/notifications/notification-permission
## Notifications and separate Admin APK (0.4.0)

The bell now opens a full-screen Notifications app. New unread items appear under New; read items from the current day appear under Today; older read items appear under Earlier. Read messages stay in history (up to 100 saved items). Announcements open as full messages. Notification preferences and phone alert controls are in Settings. The old popover, close button, manual Check now action, and last-check footer were removed.

Build user APK: `npm run android:build`.
Build separate administrator APK: `npm run android:admin:build`.
Both commands currently output `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`, so copy each APK before building the other variant. User application ID: `com.m8m8s.oxygen.debug`; administrator application ID: `com.m8m8s.admin.debug`. They install side by side and use separate Android app storage. The Admin app has sign-in, backend role checks, drafts, preview, publication confirmation, and announcement history. It is not included in the user app's launcher.

Use an existing confirmed account with a row in `public.announcement_admins`. Administrator membership can be assigned only through privileged database access; client applications cannot grant themselves access. There are no service-role keys or administrator passwords in either APK. Published messages are immutable through client RPCs. Drafts and author IDs are not included in the public feed.

Backend migration: `supabase/migrations/20261107000100_announcements.sql`. The read-only `announcements` edge function is deployed without JWT verification because published announcements are public. Saving and publishing go through authenticated, administrator-checked database RPCs. Do not deploy backend changes or grant roles without approval.

Users must install 0.4.0 or newer to receive announcements. The user app fetches history in the foreground; the native worker checks for phone alerts about every 15 minutes. Existing Android timing, permission, channel and force-stop restrictions still apply. The first feed check establishes a quiet baseline. Enabling announcements later imports prior announcements as history rather than alerting for all old messages. No real announcements are published by the automated checks.