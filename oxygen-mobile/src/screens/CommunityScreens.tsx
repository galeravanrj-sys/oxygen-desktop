import { useCallback, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, Chip, IconButton, List, Text } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Empty,
  Feedback,
  Field,
  Panel,
  RemoteStatus,
  Screen,
  confirm,
  styles,
  useAction,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import {
  backendConfigured,
  requireBackend,
  supabase,
} from "../services/supabase";
import { useRemote } from "../hooks/useRemote";
import { id } from "../services/files";
import type { Announcement, ChatMessage, Reaction } from "../types/models";

export function AccountScreen() {
  const { session, authReady } = useApp();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false);
  const action = useAction(),
    router = useRouter();
  const admin = useRemote(
    "admin-access:" + session?.user.id,
    async () => {
      if (!session) return false;
      requireBackend();
      const { data, error } = await supabase.rpc("announcement_admin_status");
      if (error) throw error;
      return data === true;
    },
    0,
    false,
  );
  return (
    <Screen>
      <Panel title="Your account">
        {!authReady ? (
          <Text>Checking saved session…</Text>
        ) : session ? (
          <>
            <Text variant="titleMedium">
              {session.user.email || "Signed in"}
            </Text>
            <Text>
              Existing M8M8S account · Session encrypted on this device
            </Text>
            <Button
              onPress={() =>
                void action.run(async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              Sign out
            </Button>
            {!!admin.data && (
              <Button
                mode="contained"
                icon="bullhorn-outline"
                onPress={() => router.push("/admin")}
              >
                Manage announcements
              </Button>
            )}
            {!!admin.error && (
              <Feedback error="Administrator access could not be checked. Retry before opening admin tools." />
            )}
            <Button onPress={() => void admin.refresh()}>
              Check administrator access
            </Button>
          </>
        ) : (
          <>
            <Field
              label="Email"
              value={email}
              keyboardType="email-address"
              onChangeText={setEmail}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Button
              mode="contained"
              loading={action.busy}
              disabled={action.busy || !backendConfigured}
              onPress={() =>
                void action.run(async () => {
                  requireBackend();
                  if (
                    !email.trim() ||
                    !password ||
                    (signup && password.length < 6)
                  )
                    throw new Error(
                      "Enter an email and a password of at least six characters.",
                    );
                  const result = signup
                    ? await supabase.auth.signUp({
                        email: email.trim(),
                        password,
                      })
                    : await supabase.auth.signInWithPassword({
                        email: email.trim(),
                        password,
                      });
                  if (result.error) throw result.error;
                  setPassword("");
                  if (signup && !result.data.session)
                    action.setMessage(
                      "Check your inbox for the existing project’s confirmation email. Confirm, then sign in here.",
                    );
                })
              }
            >
              {signup ? "Create account" : "Sign in"}
            </Button>
            <Button onPress={() => setSignup(!signup)}>
              {signup
                ? "Use an existing account"
                : "Create a community account"}
            </Button>
            <Text>
              Use the same account as the website. Existing confirmation and
              access policies still apply.
            </Text>
          </>
        )}
        <Feedback {...action} />
        {!!!backendConfigured && (
          <Feedback error="Supabase public configuration is missing. See .env.example; offline apps still work." />
        )}
      </Panel>
    </Screen>
  );
}

const rooms = ["general", "gaming", "help"];
export function ChatScreen() {
  const { session, data, update } = useApp(),
    router = useRouter(),
    action = useAction();
  const [room, setRoom] = useState("general"),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [reply, setReply] = useState<ChatMessage | null>(null),
    [report, setReport] = useState(""),
    [reason, setReason] = useState(""),
    [unread, setUnread] = useState<Record<string, number>>({});
  const sending = useRef(false),
    atBottom = useRef(true),
    list = useRef<FlatList<ChatMessage>>(null);
  const user = session?.user;
  const query = useRemote(
    "chat:" + room,
    async () => {
      requireBackend();
      const { data: messages, error } = await supabase
        .from("community_messages")
        .select("*")
        .eq("room", room)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (messages || []).reverse() as ChatMessage[];
    },
    15000,
  );
  const reactions = useRemote(
    "reactions:" + room + ":" + (query.data || []).map((m) => m.id).join(","),
    async () => {
      if (!query.data?.length) return [] as Reaction[];
      const { data, error } = await supabase
        .from("community_reactions")
        .select("message_id,user_id,emoji")
        .in(
          "message_id",
          query.data.map((m) => m.id),
        )
        .limit(2000);
      if (error)
        throw new Error(
          "Reactions are unavailable. The existing chat features migration may not be installed.",
        );
      return (data || []) as Reaction[];
    },
    15000,
  );
  const refreshMessages = query.refresh,
    refreshReactions = reactions.refresh;
  useFocusEffect(
    useCallback(() => {
      if (!backendConfigured) return;
      const channel = supabase
        .channel("native-chat:" + room + ":" + id())
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "community_messages" },
          () => void refreshMessages(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "community_reactions" },
          () => void refreshReactions(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [room, refreshMessages, refreshReactions]),
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const key = "oxygen-chat-read-v1:" + (user?.id || "guest");
      async function check() {
        try {
          const raw = JSON.parse(
            (await AsyncStorage.getItem(key)) || "{}",
          ) as Record<string, string>;
          const { data: activity, error } = await supabase.rpc(
            "community_room_activity",
            { since: raw },
          );
          if (!alive || error || !Array.isArray(activity)) return;
          const counts: Record<string, number> = {};
          for (const item of activity) {
            const baseline = !raw[item.room];
            counts[item.room] =
              baseline || (item.room === room && atBottom.current)
                ? 0
                : Number(item.unread) || 0;
            if (baseline || (item.room === room && atBottom.current))
              raw[item.room] = item.latest_at;
          }
          setUnread(counts);
          await AsyncStorage.setItem(key, JSON.stringify(raw));
        } catch {
          /* Core chat remains available if the optional unread RPC is missing. */
        }
      }
      void check();
      const timer = setInterval(() => void check(), 15000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [room, user?.id]),
  );
  async function send() {
    if (!user || sending.current) return;
    const text = (drafts[room] || "").trim();
    if (!text || !data.chatName.trim())
      throw new Error("Enter a display name and a message.");
    if (text.length > 2000)
      throw new Error("Messages must be 2,000 characters or fewer.");
    sending.current = true;
    const target = room;
    try {
      const { error } = await supabase.from("community_messages").insert({
        room: target,
        user_id: user.id,
        display_name: data.chatName.trim(),
        body: text,
        ...(reply ? { reply_to: reply.id } : {}),
      });
      if (error) {
        if (error.message.includes("chat_rate_limit"))
          throw new Error("Wait five seconds between messages.");
        throw error;
      }
      setDrafts((old) => ({ ...old, [target]: "" }));
      setReply(null);
      atBottom.current = true;
      await query.refresh();
    } finally {
      sending.current = false;
    }
  }
  return (
    <Screen scroll={false}>
      <View style={[styles.content, { paddingBottom: 0 }]}>
        <View style={styles.row}>
          {rooms.map((r) => (
            <Chip
              key={r}
              selected={room === r}
              onPress={() => {
                setRoom(r);
                setReply(null);
                atBottom.current = true;
              }}
            >
              {r}
              {unread[r] ? ` (${unread[r]})` : ""}
            </Chip>
          ))}
        </View>
        <Text>
          Public room · Latest 60 messages · Live updates with periodic refresh
        </Text>
        <RemoteStatus {...query} />
        <Feedback {...action} />
      </View>
      <FlatList
        ref={list}
        data={query.data || []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } =
            event.nativeEvent;
          atBottom.current =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 80;
        }}
        onContentSizeChange={() => {
          if (atBottom.current) list.current?.scrollToEnd({ animated: false });
        }}
        renderItem={({ item }) => (
          <Panel title={item.display_name}>
            <Text variant="bodySmall">
              {new Date(item.created_at).toLocaleString()}
            </Text>
            {!!item.reply_to && (
              <Text variant="bodySmall">
                Reply:{" "}
                {query.data
                  ?.find((m) => m.id === item.reply_to)
                  ?.body.slice(0, 140) || "Earlier or deleted message"}
              </Text>
            )}
            <Text selectable>{item.body}</Text>
            <View style={styles.row}>
              {["👍", "❤️", "🎮"].map((emoji) => (
                <Chip
                  key={emoji}
                  disabled={!user || action.busy || !!reactions.error}
                  selected={reactions.data?.some(
                    (r) =>
                      r.message_id === item.id &&
                      r.user_id === user?.id &&
                      r.emoji === emoji,
                  )}
                  onPress={() =>
                    void action.run(async () => {
                      if (!user) return;
                      const own = reactions.data?.some(
                        (r) =>
                          r.message_id === item.id &&
                          r.user_id === user.id &&
                          r.emoji === emoji,
                      );
                      const result = own
                        ? await supabase
                            .from("community_reactions")
                            .delete()
                            .eq("message_id", item.id)
                            .eq("user_id", user.id)
                            .eq("emoji", emoji)
                        : await supabase.from("community_reactions").insert({
                            message_id: item.id,
                            user_id: user.id,
                            emoji,
                          });
                      if (result.error) throw result.error;
                      await reactions.refresh();
                    })
                  }
                >
                  {emoji}{" "}
                  {reactions.data?.filter(
                    (r) => r.message_id === item.id && r.emoji === emoji,
                  ).length || ""}
                </Chip>
              ))}
              {!!user && (
                <>
                  <Button onPress={() => setReply(item)}>Reply</Button>
                  <Button
                    onPress={() => {
                      setReport(item.id);
                      setReason("");
                    }}
                  >
                    Report
                  </Button>
                  {!!(item.user_id === user.id) && (
                    <IconButton
                      icon="delete-outline"
                      accessibilityLabel="Delete your message"
                      onPress={() =>
                        void action.run(async () => {
                          if (
                            !(await confirm(
                              "Delete for everyone?",
                              item.body.slice(0, 100),
                            ))
                          )
                            return;
                          const { error } = await supabase
                            .from("community_messages")
                            .delete()
                            .eq("id", item.id)
                            .eq("user_id", user.id);
                          if (error) throw error;
                          await query.refresh();
                        })
                      }
                    />
                  )}
                </>
              )}
            </View>
          </Panel>
        )}
        ListEmptyComponent={
          !query.loading ? (
            <Empty
              title="Start a conversation"
              detail="Sign in to send a message. Public messages can be read without signing in."
            />
          ) : undefined
        }
      />
      <View style={[styles.content, { paddingTop: 8 }]}>
        {!!report && (
          <Panel title="Report privately">
            <Field
              label="Reason (3–500 characters)"
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              multiline
            />
            <View style={styles.row}>
              <Button onPress={() => setReport("")}>Cancel</Button>
              <Button
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    if (!user || reason.trim().length < 3)
                      throw new Error("Enter at least three characters.");
                    const { error } = await supabase
                      .from("community_reports")
                      .insert({
                        message_id: report,
                        user_id: user.id,
                        reason: reason.trim(),
                      });
                    if (error) throw error;
                    setReport("");
                  }, "Report sent privately to the site owner.")
                }
              >
                Send report
              </Button>
            </View>
          </Panel>
        )}
        {!!reply && (
          <View style={styles.row}>
            <Text style={styles.grow}>Replying to {reply.display_name}</Text>
            <Button onPress={() => setReply(null)}>Cancel reply</Button>
          </View>
        )}
        {user ? (
          <>
            <Field
              label="Display name"
              value={data.chatName}
              maxLength={32}
              onChangeText={(chatName) => update("chatName", chatName)}
            />
            <View style={styles.row}>
              <View style={styles.grow}>
                <Field
                  label="Message"
                  value={drafts[room] || ""}
                  maxLength={2000}
                  onChangeText={(text) =>
                    setDrafts((old) => ({ ...old, [room]: text }))
                  }
                />
              </View>
              <Button
                mode="contained"
                loading={action.busy}
                disabled={action.busy}
                onPress={() => void action.run(send)}
              >
                Send
              </Button>
            </View>
          </>
        ) : (
          <Button mode="contained" onPress={() => router.push("/account")}>
            Sign in to chat
          </Button>
        )}
        {!!reactions.error && <Feedback error={reactions.error} />}
      </View>
    </Screen>
  );
}

