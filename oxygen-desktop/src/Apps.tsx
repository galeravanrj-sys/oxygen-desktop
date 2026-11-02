
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "./Apps.css";

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
    return Array.isArray(value) && value.some((x) => x.id === ROOT)
      ? value
      : initial;
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
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [folder, setFolder] = useState(ROOT);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(entries));
    } catch {
      alert("Storage is full. Try smaller files.");
    }
  }, [entries]);

  const current = entries.find((entry) => entry.id === folder);

  const visible = entries
    .filter(
      (entry) =>
        entry.parent === folder &&
        entry.name.toLowerCase().includes(query.toLowerCase())
    )
    .sort(
      (a, b) =>
        Number(b.kind === "folder") - Number(a.kind === "folder")
    );

  const addFolder = () => {
    const name = prompt("Folder name?")?.trim();
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
    for (const file of Array.from(event.target.files || [])) {
      try {
        const data = await readFile(file);

        setEntries((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            parent: folder,
            name: file.name,
            kind: "file",
            data,
            mime: file.type,
          },
        ]);
      } catch {
        alert("Unable to read file.");
      }
    }

    event.target.value = "";
  };

  const remove = (id: string) => {
    if (!confirm("Delete this item and its contents?")) return;

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

  const rename = (id: string, name: string) => {
    const value = prompt("Rename", name)?.trim();
    if (!value) return;

    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, name: value } : entry
      )
    );
  };

  const move = (id: string) => {
    const destinations = entries.filter(
      (entry) => entry.kind === "folder" && entry.id !== id
    );

    const target = prompt("Move to folder name:", "Home");
    if (!target) return;

    const destination = destinations.find(
      (entry) => entry.name.toLowerCase() === target.toLowerCase()
    );

    if (!destination) {
      alert("Folder not found.");
      return;
    }

    let ancestor: string | null = destination.id;

    while (ancestor) {
      if (ancestor === id) {
        alert("Cannot move a folder inside itself.");
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
    <div className="ox-app">
      <div className="ox-toolbar">
        <button
          onClick={() => setFolder(current?.parent || ROOT)}
          disabled={folder === ROOT}
        >
          ← Back
        </button>

        <strong>📁 {current?.name || "Home"}</strong>

        <input
          placeholder="Search this folder"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button onClick={addFolder}>+ Folder</button>
        <button onClick={() => input.current?.click()}>Upload</button>

        <input
          ref={input}
          hidden
          type="file"
          multiple
          onChange={upload}
        />
      </div>

      <div className="ox-list">
        {visible.map((entry) => (
          <div className="ox-entry" key={entry.id}>
            <button
              className="ox-entry-main"
              onClick={() =>
                entry.kind === "folder"
                  ? setFolder(entry.id)
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
          <p className="ox-muted">This folder is empty.</p>
        )}
      </div>

      <p className="ox-muted">
        Files are stored in this browser, not in Windows folders.
        Large files may exceed browser storage.
      </p>
    </div>
  );
}

type Note = {
  id: string;
  title: string;
  body: string;
};

export function NotesApp() {
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("oxygen-notes-v1") || "[]");
    } catch {
      return [];
    }
  });

  const [id, setId] = useState("");

  useEffect(() => {
    localStorage.setItem("oxygen-notes-v1", JSON.stringify(notes));
  }, [notes]);

  const active = notes.find((note) => note.id === id);

  const update = (key: "title" | "body", value: string) => {
    setNotes((previous) =>
      previous.map((note) =>
        note.id === id ? { ...note, [key]: value } : note
      )
    );
  };

  return (
    <div className="ox-app ox-notes">
      <aside>
        <button
          onClick={() => {
            const note = {
              id: crypto.randomUUID(),
              title: "Untitled note",
              body: "",
            };

            setNotes((previous) => [note, ...previous]);
            setId(note.id);
          }}
        >
          + New note
        </button>

        {notes.map((note) => (
          <button key={note.id} onClick={() => setId(note.id)}>
            {note.title}
          </button>
        ))}
      </aside>

      <section>
        {active ? (
          <>
            <input
              value={active.title}
              onChange={(event) => update("title", event.target.value)}
            />

            <textarea
              value={active.body}
              onChange={(event) => update("body", event.target.value)}
              placeholder="Write your note..."
            />

            <button
              onClick={() => {
                setNotes((previous) =>
                  previous.filter((note) => note.id !== id)
                );
                setId("");
              }}
            >
              Delete note
            </button>
          </>
        ) : (
          <p>Select or create a note.</p>
        )}
      </section>
    </div>
  );
}

