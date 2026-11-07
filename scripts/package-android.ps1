$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nativeLibrary = Join-Path $projectRoot 'src-tauri\target\aarch64-linux-android\debug\libapp_lib.so'
$jniDirectory = Join-Path $projectRoot 'src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a'
if (-not (Test-Path -LiteralPath $nativeLibrary)) { throw 'Build the ARM64 Rust library first using npm run android:build.' }
if (-not ([IO.Path]::GetFullPath($jniDirectory).StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase))) { throw 'Invalid Android output directory.' }
New-Item -ItemType Directory -Path $jniDirectory -Force | Out-Null
Copy-Item -LiteralPath $nativeLibrary -Destination (Join-Path $jniDirectory 'libapp_lib.so') -Force
Push-Location (Join-Path $projectRoot 'src-tauri\gen\android')
try {
 & '.\gradlew.bat' ':app:assembleArm64Debug' '-x' ':app:rustBuildArm64Debug' '--no-daemon'
 if ($LASTEXITCODE -ne 0) { throw 'Android APK packaging failed.' }
} finally { Pop-Location }
