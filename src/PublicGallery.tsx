import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Cloud, Download, ImagePlus, LockKeyhole, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { supabase, GALLERY_BUCKET, uploadPublicPhoto } from "./supabase";

type LocalPhoto = { id: string; name: string; data: string };
type CloudPhoto = { name: string; url: string };
type GalleryPhoto = { id: string; name: string; url: string; source: "local" | "public" };

type Props = {
  localPhotos: LocalPhoto[];
  loadingLocal: boolean;
  localError: string;
  onSaveLocal: (file: File) => Promise<void>;
  onDeleteLocal: (id: string) => Promise<void>;
};

export default function PublicGallery({ localPhotos, loadingLocal, localError, onSaveLocal, onDeleteLocal }: Props) {
  const [cloudPhotos, setCloudPhotos] = useState<CloudPhoto[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<GalleryPhoto | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const { data, error: listError } = await supabase.storage.from(GALLERY_BUCKET)
      .list("photos", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (listError) {
      setError(`Public photos unavailable: ${listError.message}`);
      return;
    }
    setError("");
    setCloudPhotos((data ?? [])
      .filter(item => /\.(jpe?g|png|webp)$/i.test(item.name))
      .map(item => ({
        name: item.name,
        url: supabase.storage.from(GALLERY_BUCKET).getPublicUrl(`photos/${item.name}`).data.publicUrl,
      })));
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 10000);
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      subscription.subscription.unsubscribe();
    };
  }, [refresh]);

  const allPhotos: GalleryPhoto[] = [
    ...localPhotos.map(photo => ({ id: photo.id, name: photo.name, url: photo.data, source: "local" as const })),
    ...cloudPhotos.map(photo => ({ id: photo.name, name: photo.name, url: photo.url, source: "public" as const })),
  ];

  async function addLocal(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      let saved = 0;
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) continue;
        await onSaveLocal(file);
        saved++;
      }
      setMessage(`${saved} photo${saved === 1 ? "" : "s"} saved privately on this device.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save photo locally.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setBusy(false);
    }
  }

  async function publish(file: File) {
    if (!window.confirm("Publish this photo for EVERYONE to view and download? You cannot make it private again without deleting the public copy.")) return;
    setBusy(true);
    setMessage("");
    try {
      await uploadPublicPhoto(file);
      setMessage("Photo published to the community Gallery.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish photo.");
    } finally { setBusy(false); }
  }

  async function publishLocal(photo: LocalPhoto) {
    try {
      const response = await fetch(photo.data);
      const blob = await response.blob();
      const mime = ["image/jpeg", "image/png", "image/webp"].includes(blob.type) ? blob.type : "image/png";
      const extension = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
      await publish(new File([blob], `camera-or-local-${Date.now()}.${extension}`, { type: mime }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare photo for publishing.");
    }
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (photo.source === "local") {
      await onDeleteLocal(photo.id);
      setViewer(null);
      return;
    }
    if (!window.confirm("Permanently delete this public photo?")) return;
    setBusy(true);
    const { error: deleteError } = await supabase.storage.from(GALLERY_BUCKET).remove([`photos/${photo.id}`]);
    if (deleteError) setError(`Delete denied: ${deleteError.message}`);
    else { setViewer(null); setMessage("Public photo deleted."); await refresh(); }
    setBusy(false);
  }

  async function signIn() {
    setBusy(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) setError(loginError.message);
    else { setShowLogin(false); setPassword(""); setMessage("Signed in."); }
    setBusy(false);
  }

  return (
    <section className="oxygen-unified-gallery">
      <header className="unified-gallery-header">
        <div><p className="unified-eyebrow">OXYGEN PHOTOS</p><h2>Gallery</h2>
          <p>Your camera captures, saved photos, and community pictures — together.</p></div>
        <div className="unified-gallery-actions">
          <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={event => { void addLocal(event.target.files); }} />
          <button className="unified-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={17}/> Add photos
          </button>
          <button className="unified-icon-button" title="Refresh public photos" onClick={() => void refresh()}><RefreshCw size={17}/></button>
        </div>
      </header>
      <div className="unified-gallery-subbar">
        <span>{allPhotos.length} photos</span>
        <span><Camera size={14}/> Camera photos save here automatically</span>
        <span><Cloud size={14}/> Public photos sync with Supabase</span>
      </div>
      {localError && <p className="unified-error" role="alert">{localError}</p>}
      {error && <p className="unified-error" role="alert">{error}</p>}
      {message && <p className="unified-success" role="status">{message}</p>}
      {loadingLocal && <p className="unified-muted">Loading saved photos…</p>}
      {allPhotos.length === 0 && !loadingLocal ? (
        <div className="unified-empty"><ImagePlus size={40}/><h3>No photos yet</h3>
          <p>Take a picture in Camera or add photos from your device.</p></div>
      ) : (
        <div className="unified-photo-grid">
          {allPhotos.map(photo => (
            <button key={`${photo.source}-${photo.id}`} className="unified-photo-card" onClick={() => setViewer(photo)}>
              <img src={photo.url} alt={photo.name} loading="lazy"/>
              <span className="unified-photo-label">{photo.source === "local" ? "On this device" : "Community"}</span>
            </button>
          ))}
        </div>
      )}
      <footer className="unified-gallery-footer">
        <span><LockKeyhole size={14}/> Photos from Camera and Add photos stay private until you publish them.</span>
        <button onClick={() => setShowLogin(value => !value)}>{signedIn ? "Admin account" : "Admin login"}</button>
      </footer>
      {showLogin && <div className="unified-login">
        {signedIn ? <button onClick={() => { void supabase.auth.signOut(); setShowLogin(false); }}>Sign out</button> : <>
          <input type="email" placeholder="Admin email" value={email} onChange={event => setEmail(event.target.value)}/>
          <input type="password" placeholder="Password" value={password} onChange={event => setPassword(event.target.value)}/>
          <button disabled={busy} onClick={() => void signIn()}>Sign in</button>
        </>}
      </div>}
      {viewer && <div className="unified-photo-viewer" role="dialog" aria-label="Photo preview">
        <div className="unified-viewer-top"><strong>{viewer.source === "local" ? "Private photo" : "Public photo"}</strong>
          <button onClick={() => setViewer(null)} aria-label="Close"><X size={20}/></button></div>
        <img src={viewer.url} alt={viewer.name}/>
        <div className="unified-viewer-actions">
          <a href={viewer.url} download={viewer.name}><Download size={16}/> Download</a>
          {viewer.source === "local" && <button disabled={busy} onClick={() => {
            const local = localPhotos.find(item => item.id === viewer.id);
            if (local) void publishLocal(local);
          }}><UploadCloud size={16}/> Publish to everyone</button>}
          {(viewer.source === "local" || signedIn) && <button disabled={busy} className="unified-danger" onClick={() => void deletePhoto(viewer)}>
            <Trash2 size={16}/> Delete
          </button>}
        </div>
      </div>}
    </section>
  );
}