export function AdminScreen() {
  const { session } = useApp();
  const access = useRemote("admin-authorized:" + session?.user.id, async () => {
    requireBackend();
    if (!session) return false;
    const { data, error } = await supabase.rpc("announcement_admin_status");
    if (error) throw error;
    return data === true;
  });
  return !access.data ? (
    <Screen>
      <RemoteStatus {...access} />
      {!!!access.loading && (
        <Empty
          title="Administrator access required"
          detail="Sign in with an existing approved account. Access is checked by the original Supabase RPC; the app cannot grant itself permission."
        />
      )}
    </Screen>
  ) : (
    <AdminEditor />
  );
}
function AdminEditor() {
  const query = useRemote(
    "admin-announcements",
    async () => {
      const { data, error } = await supabase.rpc("admin_list_announcements");
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    0,
    false,
  );
  const [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [draft, setDraft] = useState<string | null>(null),
    [preview, setPreview] = useState(false);
  const action = useAction();
  async function save() {
    if (!title.trim() || !body.trim())
      throw new Error("Enter a title and message.");
    const { data, error } = await supabase.rpc("save_announcement", {
      p_title: title.trim(),
      p_body: body.trim(),
      p_id: draft,
    });
    if (error) throw error;
    setDraft(data as string);
    await query.refresh();
    return data as string;
  }
  return (
    <Screen>
      <RemoteStatus {...query} />
      <Panel title={preview ? "Announcement preview" : "Announcement editor"}>
        {preview ? (
          <>
            <Text variant="headlineSmall">{title}</Text>
            <Text>{body}</Text>
            <Button onPress={() => setPreview(false)}>Edit</Button>
            <Button
              mode="contained"
              disabled={action.busy}
              loading={action.busy}
              onPress={() =>
                void action.run(async () => {
                  if (
                    !(await confirm(
                      "Publish to everyone?",
                      "This sends the announcement to the public feed.",
                    ))
                  )
                    return;
                  const identifier = await save();
                  const { error } = await supabase.rpc("publish_announcement", {
                    p_id: identifier,
                  });
                  if (error) {
                    await query.refresh();
                    throw new Error(
                      "Publication was not confirmed. Check the list before retrying.",
                    );
                  }
                  setTitle("");
                  setBody("");
                  setDraft(null);
                  setPreview(false);
                  await query.refresh();
                }, "Announcement published to the shared feed.")
              }
            >
              Publish announcement
            </Button>
          </>
        ) : (
          <>
            <Field
              label="Title"
              value={title}
              onChangeText={setTitle}
              maxLength={140}
            />
            <Field
              label="Message"
              value={body}
              onChangeText={setBody}
              maxLength={2000}
              multiline
            />
            <View style={styles.row}>
              <Button
                disabled={action.busy}
                onPress={() =>
                  void action.run(save, "Draft saved. It has not been sent.")
                }
              >
                Save draft
              </Button>
              <Button
                mode="contained"
                disabled={!title.trim() || !body.trim()}
                onPress={() => setPreview(true)}
              >
                Preview
              </Button>
              <Button
                onPress={() => {
                  setDraft(null);
                  setTitle("");
                  setBody("");
                }}
              >
                New draft
              </Button>
            </View>
          </>
        )}
        <Feedback {...action} />
      </Panel>
      {query.data?.map((item) => (
        <List.Item
          key={item.id}
          title={item.title}
          description={`${item.status} · ${item.published_at || item.created_at}`}
          onPress={() => {
            if (item.status === "published") {
              action.setMessage(item.body);
              return;
            }
            setDraft(item.id);
            setTitle(item.title);
            setBody(item.body);
            setPreview(false);
          }}
        />
      ))}
    </Screen>
  );
}