export function CalculatorApp() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState("");
  const [fresh, setFresh] = useState(false);

  const press = (key: string) => {
    if ("0123456789.".includes(key)) {
      if (key === "." && !fresh && display.includes(".")) return;

      setDisplay((previous) =>
        fresh || previous === "0"
          ? key === "." ? "0." : key
          : previous + key
      );
      setFresh(false);
      return;
    }

    if (key === "C") {
      setDisplay("0");
      setStored(null);
      setOperator("");
      return;
    }

    if (key === "±") {
      setDisplay((previous) => String(-Number(previous)));
      return;
    }

    if (key === "%") {
      setDisplay((previous) => String(Number(previous) / 100));
      return;
    }

    const a = stored;
    const b = Number(display);

    if (key === "=" && a !== null && operator) {
      const value =
        operator === "+"
          ? a + b
          : operator === "−"
            ? a - b
            : operator === "×"
              ? a * b
              : b === 0
                ? NaN
                : a / b;

      setDisplay(
        Number.isFinite(value)
          ? String(Number(value.toPrecision(12)))
          : "Error"
      );

      setStored(null);
      setOperator("");
      setFresh(true);
      return;
    }

    if (["+", "−", "×", "÷"].includes(key)) {
      setStored(b);
      setOperator(key);
      setFresh(true);
    }
  };

  return (
    <div className="ox-app ox-calc">
      <div className="ox-display">{display}</div>

      <div className="ox-calc-grid">
        {[
          "C", "±", "%", "÷",
          "7", "8", "9", "×",
          "4", "5", "6", "−",
          "1", "2", "3", "+",
          "0", ".", "=",
        ].map((key) => (
          <button key={key} onClick={() => press(key)}>
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

type EventItem = {
  id: string;
  date: string;
  title: string;
};

export function CalendarApp() {
  const [events, setEvents] = useState<EventItem[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("oxygen-events-v1") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [title, setTitle] = useState("");

  useEffect(() => {
    localStorage.setItem("oxygen-events-v1", JSON.stringify(events));
  }, [events]);

  return (
    <div className="ox-app">
      <h2>Calendar</h2>

      <div className="ox-toolbar">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />

        <input
          placeholder="Event title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <button
          onClick={() => {
            if (!title.trim()) return;

            setEvents((previous) => [
              ...previous,
              {
                id: crypto.randomUUID(),
                date,
                title: title.trim(),
              },
            ]);

            setTitle("");
          }}
        >
          Add event
        </button>
      </div>

      {events
        .filter((event) => event.date === date)
        .map((event) => (
          <div className="ox-entry" key={event.id}>
            <span>{event.title}</span>

            <button
              onClick={() =>
                setEvents((previous) =>
                  previous.filter((item) => item.id !== event.id)
                )
              }
            >
              Delete
            </button>
          </div>
        ))}

      <p className="ox-muted">Events for {date}</p>
    </div>
  );
}

type Tab = {
  id: string;
  url: string;
  input: string;
  history: string[];
  index: number;
};

const HOME = "https://example.com";


function address(raw: string) {
  const value = raw.trim();

  if (!value) return "https://example.com";

  // Keep full website addresses
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // Automatically add HTTPS to website addresses
  if (value.includes(".") && !value.includes(" ")) {
    return "https://" + value;
  }

  // Search using DuckDuckGo's HTML search page
  return (
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(value)
  );
}


export function BrowserApp() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: crypto.randomUUID(),
      url: HOME,
      input: HOME,
      history: [HOME],
      index: 0,
    },
  ]);

  const [id, setId] = useState(tabs[0].id);
  const active = tabs.find((tab) => tab.id === id) || tabs[0];

  const edit = (patch: Partial<Tab>) => {
    setTabs((previous) =>
      previous.map((tab) =>
        tab.id === id ? { ...tab, ...patch } : tab
      )
    );
  };


const go = (url: string) => {
  const target = address(url);

  // Keep navigation inside the Oxygen Desktop Browser
  edit({
    url: target,
    input: target,
    history: [
      ...active.history.slice(0, active.index + 1),
      target,
    ],
    index: active.index + 1,
  });
};



  const nav = (delta: number) => {
    const index = active.index + delta;

    if (index >= 0 && index < active.history.length) {
      edit({
        index,
        url: active.history[index],
        input: active.history[index],
      });
    }
  };

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("oxygen-bookmarks-v1") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "oxygen-bookmarks-v1",
      JSON.stringify(bookmarks)
    );
  }, [bookmarks]);

  return (
    <div className="ox-app ox-browser">
      <div className="ox-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.id === id ? "selected" : ""}
            onClick={() => setId(tab.id)}
          >
            {new URL(tab.url).hostname}

            <span
              onClick={(event) => {
                event.stopPropagation();

                if (tabs.length <= 1) return;

                setTabs((previous) =>
                  previous.filter((item) => item.id !== tab.id)
                );

                if (id === tab.id) {
                  setId(tabs.find((item) => item.id !== tab.id)!.id);
                }
              }}
            >
              {" ×"}
            </span>
          </button>
        ))}

        <button
          onClick={() => {
            const tab = {
              id: crypto.randomUUID(),
              url: HOME,
              input: HOME,
              history: [HOME],
              index: 0,
            };

            setTabs((previous) => [...previous, tab]);
            setId(tab.id);
          }}
        >
          +
        </button>
      </div>

      <form
        className="ox-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          go(active.input);
        }}
      >
        <button type="button" onClick={() => nav(-1)}>
          ←
        </button>

        <button type="button" onClick={() => nav(1)}>
          →
        </button>

        <button
          type="button"
          onClick={() => edit({ url: active.url })}
        >
          ↻
        </button>

        <input
          value={active.input}
          onChange={(event) =>
            edit({ input: event.target.value })
          }
        />

        <button type="submit">Go</button>

        <button
          type="button"
          onClick={() =>
            setBookmarks((previous) =>
              previous.includes(active.url)
                ? previous.filter((url) => url !== active.url)
                : [...previous, active.url]
            )
          }
        >
          ☆
        </button>

        <button
          type="button"
          onClick={() =>
            window.open(
              active.url,
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          Open externally ↗
        </button>
      </form>

      <div className="ox-bookmarks">
        {bookmarks.map((url) => (
          <button key={url} onClick={() => go(url)}>
            {new URL(url).hostname}
          </button>
        ))}
      </div>

      <iframe
        key={active.url}
        title="Web page"
        src={active.url}
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
      />

      <p className="ox-muted">
        Some websites refuse iframe embedding. Use Open externally
        for those sites.
      </p>
    </div>
  );
}

