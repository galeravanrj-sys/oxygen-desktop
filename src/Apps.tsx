import { sitePrompt, siteConfirm, siteAlert } from "./websiteDialogStore";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "./Apps.css";
import { Camera, Folder, Upload } from "lucide-react";

type Entry = {
  id: string;
  parent: string | null;
  name: string;
  kind: "folder" | "file";
  data?: string;
  mime?: string;
};

const ROOT = "root";
const STORE = "oxygen-files-v1";
const initial: Entry[] = [
  { id: ROOT, parent: null, name: "Home", kind: "folder" },
];

function loadEntries(): Entry[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) || "null");
    const valid = Array.isArray(value) ? value.filter((x): x is Entry => x && typeof x.id === "string" && typeof x.name === "string" && (x.parent === null || typeof x.parent === "string") && ["folder", "file"].includes(x.kind) && (x.kind === "folder" || typeof x.data === "string")) : [];
    return valid.some(x => x.id === ROOT && x.kind === "folder" && x.parent === null) ? valid : initial;
  } catch {
    return initial;
  }
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function download(data: string, name: string) {
  const link = document.createElement("a");
  link.href = data;
  link.download = name;
  link.click();
}

export function FilesApp() {
  const [entries, setSavedEntries] = useState<Entry[]>(loadEntries);
  const entriesRef = useRef(entries);
  const [storageError, setStorageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const setEntries = (update: Entry[] | ((previous: Entry[]) => Entry[])) => {
    const next = typeof update === "function" ? update(entriesRef.current) : update;
    try { localStorage.setItem(STORE, JSON.stringify(next)); entriesRef.current = next; setSavedEntries(next); setStorageError(""); return true; }
    catch { setStorageError("Could not save this change. Browser storage is full; download files you want to keep and remove unused items."); return false; }
  };
  const [folder, setFolder] = useState(ROOT);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);


  const current = entries.find((entry) => entry.id === folder);

  const visible = entries
    .filter(
      (entry) =>
        entry.parent === folder &&
        entry.name.toLowerCase().includes(query.toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name)
    );

  const addFolder = async () => {
    const name = (await sitePrompt("Folder name?"))?.trim();
    if (!name) return;

    setEntries((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        parent: folder,
        name,
        kind: "folder",
      },
    ]);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = ""; setUploading(true); setStorageError("");
    try { for (const file of files) {
      if (file.size > 2 * 1024 * 1024) { setStorageError("Choose files up to 2 MB for this browser file cabinet."); continue; }
      const data = await readFile(file);
      if (!setEntries(previous => [...previous, { id: crypto.randomUUID(), parent: folder, name: file.name, kind: "file", data, mime: file.type }])) break;
    } } catch { setStorageError("Unable to read this file. Please try another file."); } finally { setUploading(false); }
  };

  const remove = async (id: string) => {
    if (!(await siteConfirm("Delete this item and its contents?"))) return;

    setEntries((previous) => {
      const ids = new Set([id]);
      let changed = true;

      while (changed) {
        changed = false;

        for (const entry of previous) {
          if (
            entry.parent &&
            ids.has(entry.parent) &&
            !ids.has(entry.id)
          ) {
            ids.add(entry.id);
            changed = true;
          }
        }
      }

      return previous.filter((entry) => !ids.has(entry.id));
    });
  };

  const rename = async (id: string, name: string) => {
    const value = (await sitePrompt("Rename", name))?.trim();
    if (!value) return;

    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, name: value } : entry
      )
    );
  };

  const move = async (id: string) => {
    const destinations = entries.filter(
      (entry) => entry.kind === "folder" && entry.id !== id
    );

    const target = (await sitePrompt("Move to folder name:", "Home"));
    if (!target) return;

    const destination = destinations.find(
      (entry) => entry.name.toLowerCase() === target.toLowerCase()
    );

    if (!destination) {
      (await siteAlert("Folder not found."));
      return;
    }

    let ancestor: string | null = destination.id;

    while (ancestor) {
      if (ancestor === id) {
        (await siteAlert("Cannot move a folder inside itself."));
        return;
      }

      ancestor =
        entries.find((entry) => entry.id === ancestor)?.parent || null;
    }

    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? { ...entry, parent: destination.id }
          : entry
      )
    );
  };

  return (
    <div className="ox-app utility-app utility-files">
      <header className="utility-heading"><span className="utility-symbol"><Folder size={22}/></span><div><h2>Files</h2><p>A tidy place for small files on this browser.</p></div></header>
      <p className="utility-error" role="status">{storageError}</p>
      <div className="ox-toolbar">
        <button
          onClick={() => { setFolder(current?.parent || ROOT); setQuery(""); }}
          disabled={folder === ROOT}
        >
          ← Back
        </button>

        <strong>📁 {current?.name || "Home"}</strong>

        <input
          aria-label="Search this folder"
          placeholder="Search this folder"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button onClick={addFolder}>+ Folder</button>
        <button disabled={uploading} onClick={() => input.current?.click()}><Upload size={14}/> {uploading ? "Adding…" : "Upload"}</button>

        <input
          ref={input}
          hidden
          type="file"
          multiple
          onChange={upload}
        />
      </div>

      <div className="utility-file-summary"><span>{visible.length} {visible.length === 1 ? "item" : "items"}</span><span>Up to 2 MB per upload</span></div>
      <div className="ox-list">
        {visible.map((entry) => (
          <div className="ox-entry" key={entry.id}>
            <button
              className="ox-entry-main"
              onClick={() =>
                entry.kind === "folder"
                  ? (setFolder(entry.id), setQuery(""))
                  : entry.data && download(entry.data, entry.name)
              }
            >
              <span>{entry.kind === "folder" ? "📁" : "📄"}</span>
              <span>{entry.name}</span>
            </button>

            <button onClick={() => rename(entry.id, entry.name)}>
              Rename
            </button>

            <button onClick={() => move(entry.id)}>Move</button>

            {entry.kind === "file" && (
              <button
                onClick={() =>
                  setEntries((previous) => [
                    ...previous,
                    {
                      ...entry,
                      id: crypto.randomUUID(),
                      name: "Copy of " + entry.name,
                    },
                  ])
                }
              >
                Copy
              </button>
            )}

            <button onClick={() => remove(entry.id)}>Delete</button>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="utility-empty"><strong>{query ? "No matching files" : "A fresh folder"}</strong><p>{query ? "Try another search." : "Upload a small file or create a folder to get started."}</p></div>
        )}
      </div>

      <p className="ox-muted">
        Files are stored in this browser, not in Windows folders.
        Large files may exceed browser storage.
      </p>
    </div>
  );
}

