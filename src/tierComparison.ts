type Character = { name: string };
type Row = { tier: string; characters?: Character[]; roles?: Record<string, Character[]> };
export type RankingPayload = { tiers: Row[]; grids?: Record<string, Row[]> };
export type TierChange = { name: string; context: string; from: string | null; to: string | null; direction: "up" | "down" | "added" | "removed" | "changed" };
const order = ["SSS","SS","S+","S","A+","A","B","C","D"];
function score(tier: string) { const t = tier.match(/^T(\d+)(\+)?$/); return t ? Number(t[1]) * 2 - (t[2] ? 1 : 0) : order.indexOf(tier); }
function flatten(data: RankingPayload) {
 const map = new Map<string,{name:string;context:string;tier:string}>();
 const groups = data.grids && Object.keys(data.grids).length ? data.grids : { overall: data.tiers };
 for(const [group,rows] of Object.entries(groups)) for(const row of rows){const roles=row.roles||{agents:row.characters||[]};for(const [role,chars] of Object.entries(roles))for(const character of chars){const context=role==="agents"?group:`${group} / ${role}`;const key=JSON.stringify([context,character.name]);const previous=map.get(key);if(!previous||score(row.tier)<score(previous.tier))map.set(key,{name:character.name,context,tier:row.tier});}}
 return map;
}
export function compareRankings(previous: RankingPayload, current: RankingPayload): TierChange[] {
 const before=flatten(previous),after=flatten(current),changes:TierChange[]=[];
 for(const key of new Set([...before.keys(),...after.keys()])){const a=before.get(key),b=after.get(key);if(a?.tier===b?.tier)continue;const change:TierChange={name:(b||a)!.name,context:(b||a)!.context,from:a?.tier??null,to:b?.tier??null,direction:!a?"added":!b?"removed":score(a.tier)<0||score(b.tier)<0?"changed":score(b.tier)<score(a.tier)?"up":"down"};changes.push(change);}
 return changes.sort((a,b)=>a.context.localeCompare(b.context)||a.name.localeCompare(b.name));
}
