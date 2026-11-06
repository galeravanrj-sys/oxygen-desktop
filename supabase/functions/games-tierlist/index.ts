const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='GET')return new Response('Method not allowed',{status:405,headers:cors});
 const game=new URL(req.url).searchParams.get('game')||'';
 if(!['genshin','origin','hsr','grandcross','zzz'].includes(game))return Response.json({error:'Unknown game'},{status:400,headers:cors});
 const url=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const res=await fetch(`${url}/rest/v1/games_tierlist_cache?game=eq.${game}&select=payload,status,updated_at,last_error,previous_payload,previous_updated_at`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
 if(!res.ok)return Response.json({error:'Cache unavailable'},{status:503,headers:cors});
 const rows=await res.json();const row=rows[0];
 if(!row?.payload)return Response.json({game,status:'unavailable',tiers:[],message:'No validated rankings have been cached yet.'},{headers:cors});
 return Response.json({...row.payload,previous:row.previous_payload??null,previous_updated_at:row.previous_updated_at??null,status:'available',cache_status:row.status,updated_at:row.updated_at,stale:row.status==='stale'}, {headers:{...cors,'Cache-Control':'public, max-age=300'}});
});