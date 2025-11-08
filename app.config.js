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
  newArchEnabled: true, 
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
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 24,
          kotlinVersion: "1.9.24",
        
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
    FB_APP_ID: process.env.FB_APP_ID,
    eas: {
        projectId: "774fe32f-e4a4-4763-b48e-c6804bc8dff4",
      },
  },
  experiments: {
    typedRoutes: false
  }
});
