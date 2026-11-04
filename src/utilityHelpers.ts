export type CalcState = { display: string; stored: number | null; operator: string; fresh: boolean; last: { operator: string; value: number } | null };
export const initialCalc: CalcState = { display: "0", stored: null, operator: "", fresh: false, last: null };
function calculate(a: number, b: number, operator: string) { return operator === "+" ? a + b : operator === "−" ? a - b : operator === "×" ? a * b : b === 0 ? NaN : a / b; }
function formatted(value: number) { return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "Error"; }
export function calcPress(state: CalcState, key: string): CalcState {
  if (key === "C") return { ...initialCalc };
  if (/^[0-9.]$/.test(key)) {
    if (key === "." && !state.fresh && state.display.includes(".")) return state;
    if (!state.fresh && state.display.length >= 16 && state.display !== "Error") return state;
    return { ...state, display: state.fresh || state.display === "0" || state.display === "Error" ? key === "." ? "0." : key : state.display + key, fresh: false, last: null };
  }
  if (state.display === "Error") return state;
  if (key === "⌫") return { ...state, display: state.fresh ? "0" : state.display.length <= 1 || (state.display.length === 2 && state.display[0] === "-") ? "0" : state.display.slice(0, -1), fresh: false };
  if (key === "±" || key === "%") return { ...state, display: formatted(key === "±" ? -Number(state.display) : Number(state.display) / 100) };
  const value = Number(state.display);
  if (key === "=") {
    const operation = state.operator ? { operator: state.operator, value } : state.last;
    if (!operation) return state;
    const result = calculate(state.operator ? state.stored ?? value : value, operation.value, operation.operator);
    return { display: formatted(result), stored: null, operator: "", fresh: true, last: Number.isFinite(result) ? operation : null };
  }
  if (["+", "−", "×", "÷"].includes(key)) {
    const result = state.operator && state.stored !== null && !state.fresh ? calculate(state.stored, value, state.operator) : value;
    if (!Number.isFinite(result)) return { ...initialCalc, display: "Error", fresh: true };
    return { ...state, display: formatted(result), stored: result, operator: key, fresh: true, last: null };
  }
  return state;
}
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export const BROWSER_HOME = "about:blank";
export function browserAddress(raw: string): string {
  const value = raw.trim(); if (!value || value === BROWSER_HOME) return BROWSER_HOME;
  let url: URL;
  if (/^https?:\/\//i.test(value)) url = new URL(value);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error("Enter a web address beginning with https:// or a search term.");
  else if (value.includes(".") && !/\s/.test(value)) url = new URL(`https://${value}`);
  else return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Enter a valid website address.");
  return url.href;
}
export function websiteName(url: string) { if (url === BROWSER_HOME) return "Home"; try { return new URL(url).hostname; } catch { return "Website"; } }
