import * as cheerio from 'npm:cheerio@1.0.0';
const SOURCES: Record<string,string> = {
 genshin:'https://game8.co/games/Genshin-Impact/archives/297465',
 origin:'https://game8.co/games/The-Seven-Deadly-Sins-Origin/archives/584624',
 hsr:'https://game8.co/games/Honkai-Star-Rail/archives/409604',
 grandcross:'https://7dsgc.fandom.com/wiki/General_Tier_List'
};
type Character = {name:string;image?:string;rarity?:string;attribute?:string;race?:string;color?:string};
type Tier = {tier:string;characters:Character[]};
const clean = (s:string) => s.replace(/\s+/g,' ').trim();
const allowed = new Set(['SS','S+','S','A+','A','B','C','D']);
function parse(html:string,game:string) {
 const $=cheerio.load(html); const tables=$('table').toArray();
 const validImage=(img:any)=>String($(img).attr('data-src')||$(img).attr('src')||'').startsWith('https://');
 const extract=(cell:any,prefix:string):Character[] => $(cell).find('a img').toArray().filter(validImage).map((img:any)=>({
   name:clean(String($(img).attr('alt')||'').replace(prefix,'').replace(/ (DPS|Sub-DPS|Support) Rank$/,'').replace(/ Rank$/,'')),
   image:String($(img).attr('data-src')||$(img).attr('src'))
 })).filter((x:Character)=>x.name.length>1 && x.name.length<100);
 const tierOf=(row:any)=>{
   const th=$(row).children('th').first();
   const alt=th.find('img').first().attr('alt')||'';
   const raw=clean(String(alt||th.text()));
   return raw.match(/^(SS|S\+|S|A\+|A|B|C|D)(?:\s*Tier)?\b/i)?.[1]?.toUpperCase()||null;
 };
 const grid=(table:any,roles:string[],prefix:string)=>{
   const rows:any[]=[];
   $(table).find('tr').each((_:number,row:any)=>{
     const tier=tierOf(row); if(!tier||!allowed.has(tier))return;
     const cells=$(row).children('td').toArray();
     if(cells.length<roles.length)return;
     const roleData:Record<string,Character[]>={};
     roles.forEach((role,i)=>roleData[role]=extract(cells[i],prefix));
     rows.push({tier,roles:roleData});
   });
   return rows;
 };
 let tiers:Tier[]=[]; let grids:any={};
 if(game==='genshin') {
   const candidates=tables.filter(t=>$(t).find('tr').first().text().includes('Main DPS')&&$(t).find('tr').first().text().includes('Sub-DPS'));
   if(candidates.length<3)throw Error('Genshin 3 tier grids missing');
   ['main','c0','c6'].forEach((k,i)=>grids[k]=grid(candidates[i],['mainDps','subDps','support'],'Genshin - '));
   tiers=grids.main.map((r:any)=>({tier:r.tier,characters:Object.values(r.roles).flat() as Character[]}));
 } else if(game==='hsr') {
   const overall=tables.find(t=>$(t).find('tr').first().text().includes('Characters')&&$(t).find('tr').first().text().includes('Tier'));
   const roles=tables.find(t=>$(t).find('tr').first().text().includes('Sustain')&&$(t).find('tr').first().text().includes('DPS'));
   if(!overall||!roles)throw Error('HSR tier tables missing');
   $(overall).find('tr').each((_:number,row:any)=>{const tier=tierOf(row);if(tier)tiers.push({tier,characters:extract($(row).children('td').first(),'Star Rail - ')})});
   grids.roles=grid(roles,['dps','support','sustain'],'Star Rail - ');
 } else if(game==='origin') {
   const candidates=tables.filter(t=>tierOf($(t).find('tr').first())==='SS'&&$(t).find('a img').length>10);
   if(candidates.length<3)throw Error('Origin tier tables missing');
   grids={};
   ['overall','pve','pvp'].forEach((key,i)=>{
     const rows:Tier[]=[];let tier='';
     $(candidates[i]).find('tr').each((_:number,row:any)=>{
       const head=$(row).children('th').first();const alt=head.find('img').first().attr('alt')||'';
       const found=clean(String(alt||head.text())).match(/^(SS|S\+|S|A\+|A|B|C|D)$/i);
       if(found){tier=found[1].toUpperCase();rows.push({tier,characters:[]});return;}
       if(tier&&rows.length){rows[rows.length-1].characters.push(...extract(row,'The Seven Deadly Sins Origin - '));}
     });
     grids[key]=rows;
   });
   tiers=grids.overall;
 } else if(game==='grandcross') {
   const ranks=['SSS','SS','S','A','B','C','D'];
   const rankTables=tables.filter(t=>$(t).find('tr').toArray().some(r=>clean($(r).children('th,td').first().text())==='SSS'));
   if(rankTables.length!==1)throw Error('Grand Cross ranking table missing or ambiguous');
   let current:Tier|undefined;
   $(rankTables[0]).find('tr').each((_:number,row:any)=>{
     const label=clean($(row).children('th,td').first().text());
     if(ranks.includes(label)){
       if(tiers.some(t=>t.tier===label))throw Error('Duplicate Grand Cross tier');
       current={tier:label,characters:[]};tiers.push(current);return;
     }
     if(!current)return;
     $(row).find('a[href^="/wiki/"]').each((_:number,link:any)=>{
       const img=$(link).find('img').first();if(!img.length)return;
       const name=clean($(link).attr('title')||img.attr('alt')||'');
       const image=img.attr('data-src')||img.attr('src')||'';
       if(!name||!image.startsWith('https://static.wikia.nocookie.net/'))throw Error('Invalid Grand Cross character');
       current!.characters.push({name,image});
     });
   });
   if(tiers.map(t=>t.tier).join(',')!==ranks.join(',')||tiers.some(t=>!t.characters.length))throw Error('Incomplete Grand Cross tiers');
 }
 const count=tiers.reduce((n,t)=>n+t.characters.length,0);
 const minimum:Record<string,number>={genshin:100,origin:30,hsr:30,grandcross:300};
 if(count<minimum[game]||tiers.length<4||tiers.some(t=>!(game==='grandcross'&&t.tier==='SSS')&&!allowed.has(t.tier)))throw Error(`Invalid ${game}: ${count} placements, ${tiers.length} tiers`);
 if(tiers.some(t=>t.characters.some(c=>!c.name||c.name.length>150)))throw Error('Invalid character name');
 return {game,title: $('title').first().text().trim() || (game==='grandcross' ? 'Grand Cross General Tier List' : ''),source:SOURCES[game],status:'available',tiers,grids,character_count:count};
}
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-refresh-token','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors});
 const expected=Deno.env.get('M8M8S_REFRESH_TOKEN');
 if(!expected||req.headers.get('x-refresh-token')!==expected)return new Response('Unauthorized',{status:401,headers:cors});
 const url=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const results:any[]=[];
 for(const [game,source] of Object.entries(SOURCES)){
  try{
   const fetchUrl=game==='grandcross'?'https://7dsgc.fandom.com/api.php?action=parse&page=General_Tier_List&prop=text&format=json':source;
   const response=await fetch(fetchUrl,{headers:{'User-Agent':'Mozilla/5.0 (compatible; M8M8S-TierCache/1.0)','Accept':'text/html'},signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error(`Source HTTP ${response.status}`);
   const html=game==='grandcross'?(await response.json())?.parse?.text?.['*']:await response.text();if(typeof html!=='string')throw Error('Wiki API returned no HTML');if(html.length<15000)throw Error('HTML unexpectedly short');
   const data=parse(html,game);
   const saved=await fetch(`${url}/rest/v1/games_tierlist_cache?on_conflict=game`,{method:'POST',headers:{'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({game,source,status:'available',payload:data,updated_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),last_error:null})});
   if(!saved.ok)throw Error(`Cache write HTTP ${saved.status}: ${(await saved.text()).slice(0,200)}`);
   results.push({game,status:'updated',count:data.character_count});
  }catch(e){
   const message=String(e).slice(0,500);
   // PATCH only status/error fields. Never overwrite last successful payload.
   await fetch(`${url}/rest/v1/games_tierlist_cache?game=eq.${game}`,{method:'PATCH',headers:{'apikey':key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({status:'stale',last_attempt_at:new Date().toISOString(),last_error:message})});
   results.push({game,status:'failed-last-good-preserved',error:message});
  }
 }
 return Response.json({results},{headers:cors,status:results.some(r=>r.status==='failed-last-good-preserved')?207:200});
});