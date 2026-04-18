// src/services/firebaseConfig.ts
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";

import type { Auth } from "firebase/auth";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";

import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

import type { Functions } from "firebase/functions";
import { getFunctions } from "firebase/functions";

import type { FirebaseStorage } from "firebase/storage";
import { getStorage } from "firebase/storage";

/**
 * Firebase config shape (web config keys)
 */
type FirebaseWebConfig = {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

/**
 * 1) Prefer EXPO_PUBLIC_* env vars (work in dev + EAS builds)
 */
const env: FirebaseWebConfig = {
  apiKey: process.env.EXPO_PUBLIC_FB_API_KEY,
  appId: process.env.EXPO_PUBLIC_FB_APP_ID,
  authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FB_MESSAGING_SENDER_ID,
};

/**
 * 2) Fallback to app.config.js › extra.firebase
 */
const fbExtra =
  (Constants?.expoConfig?.extra?.firebase as FirebaseWebConfig) ?? {};

const firebaseConfig = {
  apiKey: env.apiKey ?? fbExtra.apiKey,
  appId: env.appId ?? fbExtra.appId,
  authDomain: env.authDomain ?? fbExtra.authDomain,
  projectId: env.projectId ?? fbExtra.projectId,
  storageBucket: env.storageBucket ?? fbExtra.storageBucket,
  messagingSenderId: env.messagingSenderId ?? fbExtra.messagingSenderId,
};

// Optional debug check
if (!firebaseConfig.apiKey || !firebaseConfig.appId || !firebaseConfig.projectId) {
  console.warn("⚠️ Firebase config seems incomplete:", firebaseConfig);
}

/**
 * App initialization (singleton)
 */
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Auth with RN persistence
 * NOTE: We are NOT importing from "firebase/auth/react-native" because Metro couldn't resolve it.
 * We rely on getReactNativePersistence from "firebase/auth" (plus a .d.ts shim if TS complains).
 */
export const auth: Auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    // If already initialized (fast refresh / multiple imports)
    return getAuth(app);
  }
})();

/**
 * Firestore / Storage / Functions
 */
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, "europe-west1");