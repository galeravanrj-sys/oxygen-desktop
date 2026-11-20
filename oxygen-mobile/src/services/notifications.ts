import * as Notifications from "expo-notifications";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import {
  applyOfferUpdates,
  applyTierUpdate,
  GAME_NAMES,
  NOTIFICATION_KEY,
  parseNoticeStore,
  readOfferUpdates,
  readTierUpdate,
  type NoticeStore,
  type GameId,
} from "../lib/gameNotificationLogic";
import {
  ANNOUNCEMENT_ENDPOINT,
  applyAnnouncements,
  readAnnouncements,
} from "../lib/announcementLogic";
import { fetchJSON, getOffers, getTier } from "./api";
const TASK = "m8m8s-public-updates-v1";
let queue: Promise<unknown> = Promise.resolve(),
  checking: Promise<{ store: NoticeStore; errors: string[] }> | null = null;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export async function noticeSnapshot() {
  return parseNoticeStore(await AsyncStorage.getItem(NOTIFICATION_KEY));
}
export function updateNotices(change: (state: NoticeStore) => NoticeStore) {
  const result = queue.then(async () => {
    const current = await noticeSnapshot(),
      next = change(current);
    await AsyncStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next));
    return next;
  });
  queue = result.catch(() => {});
  return result;
}
export async function notificationPermission() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("m8m8s-updates", {
      name: "M8M8S updates",
      importance: 3, // Android IMPORTANCE_DEFAULT; kept numeric for SDK 58 enum export compatibility.
    });
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  if (!next.granted)
    throw new Error(
      "Notifications are disabled. Enable them in Android app settings to receive reminders.",
    );
  return true;
}
export async function checkPublicUpdates(post = false) {
  if (checking) return checking;
  checking = (async () => {
    const before = await noticeSnapshot(),
      errors: string[] = [];
    const updates: ((state: NoticeStore) => NoticeStore)[] = [];
    await Promise.allSettled([
      (async () => {
        if (!before.freeGameAlerts) return;
        try {
          const offers = readOfferUpdates(await getOffers());
          updates.push((s) => applyOfferUpdates(s, offers, Date.now()));
        } catch {
          errors.push("Giveaways could not be checked.");
        }
      })(),
      (async () => {
        if (!before.announcementAlerts) return;
        try {
          const announcements = readAnnouncements(
            await fetchJSON(ANNOUNCEMENT_ENDPOINT),
          );
          updates.push((s) => applyAnnouncements(s, announcements));
        } catch {
          errors.push("Announcements could not be checked.");
        }
      })(),
      ...Object.keys(GAME_NAMES).map(async (game) => {
        if (!before.tierAlerts) return;
        try {
          const update = await readTierUpdate(
            await getTier(game),
            game as GameId,
          );
          updates.push((s) => applyTierUpdate(s, update, Date.now()));
        } catch {
          errors.push(`${GAME_NAMES[game as GameId]} could not be checked.`);
        }
      }),
    ]);
    const store = await updateNotices((current) =>
      updates.reduce((s, apply) => apply(s), current),
    );
    if (post && (await Notifications.getPermissionsAsync()).granted) {
      const old = new Set(before.items.map((n) => n.id));
      for (const item of store.items.filter((n) => !n.read && !old.has(n.id))) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.body,
            data: {
              app:
                item.kind === "tierlist"
                  ? "tiers"
                  : item.kind === "freegames"
                    ? "free-games"
                    : "notifications",
              game: item.game,
              offer: item.offerId,
            },
          },
          trigger: null,
        });
      }
    }
    return { store, errors };
  })().finally(() => {
    checking = null;
  });
  return checking;
}
if (Platform.OS !== "web")
  TaskManager.defineTask(TASK, async () => {
    try {
      const result = await checkPublicUpdates(true);
      return result.errors.length === 7
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
export async function configureBackground(enabled: boolean) {
  if (!enabled) {
    if (await TaskManager.isTaskRegisteredAsync(TASK))
      await BackgroundTask.unregisterTaskAsync(TASK);
    return;
  }
  await notificationPermission();
  if (
    (await BackgroundTask.getStatusAsync()) !==
    BackgroundTask.BackgroundTaskStatus.Available
  )
    throw new Error(
      "Android has restricted background work. Check battery and background settings.",
    );
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
export async function remind(title: string, date: Date, app: string) {
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new Error("Choose a future reminder date and time.");
  await notificationPermission();
  return Notifications.scheduleNotificationAsync({
    content: { title, body: "M8M8S reminder", data: { app } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: "m8m8s-updates",
    },
  });
}
export async function cancelReminder(identifier?: string) {
  if (identifier)
    await Notifications.cancelScheduledNotificationAsync(identifier);
}
export function startForegroundChecks() {
  void checkPublicUpdates(false).catch(() => {});
  const timer = setInterval(() => {
    if (AppState.currentState === "active")
      void checkPublicUpdates(false).catch(() => {});
  }, 300000);
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") void checkPublicUpdates(false).catch(() => {});
  });
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}
