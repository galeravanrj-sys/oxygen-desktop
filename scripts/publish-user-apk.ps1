param(
 [Parameter(Mandatory=$true)][ValidatePattern('^v[0-9]+\.[0-9]+\.[0-9]+$')][string]$Tag,
 [string]$ApkPath='src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk'
)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $projectRoot
try {
 $apk=(Resolve-Path -LiteralPath $ApkPath).Path
 $version=(Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
 if($Tag -ne ('v'+$version)){throw 'Tag must match the current app version.'}
 $remoteTag=git ls-remote --tags origin ('refs/tags/'+$Tag)
 if($LASTEXITCODE -ne 0 -or !$remoteTag){throw 'Push the release tag before uploading the APK.'}
 $hash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
 $checksum=Join-Path ([IO.Path]::GetTempPath()) ('M8M8S-'+$Tag+'-SHA256SUMS.txt')
 [IO.File]::WriteAllText($checksum,"$hash  M8M8S.apk`n",[Text.Encoding]::ASCII)
 $lines="protocol=https`nhost=github.com`n`n" | git credential fill
 if($LASTEXITCODE -ne 0){throw 'GitHub sign-in is required.'}
 $credential=@{}
 foreach($line in $lines){if($line -match '^([^=]+)=(.*)$'){$credential[$matches[1]]=$matches[2]}}
 if(!$credential['password']){throw 'No GitHub credential is available.'}
 $headers=@{Authorization='Bearer '+$credential['password'];Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28';'User-Agent'='M8M8S-release'}
 $api='https://api.github.com/repos/galeravanrj-sys/oxygen-desktop/releases'
 $notes="M8M8S $Tag Android preview.`n`nThe app grids fit on one screen without scrolling. The Your personal space tagline is removed. Includes integrated account-based admin tools and announcement notifications.`n`nDownload M8M8S.apk and install over the previous M8M8S app. ARM64, Android 7.0+. Debug-signed preview; physical-device testing remains necessary. SHA256SUMS.txt verifies the download."
 $release=@(Invoke-RestMethod -Uri ($api+'?per_page=100') -Headers $headers) | Where-Object {$_.tag_name -eq $Tag} | Select-Object -First 1
 if(!$release){$body=@{tag_name=$Tag;name="M8M8S $Tag - Android Preview";body=$notes;draft=$true;prerelease=$true}|ConvertTo-Json;$release=Invoke-RestMethod -Method Post -Uri $api -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))}
 $uploadRoot=$release.upload_url -replace '\{.*$',''
 foreach($asset in @(@{Path=$apk;Name='M8M8S.apk';Type='application/vnd.android.package-archive'},@{Path=$checksum;Name='SHA256SUMS.txt';Type='text/plain'})){
  $digest='sha256:'+(Get-FileHash -LiteralPath $asset.Path -Algorithm SHA256).Hash.ToLowerInvariant()
  $existing=@($release.assets|Where-Object {$_.name -eq $asset.Name})
  if($existing.Count){if($existing[0].state -eq 'uploaded' -and $existing[0].digest -eq $digest){Write-Output ('Already verified: '+$asset.Name);continue};throw ('An asset with different contents already exists: '+$asset.Name)}
  Write-Output ('Uploading '+$asset.Name)
  $uploaded=Invoke-RestMethod -Method Post -Uri ($uploadRoot+'?name='+[Uri]::EscapeDataString($asset.Name)) -Headers $headers -ContentType $asset.Type -InFile $asset.Path -TimeoutSec 900
  if($uploaded.state -ne 'uploaded' -or $uploaded.size -ne (Get-Item -LiteralPath $asset.Path).Length -or ($uploaded.digest -and $uploaded.digest -ne $digest)){throw 'Upload verification failed.'}
 }
 $ready=Invoke-RestMethod -Uri ($api+'/'+$release.id) -Headers $headers
 if(@($ready.assets).Count -ne 2 -or @($ready.assets|Where-Object {$_.name -notin @('M8M8S.apk','SHA256SUMS.txt')}).Count){throw 'Unexpected release assets; publication stopped.'}
 $published=Invoke-RestMethod -Method Patch -Uri ($api+'/'+$release.id) -Headers $headers -ContentType 'application/json' -Body (@{draft=$false;prerelease=$true;body=$notes}|ConvertTo-Json)
 Write-Output ('Published: '+$published.html_url)
} finally { Pop-Location }
