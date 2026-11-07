import NotificationsPage from "./NotificationsPage";
import NotificationSettings from "./NotificationSettings";
import useNotificationPolling from "./useNotificationPolling";
import { phoneNotifications, type PhoneOpen } from "./phoneNotifications";
import BrandLogo from "./BrandLogo";
import { isTauri } from "@tauri-apps/api/core";
import NativeMobileShell from "./NativeMobileShell";
import GlobalSearch, { type SearchHit } from "./GlobalSearch";
import HomeWidgets from "./HomeWidgets";
import "./DesktopExtras.css";
import WebsiteDialogs from "./WebsiteDialogs";
import { siteAlert, siteConfirm } from "./websiteDialogStore";
import CommunityChat from "./CommunityChat";
import { useDesktopMotion } from "./useDesktopMotion";
import "./DesktopMotion.css";
import DailyBriefing from "./DailyBriefing";
import GamingPassport from "./GamingPassport";
import ThemeStudio from "./ThemeStudio";
import GameNotifications from "./GameNotifications";
import type { GameNotice } from "./gameNotificationLogic";
import WeatherApp from "./WeatherApp";
import TodoApp from "./TodoApp";
import Personalization from "./Personalization";
import { accentInk, loadPreferences, PREF_KEY, themes, type Preferences } from "./desktopPreferences";
import FreeGamesApp from "./FreeGamesApp";
import SevenDSTierApp from "./SevenDSTierApp";
import WidgetsApp from "./WidgetsApp";
import "./App.css";
import "./Appearance.css";
import PublicGallery from "./PublicGallery";
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { Rnd } from "react-rnd";
import {
  Bell, MessageCircle, Sparkles, Gamepad2, Palette, CloudSun, ListChecks, Star, Gift, Crown, Images, Folder, Globe, Settings, CalendarDays, Calculator, Clock3,
  Music, NotebookPen, Camera, Search, Wifi, Bluetooth,
  BatteryFull, Volume2, Sun, X, Minus, Maximize2,
  Copy as WindowRestore, Square, Minimize2, PanelLeft, PanelRight, LayoutGrid,
  Columns2,
  Expand, RotateCcw
} from "lucide-react";
import {
  FilesApp, NotesApp, CalculatorApp, CalendarApp,
  BrowserApp, MusicApp, CameraApp
} from "./Apps";

type Mode = "normal" | "maximized" | "left" | "right" | "fullscreen";
type Win = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: Mode;
  minimized: boolean;
  zIndex: number;
};
type Photo = { id: string; name: string; data: string };

const apps = [
  { name: "Notifications", icon: Bell, color: "purple" },
  { name: "Community Chat", icon: MessageCircle, color: "blue" },
  { name: "Daily Briefing", icon: Sparkles, color: "purple" },
  { name: "Gaming Passport", icon: Gamepad2, color: "blue" },
  { name: "Theme Studio", icon: Palette, color: "pink" },
  { name: "Weather", icon: CloudSun, color: "blue" },
  { name: "To-do List", icon: ListChecks, color: "green" },
  { name: "Free Games", icon: Gift, color: "green" },
  { name: "Gallery", icon: Images, color: "pink" },
  { name: "Games Tierlist", icon: Crown, color: "purple" },
  { name: "Clock & Widgets", icon: Clock3, color: "blue" },
  { name: "Files", icon: Folder, color: "orange" },
  { name: "Browser", icon: Globe, color: "blue" },
  { name: "Settings", icon: Settings, color: "gray" },
  { name: "Calendar", icon: CalendarDays, color: "red" },
  { name: "Calculator", icon: Calculator, color: "purple" },
  { name: "Music", icon: Music, color: "yellow" },
  { name: "Notes", icon: NotebookPen, color: "green" },
  { name: "Camera", icon: Camera, color: "slate" }
];

