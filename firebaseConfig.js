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

// Παίρνουμε τα credentials από app.config.js › extra.firebase
const fb = Constants.expoConfig?.extra?.firebase ?? {};

const firebaseConfig = {
  apiKey: fb.apiKey,
  authDomain: fb.authDomain,
  projectId: fb.projectId,
  storageBucket: fb.storageBucket,
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

// ➤ Μία και μοναδική Firebase App instance
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ➤ ΠΡΩΤΑ επιχειρούμε initializeAuth με AsyncStorage persistence.
//    Αν έχει ήδη γίνει init (π.χ. hot reload), κάνουμε fallback σε getAuth(app).
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// ➤ Οι υπόλοιπες υπηρεσίες από το ΙΔΙΟ app
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
export default app;
