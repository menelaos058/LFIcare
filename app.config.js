// app.config.js
import 'dotenv/config';

export default ({ config }) => ({
  ...config,

  name: "LFIcare",
  slug: "lficare",
  scheme: "lficare",
  version: "1.0.0",
  runtimeVersion: { policy: "sdkVersion" },
  orientation: "portrait",

  icon: "./assets/images/icon.png",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },

  ios: {
    bundleIdentifier: "com.menelaos.lficare",
    buildNumber: "1",
    supportsTablet: false,
    deploymentTarget: "15.1",              
    infoPlist: {
      NSCameraUsageDescription: "Η κάμερα χρησιμοποιείται για λειτουργίες της εφαρμογής.",
      NSPhotoLibraryUsageDescription: "Η βιβλιοθήκη φωτογραφιών χρησιμοποιείται για επιλογή/αποστολή εικόνων.",
      NSPhotoLibraryAddUsageDescription: "Η εφαρμογή χρειάζεται πρόσβαση για αποθήκευση εικόνων."
    }
  },

  android: {
    package: "com.men.lficare",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    permissions: ["INTERNET", "CAMERA"],
    jsEngine: "hermes",
    intentFilters: [
          {
            action: "android.intent.action.SEND",
            categories: ["android.intent.category.DEFAULT"],
            dataMimeTypes: ["*/*"],
          },
          {
            action: "android.intent.action.SEND_MULTIPLE",
            categories: ["android.intent.category.DEFAULT"],
            dataMimeTypes: ["*/*"],
          },
        ],
  },

  updates: {
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/b8f57f4d-6894-4dcd-a21b-ddaf2fa2f638"
  },

  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? process.env.API_URL,
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FB_API_KEY ?? process.env.FB_API_KEY,
      appId: process.env.EXPO_PUBLIC_FB_APP_ID ?? process.env.FB_APP_ID,
      authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN ?? process.env.FB_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID ?? process.env.FB_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET ?? process.env.FB_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FB_MESSAGING_SENDER_ID ?? process.env.FB_MESSAGING_SENDER_ID
    },
    eas: { projectId: process.env.EAS_PROJECT_ID }
  },

 plugins: [
  [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 35,
        targetSdkVersion: 35,
        buildToolsVersion: "34.0.0",
        minSdkVersion: 24,
        kotlinVersion: "1.9.25",
        javaVersion: "17",
      },
      ios: {
        deploymentTarget: "15.1",
        activationRules: [{ extension: "public.data" }],
      },
    },
  ],
  // --- Inline plugin για react-native-share-menu (Android intent-filters) ---
  (config) => {
    const { withAndroidManifest } = require("@expo/config-plugins");

    return withAndroidManifest(config, (cfg) => {
      const manifest = cfg.modResults?.manifest;
      if (!manifest?.application?.[0]?.activity) return cfg;

      // Βρες MainActivity
      const activities = manifest.application[0].activity;
      const mainActivity =
        activities.find((a) => a.$["android:name"] === ".MainActivity") || activities[0];

      // Βεβαιώσου ότι υπάρχει array intent-filter
      mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];

      // helper για αποφυγή διπλοεγγραφής
      const hasIntent = (actionName) =>
        mainActivity["intent-filter"].some(
          (f) =>
            Array.isArray(f.action) &&
            f.action.some((a) => a.$["android:name"] === actionName)
        );

      // SEND (*/*)
      if (!hasIntent("android.intent.action.SEND")) {
        mainActivity["intent-filter"].push({
          action: [{ $: { "android:name": "android.intent.action.SEND" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
          data: [{ $: { "android:mimeType": "*/*" } }],
        });
      }

      // SEND_MULTIPLE (*/*)
      if (!hasIntent("android.intent.action.SEND_MULTIPLE")) {
        mainActivity["intent-filter"].push({
          action: [{ $: { "android:name": "android.intent.action.SEND_MULTIPLE" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
          data: [{ $: { "android:mimeType": "*/*" } }],
        });
      }

      return cfg;
    });
  },

  "expo-updates",
],


  assetBundlePatterns: ["**/*"]
});
