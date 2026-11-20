import { useReducer, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  List,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { DateField } from "../components/DateField";
import {
  Empty,
  Feedback,
  Field,
  Panel,
  Screen,
  confirm,
  styles,
  useAction,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { cancelReminder, remind } from "../services/notifications";
import { exportText, id } from "../services/files";
import { localDate } from "../lib/dataValidation";
import {
  calculatorReducer,
  createCalculator,
  formatNumber,
  pastedNumber,
} from "../lib/calculatorEngine";
import {
  GAME_PLATFORMS,
  GAME_STATUSES,
  type GameStatus,
} from "../lib/gamingPassport";

export function NotesScreen() {
  const { data, update } = useApp(),
    params = useLocalSearchParams<{ item?: string }>();
  const [selected, setSelected] = useState(params.item || ""),
    [query, setQuery] = useState("");
  const action = useAction();
  const note = data.notes.find((n) => n.id === selected);
  function create() {
    const next = { id: id(), title: "Untitled note", body: "" };
    update("notes", (old) => [next, ...old]);
    setSelected(next.id);
  }
  return (
    <Screen>
      <View style={styles.row}>
        <Button mode="contained" icon="plus" onPress={create}>
          New note
        </Button>
        {!!note && <Button onPress={() => setSelected("")}>All notes</Button>}
      </View>
      <Field label="Search notes" value={query} onChangeText={setQuery} />
      {note ? (
        <Panel>
          <Field
            label="Note title"
            value={note.title}
            maxLength={160}
            onChangeText={(title) =>
              update("notes", (old) =>
                old.map((n) => (n.id === note.id ? { ...n, title } : n)),
              )
            }
          />
          <Field
            label="Note body"
            value={note.body}
            multiline
            maxLength={200000}
            onChangeText={(body) =>
              update("notes", (old) =>
                old.map((n) => (n.id === note.id ? { ...n, body } : n)),
              )
            }
          />
          <Text>
            {note.body.trim() ? note.body.trim().split(/\s+/).length : 0} words
            · Saved on this device
          </Text>
          <View style={styles.row}>
            <Button
              disabled={action.busy}
              onPress={() =>
                void action.run(() =>
                  exportText(
                    note.title + ".txt",
                    note.title + "\n\n" + note.body,
                  ),
                )
              }
            >
              Export text
            </Button>
            <Button
              onPress={() =>
                void action.run(async () => {
                  if (await confirm("Delete note?", note.title)) {
                    update("notes", (old) =>
                      old.filter((n) => n.id !== note.id),
                    );
                    setSelected("");
                  }
                })
              }
            >
              Delete
            </Button>
          </View>
        </Panel>
      ) : data.notes.length ? (
        data.notes
          .filter((n) =>
            (n.title + " " + n.body)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((n) => (
            <List.Item
              key={n.id}
              title={n.title || "Untitled note"}
              description={n.body.slice(0, 100) || "Start writing"}
              onPress={() => setSelected(n.id)}
              left={(p) => <List.Icon {...p} icon="notebook-outline" />}
            />
          ))
      ) : (
        <Empty
          title="A space for your ideas"
          detail="Create a note. Notes stay on this device unless you export them."
        />
      )}
      <Feedback {...action} />
    </Screen>
  );
}

export function TasksScreen() {
  const { data, update } = useApp();
  const [title, setTitle] = useState(""),
    [due, setDue] = useState(""),
    [filter, setFilter] = useState("all"),
    [reminder, setReminder] = useState("");
  const action = useAction();
  const visible = data.tasks.filter(
    (t) => filter === "all" || (filter === "done") === t.done,
  );
  async function add() {
    if (!title.trim()) throw new Error("Enter a task title.");
    if (
      due &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !Number.isFinite(new Date(due + "T12:00:00").getTime()))
    )
      throw new Error("Enter a valid due date or leave it blank.");
    let notification: string | undefined;
    if (reminder)
      notification = await remind(title.trim(), new Date(reminder), "tasks");
    update("tasks", (old) => [
      {
        id: id(),
        title: title.trim(),
        due,
        done: false,
        reminder: notification,
      },
      ...old,
    ]);
    setTitle("");
    setDue("");
    setReminder("");
  }
  return (
    <Screen>
      <Panel title="A little progress">
        <Field
          label="New task"
          value={title}
          maxLength={300}
          onChangeText={setTitle}
        />
        <DateField
          label="Due date (YYYY-MM-DD, optional)"
          value={due}
          onChange={setDue}
        />
        <DateField
          label="Reminder (optional)"
          value={reminder}
          onChange={setReminder}
          time
        />
        <Button
          mode="contained"
          disabled={action.busy}
          loading={action.busy}
          onPress={() => void action.run(add)}
        >
          Add task
        </Button>
      </Panel>
      <SegmentedButtons
        value={filter}
        onValueChange={setFilter}
        buttons={[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "done", label: "Done" },
        ]}
      />
      <Feedback {...action} />
      {visible.length ? (
        visible.map((task) => (
          <Panel key={task.id}>
            <View style={styles.row}>
              <Checkbox.Item
                label=""
                style={{ width: 48, paddingHorizontal: 0 }}
                accessibilityLabel={`Mark ${task.title} ${task.done ? "active" : "done"}`}
                status={task.done ? "checked" : "unchecked"}
                onPress={() =>
                  void action.run(async () => {
                    if (!task.done) await cancelReminder(task.reminder);
                    update("tasks", (old) =>
                      old.map((t) =>
                        t.id === task.id
                          ? {
                              ...t,
                              done: !t.done,
                              reminder: !t.done ? undefined : t.reminder,
                            }
                          : t,
                      ),
                    );
                  })
                }
              />
              <View style={styles.grow}>
                <Text
                  style={{
                    textDecorationLine: task.done ? "line-through" : "none",
                  }}
                >
                  {task.title}
                </Text>
                {!!task.due && <Text variant="bodySmall">Due {task.due}</Text>}
              </View>
              <IconButton
                icon="delete-outline"
                accessibilityLabel={`Delete ${task.title}`}
                onPress={() =>
                  void action.run(async () => {
                    if (await confirm("Delete task?", task.title)) {
                      await cancelReminder(task.reminder);
                      update("tasks", (old) =>
                        old.filter((t) => t.id !== task.id),
                      );
                    }
                  })
                }
              />
            </View>
          </Panel>
        ))
      ) : (
        <Empty
          title="Nothing in this list"
          detail="Add a task or try another filter."
        />
      )}
      <Button
        onPress={() =>
          void action.run(async () => {
            if (
              await confirm("Clear completed tasks?", "Active tasks will stay.")
            )
              update("tasks", (old) => old.filter((t) => !t.done));
          })
        }
      >
        Clear completed
      </Button>
    </Screen>
  );
}

export function CalendarScreen() {
  const { data, update } = useApp();
  const [date, setDate] = useState(localDate()),
    [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [title, setTitle] = useState(""),
    [reminder, setReminder] = useState("");
  const action = useAction(),
    theme = useTheme();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <Screen>
      <Panel>
        <View style={styles.row}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Previous month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          />
          <Text variant="titleMedium" style={styles.grow}>
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <IconButton
            icon="chevron-right"
            accessibilityLabel="Next month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <Text key={i} style={{ width: "14.285%", textAlign: "center" }}>
              {day}
            </Text>
          ))}
          {Array.from({ length: month.getDay() }, (_, i) => (
            <View key={"blank" + i} style={{ width: "14.285%" }} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const value = localDate(
              new Date(month.getFullYear(), month.getMonth(), i + 1),
            );
            return (
              <View key={value} style={{ width: "14.285%" }}>
                <Button
                  accessibilityLabel={value}
                  compact
                  style={{
                    backgroundColor:
                      date === value
                        ? theme.colors.secondaryContainer
                        : undefined,
                  }}
                  contentStyle={{ minHeight: 48 }}
                  onPress={() => setDate(value)}
                >
                  {i + 1}
                  {data.events.some((e) => e.date === value) ? "*" : ""}
                </Button>
              </View>
            );
          })}
        </View>
        <Button
          onPress={() => {
            setDate(localDate());
            setMonth(
              new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            );
          }}
        >
          Today
        </Button>
      </Panel>
      <Panel title="Plan your day">
        <DateField label="Event date" value={date} onChange={setDate} />
        <Field
          label="Event title"
          value={title}
          maxLength={300}
          onChangeText={setTitle}
        />
        <DateField
          label="Reminder (optional)"
          value={reminder}
          onChange={setReminder}
          time
        />
        <Button
          mode="contained"
          loading={action.busy}
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date))
                throw new Error("Enter a title and a valid event date.");
              const notification = reminder
                ? await remind(title, new Date(reminder), "calendar")
                : undefined;
              update("events", (old) => [
                ...old,
                { id: id(), title: title.trim(), date, reminder: notification },
              ]);
              setTitle("");
              setReminder("");
            })
          }
        >
          Save event
        </Button>
      </Panel>
      <Feedback {...action} />
      {data.events
        .filter((e) => e.date === date)
        .map((event) => (
          <List.Item
            key={event.id}
            title={event.title}
            description={event.date}
            right={() => (
              <IconButton
                icon="delete-outline"
                accessibilityLabel={`Delete ${event.title}`}
                onPress={() =>
                  void action.run(async () => {
                    if (await confirm("Delete event?", event.title)) {
                      await cancelReminder(event.reminder);
                      update("events", (old) =>
                        old.filter((e) => e.id !== event.id),
                      );
                    }
                  })
                }
              />
            )}
          />
        ))}
    </Screen>
  );
}

