// firebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp } from "firebase/app";
import {
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const { firebase } = Constants.expoConfig.extra ?? {};

export const firebaseConfig = {
  apiKey: firebase?.apiKey,
  authDomain: firebase?.authDomain,
  projectId: firebase?.projectId,
  storageBucket: firebase?.storageBucket,
  messagingSenderId: firebase?.messagingSenderId,
  appId: firebase?.appId,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

export default app;
