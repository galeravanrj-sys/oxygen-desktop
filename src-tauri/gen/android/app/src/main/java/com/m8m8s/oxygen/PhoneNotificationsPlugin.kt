package com.m8m8s.oxygen

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.os.Build
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class PhoneUpdateArgs {
  var enabled: Boolean = false
  var tierAlerts: Boolean = true
  var freeGameAlerts: Boolean = true
  var announcementAlerts: Boolean = true
}

@TauriPlugin(permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")])
class PhoneNotificationsPlugin(private val activity: Activity) : Plugin(activity) {
  private fun result(): JSObject = JSObject().apply {
    put("enabled", PhoneUpdates.preferences(activity).getBoolean("enabled", false))
    put("granted", PhoneUpdates.allowed(activity))
    put("lastCheck", PhoneUpdates.preferences(activity).getLong("lastCheck", 0))
  }

  @Command
  fun status(invoke: Invoke) { invoke.resolve(result()) }

  @Command
  fun configure(invoke: Invoke) {
    val args = invoke.parseArgs(PhoneUpdateArgs::class.java)
    PhoneUpdates.configure(activity, args.enabled, args.tierAlerts, args.freeGameAlerts, args.announcementAlerts)
    invoke.resolve(result())
  }

  @Command
  fun requestPermission(invoke: Invoke) {
    PhoneUpdates.channels(activity)
    if (Build.VERSION.SDK_INT >= 33 && !PhoneUpdates.allowed(activity)) {
      requestPermissionForAlias("notifications", invoke, "permissionResult")
    } else invoke.resolve(result())
  }

  @PermissionCallback
  fun permissionResult(invoke: Invoke) { invoke.resolve(result()) }

  @Command
  fun test(invoke: Invoke) {
    if (!PhoneUpdates.allowed(activity)) { invoke.reject("Allow notifications in Android settings first."); return }
    PhoneUpdates.post(activity, "test", "Phone notifications are ready", "M8M8S updates can now appear on your phone.")
    invoke.resolve(result())
  }

  @Command
  fun openSettings(invoke: Invoke) {
    activity.startActivity(Intent(if (Build.VERSION.SDK_INT >= 26) Settings.ACTION_APP_NOTIFICATION_SETTINGS else Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
      if (Build.VERSION.SDK_INT >= 26) putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
      else data = android.net.Uri.parse("package:" + activity.packageName)
    })
    invoke.resolve()
  }

  @Command
  fun consumeOpen(invoke: Invoke) {
    val intent = activity.intent
    val result = JSObject()
    intent.getStringExtra("m8_kind")?.let { result.put("kind", it) }
    intent.getStringExtra("m8_game")?.let { result.put("game", it) }
    if (intent.hasExtra("m8_offer")) result.put("offerId", intent.getLongExtra("m8_offer", 0))
    intent.getStringExtra("m8_announcement")?.let { result.put("announcementId", it) }
    intent.removeExtra("m8_announcement")
    intent.removeExtra("m8_kind"); intent.removeExtra("m8_game"); intent.removeExtra("m8_offer")
    invoke.resolve(result)
  }

  override fun onNewIntent(intent: Intent) { activity.intent = intent }
}
