import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { MessageSquare, ShieldCheck, X } from "lucide-react";
import { currentDialog, finishDialog, subscribeDialogs, type WebsiteDialogRequest } from "./websiteDialogStore";
import "./WebsiteDialogs.css";

function DialogCard({ request }: { request: WebsiteDialogRequest }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(request.initial);
  const title = useId(), description = useId();
  const destructive = /delete|remove|clear all|reset|close all/i.test(request.message);
  const label = request.kind === "prompt" ? "Save" : request.kind === "alert" ? "Got it" : /publish/i.test(request.message) ? "Publish" : /delete/i.test(request.message) ? "Delete" : /remove/i.test(request.message) ? "Remove" : /reset/i.test(request.message) ? "Reset" : /clear/i.test(request.message) ? "Clear" : /close all/i.test(request.message) ? "Close windows" : "Continue";
  const heading = request.kind === "prompt" ? "A little detail" : request.kind === "alert" ? "Just a heads-up" : destructive ? "Before you continue" : "Your choice";
  const finish = (answer: string | boolean | null) => { ref.current?.close(); finishDialog(request.id, answer); };
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.showModal();
    const focus = node.querySelector<HTMLInputElement | HTMLButtonElement>(request.kind === "prompt" ? "input" : request.kind === "confirm" ? "[data-cancel]" : "[data-accept]");
    focus?.focus();
    if (focus instanceof HTMLInputElement) focus.select();
    return () => { node.close(); };
  }, [request.kind]);
  return <dialog ref={ref} className="website-dialog" aria-labelledby={title} aria-describedby={description} onCancel={event => { event.preventDefault(); finish(request.kind === "confirm" ? false : null); }} onKeyDown={event => event.stopPropagation()}>
    <form onSubmit={event => { event.preventDefault(); finish(request.kind === "prompt" ? value : true); }}>
      <header><span className="website-dialog-symbol">{destructive ? <ShieldCheck size={23}/> : <MessageSquare size={23}/>}</span><span className="website-dialog-brand">M8M8S · YOUR SPACE</span><button type="button" className="website-dialog-close" aria-label="Close dialog" onClick={() => finish(request.kind === "confirm" ? false : null)}><X size={18}/></button></header>
      <h2 id={title}>{heading}</h2><p id={description}>{request.message}</p>
      {request.kind === "prompt" && <label className="website-dialog-input">Your answer<input aria-label="Your answer" value={value} maxLength={255} onChange={event => setValue(event.target.value)}/></label>}
      <footer>{request.kind !== "alert" && <button type="button" data-cancel onClick={() => finish(request.kind === "confirm" ? false : null)}>Cancel</button>}<button type="submit" data-accept className={destructive ? "website-dialog-danger" : "website-dialog-primary"}>{label}</button></footer>
    </form>
  </dialog>;
}
export default function WebsiteDialogs() {
  const request = useSyncExternalStore(subscribeDialogs, currentDialog, () => null);
  return request ? <DialogCard key={request.id} request={request}/> : null;
}
