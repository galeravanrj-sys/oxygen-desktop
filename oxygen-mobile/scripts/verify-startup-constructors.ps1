param([Parameter(Mandatory=$true)][string]$Apk)
$ErrorActionPreference='Stop'
$sdk=if($env:ANDROID_HOME){$env:ANDROID_HOME}else{'D:\Android\Sdk'}
$javaHome=if($env:JAVA_HOME){$env:JAVA_HOME}else{'C:\Program Files\Java\jdk-21'}
$java=Join-Path $javaHome 'bin\java.exe'
$tools=Join-Path $sdk 'cmdline-tools\latest'
$classpath=Join-Path $tools 'lib\apkanalyzer-classpath.jar'
$classes=@('androidx.work.impl.WorkDatabase_Impl','androidx.work.OverwritingInputMerger','androidx.work.ArrayCreatingInputMerger')
foreach($class in $classes){
 $code=& $java ('-Dcom.android.sdklib.toolsdir='+$tools) -classpath $classpath com.android.tools.apk.analyzer.ApkAnalyzerCli dex code --class $class --method '<init>()V' $Apk
 if($LASTEXITCODE -ne 0 -or !($code -match '\.method public constructor <init>\(\)V')){throw ('Missing public no-argument startup constructor: '+$class)}
 Write-Output ('PASS: '+$class+' public constructor is present in APK DEX.')
}
