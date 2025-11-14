/** @type {import('@expo/cli').Config} */
module.exports = {
  name: "LFIcare",
  slug: "LFIcare",
  owner: "lamprian",
  scheme: "lficare",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.men.lficare",
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "We need access to your photos to share images in chat.",
      NSCameraUsageDescription:
        "We need access to your camera to send photos.",
      NSMicrophoneUsageDescription:
        "We need access to your microphone to record videos with sound."
    }
  },
  android: {
    package: "com.men.lficare",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    permissions: [
      "INTERNET",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_EXTERNAL_STORAGE"
    ],
    intentFilters: [
      {
        action: "VIEW",
        data: [{ scheme: "https", host: "lficare.app", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  web: {
    favicon: "./assets/images/favicon.png"
  },
  extra: {
    eas: { projectId: "774fe32f-e4a4-4763-b48e-c6804bc8dff4" }
  },
  plugins: [
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
          kotlinVersion: "1.9.25"
        },
        ios: {
          
        }
      }
    ]
  ]
};
