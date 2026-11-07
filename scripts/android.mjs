import { existsSync, readdirSync, copyFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={...process.env};
const first=values=>values.filter(Boolean).find(value=>existsSync(value));
const cargoBin=path.join(env.CARGO_HOME||path.join(homedir(),'.cargo'),'bin');
env.ANDROID_HOME=first([env.ANDROID_HOME,env.ANDROID_SDK_ROOT,'D:/Android/Sdk',path.join(env.LOCALAPPDATA||'','Android','Sdk')]);
env.JAVA_HOME=first([env.M8M8S_JAVA_HOME,'C:/Program Files/Java/jdk-21','C:/Program Files/Android/Android Studio/jbr','C:/Program Files/Java/jdk-17',env.JAVA_HOME]);
const ndkRoot=env.ANDROID_HOME&&path.join(env.ANDROID_HOME,'ndk');
const ndks=ndkRoot&&existsSync(ndkRoot)?readdirSync(ndkRoot).filter(name=>existsSync(path.join(ndkRoot,name,'source.properties'))).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})):[];
env.NDK_HOME=first([env.NDK_HOME,ndks[0]&&path.join(ndkRoot,ndks[0])]);
env.Path=[cargoBin,env.JAVA_HOME&&path.join(env.JAVA_HOME,'bin'),env.ANDROID_HOME&&path.join(env.ANDROID_HOME,'platform-tools'),env.Path||env.PATH].filter(Boolean).join(path.delimiter);
env.PATH=env.Path;
const [requested='doctor',...args]=process.argv.slice(2);
const command=requested==='build-admin'?'build':requested;
if(requested==='build-admin'){env.M8M8S_ADMIN_BUILD='1';args.push('--config','src-tauri/tauri.admin.conf.json');}
const failures=[];
if(!existsSync(path.join(cargoBin,process.platform==='win32'?'cargo.exe':'cargo')))failures.push('Rust is missing. Install from https://rustup.rs.');
if(!env.JAVA_HOME)failures.push('JDK 21/Android Studio JBR is missing. Set M8M8S_JAVA_HOME.');
if(!env.ANDROID_HOME)failures.push('Android SDK is missing. Set ANDROID_HOME.');
if(!env.NDK_HOME)failures.push('Android NDK is missing. Install NDK (side by side) with the SDK Manager.');
if(command==='doctor'){
 console.log('M8M8S Android build setup');for(const key of ['JAVA_HOME','ANDROID_HOME','NDK_HOME'])console.log(`${key}: ${env[key]||'not found'}`);
 for(const [binary,options]of [[path.join(cargoBin,'rustc.exe'),['--version']],[path.join(cargoBin,'cargo.exe'),['--version']],[env.JAVA_HOME&&path.join(env.JAVA_HOME,'bin/java.exe'),['-version']],[env.ANDROID_HOME&&path.join(env.ANDROID_HOME,'platform-tools/adb.exe'),['devices']]])if(binary&&existsSync(binary)){const result=spawnSync(binary,options,{env,encoding:'utf8',windowsHide:true});console.log((result.stdout||'').trim());if(result.stderr)console.log(result.stderr.trim());}
 if(failures.length)console.error(failures.join('\n'));process.exitCode=failures.length?1:0;
}else if(!['init','dev','build'].includes(command)){console.error('Use init, dev, build, or doctor.');process.exitCode=1;}
else if(command==='init'&&existsSync(path.join(root,'src-tauri/gen/android/app/build.gradle.kts'))){console.log('Android project is already initialized. Use npm run android:build or npm run android:dev.');}
else if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else{
 const iconSource=path.join(root,'src-tauri/icons/android');
 const resourceRoot=path.join(root,'src-tauri/gen/android/app/src/main/res');
 if(existsSync(resourceRoot)&&existsSync(iconSource)){
  for(const folder of readdirSync(iconSource,{withFileTypes:true}).filter(item=>item.isDirectory()&&/^mipmap-/.test(item.name))){
   const destination=path.join(resourceRoot,folder.name);mkdirSync(destination,{recursive:true});
   for(const icon of readdirSync(path.join(iconSource,folder.name)).filter(name=>name.endsWith('.png')))copyFileSync(path.join(iconSource,folder.name,icon),path.join(destination,icon));
   for(const icon of ['ic_launcher.png','ic_launcher_foreground.png','ic_launcher_round.png'])if(existsSync(path.join(iconSource,folder.name,icon)))copyFileSync(path.join(iconSource,folder.name,icon),path.join(destination,icon.replace('ic_launcher','m8m8s_launcher')));
  }
 }
 const cli=path.join(root,'node_modules/@tauri-apps/cli/tauri.js');
 const extra=command==='init'?['--ci','--skip-targets-install']:[];
 const child=spawn(process.execPath,[cli,'android',command,...extra,...args],{cwd:root,env,stdio:['inherit','pipe','pipe'],windowsHide:true});
 let output='';
 child.stdout.on('data',chunk=>{process.stdout.write(chunk);output=(output+chunk.toString()).slice(-80000);});
 child.stderr.on('data',chunk=>{process.stderr.write(chunk);output=(output+chunk.toString()).slice(-80000);});
 child.on('error',error=>{console.error(error.message);process.exitCode=1;});
 child.on('exit',code=>{
  if(code!==0&&process.platform==='win32'&&command==='build'&&args.includes('--debug')&&args.includes('aarch64')&&/Creation symbolic link is not allowed|symbolic link privilege/i.test(output)){
   console.log('Windows blocked symbolic links. Packaging the compiled ARM64 debug library by copying it instead; Windows settings are unchanged.');
   const fallback=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/package-android.ps1')],{cwd:root,env,stdio:'inherit',windowsHide:true});
   fallback.on('error',error=>{console.error(error.message);process.exitCode=1;});fallback.on('exit',status=>{process.exitCode=status??1;});
  }else process.exitCode=code??1;
 });
}