export function PassportScreen() {
  const { data, update } = useApp();
  const [editing, setEditing] = useState(""),
    [title, setTitle] = useState(""),
    [platform, setPlatform] = useState("Steam"),
    [status, setStatus] = useState<GameStatus>("wishlist"),
    [notes, setNotes] = useState(""),
    [rating, setRating] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const action = useAction();
  return (
    <Screen>
      <Panel title={editing ? "Edit your game" : "Add to your passport"}>
        <Field
          label="Game title"
          value={title}
          maxLength={180}
          onChangeText={setTitle}
        />
        <Text>Platform</Text>
        <View style={styles.row}>
          {GAME_PLATFORMS.map((p) => (
            <Chip
              key={p}
              selected={platform === p}
              onPress={() => setPlatform(p)}
            >
              {p}
            </Chip>
          ))}
        </View>
        <View style={styles.row}>
          {Object.entries(GAME_STATUSES).map(([value, label]) => (
            <Chip
              key={value}
              selected={status === value}
              onPress={() => setStatus(value as GameStatus)}
            >
              {label}
            </Chip>
          ))}
        </View>
        <Field
          label="Notes"
          value={notes}
          maxLength={2000}
          onChangeText={setNotes}
          multiline
        />
        <Text>Rating: {rating}/5</Text>
        <View style={styles.row}>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} selected={rating === n} onPress={() => setRating(n)}>
              {n}
            </Chip>
          ))}
        </View>
        <Button
          mode="contained"
          onPress={() => {
            if (!title.trim()) return;
            const previous = data.games.find((g) => g.id === editing);
            const next = {
              id: editing || id(),
              title: title.trim(),
              platform,
              status,
              notes,
              rating,
              addedAt: previous?.addedAt || new Date().toISOString(),
              finishedAt:
                status === "finished"
                  ? previous?.finishedAt || localDate()
                  : undefined,
            };
            update("games", (old) => [
              next,
              ...old.filter((g) => g.id !== editing),
            ]);
            setTitle("");
            setNotes("");
            setEditing("");
          }}
        >
          Save game
        </Button>
      </Panel>
      <Field label="Search your games" value={query} onChangeText={setQuery} />
      <View style={styles.row}>
        {["all", ...Object.keys(GAME_STATUSES)].map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </View>
      {data.games
        .filter(
          (g) =>
            (filter === "all" || g.status === filter) &&
            (g.title + " " + g.notes)
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .map((game) => (
          <Panel key={game.id} title={game.title}>
            <Text>
              {game.platform} · {GAME_STATUSES[game.status]} · {game.rating}/5
            </Text>
            {!!game.notes && <Text>{game.notes}</Text>}
            <View style={styles.row}>
              <Button
                onPress={() => {
                  setEditing(game.id);
                  setTitle(game.title);
                  setPlatform(game.platform);
                  setStatus(game.status);
                  setNotes(game.notes);
                  setRating(game.rating);
                }}
              >
                Edit
              </Button>
              <Button
                onPress={() =>
                  void action.run(async () => {
                    if (await confirm("Remove game?", game.title))
                      update("games", (old) =>
                        old.filter((g) => g.id !== game.id),
                      );
                  })
                }
              >
                Remove
              </Button>
            </View>
          </Panel>
        ))}
      {!!!data.games.length && (
        <Empty
          title="Your next adventure"
          detail="Add a game or save a giveaway to your wishlist."
        />
      )}
      <Button
        onPress={() =>
          void action.run(() =>
            exportText(
              "m8m8s-passport.json",
              JSON.stringify(data.games, null, 2),
              "application/json",
            ),
          )
        }
      >
        Export passport
      </Button>
      <Feedback {...action} />
    </Screen>
  );
}

