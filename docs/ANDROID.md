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
