import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP, maxE: 999, minE: -999 });
type Operator = "+" | "−" | "×" | "÷";
export type HistoryItem = { id: number; expression: string; result: string; repeat?: { operator: Operator; right: string } | null };
export type CalculatorState = {
  display: string; stored: string | null; operator: Operator | "";
  fresh: boolean; waiting: boolean; evaluated: boolean; error: boolean;
  expression: string; operandLabel: string;
  last: { operator: Operator; right: string } | null;
  memory: string[]; history: HistoryItem[]; nextId: number;
};
export type CalculatorAction = { type: "key"; key: string } | { type: "recall"; value: string } | { type: "history-recall"; id: number } | { type: "clear-history" } | { type: "memory"; operation: "clear" | "add" | "subtract"; index: number };
export const HISTORY_KEY = "oxygen-calculator-history-v1";

export function createCalculator(history: HistoryItem[] = []): CalculatorState {
  return { display: "0", stored: null, operator: "", fresh: false, waiting: false, evaluated: false, error: false, expression: "", operandLabel: "", last: null, memory: [], history, nextId: history.reduce((max, item) => Math.max(max, item.id), 0) + 1 };
}
export function validHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  return value.filter((item): item is HistoryItem => {
    if (!item || !Number.isSafeInteger(item.id) || item.id < 0 || ids.has(item.id) || typeof item.expression !== "string" || item.expression.length > 600 || typeof item.result !== "string" || item.result.length > 100 || !/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(item.result)) return false;
    try {
      if (!new D(item.result).isFinite()) return false;
      if (item.repeat && (!["+", "−", "×", "÷"].includes(item.repeat.operator) || typeof item.repeat.right !== "string" || item.repeat.right.length > 100 || !/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(item.repeat.right) || !new D(item.repeat.right).isFinite())) return false;
    } catch { return false; }
    ids.add(item.id); return true;
  }).slice(0, 100);
}
function numeric(value: Decimal) {
  if (!value.isFinite()) throw new Error("Result is too large");
  return value.isZero() ? "0" : value.toSignificantDigits(32).toString();
}
function operate(left: string, right: string, operator: Operator) {
  const a = new D(left), b = new D(right);
  if (operator === "÷" && b.isZero()) throw new Error(a.isZero() ? "Result is undefined" : "Cannot divide by zero");
  return numeric(operator === "+" ? a.plus(b) : operator === "−" ? a.minus(b) : operator === "×" ? a.times(b) : a.dividedBy(b));
}
export function formatNumber(value: string, editing = false) {
  let raw = value;
  try { if (!editing) raw = new D(value).toSignificantDigits(16).toString(); } catch { return value; }
  const [mantissa, exponent] = raw.split(/e/i);
  const [integer, fraction] = mantissa.split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction !== undefined ? `.${fraction}` : "") + (exponent !== undefined ? `e${exponent}` : "");
}
export function pastedNumber(value: string) {
  const text = value.trim().replace(/[,\u00a0\u202f]/g, "");
  if (text.length > 100 || !/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(text)) throw new Error("Paste a single number, rather than a calculation.");
  return numeric(new D(text));
}
function recall(state: CalculatorState, value: string): CalculatorState {
  return { ...state, display: value, error: false, fresh: true, waiting: false, evaluated: false, operandLabel: "", last: null, expression: state.operator ? `${state.stored} ${state.operator}` : "" };
}
function reset(state: CalculatorState) { return { ...createCalculator(state.history), memory: state.memory, nextId: state.nextId }; }
function keyPress(state: CalculatorState, key: string): CalculatorState {
  if (key === "C") return reset(state);
  if (key === "CE") return state.error ? reset(state) : { ...state, display: "0", fresh: false, waiting: false, operandLabel: "", evaluated: false, last: null, expression: state.operator ? `${state.stored} ${state.operator}` : "" };
  if (state.error) return state;
  if (/^[0-9.]$/.test(key)) {
    const replace = state.fresh || state.evaluated;
    if (key === "." && !replace && state.display.includes(".")) return state;
    if (!replace && state.display.replace(/[-.]/g, "").replace(/^0+/, "").length >= 16) return state;
    const display = replace || state.display === "0" ? key === "." ? "0." : key : state.display + key;
    return { ...state, display, fresh: false, waiting: false, evaluated: false, operandLabel: "", last: null, expression: state.evaluated ? "" : state.operator ? `${state.stored} ${state.operator}` : "", stored: state.evaluated ? null : state.stored, operator: state.evaluated ? "" : state.operator };
  }
  if (key === "backspace") {
    if (state.fresh || state.evaluated) return state;
    const short = state.display.slice(0, -1);
    return { ...state, display: !short || short === "-" ? "0" : short, operandLabel: "", last: null };
  }
  if (key === "MC") return { ...state, memory: [] };
  if (key === "MR") return state.memory.length ? recall(state, state.memory[0]) : state;
  if (key === "MS") return { ...state, fresh: true, memory: [numeric(new D(state.display)), ...state.memory].slice(0, 50) };
  if (key === "M+" || key === "M−") {
    const value = operate(state.memory[0] ?? "0", state.display, key === "M+" ? "+" : "−");
    return { ...state, fresh: true, memory: [value, ...state.memory.slice(1)] };
  }
  if (["±", "%", "reciprocal", "square", "sqrt"].includes(key)) {
    const value = new D(state.display); const label = state.operandLabel || numeric(value);
    let result: Decimal; let operandLabel: string;
    if (key === "±") { result = value.negated(); operandLabel = `negate(${label})`; }
    else if (key === "%") { result = state.operator === "×" || state.operator === "÷" ? value.dividedBy(100) : value.times(state.stored ?? "0").dividedBy(100); operandLabel = numeric(result); }
    else if (key === "reciprocal") { if (value.isZero()) throw new Error("Cannot divide by zero"); result = new D(1).dividedBy(value); operandLabel = `1/(${label})`; }
    else if (key === "square") { result = value.times(value); operandLabel = `sqr(${label})`; }
    else { if (value.isNegative()) throw new Error("Invalid input"); result = value.sqrt(); operandLabel = `√(${label})`; }
    return { ...state, display: numeric(result), operandLabel, fresh: key === "±" ? state.fresh : true, waiting: false, evaluated: false, last: null, expression: state.operator ? `${state.stored} ${state.operator} ${operandLabel}` : operandLabel };
  }
  if (["+", "−", "×", "÷"].includes(key)) {
    const value = state.operator && state.stored !== null && !state.waiting ? operate(state.stored, state.display, state.operator) : numeric(new D(state.display));
    return { ...state, display: value, stored: value, operator: key as Operator, fresh: true, waiting: true, evaluated: false, expression: `${value} ${key}`, operandLabel: "", last: null };
  }
  if (key === "=") {
    const operation = state.operator ? { operator: state.operator, right: state.display } : state.last;
    const left = state.operator ? state.stored ?? state.display : state.display;
    const result = operation ? operate(left, operation.right, operation.operator) : numeric(new D(state.display));
    const expression = operation ? `${left} ${operation.operator} ${state.operator && state.operandLabel ? state.operandLabel : operation.right} =` : `${state.operandLabel || state.display} =`;
    const item = { id: state.nextId, expression, result, repeat: operation };
    return { ...state, display: result, stored: null, operator: "", fresh: true, waiting: false, evaluated: true, expression, operandLabel: "", last: operation, history: [item, ...state.history].slice(0, 100), nextId: state.nextId + 1 };
  }
  return state;
}
export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  try {
    if (action.type === "clear-history") return { ...state, history: [] };
    if (action.type === "history-recall") {
      const item = state.history.find(entry => entry.id === action.id);
      return item ? { ...reset(state), display: item.result, expression: item.expression, fresh: true, evaluated: true, last: item.repeat ?? null } : state;
    }
    if (action.type === "recall") return recall(state.error ? reset(state) : state, numeric(new D(action.value)));
    if (action.type === "memory") {
      const memory = [...state.memory]; if (memory[action.index] === undefined) return state;
      if (action.operation === "clear") memory.splice(action.index, 1);
      else if (!state.error) memory[action.index] = operate(memory[action.index], state.display, action.operation === "add" ? "+" : "−");
      return { ...state, memory };
    }
    return keyPress(state, action.key);
  } catch (reason) {
    return { ...state, display: reason instanceof Error ? reason.message : "Invalid input", error: true, fresh: true, waiting: false, expression: "", stored: null, operator: "", last: null };
  }
}
