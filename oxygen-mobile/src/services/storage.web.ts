// Web preview uses the supported browser adapter. Android uses storage.ts + SecureStore.
import AsyncStorage from "@react-native-async-storage/async-storage";
export const sessionStorage = AsyncStorage;
export const DATA_KEY = "m8m8s-mobile-data-v1";
export { AsyncStorage };