const SESSION_KEY = "oxygen-session-v2";
const SETTINGS_KEY = "oxygen-settings-v2";
const DB_NAME = "oxygen-desktop-gallery";
const STORE_NAME = "photos";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function galleryDB(): Promise<IDBDatabase> {
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

async function galleryAll(): Promise<Photo[]> {
  const db = await galleryDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as Photo[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function galleryPut(photo: Photo) {
  const db = await galleryDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(photo);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function galleryDelete(id: string) {
  const db = await galleryDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

function fileToData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const nativeApp = isTauri();
  useNotificationPolling();
  const [announcementNotice, setAnnouncementNotice] = useState<string | undefined>();
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [navigation, setNavigation] = useState<(SearchHit & { request: string }) | null>(null);
  const motion = useDesktopMotion();
  const [interacting, setInteracting] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() => loadPreferences(apps.map(app => app.name)));
  const orderedApps = preferences.order.flatMap(name => apps.filter(app => app.name === name));
  const savePreferences = (next: Preferences) => { localStorage.setItem(PREF_KEY, JSON.stringify(next)); setPreferences(next); };
  const [tierNotice, setTierNotice] = useState<GameNotice | null>(null);
  const [offerNotice, setOfferNotice] = useState<GameNotice | null>(null);
  const [time, setTime] = useState(new Date());
  const [windows, setWindows] = useState<Win[]>(() =>
    readJSON<Win[]>(SESSION_KEY, []).filter(
      w => apps.some(a => a.name === w.name)
    )
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startMenu, setStartMenu] = useState(false);
  const [quickSettings, setQuickSettings] = useState(false);
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(() =>
    readJSON(SETTINGS_KEY, { darkMode: false }).darkMode
  );
  const [mobileFloating, setMobileFloating] = useState(() => readJSON(SETTINGS_KEY, { mobileFloating: false }).mobileFloating === true);
  const [wifi, setWifi] = useState(true);
  const [bluetooth, setBluetooth] = useState(true);
  const [brightness, setBrightness] = useState(80);
  const [volume, setVolume] = useState(65);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [galleryError, setGalleryError] = useState("");
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const isMobile = viewport.width <= 650;
  const mobileFullScreen = isMobile && !mobileFloating;
  const zRef = useRef(
    Math.max(10, ...readJSON<Win[]>(SESSION_KEY, []).map(w => w.zIndex))
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const resize = () => setViewport({
      width: window.innerWidth,
      height: window.innerHeight
    });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(windows));
  }, [windows]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ darkMode, mobileFloating }));
  }, [darkMode, mobileFloating]);

  useEffect(() => {
    galleryAll()
      .then(setPhotos)
      .catch(() => setGalleryError("Unable to load saved photos."))
      .finally(() => setLoadingPhotos(false));
  }, []);


  const topWindow = (list: Win[]) =>
    [...list].filter(w => !w.minimized).sort((a, b) => b.zIndex - a.zIndex)[0];

  const focus = (id: string) => {
    motion.cancel(id);
    if (windows.find(w => w.id === id)?.minimized) requestAnimationFrame(() => motion.reveal(id));
    const z = ++zRef.current;
    setWindows(previous => previous.map(w =>
      w.id === id ? { ...w, minimized: false, zIndex: z } : w
    ));
    setActiveId(id);
  };

  const launch = (name: string, notice?: GameNotice) => {
    setStartMenu(false);
    setQuickSettings(false);
    setContext(null);
    const existing = windows.find(w => w.name === name);
    if (notice?.kind === "tierlist") setTierNotice(notice);
    else if (!existing && name === "Games Tierlist") setTierNotice(null);
    if (notice?.kind === "freegames") setOfferNotice(notice);
    else if (!existing && name === "Free Games") setOfferNotice(null);
    if (existing) {
      focus(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    const z = ++zRef.current;
    setWindows(previous => [...previous, {
      id, name,
      x: 45 + (previous.length % 6) * 32,
      y: 35 + (previous.length % 6) * 26,
      width: Math.min(name === "Calculator" ? 360 : ["Daily Briefing", "Gaming Passport", "Theme Studio"].includes(name) ? 960 : 760, Math.max(320, viewport.width - 90)),
      height: Math.min(name === "Calculator" ? 560 : name === "Community Chat" ? 740 : name === "Daily Briefing" ? 780 : ["Gaming Passport", "Theme Studio"].includes(name) ? 720 : 510, Math.max(name === "Calculator" ? 500 : 260, viewport.height - 160)),
      mode: "normal",
      minimized: false,
      zIndex: z
    }]);
    setActiveId(id);
  };

  const openPhoneNotice = useEffectEvent((item: PhoneOpen) => {
    if (item.kind === "announcement" && item.announcementId) { setAnnouncementNotice("announcement:" + item.announcementId); launch("Notifications"); }
    else if (item.kind === "tierlist" && item.game && ["zzz", "genshin", "origin", "hsr", "grandcross"].includes(item.game)) {
      launch("Games Tierlist", { id: "phone:" + crypto.randomUUID(), kind: "tierlist", title: "Tier-list update", body: "", createdAt: Date.now(), read: true, game: item.game as GameNotice["game"] });
    } else if (item.kind === "freegames") launch("Free Games", { id: "phone:" + crypto.randomUUID(), kind: "freegames", title: "New giveaway", body: "", createdAt: Date.now(), read: true, offerId: item.offerId });
  });
  useEffect(() => {
    if (!nativeApp) return;
    let active = true;
    const consume = () => { void phoneNotifications<PhoneOpen>("consumeOpen").then(item => {
      if (active && item) openPhoneNotice(item);
    }).catch(() => {}); };
    const first = window.setTimeout(consume, 0);
    const visible = () => { if (document.visibilityState === "visible") consume(); };
    document.addEventListener("visibilitychange", visible); window.addEventListener("focus", consume);
    return () => { active = false; window.clearTimeout(first); document.removeEventListener("visibilitychange", visible); window.removeEventListener("focus", consume); };
  }, [nativeApp]);

  const close = async (id: string) => {
    if (!await motion.dismiss(id, "close")) return;
    setWindows(previous => {
      const remaining = previous.filter(w => w.id !== id);
      setActiveId(active => active === id ? topWindow(remaining)?.id ?? null : active);
      return remaining;
    });
  };

  const minimize = async (id: string) => {
    if (!await motion.dismiss(id, "minimize")) return;
    setWindows(previous => {
      const updated = previous.map(w => w.id === id ? { ...w, minimized: true } : w);
      setActiveId(active => active === id ? topWindow(updated)?.id ?? null : active);
      return updated;
    });
  };

  const mode = (id: string, value: Mode) => {
    setWindows(previous => previous.map(w =>
      w.id === id ? {
        ...w,
        mode: w.mode === value ? "normal" : value,
        minimized: false
      } : w
    ));
    focus(id);
  };

  const updateWindow = (id: string, patch: Partial<Win>) => {
    setWindows(previous => previous.map(w =>
      w.id === id ? { ...w, ...patch } : w
    ));
  };

  const splitTwo = async () => {
    const visible = [...windows].filter(w => !w.minimized)
      .sort((a, b) => b.zIndex - a.zIndex);
    if (visible.length < 2) {
      (await siteAlert("Open at least two apps first."));
      return;
    }
    setWindows(previous => previous.map(w =>
      w.id === visible[0].id ? { ...w, mode: "left" } :
      w.id === visible[1].id ? { ...w, mode: "right" } : w
    ));
  };

  const geometry = (w: Win) => {
    
    if (mobileFullScreen) {
      return {
        x: 0,
        y: 0,
        width: viewport.width,
        height: Math.max(200, viewport.height - 115),
      };
    }

    if (isMobile) {
      const availableHeight = Math.max(200, viewport.height - 115);
      if (w.mode !== "normal") return { x: 0, y: 0, width: viewport.width, height: availableHeight };
      const width = Math.min(Math.max(280, w.width), viewport.width - 16);
      const height = Math.min(Math.max(240, w.height), availableHeight - 16);
      return { x: Math.max(8, Math.min(w.x, viewport.width - width - 8)), y: Math.max(8, Math.min(w.y, availableHeight - height - 8)), width, height };
    }

    const width = Math.max(320, viewport.width - 30);
    const height = Math.max(260, viewport.height - 135);
    if (w.mode === "fullscreen") {
      return { x: 0, y: -45, width: viewport.width, height: viewport.height };
    }
    if (w.mode === "maximized") {
      return { x: 10, y: 10, width, height };
    }
    if (w.mode === "left") {
      return { x: 10, y: 10, width: width / 2 - 8, height };
    }
    if (w.mode === "right") {
      return { x: width / 2 + 6, y: 10, width: width / 2 - 8, height };
    }
    if (w.name === "Calculator") {
      const calcWidth = Math.min(Math.max(320, w.width), width);
      const calcHeight = Math.min(Math.max(500, w.height), height);
      return { x: Math.max(0, Math.min(w.x, viewport.width - calcWidth - 10)), y: Math.max(0, Math.min(w.y, height - calcHeight)), width: calcWidth, height: calcHeight };
    }
    return { x: w.x, y: w.y, width: w.width, height: w.height };
  };

  const saveCameraPhoto = async (data: string): Promise<void> => {
    const photo: Photo = {
      id: crypto.randomUUID(),
      name: `Camera-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      data,
    };

    await galleryPut(photo);

    setPhotos(previous => [...previous, photo]);
    setGalleryError("");
  };
  const removePhoto = async (id: string) => {
    if (!(await siteConfirm("Delete this photo?"))) return false;
    try {
      await galleryDelete(id);
      setPhotos(previous => previous.filter(p => p.id !== id));
      return true;
    } catch {
      setGalleryError("Could not delete photo.");
      return false;
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (!document.querySelector("dialog[open]")) setGlobalSearch(value => !value); return; }
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName) ||
        target.isContentEditable;
      if (event.key === "Escape") {
        setContext(null);
        setStartMenu(false);
        setQuickSettings(false);
          setWindows(previous => previous.map(w =>
          w.mode === "fullscreen" ? { ...w, mode: "normal" } : w
        ));
        return;
      }
      if (typing) return;
      if (event.key === "F11") {
        event.preventDefault();
        if (activeId) mode(activeId, "fullscreen");
      }
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setStartMenu(value => !value);
      }
      if (event.altKey && event.key === "F4" && activeId) {
        event.preventDefault();
        close(activeId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const formattedTime = time.toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit"
  });
  const formattedDate = time.toLocaleDateString([], {
    weekday: "long", month: "long", day: "numeric"
  });

  const appContent = (name: string, visible = true) => {
    switch (name) {
      case "Notifications": return <NotificationsPage key={announcementNotice || "history"} initialId={announcementNotice} onSettings={() => launch("Settings")} onOpen={notice => launch(notice.kind === "tierlist" ? "Games Tierlist" : "Free Games", notice)} />;
      case "Community Chat": return <CommunityChat active={visible} />;
      case "Daily Briefing": return <DailyBriefing time={time} onOpen={name => launch(name)} onNotice={notice => launch("Games Tierlist", notice)} onOffer={id => launch("Free Games", { id: `briefing-offer:${id}:${Date.now()}`, kind: "freegames", title: "Giveaway", body: "", offerId: id, createdAt: Date.now(), read: true })} />;
      case "Gaming Passport": return <GamingPassport key={navigation?.app === "Gaming Passport" ? navigation.request : "passport"} initialGameId={navigation?.app === "Gaming Passport" ? navigation.id : undefined} />;
      case "Theme Studio": return <ThemeStudio mobile={nativeApp} preferences={preferences} onChange={savePreferences} />;
      case "Weather": return <WeatherApp />;
      case "To-do List": return <TodoApp key={navigation?.app === "To-do List" ? navigation.request : "tasks"} initialTaskId={navigation?.app === "To-do List" ? navigation.id : undefined} />;
      case "Free Games": return <FreeGamesApp key={offerNotice?.id ?? "offers-home"} initialOfferId={offerNotice?.offerId} />;
      case "Games Tierlist": return <SevenDSTierApp key={tierNotice?.id ?? "tiers-home"} initialGame={tierNotice?.game} />;
      case "Clock & Widgets": return <WidgetsApp time={time} photoCount={photos.length} onOpenGallery={() => launch("Gallery")} onOpenCalendar={() => launch("Calendar")} />;
      case "Files": return <FilesApp />;
      case "Notes": return <NotesApp key={navigation?.app === "Notes" ? navigation.request : "notes"} initialId={navigation?.app === "Notes" ? navigation.id : undefined} />;
      case "Calculator": return <CalculatorApp />;
      case "Calendar": return <CalendarApp />;
      case "Browser": return <BrowserApp />;
      case "Music": return <MusicApp volume={volume} />;
      case "Camera": return <CameraApp onCapture={saveCameraPhoto} />;
      case "Gallery": return (
        <div className="gallery-app gallery-unified-shell">
          <PublicGallery
            localPhotos={photos}
            loadingLocal={loadingPhotos}
            localError={galleryError}
            onSaveLocal={async (file) => {
              const photo: Photo = {
                id: crypto.randomUUID(), name: file.name,
                data: await fileToData(file),
              };
              await galleryPut(photo);
              setPhotos(previous => [...previous, photo]);
            }}
            onDeleteLocal={removePhoto}
          />
        </div>
      );
      case "Settings": return (
        <div className="generic-app personal-settings-app">
          <div className="generic-app-icon"><Settings size={38} /></div>
          <h2>Settings</h2>
          <p>{nativeApp ? "Make your app feel like you." : "Personalize M8M8S and manage your windows."}</p>
          <div className="settings-options">
            <button onClick={() => launch("Theme Studio")}><Palette size={18}/> Open Theme Studio</button>
            <button onClick={() => setDarkMode(!darkMode)}>
              <Sun size={18} /> {darkMode ? "Light mode" : "Dark mode"}
            </button>
            {!nativeApp && <><button onClick={() => setQuickSettings(true)}>
              <Wifi size={18} /> Quick settings
            </button>
            <button onClick={splitTwo}>
              <Columns2 size={18} /> Split two open apps
            </button>
            <button onClick={async () => {
              if ((await siteConfirm("Close all open windows?"))) {
                setWindows([]);
                setActiveId(null);
              }
            }}>
              <RotateCcw size={18} /> Clear desktop session
            </button></>}
          </div>
          <NotificationSettings />
          <Personalization preferences={preferences} onChange={savePreferences} />
        </div>
      );
      default: return null;
    }
  };

  if (nativeApp) {
    const selected = windows.find(w => w.id === activeId && !w.minimized) ?? topWindow(windows);
    const home = () => { setWindows(previous => previous.map(w => ({ ...w, minimized: true }))); setActiveId(null); };
    return <NativeMobileShell apps={orderedApps} time={time} preferences={preferences} dark={darkMode}
      activeName={selected?.name} recent={[...windows].sort((a,b) => b.zIndex-a.zIndex).map(w => w.name)}
      onLaunch={name => launch(name)} onHome={home} onCloseApp={() => { if (selected) void close(selected.id).then(home); }}
      onSearch={() => setGlobalSearch(true)} onWidgets={() => setWidgetsOpen(true)}
      notifications={<GameNotifications onShow={() => { setAnnouncementNotice(undefined); launch("Notifications"); }} />}
      overlays={<><HomeWidgets time={time} onOpen={name => launch(name)} open={widgetsOpen} onClose={() => setWidgetsOpen(false)} />
        {globalSearch && <GlobalSearch apps={apps.map(app => app.name)} onClose={() => setGlobalSearch(false)} onSelect={hit => { setGlobalSearch(false); if (hit.kind !== "app") setNavigation({ ...hit, request: crypto.randomUUID() }); launch(hit.app); }} />}
        <WebsiteDialogs /></>}>
      {windows.filter(w => ["Music", "Browser", "Calculator", "Gaming Passport", "Community Chat"].includes(w.name) || w.id === selected?.id).map(w =>
        <div className="nm-app-surface" key={w.id} hidden={w.id !== selected?.id}>{appContent(w.name, w.id === selected?.id)}</div>)}
    </NativeMobileShell>;
  }

  return (
    <main className={`os-shell ${darkMode ? "dark-mode" : ""}`} data-mobile-floating={mobileFloating} data-icon-style={preferences.iconStyle} style={{ "--m8-accent": preferences.accent, "--m8-accent-ink": accentInk(preferences.accent), "--m8-window-opacity": preferences.windowOpacity } as CSSProperties}>
      <div className={`wallpaper ${preferences.wallpaper ? "wallpaper-custom" : ""}`} style={preferences.wallpaper ? { backgroundImage: `url("${preferences.wallpaper}")` } : preferences.theme !== "default" ? { background: themes[preferences.theme] } : undefined}>
        <div className="wallpaper-orb orb-one" />
        <div className="wallpaper-orb orb-two" />
        <div className="wallpaper-orb orb-three" />
      </div>

      <header className="top-bar">
        <div className="top-brand">
          <BrandLogo />
        </div>
        <div className="top-system">
          <span>{formattedTime}</span>
          <GameNotifications onShow={() => { setAnnouncementNotice(undefined); launch("Notifications"); }} />
          <button className="system-button" onClick={() => setQuickSettings(true)}>
            <Wifi size={16} /><Bluetooth size={15} /><BatteryFull size={19} />
          </button>
        </div>
      </header>

      <section className="desktop-area" onContextMenu={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        setContext({ x: event.clientX, y: event.clientY });
      }}>
        <div className="desktop-welcome">
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          <h1>Good day.</h1>
          <p className="desktop-date">{formattedDate}</p>
        </div>

        <div className="desktop-shortcuts">
          {orderedApps.map(app => {
            const Icon = app.icon;
            return (
              <button className="desktop-shortcut" key={app.name}
                onClick={() => launch(app.name)}>
                <div className={`shortcut-icon ${app.color}`}>
                  <Icon size={25} />
                </div>
                <span>{app.name}{preferences.favorites.includes(app.name) && <Star className="pa-home-star" size={11} fill="currentColor" aria-label="Favorite" />}</span>
              </button>
            );
          })}
        </div>


<div className="oxygen-mobile-apps">
  <div className="oxygen-mobile-section-title">
    <span>Applications</span>
    <span>{apps.length} apps</span>
  </div>

  <div className="oxygen-mobile-grid">
    {orderedApps.map(app => {
      const Icon = app.icon;

      return (
        <button
          key={app.name}
          className="oxygen-mobile-app"
          onClick={() => launch(app.name)}
        >
          <div className={`shortcut-icon ${app.color}`}>
            <Icon size={27} />
          </div>

          <span>{app.name}{preferences.favorites.includes(app.name) && <Star className="pa-home-star" size={11} fill="currentColor" aria-label="Favorite" />}</span>
        </button>
      );
    })}
  </div>
</div>


<HomeWidgets time={time} onOpen={name => launch(name)} open={widgetsOpen} onClose={() => setWidgetsOpen(false)} />

{windows
  .filter(w =>
    ["Music", "Browser", "Calculator", "Gaming Passport", "Community Chat"].includes(w.name) ||
    !w.minimized &&
    (!mobileFullScreen ||
      w.id === activeId ||
      (!activeId &&
        w.id === topWindow(windows)?.id))
  )
  .map(w => {

          const g = geometry(w);
          const fixed = w.mode !== "normal";
          const visible = !w.minimized && (!isMobile || w.id === activeId || (!activeId && w.id === topWindow(windows)?.id));
          return (
            <Rnd key={w.id} bounds="parent"
              position={{ x: g.x, y: g.y }}
              size={{ width: g.width, height: g.height }}
              minWidth={mobileFullScreen ? 0 : isMobile ? Math.min(280, viewport.width - 16) : 320}
              minHeight={isMobile ? (mobileFloating ? 240 : 0) : w.name === "Calculator" ? Math.min(500, Math.max(240, viewport.height - 135)) : 260}
              dragHandleClassName="app-window-titlebar"
              cancel=".window-controls, .window-controls *"
              disableDragging={mobileFullScreen || fixed}
              enableResizing={mobileFullScreen || fixed ? false : isMobile ? { bottomRight: true } : true}
              resizeHandleComponent={isMobile && mobileFloating ? { bottomRight: <span className="mobile-resize-grip" aria-label="Drag to resize window">◢</span> } : undefined}
              resizeHandleStyles={isMobile && mobileFloating ? { bottomRight: { width: 32, height: 32, right: 0, bottom: 0, zIndex: 5 } } : undefined}
              className={`window-rnd ${interacting === w.id ? "window-interacting" : ""} ${isMobile ? `mobile-window-rnd ${mobileFloating ? "mobile-floating-window" : ""}` : ""} ${activeId === w.id ? "window-active" : ""}`}
              style={{ "--mobile-window-z": 901 + windows.filter(item => item.zIndex < w.zIndex).length, zIndex: isMobile && mobileFloating ? 901 + windows.filter(item => item.zIndex < w.zIndex).length : w.zIndex, display: visible ? undefined : "none" } as CSSProperties}
              onTouchStart={() => { if (activeId !== w.id) focus(w.id); }}
              onMouseDown={() => {
                if (activeId !== w.id) focus(w.id);
              }}
              onDragStart={() => setInteracting(w.id)}
              onResizeStart={() => setInteracting(w.id)}
              onDragStop={(_, data) => {
                setInteracting(null);
                const edge = 30;
                const snapped =
                  isMobile ? "normal" :
                  data.x <= edge ? "left" :
                  data.x + g.width >= viewport.width - edge ? "right" :
                  data.y <= 0 ? "maximized" : "normal";
                updateWindow(w.id, {
                  x: data.x, y: data.y, mode: snapped
                });
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                setInteracting(null);
                updateWindow(w.id, {
                  x: position.x, y: position.y,
                  width: ref.offsetWidth, height: ref.offsetHeight
                });
              }}>
              <section ref={element => motion.register(w.id, element)} className={`app-window ${w.name === "Calculator" ? "calculator-window" : ""}`}>
                <div className="app-window-titlebar" onDoubleClick={event => { if (!(event.target as HTMLElement).closest("button")) mode(w.id, "maximized"); }}>
                  <div className="window-app-title">
                    {w.name === "Calculator" ? <Calculator size={13} /> : <span className="window-dot" />}
                    <strong>{w.name}</strong>
                  </div>
                  <div className="window-controls">
                    {isMobile && <button className="mobile-layout-toggle" title={mobileFloating ? "Use full-screen apps" : "Use floating windows"} onClick={() => setMobileFloating(value => !value)}><WindowRestore size={15}/></button>}
                    <button title="Snap left" onClick={() => mode(w.id, "left")}>
                      <PanelLeft size={15} />
                    </button>
                    <button title="Snap right" onClick={() => mode(w.id, "right")}>
                      <PanelRight size={15} />
                    </button>
                    <button title="Full screen" onClick={() => mode(w.id, "fullscreen")}>
                      <Expand size={15} />
                    </button>
                    <button title="Minimize" onClick={() => minimize(w.id)}>
                      <Minus size={16} />
                    </button>
                    <button className="window-maximize" title="Maximize or restore"
                      onClick={() => mode(w.id, "maximized")}>
                      {w.mode === "maximized"
                        ? (w.name === "Calculator" ? <WindowRestore size={12} /> : <Minimize2 size={15} />) : (w.name === "Calculator" ? <Square size={12} /> : <Maximize2 size={15} />)}
                    </button>
                    <button title="Close" onClick={() => close(w.id)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {appContent(w.name, visible && (!activeId || w.id === activeId))}
              </section>
            </Rnd>
          );
        })}
      </section>

      <footer className="taskbar">
        <button className={`taskbar-start ${startMenu ? "selected" : ""}`} aria-label="Open app launcher" aria-expanded={startMenu}
          onClick={() => {
            setStartMenu(!startMenu);
            setQuickSettings(false);
          }}>
          <LayoutGrid size={23} />
        </button>
        <button className={`taskbar-app ${widgetsOpen ? "running" : ""}`} title="Widgets" aria-label="Open widgets" onClick={() => setWidgetsOpen(true)}><CloudSun size={21}/></button>
        <button className="taskbar-app" title="Search desktop (Ctrl+K)" aria-label="Search desktop" onClick={() => setGlobalSearch(true)}><Search size={20}/></button>
        <div className="taskbar-divider" />
        <div className="taskbar-apps">
          {orderedApps.filter(app => preferences.favorites.includes(app.name) && !windows.some(w => w.name === app.name)).map(app => { const Icon = app.icon; return <button type="button" className="taskbar-app taskbar-favorite" key={app.name} title={`Open ${app.name} (favorite)`} onClick={() => launch(app.name)}><Icon size={21}/></button>; })}
          {windows.map(w => {
            const Icon = apps.find(a => a.name === w.name)?.icon || Folder;
            return (
              <button key={w.id}
                title={w.name}
                className={`taskbar-app ${activeId === w.id ? "running" : ""} ${w.minimized ? "minimized" : ""}`}
                onClick={() => {
                  if (activeId === w.id && !w.minimized) minimize(w.id);
                  else focus(w.id);
                }}>
                <Icon size={21} />
              </button>
            );
          })}
        </div>
        <div className="taskbar-right">
          <button className="taskbar-system"
            onClick={() => setQuickSettings(!quickSettings)}>
            <Wifi size={16} /><Volume2 size={16} /><BatteryFull size={18} />
          </button>
          <div className="taskbar-clock">
            <strong>{formattedTime}</strong>
            <span>{time.toLocaleDateString()}</span>
          </div>
        </div>
      </footer>

      {startMenu && (
        <div className="start-menu">
          <div className="start-menu-header">
            <BrandLogo />
            <div><strong>M8M8S</strong><span>Applications</span></div>
          </div>
          <div className="start-search">
            <Search size={17} />
            <input placeholder="Search applications..."
              value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <p className="start-section-label">ALL APPLICATIONS</p>
          <div className="start-app-list">
            {orderedApps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
              .map(app => {
                const Icon = app.icon;
                return (
                  <button key={app.name} onClick={() => launch(app.name)}>
                    <div className={`start-app-icon ${app.color}`}>
                      <Icon size={20} />
                    </div>
                    <span>{app.name}{preferences.favorites.includes(app.name) && <Star className="pa-home-star" size={11} fill="currentColor" aria-label="Favorite" />}</span>
                  </button>
                );
              })}
          </div>
          <div className="start-menu-footer">
            <span>Ctrl + Alt + L to toggle launcher</span>
          </div>
        </div>
      )}

      {quickSettings && (
        <div className="quick-settings" onClick={() => setQuickSettings(false)}>
          <div className="quick-panel" onClick={event => event.stopPropagation()}>
            <div className="quick-heading">
              <div>
                <p className="eyebrow">CONTROL CENTER</p>
                <h2>{formattedTime}</h2>
                <span>{formattedDate}</span>
              </div>
              <button className="quick-close"
                onClick={() => setQuickSettings(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="quick-grid">
              <button className={wifi ? "enabled" : ""}
                onClick={() => setWifi(!wifi)}>
                <Wifi size={22} /><span>Wi-Fi</span>
                <small>{wifi ? "On" : "Off"}</small>
              </button>
              <button className={bluetooth ? "enabled" : ""}
                onClick={() => setBluetooth(!bluetooth)}>
                <Bluetooth size={22} /><span>Bluetooth</span>
                <small>{bluetooth ? "On" : "Off"}</small>
              </button>
              <button className={darkMode ? "enabled" : ""}
                onClick={() => setDarkMode(!darkMode)}>
                <Sun size={22} /><span>Appearance</span>
                <small>{darkMode ? "Dark" : "Light"}</small>
              </button>
              <button onClick={() => launch("Settings")}>
                <Settings size={22} /><span>Settings</span><small>Open</small>
              </button>
            </div>
            <div className="quick-slider">
              <div><Sun size={19} /><span>Brightness</span><strong>{brightness}%</strong></div>
              <input type="range" min="0" max="100" value={brightness}
                onChange={event => setBrightness(Number(event.target.value))} />
            </div>
            <div className="quick-slider">
              <div><Volume2 size={19} /><span>Music volume</span><strong>{volume}%</strong></div>
              <input type="range" min="0" max="100" value={volume}
                onChange={event => setVolume(Number(event.target.value))} />
            </div>
            <p className="ox-muted">
              Wi-Fi, Bluetooth and brightness are simulated controls.
            </p>
          </div>
        </div>
      )}

      {context && (
        <div className="ox-context"
          style={{
            left: Math.min(context.x, viewport.width - 190),
            top: Math.min(context.y, viewport.height - 180)
          }}>
          <button onClick={() => { launch("Files"); setContext(null); }}>
            Open Files
          </button>
          <button onClick={() => { launch("Settings"); setContext(null); }}>
            Settings
          </button>
          <button onClick={() => {
            setWindows([]);
            setActiveId(null);
            setContext(null);
          }}>Close all windows</button>
          <button onClick={() => setContext(null)}>Dismiss</button>
        </div>
      )}
      {globalSearch && <GlobalSearch apps={apps.map(app => app.name)} onClose={() => setGlobalSearch(false)} onSelect={hit => { setGlobalSearch(false); if (hit.kind !== "app") setNavigation({ ...hit, request: crypto.randomUUID() }); launch(hit.app); }} />}
      <WebsiteDialogs />
    </main>
  );
}
