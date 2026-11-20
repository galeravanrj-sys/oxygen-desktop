import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, useColorScheme } from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { AsyncStorage, DATA_KEY } from "../services/storage";
import { backendConfigured, supabase } from "../services/supabase";
import { emptyData, validateData } from "../lib/dataValidation";
import type { MobileData } from "../types/models";
type Update = <K extends keyof MobileData>(
  key: K,
  value: MobileData[K] | ((previous: MobileData[K]) => MobileData[K]),
) => void;
type Context = {
  data: MobileData;
  update: Update;
  replace: (data: MobileData) => void;
  ready: boolean;
  error: string;
  dismissError: () => void;
  session: Session | null;
  authReady: boolean;
  offline: boolean;
  dark: boolean;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyData),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [session, setSession] = useState<Session | null>(null),
    [authReady, setAuthReady] = useState(!backendConfigured);
  const dirty = useRef(false),
    writeQueue = useRef(Promise.resolve());
  const system = useColorScheme(),
    network = useNetInfo();
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(DATA_KEY)
      .then((raw) => {
        if (alive && raw) setData(validateData(JSON.parse(raw)));
      })
      .catch(() => {
        if (alive)
          setError(
            "Saved data could not be loaded. Keep your backup; do not clear app storage.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const update = useCallback<Update>((key, value) => {
    dirty.current = true;
    setData((previous) => ({
      ...previous,
      [key]:
        typeof value === "function"
          ? (value as (v: MobileData[typeof key]) => MobileData[typeof key])(
              previous[key],
            )
          : value,
    }));
  }, []);
  const replace = useCallback((next: MobileData) => {
    dirty.current = true;
    setData(validateData(next));
  }, []);
  useEffect(() => {
    if (!ready || !dirty.current) return;
    const raw = JSON.stringify(data);
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(DATA_KEY, raw))
      .catch(() =>
        setError(
          "Could not save your changes. Keep the app open and export a backup.",
        ),
      );
  }, [data, ready]);
  useEffect(() => {
    if (!backendConfigured) return;
    let alive = true;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          setAuthReady(true);
          if (error) setError(error.message || "Could not load your account.");
        }
      })
      .catch(() => {
        if (alive) {
          setAuthReady(true);
          setError(
            "Your saved sign-in could not be loaded. Try signing in again.",
          );
        }
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        if (alive) {
          setSession(next);
          setAuthReady(true);
        }
      },
    );
    const refresh = (state: string) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState || "active");
    const sub = AppState.addEventListener("change", refresh);
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  const dark =
    data.settings.theme === "system"
      ? system === "dark"
      : data.settings.theme === "dark";
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const accent = readableAccent(
    data.settings.accent,
    [base.colors.surface, base.colors.surfaceVariant],
    dark,
  );
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: accent,
      onPrimary: contrastInk(accent),
    },
  };
  return (
    <AppContext.Provider
      value={{
        data,
        update,
        replace,
        ready,
        error,
        dismissError: () => setError(""),
        session,
        authReady,
        offline:
          network.isConnected === false ||
          network.isInternetReachable === false,
        dark,
      }}
    >
      <PaperProvider theme={theme}>
        <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
          {children}
        </ThemeProvider>
      </PaperProvider>
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider is missing.");
  return value;
}
export function contrastInk(hex: string) {
  const values = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2] > 0.179
    ? "#000000"
    : "#ffffff";
}
function readableAccent(hex: string, surfaces: string[], dark: boolean) {
  const rgb = (color: string) =>
    color.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
      : (color.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
  const luminance = (color: string) =>
    rgb(color)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const original = rgb(hex);
  let result = hex;
  for (let step = 0; step <= 20; step++) {
    result =
      "#" +
      original
        .map((v) =>
          Math.round(v + (((dark ? 255 : 0) - v) * step) / 20)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    const ink = luminance(result);
    if (
      surfaces.every((surface) => {
        const background = luminance(surface);
        return (
          (Math.max(ink, background) + 0.05) /
            (Math.min(ink, background) + 0.05) >=
          4.5
        );
      })
    )
      break;
  }
  return result;
}
