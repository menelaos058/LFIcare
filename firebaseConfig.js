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
  storageBucket: fb.storageBucket,
  messagingSenderId: fb.messagingSenderId,
  appId: fb.appId,
};

// Μία και μοναδική Firebase app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth με AsyncStorage persistence (RN)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);

// ΣΗΜ.: Δεν κάνουμε export storage (native uploads με @react-native-firebase/storage)
export { app, auth, db };
export default app;
