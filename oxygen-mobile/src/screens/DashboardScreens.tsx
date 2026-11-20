import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import {
  Button,
  Chip,
  Icon,
  IconButton,
  List,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
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
import { useRemote } from "../hooks/useRemote";
import { APPS, type AppId } from "../lib/catalog";
import { GAME_STATUSES, parseGameLibrary } from "../lib/gamingPassport";
import { localDate } from "../lib/dataValidation";
import { condition, getForecast, getOffers } from "../services/api";
import { exportBackup, importBackup } from "../services/backup";
import { saveLocalPhoto } from "../services/files";
import {
  checkPublicUpdates,
  configureBackground,
  noticeSnapshot,
  updateNotices,
} from "../services/notifications";

export function Brand() {
  return (
    <View
      accessibilityLabel="M8M8S"
      style={{
        width: 112,
        height: 36,
        overflow: "hidden",
        borderRadius: 10,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Image
        source={require("../../assets/images/m8m8s-logo.png")}
        style={{ width: 156, height: 156 }}
        contentFit="contain"
      />
    </View>
  );
}
export function AppGrid({ apps }: { apps: readonly (typeof APPS)[number][] }) {
  const router = useRouter(),
    { data } = useApp(),
    theme = useTheme(),
    { width } = useWindowDimensions();
  const count = width >= 850 ? 6 : width >= 600 ? 4 : 3;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {apps.map((app) => (
        <Pressable
          key={app.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${app.name}`}
          onPress={() =>
            router.push({ pathname: "/apps/[id]", params: { id: app.id } })
          }
          style={({ pressed }) => ({
            width: `${100 / count - 3}%`,
            minHeight: 104,
            padding: 8,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 52,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.secondaryContainer,
              borderRadius:
                data.settings.iconStyle === "circle"
                  ? 26
                  : data.settings.iconStyle === "square"
                    ? 6
                    : 16,
            }}
          >
            <Icon
              source={app.icon}
              size={26}
              color={theme.colors.onSecondaryContainer}
            />
          </View>
          <Text variant="labelLarge" style={{ textAlign: "center" }}>
            {app.name}
          </Text>
          {!!data.settings.favorites.includes(app.id) && (
            <Icon source="star" size={12} color={theme.colors.primary} />
          )}
        </Pressable>
      ))}
    </View>
  );
}
function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}
function Summary() {
  const { data } = useApp(),
    router = useRouter(),
    today = localDate(),
    tasks = data.tasks.filter((t) => !t.done),
    events = data.events.filter((e) => e.date === today),
    playing = data.games.filter((g) => g.status === "playing");
  return (
    <>
      <Panel title="Ahead of you">
        <Text>
          {tasks.length} active tasks · {events.length} events today
        </Text>
        {tasks.slice(0, 3).map((task) => (
          <List.Item
            key={task.id}
            title={task.title}
            description={task.due ? "Due " + task.due : undefined}
            onPress={() =>
              router.push({
                pathname: "/apps/[id]",
                params: { id: "tasks", item: task.id },
              })
            }
            left={(p) => <List.Icon {...p} icon="checkbox-blank-outline" />}
          />
        ))}
        {!!!tasks.length && <Text>Your task list is clear.</Text>}
        <Button onPress={() => router.push("/apps/tasks")}>Open tasks</Button>
      </Panel>
      {!!(events.length > 0) && (
        <Panel title="Today’s events">
          {events.map((event) => (
            <List.Item
              key={event.id}
              title={event.title}
              onPress={() => router.push("/apps/calendar")}
            />
          ))}
        </Panel>
      )}
      <Panel title="Currently playing">
        {playing.length ? (
          playing.map((g) => (
            <List.Item
              key={g.id}
              title={g.title}
              description={g.platform}
              onPress={() => router.push("/apps/passport")}
            />
          ))
        ) : (
          <Text>Set a game to Playing in your Gaming Passport.</Text>
        )}
        <Button onPress={() => router.push("/apps/passport")}>
          Open passport
        </Button>
      </Panel>
    </>
  );
}
function WeatherPeek() {
  const { data } = useApp(),
    router = useRouter(),
    city = data.settings.city;
  const remote = useRemote("weather:" + city?.id, async () => {
    if (!city) return null;
    return getForecast(city);
  });
  return (
    <Panel title={city?.name || "Your weather"}>
      {remote.data ? (
        <>
          <Text variant="headlineMedium">
            {Math.round(remote.data.current.temperature_2m)}°C
          </Text>
          <Text>
            {condition(remote.data.current.weather_code)}
            {remote.cached ? " · Saved forecast" : ""}
          </Text>
        </>
      ) : (
        <Text>
          {remote.error || "Choose your city to add a forecast to your day."}
        </Text>
      )}
      <Button onPress={() => router.push("/apps/weather")}>Open Weather</Button>
    </Panel>
  );
}
export function HomeScreen() {
  const { data } = useApp(),
    time = useClock(),
    router = useRouter();
  const favorites = data.settings.favorites.flatMap((value) =>
    APPS.filter((a) => a.id === value),
  );
  return (
    <Screen>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Brand />
        <IconButton
          icon="account-circle-outline"
          accessibilityLabel="Your account"
          onPress={() => router.push("/account")}
        />
      </View>
      <Text variant="headlineLarge">
        {time.getHours() < 12
          ? "Good morning."
          : time.getHours() < 18
            ? "Good afternoon."
            : "Good evening."}
      </Text>
      <Text>
        {time.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>
      {!!data.settings.wallpaper && (
        <Image
          source={{ uri: data.settings.wallpaper }}
          contentFit="cover"
          style={{ height: 160, width: "100%", borderRadius: 24 }}
          accessibilityLabel="Your personal wallpaper"
        />
      )}
      <Button
        mode="contained-tonal"
        icon="magnify"
        onPress={() => router.push("/(tabs)/apps")}
      >
        Search your space
      </Button>
      <AppGrid apps={favorites.length ? favorites : APPS.slice(0, 6)} />
      <WeatherPeek />
      <Summary />
      <Button
        icon="view-grid-outline"
        onPress={() => router.push("/apps/widgets")}
      >
        Clock & Widgets
      </Button>
    </Screen>
  );
}
export function AppsScreen() {
  const { data } = useApp(),
    router = useRouter();
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("all");
  const order = data.settings.order.length
    ? data.settings.order
    : APPS.map((a) => a.id);
  const apps = [...new Set([...order, ...APPS.map((a) => a.id)])]
    .flatMap((value) => APPS.filter((a) => a.id === value))
    .filter(
      (a) =>
        (group === "all" || a.group === group) &&
        `${a.name} ${a.detail}`.toLowerCase().includes(query.toLowerCase()),
    );
  const q = query.trim().toLowerCase();
  const hits = q
    ? [
        ...data.notes
          .filter((n) => (n.title + " " + n.body).toLowerCase().includes(q))
          .map((n) => ({
            id: n.id,
            title: n.title,
            detail: "Note",
            app: "notes" as AppId,
          })),
        ...data.tasks
          .filter((t) => t.title.toLowerCase().includes(q))
          .map((t) => ({
            id: t.id,
            title: t.title,
            detail: "Task",
            app: "tasks" as AppId,
          })),
        ...data.games
          .filter((g) => (g.title + " " + g.notes).toLowerCase().includes(q))
          .map((g) => ({
            id: g.id,
            title: g.title,
            detail: "Game",
            app: "passport" as AppId,
          })),
      ].slice(0, 50)
    : [];
  return (
    <Screen>
      <Text variant="headlineLarge">Your apps.</Text>
      <Field
        label="Search apps, notes, tasks and games"
        value={query}
        onChangeText={setQuery}
      />
      <View style={styles.row}>
        {["all", "everyday", "games", "personal"].map((g) => (
          <Chip key={g} selected={group === g} onPress={() => setGroup(g)}>
            {g}
          </Chip>
        ))}
      </View>
      <AppGrid apps={apps} />
      {hits.map((hit) => (
        <List.Item
          key={hit.app + hit.id}
          title={hit.title}
          description={hit.detail}
          onPress={() =>
            router.push({
              pathname: "/apps/[id]",
              params: { id: hit.app, item: hit.id },
            })
          }
        />
      ))}
      {!!(!apps.length && !hits.length) && (
        <Empty title="No matches" detail="Try another word or category." />
      )}
    </Screen>
  );
}
export function GamesScreen() {
  const { data } = useApp();
  return (
    <Screen>
      <Text variant="headlineLarge">A little play.</Text>
      <AppGrid apps={APPS.filter((a) => a.group === "games")} />
      <Panel title="Your passport">
        <Text>{data.games.length} saved games</Text>
        {Object.entries(GAME_STATUSES).map(([key, label]) => (
          <Text key={key}>
            {label}: {data.games.filter((g) => g.status === key).length}
          </Text>
        ))}
      </Panel>
    </Screen>
  );
}
export function BriefingScreen() {
  return (
    <Screen>
      <Text variant="headlineLarge">Your daily briefing.</Text>
      <WeatherPeek />
      <Summary />
      <DiscoverySummary />
      <AppGrid
        apps={APPS.filter((a) =>
          ["free-games", "tiers", "chat"].includes(a.id),
        )}
      />
    </Screen>
  );
}
function DiscoverySummary() {
  const router = useRouter();
  const offers = useRemote("free-games", getOffers, 300000);
  const notices = useRemote(
    "device-notification-history",
    noticeSnapshot,
    30000,
    false,
  );
  return (
    <>
      <Panel title="Giveaways to explore">
        <Text>
          {offers.data
            ? `${offers.data.length} current full-game giveaways`
            : offers.error || "Checking the current giveaway feed…"}
        </Text>
        {offers.data?.slice(0, 3).map((offer) => (
          <List.Item
            key={offer.id}
            title={offer.title}
            description={
              "Source deadline: " + (offer.end_date || "Check the offer")
            }
            onPress={() =>
              router.push({
                pathname: "/apps/[id]",
                params: { id: "free-games", offer: String(offer.id) },
              })
            }
          />
        ))}
        {!!offers.cached && (
          <Text>Saved feed; verify availability on the offer page.</Text>
        )}
        <Button onPress={() => router.push("/apps/free-games")}>
          All free games
        </Button>
      </Panel>
      <Panel title="Ranking updates">
        {notices.data?.items.filter((n) => n.kind === "tierlist").length ? (
          notices.data.items
            .filter((n) => n.kind === "tierlist")
            .slice(0, 3)
            .map((notice) => (
              <List.Item
                key={notice.id}
                title={notice.title}
                description={new Date(notice.createdAt).toLocaleString()}
                onPress={() =>
                  router.push({
                    pathname: "/apps/[id]",
                    params: { id: "tiers", game: notice.game || "zzz" },
                  })
                }
              />
            ))
        ) : (
          <Text>
            No ranking changes recorded since this device’s first check.
          </Text>
        )}
        <Button onPress={() => router.push("/apps/tiers")}>
          Explore rankings
        </Button>
      </Panel>
    </>
  );
}
export function WidgetsScreen() {
  const { data } = useApp(),
    time = useClock();
  const [zone, setZone] = useState("Asia/Manila");
  return (
    <Screen>
      <Panel title="World clock">
        <Text variant="displayMedium" style={{ fontVariant: ["tabular-nums"] }}>
          {time.toLocaleTimeString(undefined, {
            timeZone: zone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
        <Text>
          {time.toLocaleDateString(undefined, {
            timeZone: zone,
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
        <View style={styles.row}>
          {[
            "Asia/Manila",
            "UTC",
            "Asia/Tokyo",
            "Europe/London",
            "America/New_York",
          ].map((z) => (
            <Chip key={z} selected={zone === z} onPress={() => setZone(z)}>
              {z}
            </Chip>
          ))}
        </View>
      </Panel>
      <Panel title="On your device">
        <Text>
          {data.photos.length} private photos ·{" "}
          {data.tasks.filter((t) => !t.done).length} active tasks ·{" "}
          {data.events.filter((e) => e.date === localDate()).length} events
          today
        </Text>
      </Panel>
      <WeatherPeek />
      <Summary />
      <DiscoverySummary />
    </Screen>
  );
}

export function AppearanceScreen() {
  const { data, update } = useApp(),
    action = useAction();
  const [custom, setCustom] = useState(data.settings.accent);
  function save(patch: Partial<typeof data.settings>) {
    update("settings", (old) => ({ ...old, ...patch }));
  }
  return (
    <Screen>
      <Panel title="Make it yours">
        <Text>Appearance</Text>
        <View style={styles.row}>
          {(["system", "light", "dark"] as const).map((theme) => (
            <Chip
              key={theme}
              selected={data.settings.theme === theme}
              onPress={() => save({ theme })}
            >
              {theme}
            </Chip>
          ))}
        </View>
        <Text>Accent color</Text>
        <View style={styles.row}>
          {[
            "#7253ba",
            "#2563eb",
            "#0f766e",
            "#be185d",
            "#a16207",
            "#b91c1c",
          ].map((accent) => (
            <Chip
              key={accent}
              selected={data.settings.accent === accent}
              onPress={() => {
                save({ accent });
                setCustom(accent);
              }}
            >
              {accent}
            </Chip>
          ))}
        </View>
        <Field
          label="Custom accent (#RRGGBB)"
          value={custom}
          maxLength={7}
          onChangeText={setCustom}
        />
        <Button
          disabled={!/^#[0-9a-f]{6}$/i.test(custom)}
          onPress={() => save({ accent: custom })}
        >
          Apply custom color
        </Button>
        <Text>Icon shape</Text>
        <View style={styles.row}>
          {(["rounded", "circle", "square"] as const).map((iconStyle) => (
            <Chip
              key={iconStyle}
              selected={data.settings.iconStyle === iconStyle}
              onPress={() => save({ iconStyle })}
            >
              {iconStyle}
            </Chip>
          ))}
        </View>
        <Button
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const pick = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
              });
              if (!pick.canceled) {
                const photo = await saveLocalPhoto(
                  pick.assets[0].uri,
                  "Wallpaper.jpg",
                  pick.assets[0].width,
                );
                save({ wallpaper: photo.uri });
              }
            })
          }
        >
          Choose a home wallpaper
        </Button>
        {!!data.settings.wallpaper && (
          <Button onPress={() => save({ wallpaper: "" })}>
            Remove wallpaper
          </Button>
        )}
        <Button
          onPress={() =>
            void action.run(async () => {
              if (
                await confirm(
                  "Reset appearance?",
                  "Your app order, favorites and saved data will stay.",
                )
              )
                save({
                  theme: "system",
                  accent: "#7253ba",
                  iconStyle: "rounded",
                  wallpaper: "",
                });
            })
          }
        >
          Reset appearance
        </Button>
        <Feedback {...action} />
      </Panel>
      <Panel title="Favorites and app order">
        {[...new Set([...data.settings.order, ...APPS.map((a) => a.id)])]
          .flatMap((value) => APPS.filter((a) => a.id === value))
          .map((app, index, ordered) => (
            <View style={styles.row} key={app.id}>
              <IconButton
                icon={
                  data.settings.favorites.includes(app.id)
                    ? "star"
                    : "star-outline"
                }
                accessibilityLabel={`Favorite ${app.name}`}
                selected={data.settings.favorites.includes(app.id)}
                onPress={() =>
                  save({
                    favorites: data.settings.favorites.includes(app.id)
                      ? data.settings.favorites.filter((v) => v !== app.id)
                      : [...data.settings.favorites, app.id],
                  })
                }
              />
              <Text style={styles.grow}>{app.name}</Text>
              <IconButton
                icon="arrow-up"
                accessibilityLabel={`Move ${app.name} earlier`}
                disabled={index === 0}
                onPress={() => {
                  const next = ordered.map((a) => a.id);
                  [next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ];
                  save({ order: next });
                }}
              />
              <IconButton
                icon="arrow-down"
                accessibilityLabel={`Move ${app.name} later`}
                disabled={index === ordered.length - 1}
                onPress={() => {
                  const next = ordered.map((a) => a.id);
                  [next[index + 1], next[index]] = [
                    next[index],
                    next[index + 1],
                  ];
                  save({ order: next });
                }}
              />
            </View>
          ))}
      </Panel>
    </Screen>
  );
}

export function SettingsScreen() {
  const { data, update, replace, session } = useApp(),
    router = useRouter(),
    action = useAction();
  return (
    <Screen>
      <Panel title="Your space">
        <Text>
          {session?.user.email ||
            "Use your existing M8M8S account for shared features."}
        </Text>
        <Button icon="account-outline" onPress={() => router.push("/account")}>
          Account and administrator access
        </Button>
        <Button
          icon="palette-outline"
          onPress={() => router.push("/apps/appearance")}
        >
          Theme Studio
        </Button>
        <Button
          icon="bell-outline"
          onPress={() => router.push("/apps/notifications")}
        >
          Notification preferences
        </Button>
      </Panel>
      <Panel title="Data and backup">
        <Text>
          Notes, tasks, files, private photos, preferences and your passport
          stay on this device. Public Gallery, chat, accounts and announcements
          use the existing shared backend.
        </Text>
        <Button
          loading={action.busy}
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const omitted = await exportBackup(data);
              action.setMessage(
                omitted.length
                  ? `Backup shared. Export these files individually because they were too large or unavailable: ${omitted.join(", ")}`
                  : "Backup shared with private media. Keep it somewhere safe.",
              );
            })
          }
        >
          Export device backup
        </Button>
        <Button
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const imported = await importBackup();
              if (
                imported &&
                (await confirm(
                  "Replace device data?",
                  "This imports the backup into this Expo app only. The website and Supabase database are unchanged.",
                ))
              )
                replace(imported);
            })
          }
        >
          Import device / website backup
        </Button>
        <Button
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const picked = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
              });
              if (picked.canceled) return;
              const file = new File(picked.assets[0].uri);
              if (file.size > 10 * 1024 * 1024)
                throw new Error("Choose a passport file under 10 MB.");
              const text = await file.text(),
                parsed = JSON.parse(text);
              if (!Array.isArray(parsed))
                throw new Error(
                  "Choose the passport JSON array exported by the website.",
                );
              const games = parseGameLibrary(text);
              if (parsed.length && !games.length)
                throw new Error("The file contains no valid games.");
              if (
                await confirm(
                  "Merge passport?",
                  `${games.length} valid games will be merged by ID.`,
                )
              )
                update("games", (old) =>
                  [
                    ...new Map(
                      [...old, ...games].map((g) => [g.id, g]),
                    ).values(),
                  ].slice(0, 1000),
                );
            }, "Passport import completed.")
          }
        >
          Import passport JSON
        </Button>
        <Feedback {...action} />
      </Panel>
      <Panel title="About M8M8S Mobile">
        <Text>
          Separate Expo / React Native app. Android system tabs replace desktop
          browser windows; native navigation replaces dragging, snapping and
          minimizing. No production schema changes.
        </Text>
      </Panel>
    </Screen>
  );
}

export function NotificationsScreen() {
  const { data, update } = useApp(),
    router = useRouter(),
    action = useAction();
  const remote = useRemote(
    "device-notification-history",
    noticeSnapshot,
    30000,
  );
  const [filter, setFilter] = useState("all");
  async function toggle(
    key: "tierAlerts" | "freeGameAlerts" | "announcementAlerts",
    value: boolean,
  ) {
    await updateNotices((s) => ({
      ...s,
      [key]: value,
      ...(value && key === "tierAlerts" ? { tiers: {} } : {}),
      ...(value && key === "freeGameAlerts" ? { seenOffers: null } : {}),
      ...(value && key === "announcementAlerts"
        ? { announcementSeen: null }
        : {}),
    }));
    await remote.refresh();
  }
  return (
    <Screen>
      <Panel title="Update preferences">
        {(["tierAlerts", "freeGameAlerts", "announcementAlerts"] as const).map(
          (key) => (
            <View style={styles.row} key={key}>
              <Text style={styles.grow}>
                {key === "tierAlerts"
                  ? "Ranking changes"
                  : key === "freeGameAlerts"
                    ? "Free game giveaways"
                    : "Announcements"}
              </Text>
              <Switch
                accessibilityLabel={key}
                value={remote.data?.[key] ?? true}
                onValueChange={(value) =>
                  void action.run(() => toggle(key, value))
                }
              />
            </View>
          ),
        )}
        <View style={styles.row}>
          <Text style={styles.grow}>Android background checks</Text>
          <Switch
            accessibilityLabel="Android background checks"
            value={data.settings.backgroundUpdates}
            onValueChange={(enabled) =>
              void action.run(async () => {
                await configureBackground(enabled);
                update("settings", (s) => ({
                  ...s,
                  backgroundUpdates: enabled,
                }));
              })
            }
          />
        </View>
        <Text>
          Background checks use Android WorkManager through Expo. Android
          chooses the timing; 15 minutes is a minimum, not an exact schedule.
          Force-stopping the app prevents checks until it is opened again.
        </Text>
        <Button
          mode="contained"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const result = await checkPublicUpdates(false);
              await remote.refresh();
              action.setMessage(
                result.errors.length
                  ? result.errors.join("\n")
                  : "Public feeds checked.",
              );
            })
          }
        >
          Check now
        </Button>
        <View style={styles.row}>
          <Button
            onPress={() =>
              void action.run(async () => {
                await updateNotices((s) => ({
                  ...s,
                  items: s.items.map((n) => ({ ...n, read: true })),
                }));
                await remote.refresh();
              })
            }
          >
            Mark all read
          </Button>
          <Button
            onPress={() =>
              void action.run(async () => {
                if (
                  await confirm(
                    "Clear notification history?",
                    "Feed baselines will stay so old updates do not return.",
                  )
                ) {
                  await updateNotices((s) => ({ ...s, items: [] }));
                  await remote.refresh();
                }
              })
            }
          >
            Clear history
          </Button>
        </View>
      </Panel>
      <Feedback {...action} />
      <View style={styles.row}>
        {["all", "unread", "tierlist", "freegames", "announcement"].map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)}>
            {f}
          </Chip>
        ))}
      </View>
      {remote.data?.items
        .filter(
          (n) =>
            filter === "all" ||
            (filter === "unread" && !n.read) ||
            n.kind === filter,
        )
        .map((notice) => (
          <Panel
            key={notice.id}
            title={(notice.read ? "" : "New · ") + notice.title}
          >
            <Text>{notice.body}</Text>
            <Text variant="bodySmall">
              {new Date(notice.createdAt).toLocaleString()}
            </Text>
            <Button
              onPress={() =>
                void action.run(async () => {
                  await updateNotices((s) => ({
                    ...s,
                    items: s.items.map((n) =>
                      n.id === notice.id ? { ...n, read: true } : n,
                    ),
                  }));
                  await remote.refresh();
                  if (notice.kind !== "announcement")
                    router.push({
                      pathname: "/apps/[id]",
                      params: {
                        id: notice.kind === "tierlist" ? "tiers" : "free-games",
                        ...(notice.game ? { game: notice.game } : {}),
                        ...(notice.offerId
                          ? { offer: String(notice.offerId) }
                          : {}),
                      },
                    });
                })
              }
            >
              {notice.kind === "announcement" ? "Mark read" : "Open update"}
            </Button>
          </Panel>
        ))}
      {!!!remote.data?.items.length && (
        <Empty
          title="You’re up to date"
          detail="The first successful feed check establishes a quiet baseline. New updates will appear here."
        />
      )}
    </Screen>
  );
}
