#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
struct PhoneUpdates(tauri::plugin::PluginHandle<tauri::Wry>);

pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  tauri::plugin::Builder::new("phone-updates")
    .setup(|_app, _api| {
      #[cfg(target_os = "android")]
      _app.manage(PhoneUpdates(_api.register_android_plugin("com.m8m8s.oxygen", "PhoneNotificationsPlugin")?));
      Ok(())
    }).build()
}

#[tauri::command]
pub async fn phone_notifications(app: tauri::AppHandle, action: String, payload: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
  if !["status", "configure", "requestPermission", "test", "openSettings", "consumeOpen"].contains(&action.as_str()) {
    return Err("Unknown notification action".into());
  }
  #[cfg(target_os = "android")]
  { app.state::<PhoneUpdates>().0.run_mobile_plugin(&action, payload.unwrap_or(serde_json::json!({}))).map_err(|error| error.to_string()) }
  #[cfg(not(target_os = "android"))]
  { let _ = (app, payload); Err("Phone notifications are available on Android".into()) }
}
