// app.config.js
import 'dotenv/config';

export default ({ config }) => ({
  ...config,

  // --- App metadata ---
  name: "LFIcare",
  slug: "lficare",
  scheme: "lficare",
  version: "1.0.0",
  runtimeVersion: { policy: "sdkVersion" },

  orientation: "portrait",

  // --- Branding / assets ---
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },

  // --- iOS ---
  ios: {
    bundleIdentifier: "com.menelaos.lficare",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "Η κάμερα χρησιμοποιείται για λειτουργίες της εφαρμογής.",
      NSPhotoLibraryUsageDescription: "Η βιβλιοθήκη φωτογραφιών χρησιμοποιείται για επιλογή/αποστολή εικόνων.",
      NSPhotoLibraryAddUsageDescription: "Η εφαρμογή χρειάζεται πρόσβαση για αποθήκευση εικόνων."
    }
  },

  // --- Android ---
  android: {
    package: "com.menelaos.lficare",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    // Κράτα τα permissions λιτά· πρόσθεσε μόνο ό,τι πραγματικά χρειάζεται
    permissions: ["INTERNET", "CAMERA"]
  },

  // --- OTA Updates (EAS Update) ---
  // Μην βάζεις εδώ 'url' χειροκίνητα (αποφεύγουμε το "Invalid UUID appId").
  // Το EAS CLI θα προσθέσει μόνο του το updates.url όταν γίνει project:init / build:configure.
  updates: {
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0
    // url: "https://u.expo.dev/<AUTO-INSERTED-BY-EAS>"
  },

  // --- Public runtime config (διαθέσιμο στο client) ---
  // Tip: Για public variables προτιμάται prefix EXPO_PUBLIC_*. Βάζω fallback στα παλιά FB_* αν τα έχεις ήδη.
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? process.env.API_URL,
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FB_API_KEY ?? process.env.FB_API_KEY,
      appId: process.env.EXPO_PUBLIC_FB_APP_ID ?? process.env.FB_APP_ID,
      authDomain: process.env.EXPO_PUBLIC_FB_AUTH_DOMAIN ?? process.env.FB_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FB_PROJECT_ID ?? process.env.FB_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FB_STORAGE_BUCKET ?? process.env.FB_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FB_MESSAGING_SENDER_ID ?? process.env.FB_MESSAGING_SENDER_ID
    }
    // eas: { projectId: "<AUTO-INSERTED-BY-EAS>" }
  },

  // --- Plugins ---
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          // Κρίσιμα για σταθερά builds με AGP 8 (SDK 52)
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: "1.9.24",
          javaVersion: "17"
        }
      }
    ]
    // Αν χρησιμοποιήσεις στο μέλλον notifications/localization, πρόσθεσέ τα εδώ:
    // "expo-notifications",
    // "expo-localization",
  ]
});
