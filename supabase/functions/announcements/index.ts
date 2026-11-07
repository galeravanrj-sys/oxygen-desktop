const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
Deno.serve(async (request: Request) => {
 if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
 if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
 const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!url || !key) return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers });
 try {
  const response = await fetch(`${url}/rest/v1/rpc/list_announcements`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Feed unavailable");
  return new Response(JSON.stringify(await response.json()), { headers });
 } catch { return new Response(JSON.stringify({ error: "Announcements unavailable" }), { status: 503, headers }); }
});
