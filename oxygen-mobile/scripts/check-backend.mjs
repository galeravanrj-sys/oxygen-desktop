// Read-only contract checks. No sign-in, uploads, messages, reports or schema writes.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const oldClient = createRequire(
  new URL("../../oxygen-desktop/package.json", import.meta.url),
)("@supabase/supabase-js").createClient;
const env = {};
for (const line of fs
  .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)) {
  const match = line.match(
    /^(EXPO_PUBLIC_SUPABASE_(?:URL|PUBLISHABLE_KEY))=(.*)$/,
  );
  if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
}
const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, ""),
  key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Public Supabase configuration is missing.");
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
  },
};
const native = createClient(url, key, options),
  website = oldClient(url, key, options),
  results = [];
async function check(name, action) {
  try {
    const detail = await action();
    results.push({ name, status: "passed", detail });
    console.log("PASS " + name + ": " + detail);
  } catch (error) {
    results.push({
      name,
      status: "failed",
      detail: error instanceof Error ? error.message : "Request failed",
    });
    console.log("FAIL " + name + ": " + results.at(-1).detail);
  }
}
await check(
  "public Gallery contract shared by website and native clients",
  async () => {
    const results = await Promise.all(
      [native, website].map((client) =>
        client.storage.from("oxygen-public-gallery").list("photos", {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        }),
      ),
    );
    for (const result of results) if (result.error) throw result.error;
    const names = results.map((r) => r.data.map((p) => p.name).sort());
    if (JSON.stringify(names[0]) !== JSON.stringify(names[1]))
      throw new Error(
        "Public lists differed; retry if another visitor changed the gallery.",
      );
    return (
      names[0].length + " public objects read consistently; no upload performed"
    );
  },
);
await check("community message schema and anonymous read policy", async () => {
  const { data, error } = await native
    .from("community_messages")
    .select("id,room,user_id,display_name,body,created_at,reply_to")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (
    "message fields accepted; " +
    data.length +
    " rows sampled without printing content"
  );
});
await check("chat reaction schema", async () => {
  const { error } = await native
    .from("community_reactions")
    .select("message_id,user_id,emoji")
    .limit(1);
  if (error) throw error;
  return "existing reaction fields accepted";
});
await check("announcement RPC", async () => {
  const { data, error } = await native.rpc("list_announcements");
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid announcement response");
  return data.length + " published announcements readable";
});
await check("unread counts RPC", async () => {
  const { data, error } = await native.rpc("community_room_activity", {
    since: {},
  });
  if (error) throw error;
  if (
    !Array.isArray(data) ||
    !["general", "gaming", "help"].every((room) =>
      data.some((row) => row.room === room),
    )
  )
    throw new Error("Room activity response is incomplete");
  return "all three existing rooms returned";
});
await check("administrator RPC rejects anonymous access", async () => {
  const { data, error } = await native.rpc("announcement_admin_status");
  if (!error && data === true)
    throw new Error("Anonymous client unexpectedly has administrator access");
  return error
    ? "anonymous request denied as expected"
    : "anonymous request has no administrator role";
});
const feeds = [
  ["announcements", url + "/functions/v1/announcements"],
  ...["zzz", "genshin", "origin", "hsr", "grandcross"].map((game) => [
    "tier " + game,
    url + "/functions/v1/games-tierlist?game=" + game,
  ]),
  [
    "GamerPower",
    "https://www.gamerpower.com/api/filter?platform=steam%2Bepic-games-store%2Bgog%2Bitchio&type=game&sort-by=date",
  ],
  [
    "Open-Meteo",
    "https://api.open-meteo.com/v1/forecast?latitude=14.6&longitude=120.98&current=temperature_2m&daily=temperature_2m_max&timezone=auto&forecast_days=7",
  ],
];
await Promise.all(
  feeds.map(([name, endpoint]) =>
    check(name, async () => {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = response.status === 201 ? [] : await response.json();
      if (
        name.startsWith("tier ") &&
        (payload.status !== "available" || !Array.isArray(payload.tiers))
      )
        throw new Error("Rankings unavailable");
      if (name === "announcements" && !Array.isArray(payload))
        throw new Error("Invalid announcement feed");
      return name.startsWith("tier ")
        ? `${payload.tiers.length} ranking rows; stale=${payload.stale === true || payload.cache_status === "stale"}`
        : "readable JSON";
    }),
  ),
);
fs.mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL("../docs/backend-checks.json", import.meta.url),
  JSON.stringify(
    { checkedAt: new Date().toISOString(), mode: "read-only", results },
    null,
    2,
  ),
);
if (results.some((r) => r.status === "failed")) process.exitCode = 1;
