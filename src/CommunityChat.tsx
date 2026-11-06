import { useChatReactions } from "./useChatReactions";
import { ChatMessageExtras, type ChatMessage } from "./ChatMessageExtras";
import { useChatUnread } from "./useChatUnread";
import { siteConfirm } from "./websiteDialogStore";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Hash, MessageCircle, RefreshCw, Send, Trash2 } from "lucide-react";
import { supabase } from "./supabase";
import "./CommunityChat.css";

const rooms = [{ id: "general", name: "General", detail: "A little conversation, a shared space." }, { id: "gaming", name: "Gaming", detail: "Discover games and talk about your next adventure." }, { id: "help", name: "Help", detail: "Ask questions and help each other out." }];
type Message = ChatMessage;
function savedName() { try { return localStorage.getItem("oxygen-chat-name-v1") || ""; } catch { return ""; } }
function errorText(error: { code?: string; message: string }) {
  if (["42P01", "PGRST205", "PGRST204"].includes(error.code || "")) return "Community Chat is waiting for its database setup. The site owner needs to apply the chat migration.";
  if (error.message.includes("chat_reply_room_mismatch") || error.code === "23503") return "The original message is no longer available in this room. Cancel the reply and try again.";
  if (error.message.includes("chat_rate_limit")) return "Please wait five seconds between messages.";
  return "Could not connect to chat. Check your connection and try again.";
}
export default function CommunityChat({ active = true }: { active?: boolean } = {}) {
  const [room, setRoom] = useState("general");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState(savedName);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState("Connecting");
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const inFlight = useRef(false);
  const currentRoom = useRef(room);
  useEffect(() => { currentRoom.current = room; }, [room]);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const unread = useChatUnread(room, active && atBottom, user?.id || "");
  const reactionState = useChatReactions(messages);
  const draft = drafts[room] || "";
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => { if (alive) { setUser(data.session?.user ?? null); setAuthReady(true); if (error) setNotice("Sign in again to send messages."); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) { setUser(session?.user ?? null); setAuthReady(true); } });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let alive = true, pending = false;
    const controller = new AbortController();
    nearBottom.current = true;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const { data, error } = await supabase.from("community_messages").select("*").eq("room", room).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(60).abortSignal(controller.signal);
        if (!alive) return;
        if (error) { setError(errorText(error)); return; }
        setMessages((data || []).reverse() as Message[]); setError("");
      } catch { if (alive) setError("Could not connect to chat. Try refreshing."); }
      finally { pending = false; if (alive) setLoading(false); }
    }

    void refresh();
    const channel = supabase.channel(`community:${room}:${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "community_messages" }, () => { void refresh(); }).subscribe(status => {
      if (!alive) return;
      setConnection(status === "SUBSCRIBED" ? "Live" : "Periodic refresh");
      if (status === "SUBSCRIBED") void refresh();
    });
    const interval = window.setInterval(() => { void refresh(); }, 15000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { alive = false; controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); void supabase.removeChannel(channel); };
  }, [room, revision]);
  useEffect(() => { if (nearBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages]);
  async function authenticate(event: FormEvent) {
    event.preventDefault(); if (authBusy) return; setAuthBusy(true); setNotice("");
    try {
      const result = authMode === "signin" ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) { setNotice(result.error.message); return; }
      setPassword("");
      setNotice(authMode === "signup" && !result.data.session ? "If a new account was created, check your inbox and spam folder for confirmation. Already registered? Choose Sign in and use your existing password." : "You’re signed in. Join the conversation.");
    } catch { setNotice("Could not sign in. Check your connection and try again."); }
    finally { setAuthBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!user || inFlight.current || !draft.trim() || !name.trim()) return;
    const targetRoom = room, text = draft.trim();
    inFlight.current = true; setSending(true); setNotice("");
    try {
      const { error } = await supabase.from("community_messages").insert({ room: targetRoom, user_id: user.id, display_name: name.trim(), body: text, ...(reply ? { reply_to: reply.id } : {}) });
      if (error) { setNotice(errorText(error)); return; }
      setReply(null);
      setDrafts(previous => ({ ...previous, [targetRoom]: "" }));
      try { localStorage.setItem("oxygen-chat-name-v1", name.trim()); } catch { /* Chat still works without local preferences. */ }
      nearBottom.current = true;
      if (currentRoom.current === targetRoom) setRevision(value => value + 1);
    } catch { setNotice("Message was not confirmed. Refresh before retrying to avoid sending it twice."); }
    finally { inFlight.current = false; setSending(false); }
  }
  async function remove(message: Message) {
    if (!(await siteConfirm("Delete your message for everyone?"))) return;
    try {
      const { error } = await supabase.from("community_messages").delete().eq("id", message.id).eq("user_id", user?.id || "");
      if (error) setNotice("Could not delete the message. Try again.");
      else setMessages(previous => previous.filter(item => item.id !== message.id));
    } catch { setNotice("Could not delete the message. Check your connection."); }
  }
  return <div className="community-chat">
    <header className="chat-heading"><div className="chat-logo"><MessageCircle size={22}/></div><div><p>M8M8S / COMMUNITY</p><h2>A space to connect.</h2></div></header>
    <nav className="chat-rooms" aria-label="Chat rooms">{rooms.map(item => <button key={item.id} aria-pressed={room === item.id} onClick={() => { if (room === item.id) return; setRoom(item.id); setReply(null); setAtBottom(true); setNotice(""); setMessages([]); setLoading(true); setError(""); setConnection("Connecting"); }}><Hash size={15}/>{item.name}{unread[item.id] > 0 && <span className="chat-unread-badge" aria-label={`${unread[item.id]} unread`}>{unread[item.id] > 99 ? "99+" : unread[item.id]}</span>}</button>)}</nav>
    <div className="chat-room-heading"><div><strong>#{room}</strong><span>{rooms.find(item => item.id === room)?.detail}</span></div><button aria-label="Refresh messages" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16}/></button></div>
    <div className="chat-connection"><span className={connection === "Live" && !error ? "chat-live" : ""}/>{error ? "Unavailable" : connection} · Public room · Latest 60 messages</div>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <div className="chat-messages" ref={list} role="log" aria-label={`${room} messages`} aria-live="polite" aria-relevant="additions" onScroll={event => { const node = event.currentTarget; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 70; setAtBottom(nearBottom.current); }}>
      {loading ? <p className="chat-empty">Loading the conversation…</p> : !messages.length && !error ? <div className="chat-empty"><MessageCircle size={30}/><strong>The conversation starts here.</strong><span>Say hello, share a discovery, or ask a question.</span></div> : null}
      {messages.map(message => <article key={message.id} className={`chat-message ${message.user_id === user?.id ? "chat-own" : ""}`}><div className="chat-avatar">{message.display_name.slice(0, 2).toUpperCase()}</div><div className="chat-message-content"><div className="chat-message-meta"><strong>{message.display_name}</strong><small>·{message.user_id.slice(0, 6)}</small><time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{message.user_id === user?.id && <button aria-label="Delete your message" onClick={() => { void remove(message); }}><Trash2 size={14}/></button>}</div><p>{message.body}</p><ChatMessageExtras message={message} messages={messages} userId={user?.id} onReply={() => setReply(message)} reactions={reactionState.reactions} available={reactionState.available} onChanged={reactionState.refresh} onNotice={setNotice}/></div></article>)}
    </div>
    {!reactionState.available && messages.length > 0 && <p className="chat-notice">Replies, reactions and reports need the chat features database update. Existing chat still works.</p>}
    {notice && <p className="chat-notice" role="status">{notice}</p>}
    {!authReady ? <p className="chat-notice">Checking your sign-in…</p> : user ? <form className="chat-compose" onSubmit={send}>{reply && <div className="chat-composer-reply"><span>Replying to {reply.display_name}: {reply.body.slice(0,90)}</span><button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}>×</button></div>}<div className="chat-identity"><label>Display name<input aria-label="Chat display name" value={name} maxLength={32} required onChange={event => setName(event.target.value)}/></label><button type="button" onClick={() => { void supabase.auth.signOut().then(({ error }) => { if (error) setNotice("Could not sign out. Try again."); }); }}>Sign out</button></div><label className="chat-message-label">Message<textarea aria-label="Message" placeholder={`Message #${room}…`} value={draft} maxLength={2000} disabled={sending} onChange={event => setDrafts(previous => ({ ...previous, [room]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/></label><div className="chat-compose-footer"><small>{draft.length}/2000 · Enter to send · Shift+Enter for a new line</small><button type="submit" disabled={sending || !!error || !draft.trim() || !name.trim()}><Send size={15}/>{sending ? "Sending…" : "Send"}</button></div></form> : <form className="chat-auth" onSubmit={authenticate}><strong>{authMode === "signin" ? "Sign in to join the conversation" : "Create your community account"}</strong><div><label>Email<input type="email" aria-label="Chat email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></label><label>Password<input type="password" aria-label="Chat password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={event => setPassword(event.target.value)}/></label></div><div className="chat-auth-actions"><button type="submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}</button><button type="button" onClick={() => { setAuthMode(value => value === "signin" ? "signup" : "signin"); setNotice(""); }}>{authMode === "signin" ? "Create an account" : "Already have an account?"}</button></div></form>}
    <footer className="chat-guidelines">Be kind. Messages and display names are public; never share passwords or private details. Names are self-chosen; the short account ID helps distinguish people. Sign-in is shared with Gallery.</footer>
  </div>;
}

