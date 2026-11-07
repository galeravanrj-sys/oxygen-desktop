package com.m8m8s.oxygen

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

/** Public-feed checks run independently of the WebView. No account tokens or private data. */
object PhoneUpdates {
  private const val WORK = "m8m8s-phone-updates-v1"
  private const val TIERS = "m8m8s-tier-updates"
  private const val GAMES = "m8m8s-free-games"
  private val gameNames = linkedMapOf("zzz" to "Zenless Zone Zero", "genshin" to "Genshin Impact", "origin" to "Seven Deadly Sins: Origin", "hsr" to "Honkai: Star Rail", "grandcross" to "7DS Grand Cross")
  fun preferences(context: Context) = context.getSharedPreferences("m8m8s-phone-updates-v1", Context.MODE_PRIVATE)
  fun allowed(context: Context) = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun channels(context: Context) {
    if (Build.VERSION.SDK_INT >= 26) {
      val manager = context.getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(TIERS, "Tier-list changes", NotificationManager.IMPORTANCE_DEFAULT))
      manager.createNotificationChannel(NotificationChannel(GAMES, "Free game giveaways", NotificationManager.IMPORTANCE_DEFAULT))
    }
  }

  fun configure(context: Context, enabled: Boolean, tierAlerts: Boolean, freeGameAlerts: Boolean) {
    val prefs = preferences(context)
    val edit = prefs.edit()
    // Start quietly whenever a category is enabled; old updates are not new notifications.
    if (enabled && (!prefs.getBoolean("enabled", false) || tierAlerts && !prefs.getBoolean("tierAlerts", true))) {
      gameNames.keys.forEach { edit.remove("tier.$it") }
    }
    if (enabled && (!prefs.getBoolean("enabled", false) || freeGameAlerts && !prefs.getBoolean("freeGameAlerts", true))) edit.remove("offers")
    edit.putBoolean("enabled", enabled).putBoolean("tierAlerts", tierAlerts).putBoolean("freeGameAlerts", freeGameAlerts).apply()
    val manager = WorkManager.getInstance(context)
    if (enabled && (tierAlerts || freeGameAlerts)) {
      channels(context)
      val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
      manager.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<PhoneUpdateWorker>(15, TimeUnit.MINUTES).setConstraints(constraints).build())
    } else {
      manager.cancelUniqueWork(WORK)
      NotificationManagerCompat.from(context).cancelAll()
    }
  }

  fun post(context: Context, kind: String, title: String, body: String, game: String? = null, offer: Long? = null) {
    if (!allowed(context)) return
    if (kind != "test") {
      val prefs = preferences(context)
      if (!prefs.getBoolean("enabled", false) || !prefs.getBoolean(if (kind == "tierlist") "tierAlerts" else "freeGameAlerts", true)) return
    }
    channels(context)
    val id = ("$kind:$game:$offer").hashCode() and Int.MAX_VALUE
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("m8_kind", kind)
      game?.let { putExtra("m8_game", it) }; offer?.let { putExtra("m8_offer", it) }
    }
    val pending = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notice = NotificationCompat.Builder(context, if (kind == "tierlist") TIERS else GAMES)
      .setSmallIcon(R.drawable.ic_stat_m8m8s).setContentTitle(title.take(180)).setContentText(body.take(600))
      .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(600))).setAutoCancel(true)
      .setContentIntent(pending).setOnlyAlertOnce(true).setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setGroup("m8m8s.$kind").build()
    try { NotificationManagerCompat.from(context).notify(id, notice) } catch (_: SecurityException) { /* Permission changed during the check. */ }
  }

  private fun fetch(address: String): String {
    val connection = URL(address).openConnection() as HttpsURLConnection
    connection.connectTimeout = 15000; connection.readTimeout = 20000
    connection.instanceFollowRedirects = false
    connection.setRequestProperty("User-Agent", "M8M8S-Android/0.3.0")
    connection.setRequestProperty("Accept", "application/json")
    try {
      check(connection.responseCode in 200..299) { "Feed unavailable" }
      return connection.inputStream.bufferedReader().use { reader ->
        val result = StringBuilder(); val buffer = CharArray(8192)
        while (true) { val size = reader.read(buffer); if (size < 0) break; result.append(buffer, 0, size); check(result.length <= 4_000_000) { "Feed too large" } }
        result.toString()
      }
    } finally { connection.disconnect() }
  }

  private fun characters(value: JSONArray): List<List<String>> = (0 until value.length()).map { index ->
    val character = value.getJSONObject(index)
    check(character.optString("name").isNotBlank())
    listOf("name", "rarity", "attribute", "race", "color").map { character.optString(it, "") }
  }.sortedBy { JSONArray(it).toString() }

  private fun rows(value: JSONArray): JSONArray {
    check(value.length() > 0)
    return JSONArray((0 until value.length()).map { index ->
      val row = value.getJSONObject(index); check(row.has("tier"))
      val roles = row.optJSONObject("roles")
      val content: Any = if (roles != null) roles.keys().asSequence().sorted().map { role -> listOf(role, characters(roles.getJSONArray(role))) }.toList()
        else characters(row.getJSONArray("characters"))
      JSONArray(listOf(row.getString("tier"), content))
    }.sortedBy { it.toString() })
  }

  internal fun fingerprint(data: JSONObject, game: String): String {
    check(data.optString("game") == game && data.optString("status") == "available" && !data.optBoolean("stale") && data.optString("cache_status") != "stale")
    val tiers = data.getJSONArray("tiers")
    check((0 until tiers.length()).any { (tiers.getJSONObject(it).optJSONArray("characters")?.length() ?: 0) > 0 })
    val grids = data.optJSONObject("grids") ?: JSONObject()
    val canonical = rows(tiers).toString() + grids.keys().asSequence().sorted().joinToString("") { key -> JSONObject.quote(key) + rows(grids.getJSONArray(key)).toString() }
    return MessageDigest.getInstance("SHA-256").digest(canonical.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
  }

  // WorkManager can run different unique requests concurrently. Serialize baseline and delivery.
  @Synchronized
  fun check(context: Context): Boolean {
    val prefs = preferences(context)
    if (!prefs.getBoolean("enabled", false) || !allowed(context)) return true
    var successful = false
    if (prefs.getBoolean("tierAlerts", true)) for ((game, name) in gameNames) {
      try {
        val data = JSONObject(fetch("https://wxszznrkuozyptkekhjp.supabase.co/functions/v1/games-tierlist?game=$game"))
        val hash = fingerprint(data, game); val previous = prefs.getString("tier.$game", null)
        if (previous != null && previous != hash) post(context, "tierlist", "$name tier list updated", "Rankings have changed. Tap to see the latest tier list.", game)
        prefs.edit().putString("tier.$game", hash).apply(); successful = true
      } catch (_: Exception) { /* Keep the last known baseline when a source fails. */ }
    }
    if (prefs.getBoolean("freeGameAlerts", true)) try {
      val feed = JSONArray(fetch("https://www.gamerpower.com/api/filter?platform=steam%2Bepic-games-store%2Bgog%2Bitchio&type=game&sort-by=date"))
      val offers = mutableListOf<JSONObject>(); var valid = 0
      for (index in 0 until feed.length()) {
        val item = feed.getJSONObject(index)
        if (item.optLong("id") <= 0 || item.optString("title").isBlank() || !item.has("status") || !item.has("platforms") || !item.has("type")) continue
        valid++
        if (item.optString("status") == "Active" && item.optString("type") == "Game" && Regex("Steam|Epic Games Store|GOG|Itch\\.io", RegexOption.IGNORE_CASE).containsMatchIn(item.optString("platforms"))) offers.add(item)
      }
      check(feed.length() == 0 || valid > 0)
      val previous = prefs.getString("offers", null)
      val seen = if (previous == null) mutableSetOf<String>() else JSONObject(previous).keys().asSequence().toMutableSet()
      val fresh = offers.filter { it.getLong("id").toString() !in seen }
      if (previous != null && fresh.isNotEmpty()) {
        val first = fresh.first()
        post(context, "freegames", if (fresh.size == 1) "New free game: " + first.optString("title") else "${fresh.size} new free games",
          fresh.take(3).joinToString(" · ") { it.optString("title") }, offer = first.getLong("id"))
      }
      val saved = JSONObject(); (seen.toList() + offers.map { it.getLong("id").toString() }).distinct().takeLast(2000).forEach { saved.put(it, true) }
      prefs.edit().putString("offers", saved.toString()).apply(); successful = true
    } catch (_: Exception) { /* A failed feed is never treated as an empty feed. */ }
    if (successful) prefs.edit().putLong("lastCheck", System.currentTimeMillis()).apply()
    return successful
  }
}

class PhoneUpdateWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result = if (PhoneUpdates.check(applicationContext)) Result.success() else Result.retry()
}
