// scripts/restoreGradle.js
const fs = require('fs');
const path = require('path');

const backupDir = path.join(__dirname, '../backup_android_gradle');
const androidDir = path.join(__dirname, '../android');

const files = [
  'settings.gradle',
  'build.gradle',
  'app/build.gradle',
  'gradle.properties',
  'gradle/wrapper/gradle-wrapper.properties'
];

console.log('🔁 Restoring Gradle files from backup...');

files.forEach(file => {
  const backupPath = path.join(backupDir, path.basename(file));
  const targetPath = path.join(androidDir, file);

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, targetPath);
    console.log(`✅ Restored ${file}`);
  } else {
    console.warn(`⚠️ Missing in backup: ${backupPath}`);
  }
});

console.log('✅ Gradle files restored successfully!');
