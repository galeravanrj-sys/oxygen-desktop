export type WebsiteDialogRequest = { id: number; kind: "confirm" | "alert" | "prompt"; message: string; initial: string; resolve: (value: string | boolean | null) => void };
let queue: WebsiteDialogRequest[] = [];
let serial = 0;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(listener => listener()); }
export const subscribeDialogs = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const currentDialog = () => queue[0] ?? null;
function request(kind: WebsiteDialogRequest["kind"], message: string, initial = "") {
  return new Promise<string | boolean | null>(resolve => { queue = [...queue, { id: ++serial, kind, message, initial, resolve }]; emit(); });
}
export async function siteConfirm(message: string) { return await request("confirm", message) === true; }
export async function siteAlert(message: string) { await request("alert", message); }
export async function sitePrompt(message: string, initial = ""): Promise<string | null> { const value = await request("prompt", message, initial); return typeof value === "string" ? value : null; }
export function finishDialog(id: number, value: string | boolean | null) {
  if (queue[0]?.id !== id) return;
  const item = queue[0]; queue = queue.slice(1); item.resolve(value); emit();
}
