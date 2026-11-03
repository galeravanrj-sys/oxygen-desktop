import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  supabase,
  GALLERY_BUCKET,
  uploadPublicPhoto,
} from "./supabase";

type Photo = {
  name: string;
  url: string;
};

export default function PublicGallery() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [viewer, setViewer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .list("photos", {
        limit: 100,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPhotos(
      (data ?? [])
        .filter(item => /\.(jpg|jpeg|png|webp)$/i.test(item.name))
        .map(item => ({
          name: item.name,
          url: supabase.storage
            .from(GALLERY_BUCKET)
            .getPublicUrl(`photos/${item.name}`).data.publicUrl,
        }))
    );
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPhotos();
    }, 0);

    const timer = window.setInterval(() => {
      void loadPhotos();
    }, 10000);

    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSignedIn(Boolean(session?.user));
      });

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      listener.subscription.unsubscribe();
    };
  }, [loadPhotos]);

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const publish = async () => {
    if (!file || busy) return;

    if (!window.confirm(
      "Publish this photo publicly? Everyone can view, download and share it."
    )) return;

    setBusy(true);
    setMessage("");

    try {
      await uploadPublicPhoto(file);
      setFile(null);
      setMessage("Photo published successfully!");
      await loadPhotos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setMessage(error ? error.message : "Signed in.");

    if (!error) {
      setShowLogin(false);
      setPassword("");
    }

    setBusy(false);
  };

  const remove = async (name: string) => {
    if (!window.confirm("Permanently delete this public photo?")) {
      return;
    }

    setBusy(true);

    const { error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .remove([`photos/${name}`]);

    setMessage(
      error ? `Delete failed: ${error.message}` : "Photo deleted."
    );

    await loadPhotos();
    setBusy(false);
  };

  return (
    <section className="oxygen-public-gallery">
      <h2>Public Gallery</h2>
      <p>Photos shared by the Oxygen Desktop community.</p>

      <div className="public-gallery-upload">
        <h3>Publish a photo</h3>
        <p>
          Only upload pictures you have permission to share.
          Published photos are visible to everyone.
        </p>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={selectPhoto}
        />

        <button
          disabled={!file || busy}
          onClick={() => void publish()}
        >
          {busy ? "Uploading..." : "Publish to Everyone"}
        </button>
      </div>

      {message && <p role="status">{message}</p>}

      <button onClick={() => void loadPhotos()}>
        Refresh Gallery
      </button>

      <div className="public-gallery-grid">
        {photos.map(photo => (
          <div className="public-gallery-card" key={photo.name}>
            <button
              className="public-gallery-photo"
              onClick={() => setViewer(photo.url)}
            >
              <img
                src={photo.url}
                alt="Public gallery photo"
                loading="lazy"
              />
            </button>

            {signedIn && (
              <button
                className="public-gallery-delete"
                disabled={busy}
                onClick={() => void remove(photo.name)}
              >
                Delete (admin only)
              </button>
            )}
          </div>
        ))}
      </div>

      {photos.length === 0 && (
        <p>No public photos yet.</p>
      )}

      {viewer && (
        <div className="public-gallery-viewer">
          <button onClick={() => setViewer("")}>Close</button>
          <img src={viewer} alt="Selected public photo" />
        </div>
      )}

      <div className="public-gallery-admin">
        {signedIn ? (
          <button onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        ) : (
          <button onClick={() => setShowLogin(!showLogin)}>
            Admin login
          </button>
        )}

        {showLogin && !signedIn && (
          <div className="public-admin-form">
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />

            <button disabled={busy} onClick={() => void login()}>
              Sign in
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
