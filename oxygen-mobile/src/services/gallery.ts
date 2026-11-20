import { File } from "expo-file-system";
import {
  GALLERY_BUCKET,
  GALLERY_TOPIC,
  requireBackend,
  supabase,
} from "./supabase";
import { id } from "./files";
export async function publicPhotos() {
  requireBackend();
  const { data, error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .list("photos", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
  if (error) throw error;
  return (data || [])
    .filter((p) => /\.(jpe?g|png|webp)$/i.test(p.name))
    .map((p) => ({
      name: p.name,
      url: supabase.storage
        .from(GALLERY_BUCKET)
        .getPublicUrl(`photos/${p.name}`).data.publicUrl,
    }));
}
export async function publishPhoto(uri: string) {
  requireBackend();
  const file = new File(uri);
  if (file.size > 5 * 1024 * 1024)
    throw new Error("The public gallery accepts photos up to 5 MB.");
  const path = `photos/${id()}.jpg`;
  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (error) throw error;
  await announceGallery();
}
export async function removePublicPhoto(name: string) {
  requireBackend();
  if (!/^[\w.-]+\.(jpe?g|png|webp)$/i.test(name))
    throw new Error("Invalid photo name.");
  const { error } = await supabase.storage
    .from(GALLERY_BUCKET)
    .remove([`photos/${name}`]);
  if (error) throw error;
  await announceGallery();
}
async function announceGallery() {
  const channel = supabase.channel(GALLERY_TOPIC);
  try {
    await channel.httpSend("changed", {}, { timeout: 3000 });
  } catch {
    /* Website and mobile clients also poll the authorized storage list. */
  } finally {
    void supabase.removeChannel(channel);
  }
}
