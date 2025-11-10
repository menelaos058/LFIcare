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

// ⚙️ Πάρε extra από όπου κι αν τρέχει (dev client, EAS build, OTA)
const extra =
  Constants.expoConfig?.extra ??
  Constants.manifestExtra /* παλιό */ ??
  {};

const fb = extra?.firebase ?? {};

const requiredKeys = [
  "apiKey",
  "appId",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
];
for (const k of requiredKeys) {
  if (!fb[k]) {
    throw new Error(
      `[FirebaseConfig] Missing "${k}" in extra.firebase. 
       Έλεγξε .env (EXPO_PUBLIC_FB_*) και το app.config.js -> extra.firebase`
    );
  }
}

const firebaseConfig = {
  apiKey: fb.apiKey,
  authDomain: fb.authDomain,
  projectId: fb.projectId,
  storageBucket: fb.storageBucket,
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

// Μία και μοναδική Firebase app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth με AsyncStorage persistence (RN)
let auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // σε hot-reload / διπλή init
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;
