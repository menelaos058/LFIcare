// app.config.js
/** @type {import('@expo/cli').Config} */
module.exports = {
  name: "LFIcare",
  slug: "lficare",
  scheme: "lficare",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  updates: {
    url: "https://u.expo.dev/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // αν δεν έχεις EAS Update, μπορείς να το αφαιρέσεις
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.lficare",
    infoPlist: {
      NSPhotoLibraryUsageDescription: "We need access to your photos to share images in chat.",
      NSCameraUsageDescription: "We need access to your camera to send photos.",
      NSMicrophoneUsageDescription:
        "We need access to your microphone to record videos with sound.",
    },
  },
  android: {
    package: "com.lficare",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    permissions: [
      "INTERNET",
      // Android 13+ granular permissions
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      // backwards compatibility
      "android.permission.READ_EXTERNAL_STORAGE",
    ],
    // αν μιλάς με http dev server / emulator
    intentFilters: [
      {
        action: "VIEW",
        data: [{ scheme: "https", host: "lficare.app", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/images/favicon.png",
  },
  extra: {
    eas: { projectId: "YOUR-EAS-PROJECT-ID" },
    // ό,τι public env θέλεις να περάσεις (EXPO_PUBLIC_*)
  },
  plugins: [
    // κρατάμε μόνο expo plugins που είναι 100% safe
    "expo-file-system",
    "expo-image-picker",
    "expo-media-library",
    "expo-font",
    "expo-system-ui",
    "expo-splash-screen",
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: "1.9.25",
        },
        ios: {},
      },
    ],
  ],
};
