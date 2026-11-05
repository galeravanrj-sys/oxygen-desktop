import { siteConfirm } from "./websiteDialogStore";
import { useState, type FormEvent } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import "./PersonalApps.css";
type Task = { id: string; title: string; due: string; done: boolean };
const KEY = "oxygen-todos-v1";
function load(): Task[] { try { const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(data) ? data.filter((t): t is Task => t && typeof t.id === "string" && typeof t.title === "string" && typeof t.done === "boolean" && typeof t.due === "string") : []; } catch { return []; } }
export default function TodoApp() {
  const [tasks, setTasks] = useState<Task[]>(load); const [title, setTitle] = useState(""); const [due, setDue] = useState(""); const [filter, setFilter] = useState("all"); const [error, setError] = useState("");
  function save(next: Task[]) { try { localStorage.setItem(KEY, JSON.stringify(next)); setTasks(next); setError(""); return true; } catch { setError("Could not save tasks. Your browser storage may be full."); return false; } }
  function add(event: FormEvent) { event.preventDefault(); if (!title.trim()) return; if (save([...tasks, { id: crypto.randomUUID(), title: title.trim(), due, done: false }])) { setTitle(""); setDue(""); } }
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const visible = tasks.filter(task => filter === "all" || (filter === "done" ? task.done : !task.done));
  return <div className="pa-app"><header><span className="pa-eyebrow"><CheckCheck size={16}/> ONE THING AT A TIME</span><h2>Your to-do list</h2><p>{tasks.filter(t => !t.done).length} tasks left · Saved on this browser</p></header>
    <form className="pa-task-form" onSubmit={add}><label>Task<input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={240} required/></label><label>Due date<input type="date" value={due} onChange={e => setDue(e.target.value)}/></label><button type="submit">Add task</button></form>
    <div className="pa-filters">{["all", "active", "done"].map(id => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{id}</button>)}</div><p role="status">{error}</p>
    <ul className="pa-tasks">{visible.map(task => <li key={task.id} className={task.done ? "is-done" : ""}><label><input type="checkbox" checked={task.done} onChange={() => save(tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}/><span>{task.title}{task.due && <small className={!task.done && task.due < today ? "pa-overdue" : ""}>{!task.done && task.due < today ? "Overdue · " : "Due "}{new Date(task.due + "T12:00:00").toLocaleDateString()}</small>}</span></label><button type="button" aria-label={`Delete ${task.title}`} onClick={async () => { if ((await siteConfirm(`Delete “${task.title}”?`))) save(tasks.filter(t => t.id !== task.id)); }}><Trash2 size={16}/></button></li>)}</ul>
    {!visible.length && <div className="pa-empty">{tasks.length ? "No tasks in this view." : "A clear day starts here. Add your first task above."}</div>}
  </div>;
}