export function CalculatorScreen() {
  const { data, update } = useApp();
  const [state, dispatch] = useReducer(
    calculatorReducer,
    data.history,
    createCalculator,
  );
  const action = useAction();
  function key(value: string) {
    value =
      (
        {
          "\u232b": "backspace",
          "1/x": "reciprocal",
          "x\u00b2": "square",
          "\u221ax": "sqrt",
        } as Record<string, string>
      )[value] || value;
    const next = calculatorReducer(state, { type: "key", key: value });
    dispatch({ type: "key", key: value });
    if (next.history !== state.history) update("history", next.history);
  }
  const keys = [
    "%",
    "CE",
    "C",
    "⌫",
    "1/x",
    "x²",
    "√x",
    "÷",
    "7",
    "8",
    "9",
    "×",
    "4",
    "5",
    "6",
    "−",
    "1",
    "2",
    "3",
    "+",
    "±",
    "0",
    ".",
    "=",
  ];
  return (
    <Screen>
      <Panel>
        <Text variant="bodyLarge">{state.expression || "Standard"}</Text>
        <Text
          selectable
          accessibilityLiveRegion="polite"
          variant="displayMedium"
          numberOfLines={2}
          style={{ textAlign: "right" }}
        >
          {formatNumber(state.display, !state.fresh)}
        </Text>
        <View style={styles.row}>
          {["MC", "MR", "M+", "M−", "MS"].map((k) => (
            <Button key={k} compact onPress={() => key(k)}>
              {k}
            </Button>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {keys.map((k) => (
            <View key={k} style={{ width: "25%", padding: 3 }}>
              <Button
                accessibilityLabel={k === "⌫" ? "Backspace" : k}
                mode={k === "=" ? "contained" : "contained-tonal"}
                contentStyle={{ minHeight: 52 }}
                onPress={() => key(k)}
              >
                {k}
              </Button>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Button
            onPress={() =>
              void action.run(
                () => Clipboard.setStringAsync(state.display),
                "Copied.",
              )
            }
          >
            Copy
          </Button>
          <Button
            onPress={() =>
              void action.run(async () => {
                dispatch({
                  type: "recall",
                  value: pastedNumber(await Clipboard.getStringAsync()),
                });
              })
            }
          >
            Paste
          </Button>
        </View>
      </Panel>
      <Feedback {...action} />
      {!!(state.memory.length > 0) && (
        <Panel title="Memory">
          {state.memory.map((value, index) => (
            <View style={styles.row} key={index}>
              <Button onPress={() => dispatch({ type: "recall", value })}>
                {formatNumber(value)}
              </Button>
              <Button
                onPress={() =>
                  dispatch({ type: "memory", operation: "clear", index })
                }
              >
                Clear
              </Button>
            </View>
          ))}
        </Panel>
      )}
      <Panel title="History">
        {state.history.map((item) => (
          <List.Item
            key={item.id}
            title={formatNumber(item.result)}
            description={item.expression}
            onPress={() => dispatch({ type: "history-recall", id: item.id })}
          />
        ))}
        <Button
          onPress={() => {
            dispatch({ type: "clear-history" });
            update("history", []);
          }}
        >
          Clear history
        </Button>
      </Panel>
      <Divider />
    </Screen>
  );
}
