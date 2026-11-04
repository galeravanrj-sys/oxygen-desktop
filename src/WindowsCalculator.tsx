import { useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Copy, Delete, History, Trash2, X } from "lucide-react";
import { calculatorReducer, createCalculator, formatNumber, HISTORY_KEY, pastedNumber, validHistory } from "./calculatorEngine";
import "./WindowsCalculator.css";

const keys = [
  { key: "%", label: "%", name: "Percent" }, { key: "CE", label: "CE", name: "Clear entry" }, { key: "C", label: "C", name: "Clear" }, { key: "backspace", label: "⌫", name: "Backspace" },
  { key: "reciprocal", label: "¹⁄ₓ", name: "Reciprocal" }, { key: "square", label: "x²", name: "Square" }, { key: "sqrt", label: "²√x", name: "Square root" }, { key: "÷", label: "÷", name: "Divide" },
  ...["7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ".", "="].map(key => ({ key, label: key, name: ({ "×": "Multiply", "−": "Subtract", "+": "Add", "±": "Change sign", ".": "Decimal point", "=": "Equals" } as Record<string, string>)[key] ?? key })),
];
export default function WindowsCalculator() {
  const [state, send] = useReducer(calculatorReducer, undefined, () => { try { return createCalculator(validHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"))); } catch { return createCalculator(); } });
  const [panel, setPanel] = useState<"history" | "memory">("history"); const [panelOpen, setPanelOpen] = useState(false); const [storageError, setStorageError] = useState(""); const [copyMessage, setCopyMessage] = useState(""); const frame = useRef<HTMLDivElement>(null); const records = useRef<HTMLDivElement>(null); const output = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); setStorageError(""); } catch { setStorageError("History is available for this session but could not be saved to this browser."); } }, 0);
    return () => window.clearTimeout(timer);
  }, [state.history]);
  useEffect(() => { records.current?.scrollTo({ top: 0 }); }, [state.history, state.memory, panel]);
  useEffect(() => { if (!copyMessage) return; const timer = window.setTimeout(() => setCopyMessage(""), 2500); return () => window.clearTimeout(timer); }, [copyMessage]);
  function press(key: string) { send({ type: "key", key }); frame.current?.focus({ preventScroll: true }); }
  async function copy() { try { await navigator.clipboard.writeText(state.display); setCopyMessage("Result copied"); } catch { setCopyMessage("Copy is unavailable in this browser."); } }
  function pasteText(value: string) { try { send({ type: "recall", value: pastedNumber(value) }); setCopyMessage(""); } catch (reason) { setCopyMessage(reason instanceof Error ? reason.message : "Could not paste that number."); } }
  async function paste() { try { pasteText(await navigator.clipboard.readText()); } catch { setCopyMessage("Paste is unavailable. Type the number instead."); } }
  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable || event.altKey || event.metaKey) return;
    if ((event.key === "Enter" || event.key === " ") && target.tagName === "BUTTON") return;
    if (event.ctrlKey) {
      const lower = event.key.toLowerCase();
      if (lower === "h") { event.preventDefault(); setPanel("history"); setPanelOpen(open => !open); return; }
      if (lower === "c") { event.preventDefault(); void copy(); return; }
      if (lower === "v") { event.preventDefault(); void paste(); return; }
      const memory = ({ l: "MC", r: "MR", m: "MS", p: "M+", q: "M−" } as Record<string, string>)[lower];
      if (memory) { event.preventDefault(); press(memory); } return;
    }
    if (event.key === "Escape" && panelOpen) { event.preventDefault(); setPanelOpen(false); return; }
    const key = ({ Enter: "=", Escape: "C", Delete: "CE", Backspace: "backspace", "*": "×", "/": "÷", "-": "−", F9: "±", "@": "sqrt", r: "reciprocal" } as Record<string, string>)[event.key] ?? event.key;
    if (keys.some(item => item.key === key)) { event.preventDefault(); press(key); }
  }
  function recall(value: string) { send({ type: "recall", value }); setPanelOpen(false); frame.current?.focus({ preventScroll: true }); }
  function restoreHistory(id: number) { send({ type: "history-recall", id }); setPanelOpen(false); frame.current?.focus({ preventScroll: true }); }
  const display = state.error ? state.display : formatNumber(state.display, !state.fresh && !state.evaluated);
  useLayoutEffect(() => {
    const element = output.current; const container = frame.current; if (!element || !container) return;
    const canvas = document.createElement("canvas"); const context = canvas.getContext("2d"); if (!context) return;
    function fit() {
      if (!element || !container || !context || !element.clientWidth) return;
      context.font = '600 48px "Segoe UI", Arial, sans-serif';
      const measured = context.measureText(display).width;
      const maxSize = container.clientHeight <= 250 ? 28 : container.clientHeight <= 360 ? 36 : 48;
      element.style.setProperty("--calc-fit-size", Math.max(14, Math.min(maxSize, 48 * (element.clientWidth - 20) / Math.max(1, measured))).toFixed(2) + "px");
    }
    fit(); const observer = new ResizeObserver(fit); observer.observe(element); observer.observe(container);
    return () => observer.disconnect();
  }, [display]);
  return <div ref={frame} className="ox-app win-calculator" tabIndex={0} aria-label="Standard calculator" onKeyDown={handleKeyboard} onPaste={event => { event.preventDefault(); pasteText(event.clipboardData.getData("text/plain")); }} data-panel-open={panelOpen}>
    <div className="calc-layout">
      <section className="calc-main" aria-label="Calculator keypad">
        <header className="calc-header"><h2>Standard</h2><button className="calc-history-toggle" type="button" aria-label="Show history" aria-expanded={panelOpen} onClick={() => { setPanel("history"); setPanelOpen(open => !open); }}><History size={20}/></button></header>
        <div className="calc-expression" aria-label="Calculation expression">{state.expression || "\u00a0"}</div>
        <output ref={output} className={`calc-output ${display.length > 16 || state.error ? "calc-output-small" : ""}`} aria-live="polite" title={state.display}>{display}</output>
        <div className="calc-display-actions"><span role="status">{copyMessage}</span><button type="button" aria-label="Copy result" title="Copy result (Ctrl+C)" disabled={state.error} onClick={() => void copy()}><Copy size={13}/></button></div>
        <div className="calc-memory-strip" aria-label="Memory controls">{[{ key: "MC", title: "Clear all memory (Ctrl+L)" }, { key: "MR", title: "Recall memory (Ctrl+R)" }, { key: "M+", title: "Add to memory (Ctrl+P)" }, { key: "M−", title: "Subtract from memory (Ctrl+Q)" }, { key: "MS", title: "Store in memory (Ctrl+M)" }].map(item => <button type="button" key={item.key} title={item.title} aria-label={item.title.split(" (")[0]} disabled={state.error || (["MC", "MR"].includes(item.key) && state.memory.length === 0)} onClick={() => press(item.key)}>{item.key}</button>)}<button type="button" aria-label="Show memory" title="Show memory" onClick={() => { setPanel("memory"); setPanelOpen(true); }}>M<ChevronDown size={12}/></button></div>
        <div className="calc-keys">{keys.map(item => <button type="button" key={item.key} title={item.name} aria-label={item.name} disabled={state.error && !["C", "CE"].includes(item.key)} className={`${/^[0-9.]$/.test(item.key) || item.key === "±" ? "calc-number" : ""} ${item.key === "=" ? "calc-equals" : ""}`} onClick={() => press(item.key)}>{item.key === "backspace" ? <Delete size={20}/> : item.label}</button>)}</div>
        <p className="calc-keyboard-hint">Enter = · Delete CE · Esc C · Ctrl+H history</p>
      </section>
      <aside className="calc-side" aria-label="Calculator history and memory">
        <header className="calc-side-header"><div role="tablist" aria-label="Calculator records"><button type="button" role="tab" id="calc-history-tab" aria-selected={panel === "history"} aria-controls="calc-history-panel" onClick={() => setPanel("history")}>History</button><button type="button" role="tab" id="calc-memory-tab" aria-selected={panel === "memory"} aria-controls="calc-memory-panel" onClick={() => setPanel("memory")}>Memory</button></div><button className="calc-side-close" type="button" aria-label="Close history and memory" onClick={() => setPanelOpen(false)}><X size={18}/></button></header>
        <div ref={records} className="calc-records" role="tabpanel" id={panel === "history" ? "calc-history-panel" : "calc-memory-panel"} aria-labelledby={panel === "history" ? "calc-history-tab" : "calc-memory-tab"}>
          {panel === "history" ? state.history.length ? state.history.map(item => <button className="calc-history-item" type="button" key={item.id} title="Recall this result" onClick={() => restoreHistory(item.id)}><span>{item.expression}</span><strong>{formatNumber(item.result)}</strong></button>) : <p className="calc-empty">There’s no history yet.</p> : state.memory.length ? state.memory.map((value, index) => <div className="calc-memory-item" key={index}><button type="button" aria-label={`Recall memory ${index + 1}`} onClick={() => recall(value)}>{formatNumber(value)}</button><div>{[{ operation: "clear", label: "MC" }, { operation: "add", label: "M+" }, { operation: "subtract", label: "M−" }].map(item => <button type="button" key={item.operation} aria-label={`${item.operation} memory ${index + 1}`} disabled={state.error && item.operation !== "clear"} onClick={() => send({ type: "memory", operation: item.operation as "clear" | "add" | "subtract", index })}>{item.label}</button>)}</div></div>) : <p className="calc-empty">There’s nothing saved in memory.</p>}
        </div>
        <footer className="calc-side-footer"><span>{panel === "history" ? storageError || "History is saved on this browser." : "Memory is kept while this app is open."}</span><button type="button" aria-label={panel === "history" ? "Clear history" : "Clear all memory"} disabled={panel === "history" ? !state.history.length : !state.memory.length} onClick={() => { if (panel === "history") { if (confirm("Clear all calculation history?")) send({ type: "clear-history" }); } else press("MC"); }}><Trash2 size={18}/></button></footer>
      </aside>
    </div>
  </div>;
}
