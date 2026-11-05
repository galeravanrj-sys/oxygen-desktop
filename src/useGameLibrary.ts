import { useSyncExternalStore } from "react";
import { gameLibrarySnapshot, subscribeGameLibrary } from "./gamingPassportStore";
export function useGameLibrary() { return useSyncExternalStore(subscribeGameLibrary, gameLibrarySnapshot); }
