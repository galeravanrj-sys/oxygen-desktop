import { parseGameLibrary } from "./gamingPassportStore";
export type SearchHit = { id: string; title: string; detail: string; app: string; kind: string; text?: string };
function list(key: string): Record<string, unknown>[] { try { const data = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(data) ? data.filter(item => item && typeof item === "object") : []; } catch { return []; } }
export function searchDesktop(apps: string[], query: string): SearchHit[] {
  const hits: SearchHit[] = apps.map(app => ({ id: app, title: app, detail: "Application", app, kind: "app" }));
  for (const [key, app, kind] of [["oxygen-notes-v1", "Notes", "note"], ["oxygen-todos-v1", "To-do List", "task"]]) {
    for (const item of list(key)) if (typeof item.id === "string" && typeof item.title === "string") hits.push({ id: item.id, title: item.title || "Untitled note", detail: kind === "note" ? String(item.body || "").slice(0, 140) : item.done ? "Completed task" : `Task${item.due ? ` · Due ${item.due}` : ""}`, app, kind, text: kind === "note" ? String(item.body || "") : "" });
  }
  let games = ""; try { games = localStorage.getItem("oxygen-gaming-passport-v1") || ""; } catch { /* Locked storage. */ }
  for (const game of parseGameLibrary(games)) hits.push({ id: game.id, title: game.title, detail: `${game.platform} · ${game.status}`, app: "Gaming Passport", kind: "game" });
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return hits.filter(hit => !terms.length ? hit.kind === "app" : terms.every(term => `${hit.title} ${hit.text || hit.detail} ${hit.app}`.toLowerCase().includes(term))).sort((a, b) => Number(b.title.toLowerCase().startsWith(query.toLowerCase())) - Number(a.title.toLowerCase().startsWith(query.toLowerCase()))).slice(0, 50);
}
