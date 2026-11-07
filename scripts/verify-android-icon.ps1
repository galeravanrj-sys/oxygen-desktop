param([Parameter(Mandatory=$true)][string]$ApkPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$archive=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ApkPath).Path)
try {
 foreach($density in @('mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi')) {
  $entry=@($archive.Entries | Where-Object {$_.FullName -match ('^res/mipmap-'+$density+'(?:-v\d+)?/m8m8s_launcher_foreground\.png$')})
  if($entry.Count -ne 1){throw "Missing dedicated launcher foreground for $density"}
  $source=Join-Path $projectRoot "src-tauri/icons/android/mipmap-$density/ic_launcher_foreground.png"
  $expected=[Drawing.Bitmap]::new($source)
  $memory=[IO.MemoryStream]::new();$stream=$entry[0].Open()
  try{$stream.CopyTo($memory)}finally{$stream.Dispose()}
  $memory.Position=0;$actual=[Drawing.Bitmap]::new($memory)
  try {
   if($expected.Width -ne $actual.Width -or $expected.Height -ne $actual.Height){throw "Icon dimensions differ for $density"}
   for($y=0;$y -lt $expected.Height;$y++){for($x=0;$x -lt $expected.Width;$x++){if($expected.GetPixel($x,$y).ToArgb() -ne $actual.GetPixel($x,$y).ToArgb()){throw "Packaged icon differs from M8M8S source at $density ($x,$y)"}}}
   Write-Output "Verified packaged M8M8S icon pixels: $density"
  }finally{$actual.Dispose();$expected.Dispose();$memory.Dispose()}
 }
 if(!($archive.Entries | Where-Object {$_.FullName -eq 'res/mipmap-anydpi-v26/m8m8s_launcher.xml'})){throw 'Missing dedicated adaptive icon'}
}finally{$archive.Dispose()}