export { NotesApp, CalculatorApp, CalendarApp, BrowserApp, MusicApp } from "./UtilityApps";

function disposeCamera(request: { current: number }, source: { current: MediaStream | null }) { request.current++; source.current?.getTracks().forEach(track => track.stop()); source.current = null; }

export function CameraApp({
  onCapture,
}: {
  onCapture?: (data: string) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const requestId = useRef(0);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [shot, setShot] = useState("");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  const stopTracks = () => {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(device => device.kind === "videoinput"));
    } catch {
      // Some browsers restrict camera enumeration.
    }
  };

  useEffect(() => {
    return () => {
      disposeCamera(requestId, stream);
    };
  }, []);

  const start = async (
    selectedFacing: "user" | "environment" = facing,
    selectedId = ""
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS or localhost and a supported browser.");
      return;
    }

    const currentRequest = ++requestId.current;

    setBusy(true);
    setError("");
    setMessage("");
    setRunning(false);

    stopTracks();

    if (video.current) {
      video.current.srcObject = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedId
          ? { deviceId: { exact: selectedId } }
          : {
              facingMode: { ideal: selectedFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      const newStream =
        await navigator.mediaDevices.getUserMedia(constraints);

      if (currentRequest !== requestId.current) {
        newStream.getTracks().forEach(track => track.stop());
        return;
      }

      stream.current = newStream;

      if (video.current) {
        video.current.srcObject = newStream;
        await video.current.play();
      }

      setRunning(true);
      setDeviceId(
        newStream.getVideoTracks()[0]?.getSettings().deviceId || ""
      );

      await refreshDevices();
    } catch (err) {
      if (currentRequest !== requestId.current) return;

      console.error("Camera error:", err);
      stopTracks();
      setError(
        "Unable to open this camera. Check permissions or select another camera."
      );
      setRunning(false);
    } finally {
      if (currentRequest === requestId.current) {
        setBusy(false);
      }
    }
  };

  const stop = () => {
    requestId.current++;
    stopTracks();

    if (video.current) {
      video.current.srcObject = null;
    }

    setRunning(false);
    setBusy(false);
    setMessage("");
  };

  const switchCamera = async () => {
    const next = facing === "user" ? "environment" : "user";

    setFacing(next);
    setDeviceId("");

    await start(next, "");
  };

  const selectCamera = async (id: string) => {
    setDeviceId(id);

    if (id) {
      await start(facing, id);
    }
  };

  const capture = async () => {
    const element = video.current;

    if (saving || !element || !element.videoWidth || !running) {
      setError("Start the camera before taking a picture.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture picture.");
      return;
    }

    context.drawImage(element, 0, 0);

    const photoData = canvas.toDataURL("image/png");

    setShot(photoData);
    setError("");
    setMessage("");

    if (onCapture) {
      setSaving(true);
      try {
        await onCapture(photoData);
        setMessage("Photo saved to Oxygen Desktop Gallery!");
      } catch {
        setError("Photo captured, but Gallery could not save it. You can still download it below.");
      } finally { setSaving(false); }
    }
  };

  return (
    <div className="ox-app utility-app utility-camera" style={{ overflowY: "auto" }}>
      <header className="utility-heading"><span className="utility-symbol"><Camera size={22}/></span><div><h2>Camera</h2><p>Capture a moment and keep it in your Gallery.</p></div></header>

      <div
        className="ox-toolbar"
        style={{ flexWrap: "wrap", gap: 8 }}
      >
        <button
          onClick={() => start(facing, "")}
          disabled={busy}
        >
          {busy ? "Opening..." : "Start Camera"}
        </button>

        <button
          onClick={switchCamera}
          disabled={busy}
        >
          🔄 Switch Front / Back
        </button>

        <button
          onClick={capture}
          disabled={!running || busy || saving}
        >
          {saving ? "Saving photo…" : "📸 Capture"}
        </button>

        <button onClick={stop}>
          Stop Camera
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          margin: "12px 0",
        }}
      >
        <label htmlFor="oxygen-camera-select">
          Choose Camera:
        </label>

        <select
          id="oxygen-camera-select"
          value={deviceId}
          disabled={busy}
          onChange={event => selectCamera(event.target.value)}
          style={{
            padding: 9,
            borderRadius: 8,
            maxWidth: "100%",
          }}
        >
          <option value="">Automatic camera</option>

          {devices.map((device, index) => (
            <option
              key={device.deviceId}
              value={device.deviceId}
            >
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>

        <button onClick={refreshDevices}>
          Refresh List
        </button>
      </div>

      <p className="ox-muted">
        Front camera is preferred initially. Use Switch Front / Back
        to request the other camera, or choose a camera manually.
        Available cameras depend on your device and browser.
      </p>

      {error && (
        <p style={{ color: "#e35b5b" }}>
          {error}
        </p>
      )}

      {message && (
        <p style={{ color: "#16a34a" }}>
          {message}
        </p>
      )}

      <div className="utility-camera-stage">
      {!running && <div className="utility-camera-placeholder"><Camera size={32}/><span>{busy ? "Opening your camera…" : "Choose Start Camera when you’re ready."}</span></div>}
      <video
        className={facing === "user" ? "mirrored" : ""}
        ref={video}
        autoPlay
        muted
        playsInline
        style={{
          display: "block",
          width: "100%",
          maxHeight: 380,
          objectFit: "contain",
          borderRadius: 14,
          background: "#15151d",
        }}
      />
      </div>

      {shot && (
        <div style={{ marginTop: 16 }}>
          <h3>Last Captured Photo</h3>

          <img
            src={shot}
            alt="Last captured photo"
            style={{
              maxWidth: "100%",
              maxHeight: 220,
              borderRadius: 12,
              objectFit: "contain",
            }}
          />

          <div style={{ marginTop: 10 }}>
            <button
              onClick={() =>
                download(shot, "oxygen-camera.png")
              }
            >
              Download Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
