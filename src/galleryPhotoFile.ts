const LIMIT = 5 * 1024 * 1024;
/** FileReader/Camera images are already in memory; no network fetch is needed. */
export function galleryPhotoFile(data: string, name = "photo"): File {
 const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/\r\n]*={0,2})$/i.exec(data);
 if (!match) throw new Error("This saved photo could not be read. Try adding the JPG, PNG, or WebP again.");
 const mime = match[1].toLowerCase(), encoded = match[2].replace(/[\r\n]/g, "");
 const size = encoded.length * 3 / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
 if (size > LIMIT) throw new Error("Maximum public photo size is 5 MB. Choose a smaller photo.");
 let binary: string;
 try { binary = atob(encoded); } catch { throw new Error("This saved photo is damaged. Try adding it again."); }
 if (!binary.length) throw new Error("This saved photo is empty. Try adding it again.");
 const bytes = new Uint8Array(binary.length);
 for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
 const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
 return new File([bytes], `${name.replace(/\.[^.]*$/, "") || "photo"}.${extension}`, { type: mime });
}
