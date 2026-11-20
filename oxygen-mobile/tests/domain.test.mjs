import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { loadTS } from "./load-ts.mjs";
const calc = loadTS("src/lib/calculatorEngine.ts"),
  tiers = loadTS("src/lib/tierComparison.ts"),
  passport = loadTS("src/lib/gamingPassport.ts"),
  validation = loadTS("src/lib/dataValidation.ts"),
  secure = loadTS("src/lib/sessionStorage.ts");
const notices = loadTS("src/lib/gameNotificationLogic.ts", {
  "expo-crypto": {
    CryptoDigestAlgorithm: { SHA256: "sha256" },
    digestStringAsync: async (_algorithm, value) =>
      crypto.createHash("sha256").update(value).digest("hex"),
  },
});
function calculate(keys) {
  return keys.reduce(
    (state, key) => calc.calculatorReducer(state, { type: "key", key }),
    calc.createCalculator(),
  );
}
test("calculator preserves decimal precision, percentage behavior and invalid input handling", () => {
  assert.equal(
    calculate(["0", ".", "1", "+", "0", ".", "2", "="]).display,
    "0.3",
  );
  assert.equal(
    calculate(["2", "0", "0", "+", "1", "0", "%", "="]).display,
    "220",
  );
  assert.equal(calculate(["1", "÷", "0", "="]).error, true);
  assert.equal(calculate(["9", "sqrt"]).display, "3");
  assert.equal(calculate(["4", "square"]).display, "16");
  assert.equal(calculate(["8", "backspace"]).display, "0");
  assert.throws(() => calc.pastedNumber("1+2"));
});
test("ranking comparisons keep categories and roles distinct", () => {
  const before = {
      tiers: [],
      grids: {
        pve: [{ tier: "S", roles: { support: [{ name: "A" }] } }],
        pvp: [{ tier: "A", characters: [{ name: "A" }] }],
      },
    },
    after = {
      tiers: [],
      grids: {
        pve: [{ tier: "A", roles: { support: [{ name: "A" }] } }],
        pvp: [{ tier: "A", characters: [{ name: "A" }, { name: "B" }] }],
      },
    };
  const changes = tiers.compareRankings(before, after);
  assert.deepEqual(
    changes.map((c) => [c.name, c.context, c.direction]),
    [
      ["A", "pve / support", "down"],
      ["B", "pvp", "added"],
    ],
  );
});
test("passport import rejects malformed games and duplicate IDs", () => {
  const game = {
    id: "1",
    title: "A",
    platform: "Steam",
    status: "wishlist",
    notes: "",
    rating: 0,
    addedAt: "2026-11-20T00:00:00Z",
  };
  assert.equal(
    passport.parseGameLibrary(
      JSON.stringify([game, game, { ...game, id: "2", rating: 9 }]),
    ).length,
    1,
  );
});
test("backup validation and URL handling reject unsafe input", () => {
  assert.throws(() => validation.validateData({ version: 2 }));
  const data = validation.validateData({
    version: 1,
    notes: [{ id: "1", title: "A", body: "B" }, null],
    bookmarks: [{ id: "x", title: "bad", url: "javascript:alert(1)" }],
    settings: {
      accent: "red",
      wallpaper: "https://tracking.invalid/image.png",
    },
  });
  assert.equal(data.notes.length, 1);
  assert.equal(data.bookmarks.length, 0);
  assert.equal(data.settings.wallpaper, "");
  assert.equal(data.settings.accent, "#7253ba");
  for (const url of [
    "javascript:alert(1)",
    "file:///data/private",
    "https://user:pass@example.com",
  ])
    assert.throws(() => validation.browserAddress(url));
  assert.equal(
    validation.browserAddress("example.com"),
    "https://example.com/",
  );
});
test("secure session storage chunks by bytes and survives failed replacement", async () => {
  const values = new Map();
  let fail = false;
  const adapter = secure.makeSessionStorage({
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (fail && key.endsWith(".1")) throw new Error("Disk full");
      values.set(key, value);
    },
    deleteItemAsync: async (key) => values.delete(key),
  });
  const session = "🔒".repeat(1900);
  assert.ok(
    secure
      .secureChunks(session)
      .every((s) => Buffer.byteLength(s, "utf8") <= 1500),
  );
  await adapter.setItem("session", session);
  assert.equal(await adapter.getItem("session"), session);
  fail = true;
  await assert.rejects(adapter.setItem("session", "new".repeat(3000)));
  assert.equal(await adapter.getItem("session"), session);
  fail = false;
  await adapter.removeItem("session");
  assert.equal(await adapter.getItem("session"), null);
  assert.equal(values.size, 0);
});
test("new notification baselines stay quiet; changed rankings generate one alert", async () => {
  const payload = {
    game: "zzz",
    status: "available",
    tiers: [{ tier: "S", characters: [{ name: "A" }] }],
  };
  const first = await notices.readTierUpdate(payload, "zzz");
  let state = notices.applyTierUpdate(notices.emptyNoticeStore(), first, 100);
  assert.equal(state.items.length, 0);
  const same = await notices.readTierUpdate(
    { ...payload, updated_at: "2026-11-20T01:00:00Z" },
    "zzz",
  );
  state = notices.applyTierUpdate(state, same, 200);
  assert.equal(state.items.length, 0);
  const changed = await notices.readTierUpdate(
    { ...payload, tiers: [{ tier: "A", characters: [{ name: "A" }] }] },
    "zzz",
  );
  state = notices.applyTierUpdate(state, changed, 300);
  assert.equal(state.items.length, 1);
  state = notices.applyTierUpdate(state, changed, 400);
  assert.equal(state.items.length, 1);
});
test("every discovered website launcher app has a native registration", () => {
  const source = fs
    .readFileSync("../oxygen-desktop/src/App.tsx", "utf8")
    .split("const apps = [")[1]
    .split("];")[0];
  const names = [...source.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);
  const catalog = loadTS("src/lib/catalog.ts").APPS;
  assert.deepEqual(
    catalog.map((a) => a.name),
    names,
  );
  const route = fs.readFileSync("src/app/apps/[id].tsx", "utf8");
  for (const app of catalog)
    assert.ok(
      new RegExp(
        '["\\s]' + app.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"?\\s*:',
      ).test(route),
      app.id + " has no screen registration",
    );
});
