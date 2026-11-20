import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import * as ImageManipulator from "expo-image-manipulator";
import type { LocalPhoto } from "../types/models";
export const id = () => Crypto.randomUUID();
export function managedDirectory() {
  const dir = new Directory(Paths.document, "m8m8s");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}
export async function persistFile(uri: string, name: string) {
  const extension = name.match(/\.[a-z\d]{1,8}$/i)?.[0] || "";
  const target = new File(managedDirectory(), id() + extension);
  await new File(uri).copy(target);
  return target;
}
export async function saveLocalPhoto(
  uri: string,
  name = "Photo.jpg",
  width?: number,
): Promise<LocalPhoto> {
  const output = await ImageManipulator.manipulateAsync(
    uri,
    width && width > 2048 ? [{ resize: { width: 2048 } }] : [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const file = await persistFile(output.uri, "Photo.jpg");
  return {
    id: id(),
    name: name.replace(/\.[^.]+$/, "") + ".jpg",
    uri: file.uri,
    createdAt: new Date().toISOString(),
  };
}
export async function shareFile(uri: string, mime?: string) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Native sharing is not available on this device.");
  await Sharing.shareAsync(uri, { mimeType: mime });
}
export async function exportText(
  name: string,
  text: string,
  mime = "text/plain",
) {
  const file = new File(Paths.cache, name.replace(/[^\w.-]/g, "_"));
  file.create({ overwrite: true });
  await file.write(text);
  await shareFile(file.uri, mime);
}
export async function downloadAndShare(url: string) {
  if (!/^https:\/\//i.test(url))
    throw new Error("Only secure download links are supported.");
  const file = await File.downloadFileAsync(
    url,
    new File(Paths.cache, id() + ".jpg"),
  );
  await shareFile(file.uri, "image/jpeg");
}
export async function deleteManagedFile(uri: string) {
  const dir = managedDirectory();
  if (!uri.startsWith(dir.uri.replace(/\/$/, "") + "/"))
    throw new Error("This file is outside the private app folder.");
  const file = new File(uri);
  if (file.exists) await file.delete();
}
