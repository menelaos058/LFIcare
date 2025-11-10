// firebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 1) Προτίμησε EXPO_PUBLIC_* envs (τρέχουν και σε dev & EAS builds)
const env = {
  apiKey: process.env.EXPO_PUBLIC_FB_API_KEY,
  appId: process.env.EXPO_PUBLIC_FB_APP_ID,
  authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FB_MESSAGING_SENDER_ID,
};

// 2) Fallback σε app.config.js › extra.firebase αν κάποιο λείπει
const fbExtra = Constants?.expoConfig?.extra?.firebase ?? {};
const firebaseConfig = {
  apiKey: env.apiKey ?? fbExtra.apiKey,
  appId: env.appId ?? fbExtra.appId,
  authDomain: env.authDomain ?? fbExtra.authDomain,
  projectId: env.projectId ?? fbExtra.projectId,
  storageBucket: env.storageBucket ?? fbExtra.storageBucket,
  messagingSenderId: env.messagingSenderId ?? fbExtra.messagingSenderId,
};

// Προαιρετικός έλεγχος (βοηθά debugging)
if (!firebaseConfig.apiKey || !firebaseConfig.appId || !firebaseConfig.projectId) {
  console.warn("⚠️ Firebase config seems incomplete:", firebaseConfig);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth με persistence
let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;
