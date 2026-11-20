import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { makeSessionStorage } from "../lib/sessionStorage";
export const sessionStorage = makeSessionStorage(SecureStore);
export const DATA_KEY = "m8m8s-mobile-data-v1";
export { AsyncStorage };
