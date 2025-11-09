// firebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Credentials από app.config.js › extra
const extra = Constants.expoConfig?.extra ?? {};
const fb = extra?.firebase ?? {};

export const firebaseConfig = {
  apiKey: fb.apiKey,
  authDomain: fb.authDomain,
  projectId: fb.projectId,
  storageBucket: fb.storageBucket,
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

// Single app instance
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Single auth instance με persistence (αν δεν υπάρχει ήδη)
let auth;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { app };
export const db = getFirestore(app);
export const storage = getStorage(app);
export { auth };
export default app;
