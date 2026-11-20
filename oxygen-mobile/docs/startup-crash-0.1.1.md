# Android startup crash: 0.1.0 to 0.1.1

The user reported that the published 0.1.0 preview closed immediately on launch.
USB debugging confirmed the failure on an Oppo Reno 13F (CPH2699), Android 16:

```text
Unable to get provider androidx.startup.InitializationProvider
java.lang.NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []
```

The original R8 usage report explicitly listed `WorkDatabase_Impl`'s public
no-argument constructor as removed. APK Analyzer also could not find that
constructor in the published 0.1.0 APK. This matches the independently reported
[Expo SDK 58 background-task startup issue](https://github.com/expo/expo/issues/52173).

Version 0.1.1 adds the two targeted Room/WorkManager constructor keep rules through
the supported `expo-build-properties` plugin in `app.json`. R8 remains enabled.
Prebuild generates the native configuration; native generated files and installed
dependencies are not edited manually. Package identity and signing are retained,
with Android versionCode increased to 2 for an in-place update.

The build script now reads the app version from `app.json` for APK filenames.
`scripts/verify-startup-constructors.ps1` checks the actual APK DEX for public,
no-argument constructors on WorkDatabase_Impl and both built-in InputMergers:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-startup-constructors.ps1 -Apk artifacts/M8M8S-Mobile-0.1.1-release.apk
```

TypeScript, lint, seven domain tests and all 20 Expo Doctor checks passed after
adding the build plugin. The corrected release built successfully in 5m 32s.
APK Analyzer verified all three constructors in the minified APK. The APK's
signature matches the previous version, and versionCode is 2.

The replacement was installed with `adb install -r` on the user's Oppo Reno 13F,
retaining app data. Three force-stop/cold-launch trials passed without native
crashes, and UI Automator plus a screenshot confirmed the native Home screen
rendered. Results are recorded in `docs/android-startup-checks.json`.

Authenticated backend writes and the full media/notification device checklist
remain separate from the startup regression check.
