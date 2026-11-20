import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useApp } from "./AppProvider";
import type { FileEntry } from "../types/models";
type AudioContextValue = {
  tracks: FileEntry[];
  current: FileEntry | undefined;
  playing: boolean;
  position: number;
  duration: number;
  play: (id: string) => void;
  toggle: () => void;
  next: (offset?: number) => void;
  seek: (seconds: number) => Promise<void>;
  volume: (value: number) => void;
  error: string;
};
const AudioContext = createContext<AudioContextValue | null>(null);
export function AudioProvider({ children }: { children: ReactNode }) {
  const { data } = useApp();
  const tracks = useMemo(
    () =>
      data.files.filter(
        (f) => f.kind === "file" && f.mime?.startsWith("audio/") && f.uri,
      ),
    [data.files],
  );
  const [active, setActive] = useState(""),
    [error, setError] = useState("");
  const player = useAudioPlayer(null, { keepAudioSessionActive: true }),
    status = useAudioPlayerStatus(player);
  const current = tracks.find((t) => t.id === active);
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() =>
      setError("Audio could not be initialized. Reopen the app to retry."),
    );
  }, []);
  const play = useCallback(
    (id: string) => {
      const track = tracks.find((t) => t.id === id);
      if (!track?.uri) return;
      try {
        player.replace({ uri: track.uri });
        player.play();
        player.setActiveForLockScreen(true, {
          title: track.name,
          artist: "M8M8S local library",
        });
        setActive(id);
        setError("");
      } catch {
        setError("This audio file could not be played. Choose another format.");
      }
    },
    [tracks, player],
  );
  function next(offset = 1) {
    if (!tracks.length) return;
    const index = tracks.findIndex((t) => t.id === active);
    play(tracks[(index + offset + tracks.length) % tracks.length].id);
  }
  useEffect(() => {
    const subscription = player.addListener("playbackStatusUpdate", (event) => {
      if (event.didJustFinish) {
        const index = tracks.findIndex((t) => t.id === active),
          track = tracks[index + 1];
        if (track?.uri) {
          play(track.id);
        }
      }
    });
    return () => subscription.remove();
  }, [active, player, tracks, play]);
  return (
    <AudioContext.Provider
      value={{
        tracks,
        current,
        playing: status.playing,
        position: status.currentTime,
        duration: status.duration,
        play,
        toggle: () => (status.playing ? player.pause() : player.play()),
        next,
        seek: (seconds) => player.seekTo(seconds),
        volume: (value) => {
          // Expo Audio exposes this native player property as its supported volume setter.
          // eslint-disable-next-line react-hooks/immutability
          player.volume = Math.max(0, Math.min(1, value));
        },
        error,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
export function useMusic() {
  const value = useContext(AudioContext);
  if (!value) throw new Error("AudioProvider is missing.");
  return value;
}
