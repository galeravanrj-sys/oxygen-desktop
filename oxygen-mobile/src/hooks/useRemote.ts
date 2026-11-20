import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
type Result<T> = {
  key: string;
  data: T | null;
  error: string;
  loading: boolean;
  cached: boolean;
};
export function useRemote<T>(
  key: string,
  loader: () => Promise<T>,
  interval = 0,
  cache = true,
) {
  const loadRef = useRef(loader);
  useEffect(() => {
    loadRef.current = loader;
  }, [loader]);
  const lifecycle = useRef({
    active: false,
    generation: 0,
    sequence: 0,
    inFlight: 0,
  });
  const [state, setState] = useState<Result<T>>({
    key,
    data: null,
    error: "",
    loading: true,
    cached: false,
  });
  const refresh = useCallback(async () => {
    const life = lifecycle.current;
    if (!life.active || life.inFlight) return;
    const generation = life.generation,
      request = ++life.sequence;
    life.inFlight = request;
    const current = () => life.active && life.generation === generation;
    setState((old) =>
      old.key === key
        ? { ...old, loading: true }
        : { key, data: null, error: "", loading: true, cached: false },
    );
    try {
      const next = await loadRef.current();
      if (current()) {
        setState({ key, data: next, error: "", loading: false, cached: false });
        if (cache)
          await AsyncStorage.setItem(
            "m8-cache:" + key,
            JSON.stringify(next),
          ).catch(() => {});
      }
    } catch (error) {
      if (current())
        setState((old) => ({
          ...old,
          key,
          error:
            error instanceof Error
              ? error.message
              : "Check your connection and retry.",
          loading: false,
        }));
    } finally {
      if (life.inFlight === request) life.inFlight = 0;
    }
  }, [key, cache]);
  useFocusEffect(
    useCallback(() => {
      const life = lifecycle.current;
      life.active = true;
      const generation = ++life.generation;
      life.inFlight = 0;
      void (
        cache ? AsyncStorage.getItem("m8-cache:" + key) : Promise.resolve(null)
      )
        .then((raw) => {
          if (life.active && life.generation === generation && raw) {
            try {
              const data = JSON.parse(raw) as T;
              setState({ key, data, error: "", loading: true, cached: true });
            } catch {
              /* Invalid cache is replaced by the network result. */
            }
          }
        })
        .finally(() => {
          if (life.active && life.generation === generation) void refresh();
        });
      const sub = AppState.addEventListener("change", (status) => {
        if (status === "active") void refresh();
      });
      const timer = interval
        ? setInterval(() => {
            if (AppState.currentState === "active") void refresh();
          }, interval)
        : undefined;
      return () => {
        life.active = false;
        life.generation++;
        sub.remove();
        if (timer) clearInterval(timer);
      };
    }, [key, refresh, interval, cache]),
  );
  return {
    ...(state.key === key
      ? state
      : { key, data: null, error: "", loading: true, cached: false }),
    refresh,
  };
}
