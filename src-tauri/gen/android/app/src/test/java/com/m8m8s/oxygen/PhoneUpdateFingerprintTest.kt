package com.m8m8s.oxygen

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PhoneUpdateFingerprintTest {
  private fun feed() = JSONObject("""{"game":"zzz","status":"available","updated_at":"2026-11-07","tiers":[{"tier":"S","characters":[{"name":"Alice","rarity":"S","image":"old.png"},{"name":"Bob","rarity":"A"}]},{"tier":"A","characters":[{"name":"Carol"}]}],"grids":{}}""")

  @Test fun refreshTimestampsAndImagesDoNotCreateUpdates() {
    val a = feed(); val b = feed().put("updated_at", "2026-11-08")
    b.getJSONArray("tiers").getJSONObject(0).getJSONArray("characters").getJSONObject(0).put("image", "new.png")
    assertEquals(PhoneUpdates.fingerprint(a, "zzz"), PhoneUpdates.fingerprint(b, "zzz"))
  }

  @Test fun reorderedCharactersAndRowsDoNotCreateUpdates() {
    val a = feed(); val b = feed(); val rows = b.getJSONArray("tiers")
    val first = rows.getJSONObject(0); val characters = first.getJSONArray("characters")
    val alice = characters.getJSONObject(0); val bob = characters.getJSONObject(1)
    characters.put(0, bob).put(1, alice)
    val second = rows.getJSONObject(1); rows.put(0, second).put(1, first)
    assertEquals(PhoneUpdates.fingerprint(a, "zzz"), PhoneUpdates.fingerprint(b, "zzz"))
  }

  @Test fun actualRankChangesCreateUpdates() {
    val a = feed(); val b = feed()
    b.getJSONArray("tiers").getJSONObject(0).put("tier", "SS")
    assertNotEquals(PhoneUpdates.fingerprint(a, "zzz"), PhoneUpdates.fingerprint(b, "zzz"))
  }

  @Test fun roleGridChangesCreateUpdates() {
    val a = feed(); val b = feed()
    b.put("grids", JSONObject("""{"boss":[{"tier":"S","roles":{"damage":[{"name":"Alice"}]}}]}"""))
    assertNotEquals(PhoneUpdates.fingerprint(a, "zzz"), PhoneUpdates.fingerprint(b, "zzz"))
  }

  @Test fun unavailableAndStaleFeedsNeverReplaceBaseline() {
    for (bad in listOf(feed().put("stale", true), feed().put("status", "unavailable"), feed().put("cache_status", "stale"), feed().put("game", "hsr"))) {
      try { PhoneUpdates.fingerprint(bad, "zzz"); fail("Invalid feed was accepted") } catch (_: IllegalStateException) { }
    }
  }
}