export function MusicApp({ volume = 65 }: { volume?: number }) {
  const [tracks, setTracks] = useState<
    { name: string; url: string }[]
  >([]);

  const [playing, setPlaying] = useState("");
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audio.current) {
      audio.current.volume = volume / 100;
    }
  }, [volume, playing]);

  return (
    <div className="ox-app">
      <h2>Music</h2>

      <input
        type="file"
        accept="audio/*"
        multiple
        onChange={(event) => {
          const items = Array.from(
            event.target.files || []
          ).map((file) => ({
            name: file.name,
            url: URL.createObjectURL(file),
          }));

          setTracks((previous) => [...previous, ...items]);
        }}
      />

      {tracks.map((track) => (
        <div className="ox-entry" key={track.url}>
          <button onClick={() => setPlaying(track.url)}>
            ▶ {track.name}
          </button>
        </div>
      ))}

      <audio
        ref={audio}
        controls
        autoPlay={!!playing}
        src={playing}
        style={{ width: "100%" }}
      />

      <p className="ox-muted">
        Uploaded tracks remain available until you refresh the page.
      </p>
    </div>
  );
}

export function CameraApp() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const [error, setError] = useState("");
  const [shot, setShot] = useState("");

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  useEffect(() => {
    return () => {
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const start = async () => {
    try {
      setError("");
      stop();

      stream.current =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
    } catch {
      setError("Camera unavailable or permission denied.");
    }
  };

  const capture = () => {
    const element = video.current;

    if (!element || !element.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;

    canvas
      .getContext("2d")
      ?.drawImage(element, 0, 0);

    setShot(canvas.toDataURL("image/png"));
  };

  return (
    <div className="ox-app">
      <div className="ox-toolbar">
        <button onClick={start}>Start camera</button>
        <button onClick={capture}>Capture</button>
        <button onClick={stop}>Stop camera</button>

        {shot && (
          <button
            onClick={() =>
              download(shot, "oxygen-camera.png")
            }
          >
            Save photo
          </button>
        )}
      </div>

      {error && <p>{error}</p>}

      <video
        ref={video}
        muted
        playsInline
        style={{
          width: "100%",
          maxHeight: 280,
          background: "#15151d",
        }}
      />

      {shot && (
        <img
          src={shot}
          alt="Captured"
          style={{ maxWidth: "100%", maxHeight: 180 }}
        />
      )}
    </div>
  );
}
