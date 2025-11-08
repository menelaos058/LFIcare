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
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#ffffff" },

  ios: {
    bundleIdentifier: "com.menelaos.lficare",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "Η κάμερα χρησιμοποιείται για λειτουργίες της εφαρμογής.",
      NSPhotoLibraryUsageDescription: "Η βιβλιοθήκη φωτογραφιών χρησιμοποιείται για επιλογή/αποστολή εικόνων."
    }
  },

  android: {
    package: "com.menelaos.lficare",
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ffffff" },
    permissions: ["INTERNET", "CAMERA"]
  },

  updates: {
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/YOUR-EAS-PROJECT-ID" // θα συμπληρωθεί μετά το eas build:configure
  },

  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    firebase: {
      apiKey: process.env.FB_API_KEY,
      appId: process.env.FB_APP_ID,
      authDomain: process.env.FB_AUTH_DOMAIN,
      projectId: process.env.FB_PROJECT_ID,
      storageBucket: process.env.FB_STORAGE_BUCKET,
      messagingSenderId: process.env.FB_MESSAGING_SENDER_ID
    },
    eas: { projectId: "YOUR-EAS-PROJECT-ID" } // αυτό θα το γράψει το CLI στο πρώτο configure
  },

  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          // Κρίσιμο για το πρόβλημά σου:
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: "1.9.24",
          javaVersion: "17"
        }
      }
    ],
    // πρόσθεσε εδώ ό,τι άλλο plugin χρησιμοποιείς, π.χ.:
    // "expo-notifications",
    // "expo-localization",
   
  ]
});
