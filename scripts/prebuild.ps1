param(
  [ValidateSet("android","ios","both")]
  [string]$Platform = "android",
  [switch]$CleanOnly
)

Write-Host "==> Prebuild helper started (Platform=$Platform, CleanOnly=$CleanOnly)" -ForegroundColor Cyan

# Κάνε non-interactive όλα τα expo βήματα
$env:CI = "1"

# 1) Καθάρισμα generated φακέλων
$paths = @("android", "ios", ".gradle")
foreach ($p in $paths) {
  if (Test-Path $p) {
    Write-Host " - Removing $p ..."
    Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue
  }
}

if ($CleanOnly) {
  Write-Host "==> Clean completed." -ForegroundColor Green
  exit 0
}

# 2) Εγκατάσταση modules (ci -> fallback σε install)
if (Test-Path "package-lock.json") {
  Write-Host " - npm ci"
  npm ci
  if ($LASTEXITCODE -ne 0) {
    Write-Host " - npm ci failed, falling back to npm install" -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} else {
  Write-Host " - npm install (no lockfile)"
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Ensure-Avd() {
  # Αν υπάρχει adb & device, προχωράμε. Αλλιώς άνοιξε μόνος σου τον emulator πριν τρέξεις το script.
  $adb = "adb"
  $devices = & $adb devices
  if (-not ($devices -match "device`$")) {
    Write-Host "(!) Δεν βρέθηκε ενεργή συσκευή/emulator μέσω 'adb devices'." -ForegroundColor Yellow
    Write-Host "    Άνοιξε έναν emulator (ή σύνδεσε συσκευή) και ξανατρέξε το script." -ForegroundColor Yellow
  }
}

if ($Platform -eq "android" -or $Platform -eq "both") {
  Ensure-Avd

  Write-Host "==> expo prebuild -p android --clean"
  npx expo prebuild -p android --clean
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # 3) Build + Install με Gradle (αποφεύγουμε το 'expo run:android' για να μην ανοίγει emulator)
  Push-Location android
  Write-Host "==> ./gradlew app:assembleDebug"
  ./gradlew app:assembleDebug
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }

  Write-Host "==> ./gradlew app:installDebug"
  ./gradlew app:installDebug
  $installExit = $LASTEXITCODE
  Pop-Location
  if ($installExit -ne 0) { exit $installExit }

  # 4) Εκκίνηση activity
  Write-Host "==> adb shell am start -n com.lamprian.lficare/.MainActivity"
  adb shell am start -n com.lamprian.lficare/.MainActivity

  Write-Host "==> Done." -ForegroundColor Green
  exit 0
}

if ($Platform -eq "ios" -or $Platform -eq "both") {
  Write-Host "==> expo prebuild -p ios --clean"
  npx expo prebuild -p ios --clean
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "==> npx expo run:ios --non-interactive"
  npx expo run:ios
  exit $LASTEXITCODE
}

Write-Host "==> Done." -ForegroundColor Green
