import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { APPS } from "../lib/catalog";
import { validateData } from "../lib/dataValidation";
import type { MobileData } from "../types/models";
import { exportText, id, managedDirectory } from "./files";
type Media = {
  id: string;
  kind: "photo" | "file";
  base64: string;
  name: string;
};
export async function exportBackup(data: MobileData) {
  const media: Media[] = [],
    omitted: string[] = [];
  let budget = 25 * 1024 * 1024;
  for (const item of [
    ...data.photos.map((p) => ({ ...p, kind: "photo" as const })),
    ...data.files
      .filter((f) => f.kind === "file" && f.uri)
      .map((f) => ({ ...f, kind: "file" as const })),
  ]) {
    try {
      const file = new File(item.uri!);
      if (file.size > budget) {
        omitted.push(item.name);
        continue;
      }
      media.push({
        id: item.id,
        kind: item.kind,
        base64: await file.base64(),
        name: item.name,
      });
      budget -= file.size;
    } catch {
      omitted.push(item.name);
    }
  }
  await exportText(
    "M8M8S-backup.json",
    JSON.stringify(
      { format: "m8m8s-mobile-backup", version: 1, data, media, omitted },
      null,
      2,
    ),
    "application/json",
  );
  return omitted;
}
export async function importBackup(): Promise<MobileData | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const file = new File(picked.assets[0].uri);
  if (file.size > 50 * 1024 * 1024)
    throw new Error("Backups must be under 50 MB. Import a smaller export.");
  const raw = JSON.parse(await file.text());
  if (Array.isArray(raw))
    throw new Error(
      "This is a game-library export. Use Import passport in Settings.",
    );
  let next: MobileData;
  let media: Media[] = [];
  if (raw.format === "m8m8s-mobile-backup" && raw.version === 1 && raw.data) {
    const input = raw.data;
    next = validateData({
      ...input,
      photos: [],
      files: (Array.isArray(input.files) ? input.files : []).filter(
        (f: { kind?: string }) => f.kind === "folder",
      ),
    });
    media = Array.isArray(raw.media) ? raw.media : [];
    for (const part of media) {
      if (
        !part ||
        typeof part.id !== "string" ||
        typeof part.base64 !== "string" ||
        typeof part.name !== "string" ||
        part.base64.length > 40 * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(part.base64)
      )
        throw new Error("Invalid media in backup.");
      const extension =
        part.kind === "photo"
          ? ".jpg"
          : part.name.match(/\.[a-z\d]{1,8}$/i)?.[0] || "";
      const target = new File(managedDirectory(), id() + extension);
      target.create();
      await target.write(part.base64, { encoding: "base64" });
      if (part.kind === "photo") {
        const original = Array.isArray(input.photos)
          ? input.photos.find((p: { id?: string }) => p.id === part.id)
          : null;
        if (original) next.photos.push({ ...original, uri: target.uri });
      } else if (part.kind === "file") {
        const original = Array.isArray(input.files)
          ? input.files.find((p: { id?: string }) => p.id === part.id)
          : null;
        if (original) next.files.push({ ...original, uri: target.uri });
      }
    }
    return validateData(next);
  }
  if (raw.format === "m8m8s-web-export-v1") {
    const storage = raw.storage || {};
    const parse = (key: string, fallback: unknown) => {
      try {
        return typeof storage[key] === "string"
          ? JSON.parse(storage[key])
          : fallback;
      } catch {
        return fallback;
      }
    };
    const prefs = parse("oxygen-personalization-v1", {}) as Record<
      string,
      unknown
    >;
    const appIds = (value: unknown) =>
      Array.isArray(value)
        ? value.flatMap((name) =>
            APPS.filter((a) => a.name === name).map((a) => a.id),
          )
        : [];
    next = validateData({
      version: 1,
      notes: parse("oxygen-notes-v1", []),
      tasks: parse("oxygen-todos-v1", []),
      events: parse("oxygen-events-v1", []),
      games: parse("oxygen-gaming-passport-v1", []),
      bookmarks: parse("oxygen-bookmarks-v1", []),
      history: parse("oxygen-calculator-history-v1", []),
      settings: {
        accent: prefs.accent,
        iconStyle: prefs.iconStyle,
        favorites: appIds(prefs.favorites),
        order: appIds(prefs.order),
        city: parse("oxygen-weather-city-v1", null),
      },
      chatName: storage["oxygen-chat-name-v1"] || "",
    });
    return next;
  }
  throw new Error(
    "Choose a M8M8S mobile backup or the documented website data export. Nothing was replaced.",
  );
}
