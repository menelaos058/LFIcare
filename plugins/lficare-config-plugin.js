// plugins/lficare-config-plugin.js
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withGradleProperties,
  withAppBuildGradle,
  createRunOncePlugin,
  AndroidConfig,
  withDangerousMod,
} = require('@expo/config-plugins');

const PLUGIN_NAME = 'lficare-config-plugin';
const PLUGIN_VERSION = '1.0.0';

function ensureArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function addPermissionIfMissing(manifest, name) {
  manifest.manifest['uses-permission'] = ensureArray(
    manifest.manifest['uses-permission']
  );
  const exists = manifest.manifest['uses-permission'].some(
    (p) => p.$?.['android:name'] === name
  );
  if (!exists) {
    manifest.manifest['uses-permission'].push({
      $: { 'android:name': name },
    });
  }
}

function addIntentFilterScheme(activity, scheme) {
  activity['intent-filter'] = ensureArray(activity['intent-filter'] || []);
  const already = activity['intent-filter'].some((f) => {
    const data = ensureArray(f.data || []);
    return data.some((d) => d.$?.['android:scheme'] === scheme);
  });
  if (!already) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: [{ $: { 'android:scheme': scheme } }],
    });
  }
}

function withNetworkSecurityFile(config, opts = {}) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const androidAppPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        opts.debugOnly ? 'debug' : 'main',
        'res',
        'xml'
      );
      fs.mkdirSync(androidAppPath, { recursive: true });

      const filePath = path.join(
        androidAppPath,
        'network_security_config.xml'
      );

      const ip = opts.devLanIp || '192.168.1.2';
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
    <domain includeSubdomains="false">${ip}</domain>
  </domain-config>
</network-security-config>
`;
      fs.writeFileSync(filePath, xml, 'utf8');
      return cfg;
    },
  ]);
}

const withLFIcare = (config, props = {}) => {
  const {
    scheme = 'lficare',
    devLanIp = '192.168.1.2',
    debugCleartext = true, // μόνο για debug
  } = props;

  // 1) AndroidManifest edits
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // a) Permissions (όσα χρειάζεσαι σήμερα)
    [
      'android.permission.INTERNET',
      'android.permission.VIBRATE',
      'android.permission.RECORD_AUDIO',
      // Για σύγχρονα Android ΔΕΝ χρησιμοποιούμε WRITE/READ_EXTERNAL_STORAGE
      // Αν θες media access:
      // 'android.permission.READ_MEDIA_IMAGES',
      // 'android.permission.READ_MEDIA_VIDEO',
    ].forEach((perm) => addPermissionIfMissing(manifest, perm));

    // b) Cleartext / networkSecurityConfig (μόνο debug)
    if (debugCleartext) {
      app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      // Δεν χρειάζεται να βάλουμε usesCleartextTraffic αν έχουμε config file,
      // αλλά δεν βλάπτει στο debug:
      app.$['android:usesCleartextTraffic'] = 'true';
    }

    // c) Intent filters για custom scheme
    const mainActivity =
      AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    addIntentFilterScheme(mainActivity, scheme);
    addIntentFilterScheme(mainActivity, config.android?.package || 'com.lamprian.lficare');

    return cfg;
  });

  // 2) Γράψε το network_security_config.xml
  if (debugCleartext) {
    config = withNetworkSecurityFile(config, {
      devLanIp,
      debugOnly: true,
    });
  }

  // 3) Gradle properties (Hermes / New Arch / Architectures)
  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;

    const setProp = (k, v) => {
      const i = props.findIndex((p) => p.key === k);
      if (i >= 0) props[i].value = v;
      else props.push({ type: 'property', key: k, value: v });
    };

    setProp('newArchEnabled', 'true');
    setProp('hermesEnabled', 'true');
    setProp('reactNativeArchitectures', 'x86_64,arm64-v8a,armeabi-v7a');
    setProp('EX_DEV_CLIENT_NETWORK_INSPECTOR', 'true');

    return cfg;
  });

  // 4) App build.gradle — εξασφάλιση namespace/applicationId αν λείπει
  config = withAppBuildGradle(config, (cfg) => {
    const pkg = cfg.android?.package || 'com.lamprian.lficare';
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /namespace\s+['"].+?['"]/,
      `namespace '${pkg}'`
    );
    // Αν δεν υπάρχει καθόλου `namespace`, πρόσθεσέ το στο android { ... }
    if (!/namespace\s+['"].+?['"]/.test(cfg.modResults.contents)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android\s*\{/,
        `android {\n    namespace '${pkg}'`
      );
    }
    return cfg;
  });

  return config;
};

module.exports = createRunOncePlugin(withLFIcare, PLUGIN_NAME, PLUGIN_VERSION);
