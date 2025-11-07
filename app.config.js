// app.config.js
require('dotenv').config();

module.exports = ({ config }) => ({
  ...config,
  name: "LFIcare",
  slug: "LFIcare",
  scheme: "lficare",
  version: "1.0.0",
  orientation: "portrait",
  sdkVersion: "52.0.0",
  platforms: ["android", "ios", "web"],
  newArchEnabled: true, // Reanimated 3.x
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.lamprian.lficare"
  },
  android: {
    package: "com.lamprian.lficare",
    minSdkVersion: 24,
    compileSdkVersion: 36,
    targetSdkVersion: 36,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    permissions: [
      "INTERNET",
      "RECORD_AUDIO",
      "VIBRATE",
      "SYSTEM_ALERT_WINDOW"
    ],
    intentFilters: [
      {
        action: "VIEW",
        category: ["BROWSABLE", "DEFAULT"],
        data: [
          { scheme: "lficare" },
          { scheme: "https" }
        ]
      }
    ]
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          minSdkVersion: 24,
          kotlinVersion: "1.9.25",
          // Αν ποτέ χρειαστείς extra CMake/Ninja/NDK ρυθμίσεις:
          // ndkVersion: "26.1.10909125",
          // packagingOptions: { doNotStrip: ["**/*.so"] }
        }
      }
    ]
  ],
  extra: {
    APP_ENV: process.env.APP_ENV,
    FB_API_KEY: process.env.FB_API_KEY,
    FB_AUTH_DOMAIN: process.env.FB_AUTH_DOMAIN,
    FB_PROJECT_ID: process.env.FB_PROJECT_ID,
    FB_STORAGE_BUCKET: process.env.FB_STORAGE_BUCKET,
    FB_MESSAGING_SENDER_ID: process.env.FB_MESSAGING_SENDER_ID,
    FB_APP_ID: process.env.FB_APP_ID
  },
  experiments: {
    typedRoutes: false
  }
});
