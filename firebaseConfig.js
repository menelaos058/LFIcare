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

// Παίρνουμε τα credentials από app.config.js › extra.firebase
const fb = Constants.expoConfig?.extra?.firebase ?? {};

const firebaseConfig = {
  apiKey: fb.apiKey,
  authDomain: fb.authDomain,
  projectId: fb.projectId,
  storageBucket: fb.storageBucket, // χρειάζεται για κανόνες/URL, όχι για web SDK
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth με AsyncStorage persistence (RN)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);

// ❗️Δεν εξάγουμε web storage εδώ
export { app, auth, db };
export default app;
