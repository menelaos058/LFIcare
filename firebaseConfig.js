// firebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// 🔹 Πάρε τα runtime secrets από app.config.js › extra
//    Σε dev/managed: Constants.expoConfig?.extra
//    Σε κάποιες περιπτώσεις: Updates.manifest?.extra ως fallback
const extra =
  Constants.expoConfig?.extra ??
  (Updates?.manifest?.extra ?? {}); // προσοχή: μπορεί να είναι null σε κάποιες ροές

const fb = extra?.firebase ?? {};

export const firebaseConfig = {
  apiKey: fb.apiKey,
  authDomain: fb.authDomain,
  projectId: fb.projectId,
  storageBucket: fb.storageBucket,
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

// Προειδοποίηση αν λείπουν πεδία (συχνή αιτία auth/invalid-credential)
["apiKey", "appId", "projectId"].forEach((k) => {
  if (!firebaseConfig[k]) {
    console.warn(`⚠️ Firebase config missing: ${k}. Check app.config.js extra.firebase & your .env`);
  }
});

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// RN (Android/iOS): χρησιμοποιούμε AsyncStorage persistence
// Web: σκέτο getAuth
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export const db = getFirestore(app);
export const storage = getStorage(app); // << ΑΥΤΟ προσθέτουμε/εξάγουμε
export default app;
