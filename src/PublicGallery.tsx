import { galleryPhotoFile } from "./galleryPhotoFile";
import { usePublicGallerySync } from "./usePublicGallerySync";
import { siteConfirm } from "./websiteDialogStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Camera, Cloud, Download, ImagePlus, LockKeyhole, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { supabase, GALLERY_BUCKET, uploadPublicPhoto } from "./supabase";

type LocalPhoto = { id: string; name: string; data: string };
type GalleryPhoto = { id: string; name: string; url: string; source: "local" | "public" };

type Props = {
  localPhotos: LocalPhoto[];
  loadingLocal: boolean;
  localError: string;
  onSaveLocal: (file: File) => Promise<void>;
  onDeleteLocal: (id: string) => Promise<boolean>;
};

export default function PublicGallery({ localPhotos, loadingLocal, localError, onSaveLocal, onDeleteLocal }: Props) {
  const { photos: cloudPhotos, syncError, syncStatus, refresh, announce } = usePublicGallerySync();
  const [collection, setCollection] = useState<"all" | "local" | "public">("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<GalleryPhoto | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const viewerRef = useRef<HTMLDialogElement>(null);
  const [imageError, setImageError] = useState("");
  const viewerOpen = !!viewer;
  useEffect(() => {
    const node = viewerRef.current;
    if (!viewerOpen || !node) return;
    node.showModal();
    return () => { node.close(); };
  }, [viewerOpen]);
  const fileRef = useRef<HTMLInputElement>(null);
  const publishing = useRef(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => { if (alive) setSignedIn(Boolean(data.user)); }).catch(() => {});
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(Boolean(session?.user));
    });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, []);

  const allPhotos = useMemo<GalleryPhoto[]>(() => [
    ...localPhotos.map(photo => ({ id: photo.id, name: photo.name, url: photo.data, source: "local" as const })),
    ...cloudPhotos.map(photo => ({ id: photo.name, name: photo.name, url: photo.url, source: "public" as const })),
  ], [localPhotos, cloudPhotos]);

  const visiblePhotos = allPhotos.filter(photo => collection === "all" || photo.source === collection);

  const viewerIndex = viewer ? allPhotos.findIndex(photo => photo.id === viewer.id && photo.source === viewer.source) : -1;
  function changePhoto(offset: number) { if (allPhotos.length) setViewer(allPhotos[(viewerIndex + offset + allPhotos.length) % allPhotos.length]); }
  useEffect(() => {
    if (!viewer) return;
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector(".website-dialog[open]")) return;
      if (event.key === "Escape") { event.preventDefault(); setViewer(null); }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && allPhotos.length > 1) {
        event.preventDefault(); const offset = event.key === "ArrowLeft" ? -1 : 1;
        setViewer(allPhotos[(viewerIndex + offset + allPhotos.length) % allPhotos.length]);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [viewer, viewerIndex, allPhotos]);

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
    if (!(await siteConfirm("Publish this photo for EVERYONE to view and download? You cannot make it private again without deleting the public copy."))) return;
    setBusy(true);
    setMessage("");
    try {
      await uploadPublicPhoto(file);
      announce();
      setMessage("Photo published to the community Gallery.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish photo.");
    } finally { setBusy(false); }
  }

  async function publishLocal(photo: LocalPhoto) {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      await publish(galleryPhotoFile(photo.data, photo.name));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare photo for publishing.");
    } finally { publishing.current = false; setBusy(false); }
  }
  async function deletePhoto(photo: GalleryPhoto) {
    if (photo.source === "local") {
      if (await onDeleteLocal(photo.id)) setViewer(null);
      return;
    }
    if (!(await siteConfirm("Permanently delete this public photo?"))) return;
    setBusy(true);
    const { error: deleteError } = await supabase.storage.from(GALLERY_BUCKET).remove([`photos/${photo.id}`]);
    if (deleteError) setError(`Delete denied: ${deleteError.message}`);
    else { announce(); setViewer(null); setMessage("Public photo deleted."); await refresh(); }
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
        <span>{allPhotos.length} {allPhotos.length === 1 ? "photo" : "photos"}</span>
        <span><Camera size={14}/> Camera photos save here automatically</span>
        <span role="status" className="unified-sync-status"><Cloud size={14}/>{syncError ? "Auto-sync reconnecting" : syncStatus}</span>
      </div>
      <nav className="gallery-collections" aria-label="Photo collections">
        {([['all', 'All photos'], ['local', 'On device'], ['public', 'Community']] as const).map(([value, label]) => <button key={value} aria-pressed={collection === value} onClick={() => setCollection(value)}>{label}</button>)}
      </nav>
      {syncError && <p className="unified-error" role="alert">{syncError}</p>}
      {localError && <p className="unified-error" role="alert">{localError}</p>}
      {error && <p className="unified-error" role="alert">{error}</p>}
      {message && <p className="unified-success" role="status">{message}</p>}
      {loadingLocal && <p className="unified-muted">Loading saved photos…</p>}
      {visiblePhotos.length === 0 && !loadingLocal ? (
        <div className="unified-empty"><ImagePlus size={40}/><h3>No photos yet</h3>
          <p>Take a picture in Camera or add photos from your device.</p></div>
      ) : (
        <div className="unified-photo-grid">
          {visiblePhotos.map(photo => (
            <button key={`${photo.source}-${photo.id}`} className="unified-photo-card" onClick={() => { setError(""); setMessage(""); setViewer(photo); }}>
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
      {viewer && <dialog ref={viewerRef} className="unified-photo-viewer" aria-label="Photo preview" onCancel={event => { event.preventDefault(); setViewer(null); }} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); setViewer(null); } }}>
        <div className="unified-viewer-top"><div className="unified-viewer-title"><strong>{viewer.source === "local" ? "Private photo" : "Public photo"}</strong><small>{viewer.name}</small></div>
          <button onClick={() => setViewer(null)} aria-label="Close"><X size={20}/></button></div>
        <div className="unified-viewer-stage">{imageError === viewer.url ? <p role="status">This image could not be loaded. You can still browse other photos.</p> : <img src={viewer.url} alt={viewer.name} onError={() => setImageError(viewer.url)}/>}</div>
        <div className="unified-viewer-actions">
          <button aria-label="Previous photo" disabled={allPhotos.length < 2} onClick={() => changePhoto(-1)}><ChevronLeft size={18}/></button><span>{viewerIndex < 0 ? "No longer in Gallery" : `${viewerIndex + 1} / ${allPhotos.length}`}</span><button aria-label="Next photo" disabled={allPhotos.length < 2} onClick={() => changePhoto(1)}><ChevronRight size={18}/></button>
          <a href={viewer.url} download={viewer.name}><Download size={16}/> Download</a>
          {viewer.source === "local" && <button disabled={busy} onClick={() => {
            const local = localPhotos.find(item => item.id === viewer.id);
            if (local) void publishLocal(local);
          }}><UploadCloud size={16}/> {busy ? "Publishing…" : "Publish to everyone"}</button>}
          {(viewer.source === "local" || signedIn) && <button disabled={busy} className="unified-danger" onClick={() => void deletePhoto(viewer)}>
            <Trash2 size={16}/> Delete
          </button>}
          {error && <p className="unified-viewer-feedback unified-error" role="alert">{error}</p>}
          {message && <p className="unified-viewer-feedback unified-success" role="status">{message}</p>}
        </div>
      </dialog>}
    </section>
  );
}
