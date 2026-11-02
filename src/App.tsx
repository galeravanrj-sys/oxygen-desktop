
import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import {
  Images,
  Folder,
  Globe,
  Settings,
  CalendarDays,
  Calculator,
  Music,
  NotebookPen,
  Camera,
  Search,
  Wifi,
  BatteryFull,
  Bluetooth,
  Volume2,
  Sun,
  Power,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Upload,
  Trash2,
  ImagePlus,
  ChevronRight,
  Monitor,
  LayoutGrid,
  Columns2,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import "./App.css";

type Photo = {
  id: string;
  name: string;
  data: string;
};

type WindowMode = "normal" | "maximized" | "left" | "right";

type AppWindow = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: WindowMode;
  minimized: boolean;
  zIndex: number;
};

const apps = [
  { name: "Gallery", icon: Images, color: "pink" },
  { name: "Files", icon: Folder, color: "orange" },
  { name: "Browser", icon: Globe, color: "blue" },
  { name: "Settings", icon: Settings, color: "gray" },
  { name: "Calendar", icon: CalendarDays, color: "red" },
  { name: "Calculator", icon: Calculator, color: "purple" },
  { name: "Music", icon: Music, color: "yellow" },
  { name: "Notes", icon: NotebookPen, color: "green" },
  { name: "Camera", icon: Camera, color: "slate" },
];

const DB_NAME = "oxygen-desktop-gallery";
const STORE_NAME = "photos";

function openGalleryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSavedPhotos(): Promise<Photo[]> {
  const db = await openGalleryDB();

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => {
      resolve(request.result as Photo[]);
      db.close();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function savePhoto(photo: Photo): Promise<void> {
  const db = await openGalleryDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(photo);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function removePhoto(id: string): Promise<void> {
  const db = await openGalleryDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function App() {
  const [time, setTime] = useState(new Date());
  const [windows, setWindows] = useState<AppWindow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nextZ, setNextZ] = useState(10);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState("");

  const [startMenu, setStartMenu] = useState(false);
  const [quickSettings, setQuickSettings] = useState(false);
  const [search, setSearch] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(true);
  const [brightness, setBrightness] = useState(80);
  const [volume, setVolume] = useState(65);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    getSavedPhotos()
      .then(setPhotos)
      .catch(() => setGalleryError("Could not load saved photos."))
      .finally(() => setGalleryLoading(false));
  }, []);

  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedDate = time.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // OPEN AN APP OR BRING ITS WINDOW TO THE FRONT
  const launchApp = (name: string) => {
    const existing = windows.find((item) => item.name === name);

    setStartMenu(false);
    setQuickSettings(false);

    if (existing) {
      const newZ = nextZ + 1;

      setWindows((previous) =>
        previous.map((item) =>
          item.id === existing.id
            ? { ...item, minimized: false, zIndex: newZ }
            : item
        )
      );

      setActiveId(existing.id);
      setNextZ(newZ);
      return;
    }

    const newId = crypto.randomUUID();
    const newZ = nextZ + 1;

    const newWindow: AppWindow = {
      id: newId,
      name,
      x: 45 + windows.length * 28,
      y: 35 + windows.length * 24,
      width: 760,
      height: 510,
      mode: "normal",
      minimized: false,
      zIndex: newZ,
    };

    setWindows((previous) => [...previous, newWindow]);
    setActiveId(newId);
    setNextZ(newZ);
  };

  // FOCUS A WINDOW
  const focusWindow = (id: string) => {
    const newZ = nextZ + 1;

    setWindows((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, minimized: false, zIndex: newZ }
          : item
      )
    );

    setActiveId(id);
    setNextZ(newZ);
  };

  // MINIMIZE
  const minimizeWindow = (id: string) => {
    setWindows((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, minimized: true } : item
      )
    );

    if (activeId === id) {
      const nextWindow = windows
        .filter((item) => item.id !== id && !item.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];

      setActiveId(nextWindow?.id ?? null);
    }
  };

  // CLOSE
  const closeWindow = (id: string) => {
    setWindows((previous) => previous.filter((item) => item.id !== id));

    if (activeId === id) {
      const nextWindow = windows
        .filter((item) => item.id !== id && !item.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];

      setActiveId(nextWindow?.id ?? null);
    }
  };

  // MAXIMIZE OR RESTORE
