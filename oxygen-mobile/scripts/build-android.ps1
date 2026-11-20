param([ValidateSet('debug','release')][string]$Variant='debug')
$ErrorActionPreference='Stop'
$mobileProject=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$buildProject=$mobileProject
Push-Location -LiteralPath $buildProject
try {
 if(!$env:JAVA_HOME -and (Test-Path -LiteralPath 'C:\Program Files\Java\jdk-21')){$env:JAVA_HOME='C:\Program Files\Java\jdk-21'}
 if(!$env:ANDROID_HOME -and (Test-Path -LiteralPath 'D:\Android\Sdk')){$env:ANDROID_HOME='D:\Android\Sdk'}
 if(!$env:JAVA_HOME -or !$env:ANDROID_HOME){throw 'Set JAVA_HOME and ANDROID_HOME to the installed Java 21 and Android SDK.'}
 & npx.cmd expo prebuild --platform android --no-install
 if($LASTEXITCODE -ne 0){throw 'Expo Android prebuild failed.'}
 Push-Location -LiteralPath (Join-Path $buildProject 'android')
 try {
  $task=if($Variant -eq 'release'){':app:assembleRelease'}else{':app:assembleDebug'}
  $initScript=Join-Path $mobileProject 'scripts\windows-cmake.init.gradle'
  & '.\gradlew.bat' $task '--no-daemon' '--max-workers=2' '-PreactNativeArchitectures=arm64-v8a' '--init-script' $initScript
  if($LASTEXITCODE -ne 0){throw 'Android APK build failed. See the Gradle output.'}
 }finally{Pop-Location}
 $apk=Join-Path $mobileProject ('android\app\build\outputs\apk\'+$Variant+'\app-'+$Variant+'.apk')
 if(!(Test-Path -LiteralPath $apk)){throw 'Gradle did not produce the expected APK.'}
 New-Item -ItemType Directory -Path (Join-Path $mobileProject 'artifacts') -Force | Out-Null
 $destination=Join-Path $mobileProject ('artifacts\M8M8S-Mobile-0.1.0-'+$Variant+'.apk')
 Copy-Item -LiteralPath $apk -Destination $destination -Force
 Get-FileHash -LiteralPath $destination -Algorithm SHA256
 Write-Output ('APK: '+$destination)
 if($Variant -eq 'debug'){Write-Output 'Development client: start Metro with npm start, then open this app.'}
 else{Write-Output 'Bundled preview APK. Expo template debug signing is for testing; configure release signing before distribution.'}
}finally{Pop-Location}