const toggleMaximize = (id: string) => {
  setWindows((previous) =>
    previous.map((item) => {
      if (item.id !== id) return item;

      const restoring = item.mode !== "normal";

      return {
        ...item,
        mode: restoring ? "normal" : "maximized",
        x: restoring ? 45 : item.x,
        y: restoring ? 35 : item.y,
        width: restoring ? 760 : item.width,
        height: restoring ? 510 : item.height,
      };
    })
  );

  focusWindow(id);
};

  // SPLIT SCREEN
  const splitWindow = (id: string, side: "left" | "right") => {
    setWindows((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, mode: side, minimized: false }
          : item
      )
    );

    focusWindow(id);
  };

  const splitActiveWindows = () => {
    const visible = windows
      .filter((item) => !item.minimized)
      .sort((a, b) => b.zIndex - a.zIndex);

    if (visible.length < 2) return;

    const first = visible[0];
    const second = visible[1];

    setWindows((previous) =>
      previous.map((item) => {
        if (item.id === first.id) return { ...item, mode: "left" };
        if (item.id === second.id) return { ...item, mode: "right" };
        return item;
      })
    );
  };

  // PHOTO UPLOAD
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );

    setGalleryError("");

    for (const file of files) {
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Could not read image."));
            }
          };

          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        const photo: Photo = {
          id: crypto.randomUUID(),
          name: file.name,
          data,
        };

        await savePhoto(photo);
        setPhotos((previous) => [...previous, photo]);
      } catch {
        setGalleryError("Could not save a photo. Try a smaller image.");
      }
    }

    event.target.value = "";
  };

  const deletePhoto = async (id: string) => {
    try {
      await removePhoto(id);
      setPhotos((previous) => previous.filter((photo) => photo.id !== id));
      setGalleryError("");
    } catch {
      setGalleryError("Could not delete this photo.");
    }
  };

  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  // WINDOW SIZE AND POSITION
  const getWindowGeometry = (item: AppWindow) => {
    const availableWidth = Math.max(320, window.innerWidth - 30);
    const availableHeight = Math.max(260, window.innerHeight - 135);

    if (item.mode === "maximized") {
      return {
        x: 10,
        y: 10,
        width: availableWidth,
        height: availableHeight,
      };
    }

    if (item.mode === "left") {
      return {
        x: 10,
        y: 10,
        width: availableWidth / 2 - 8,
        height: availableHeight,
      };
    }

    if (item.mode === "right") {
      return {
        x: availableWidth / 2 + 6,
        y: 10,
        width: availableWidth / 2 - 8,
        height: availableHeight,
      };
    }

    return {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    };
  };

  return (
    <main className={`os-shell ${darkMode ? "dark-mode" : ""}`}>
      <div className="wallpaper">
        <div className="wallpaper-orb orb-one" />
        <div className="wallpaper-orb orb-two" />
        <div className="wallpaper-orb orb-three" />
      </div>

      {/* TOP SYSTEM BAR */}
      <header className="top-bar">
        <div className="top-brand">
          <div className="brand-mark">O</div>
          <span>Oxygen Desktop</span>
        </div>

        <div className="top-system">
          <span>{formattedTime}</span>

          <button
            className="system-button"
            onClick={() => setQuickSettings(!quickSettings)}
            aria-label="Quick settings"
          >
            <Wifi size={16} />
            <Bluetooth size={15} />
            <BatteryFull size={19} />
          </button>
        </div>
      </header>

      {/* DESKTOP */}
      <section className="desktop-area">
        <div className="desktop-welcome">
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          <h1>Good day.</h1>
          <p className="desktop-date">{formattedDate}</p>
        </div>

        <div className="desktop-shortcuts">
          {apps.slice(0, 4).map((app) => {
            const Icon = app.icon;

            return (
              <button
                className="desktop-shortcut"
                key={app.name}
                onDoubleClick={() => launchApp(app.name)}
                onClick={() => launchApp(app.name)}
              >
                <div className={`shortcut-icon ${app.color}`}>
                  <Icon size={25} />
                </div>
                <span>{app.name}</span>
              </button>
            );
          })}
        </div>

        <div className="desktop-widget">
          <div className="widget-top">
            <span>LOCAL TIME</span>
            <span className="clock-icon">◷</span>
          </div>

          <h2>{formattedTime}</h2>
          <p>{formattedDate}</p>

          <div className="widget-bottom">
            <span>Oxygen Desktop</span>
            <span>Welcome home</span>
          </div>
        </div>

        {/* MULTIPLE APP WINDOWS */}
        {windows.map((item) => {
          if (item.minimized) return null;

          const geometry = getWindowGeometry(item);
          const isActive = activeId === item.id;
          const isFixed = item.mode !== "normal";

          return (
            <Rnd
              key={item.id}
              bounds="parent"
              position={{ x: geometry.x, y: geometry.y }}
              size={{ width: geometry.width, height: geometry.height }}
              minWidth={320}
              minHeight={260}
              dragHandleClassName="app-window-titlebar"
              cancel=".window-controls, .window-controls *"
              disableDragging={isFixed}
              enableResizing={!isFixed}
              style={{
                zIndex: item.zIndex,
                display: "flex",
                flexDirection: "column",
              }}
              onMouseDown={() => focusWindow(item.id)}
              onDragStop={(_, data) => {
                setWindows((previous) =>
                  previous.map((win) =>
                    win.id === item.id
                      ? { ...win, x: data.x, y: data.y }
                      : win
                  )
                );
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                setWindows((previous) =>
                  previous.map((win) =>
                    win.id === item.id
                      ? {
                          ...win,
                          width: ref.offsetWidth,
                          height: ref.offsetHeight,
                          x: position.x,
                          y: position.y,
                        }
                      : win
                  )
                );
              }}
              className={`window-rnd ${isActive ? "window-active" : ""}`}
            >
              <section className="app-window">
                <div className="app-window-titlebar">
                  <div className="window-app-title">
                    <span className="window-dot" />
                    <strong>{item.name}</strong>
                  </div>

                  <div className="window-controls">
                    <button
                      title="Split left"
                      aria-label="Split window left"
                      onClick={() => splitWindow(item.id, "left")}
                    >
                      <PanelLeft size={15} />
                    </button>

                    <button
                      title="Split right"
                      aria-label="Split window right"
                      onClick={() => splitWindow(item.id, "right")}
                    >
                      <PanelRight size={15} />
                    </button>

                    <button
                      title="Minimize"
                      aria-label="Minimize window"
                      onClick={() => minimizeWindow(item.id)}
                    >
                      <Minus size={16} />
                    </button>

                    <button
                      title="Maximize or restore"
                      aria-label="Maximize or restore window"
                      onClick={() => toggleMaximize(item.id)}
                    >
                      {item.mode === "maximized" ? (
                        <Minimize2 size={15} />
                      ) : (
                        <Maximize2 size={15} />
                      )}
                    </button>

                    <button
                      title="Close"
                      aria-label="Close window"
                      onClick={() => closeWindow(item.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {item.name === "Gallery" ? (
                  <div className="gallery-app">
                    <div className="gallery-heading">
                      <div>
                        <p className="eyebrow">YOUR COLLECTION</p>
                        <h2>Gallery</h2>
                        <span>{photos.length} photos</span>
                      </div>

                      <button
                        className="upload-button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus size={18} />
                        Add photos
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={handlePhotoUpload}
                      />
                    </div>

                    {galleryError && (
                      <p className="gallery-error">{galleryError}</p>
                    )}

                    {galleryLoading ? (
                      <div className="gallery-empty">
                        <p>Loading your gallery...</p>
                      </div>
                    ) : photos.length === 0 ? (
                      <div className="gallery-empty">
                        <Images size={42} />
                        <h3>Your gallery is empty</h3>
                        <p>Add photos from your computer to start.</p>
                        <button
                          className="upload-button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={17} />
                          Upload photos
                        </button>
                      </div>
                    ) : (
                      <div className="photo-grid">
                        {photos.map((photo) => (
                          <article className="photo-card" key={photo.id}>
                            <img src={photo.data} alt={photo.name} />

                            <div className="photo-card-info">
                              <span title={photo.name}>{photo.name}</span>
                              <button
                                onClick={() => deletePhoto(photo.id)}
                                title="Delete photo"
                                aria-label={`Delete ${photo.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="generic-app">
                    <div className="generic-app-icon">
                      {(() => {
                        const app = apps.find(
                          (entry) => entry.name === item.name
                        );
                        const Icon = app?.icon ?? Monitor;
                        return <Icon size={38} />;
                      })()}
                    </div>

                    <h2>{item.name}</h2>
                    <p>
                      Welcome to {item.name}. This application is running
                      inside Oxygen Desktop.
                    </p>

                    {item.name === "Settings" && (
                      <div className="settings-options">
                        <button onClick={() => setDarkMode(!darkMode)}>
                          <Sun size={18} />
                          {darkMode ? "Light appearance" : "Dark appearance"}
                          <ChevronRight size={17} />
                        </button>

                        <button onClick={() => setQuickSettings(true)}>
                          <Wifi size={18} />
                          Quick settings
                          <ChevronRight size={17} />
                        </button>

                        <button onClick={splitActiveWindows}>
                          <Columns2 size={18} />
                          Split two open apps
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    )}

                    {item.name === "Files" && (
                      <p className="coming-soon">
                        File browsing features are coming soon.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </Rnd>
          );
        })}
      </section>

      {/* TASKBAR */}
      <footer className="taskbar">
        <button
          className={`taskbar-start ${startMenu ? "selected" : ""}`}
          onClick={() => {
            setStartMenu(!startMenu);
            setQuickSettings(false);
          }}
          aria-label="Open app launcher"
        >
          <LayoutGrid size={23} />
        </button>

        <div className="taskbar-divider" />

        <div className="taskbar-apps">
          {windows.map((item) => {
            const app = apps.find((entry) => entry.name === item.name);
            const Icon = app?.icon ?? Monitor;

            return (
              <button
                key={item.id}
                className={`taskbar-app ${
                  activeId === item.id ? "running" : ""
                } ${item.minimized ? "minimized" : ""}`}
                onClick={() => {
                  if (activeId === item.id && !item.minimized) {
                    minimizeWindow(item.id);
                  } else {
                    focusWindow(item.id);
                  }
                }}
                title={item.name}
              >
                <Icon size={21} />
                <span className="taskbar-running-dot" />
              </button>
            );
          })}
        </div>

        <div className="taskbar-right">
          <button
            className="taskbar-system"
            onClick={() => {
              setQuickSettings(!quickSettings);
              setStartMenu(false);
            }}
          >
            <Wifi size={16} />
            <Volume2 size={16} />
            <BatteryFull size={18} />
          </button>

          <div className="taskbar-clock">
            <strong>{formattedTime}</strong>
            <span>{time.toLocaleDateString()}</span>
          </div>
        </div>
      </footer>

      {/* START MENU */}
      {startMenu && (
        <div className="start-menu">
          <div className="start-menu-header">
            <div className="brand-mark">O</div>
            <div>
              <strong>Oxygen Desktop</strong>
              <span>Applications</span>
            </div>
          </div>

          <div className="start-search">
            <Search size={17} />
            <input
              placeholder="Search applications..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <p className="start-section-label">ALL APPLICATIONS</p>

          <div className="start-app-list">
            {filteredApps.map((app) => {
              const Icon = app.icon;

              return (
                <button
                  key={app.name}
                  onClick={() => launchApp(app.name)}
                >
                  <div className={`start-app-icon ${app.color}`}>
                    <Icon size={20} />
                  </div>
                  <span>{app.name}</span>
                  <ChevronRight size={16} />
                </button>
              );
            })}

            {filteredApps.length === 0 && (
              <p className="no-results">No applications found.</p>
            )}
          </div>

          <div className="start-menu-footer">
            <span>Oxygen Desktop</span>
            <button
              title="Power menu"
              onClick={() => setStartMenu(false)}
            >
              <Power size={18} />
            </button>
          </div>
        </div>
      )}

      {/* QUICK SETTINGS */}
      {quickSettings && (
        <div
          className="quick-settings"
          onClick={() => setQuickSettings(false)}
        >
          <div
            className="quick-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-heading">
              <div>
                <p className="eyebrow">CONTROL CENTER</p>
                <h2>{formattedTime}</h2>
                <span>{formattedDate}</span>
              </div>

              <button
                className="quick-close"
                onClick={() => setQuickSettings(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="quick-grid">
              <button
                className={wifi ? "enabled" : ""}
                onClick={() => setWifi(!wifi)}
              >
                <Wifi size={22} />
                <span>Wi-Fi</span>
                <small>{wifi ? "On" : "Off"}</small>
              </button>

              <button
                className={bluetooth ? "enabled" : ""}
                onClick={() => setBluetooth(!bluetooth)}
              >
                <Bluetooth size={22} />
                <span>Bluetooth</span>
                <small>{bluetooth ? "On" : "Off"}</small>
              </button>

              <button
                className={darkMode ? "enabled" : ""}
                onClick={() => setDarkMode(!darkMode)}
              >
                <Sun size={22} />
                <span>Appearance</span>
                <small>{darkMode ? "Dark" : "Light"}</small>
              </button>

              <button onClick={() => launchApp("Settings")}>
                <Settings size={22} />
                <span>Settings</span>
                <small>Open</small>
              </button>
            </div>

            <div className="quick-slider">
              <div>
                <Sun size={19} />
                <span>Brightness</span>
                <strong>{brightness}%</strong>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(event) =>
                  setBrightness(Number(event.target.value))
                }
              />
            </div>

            <div className="quick-slider">
              <div>
                <Volume2 size={19} />
                <span>Volume</span>
                <strong>{volume}%</strong>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) =>
                  setVolume(Number(event.target.value))
                }
              />
            </div>

            <div className="quick-footer">
              <span>
                <BatteryFull size={19} /> Battery 100%
              </span>
              <span>Oxygen Desktop</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
