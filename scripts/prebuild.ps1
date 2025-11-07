param(
  [ValidateSet("android","ios","both")]
  [string]$Platform = "android",
  [switch]$CleanOnly
)

Write-Host "==> Prebuild helper started (Platform=$Platform, CleanOnly=$CleanOnly)" -ForegroundColor Cyan

# 1) Σβήσε generated/native φακέλους
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

# 2) Εγκατάσταση node modules (ci -> fallback σε install)
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

# 3) Προαιρετικό αντίγραφο overrides (αν υπάρχουν)
$overrideRoot = "templates"
$androidOverrides = Join-Path $overrideRoot "android-overrides"
$iosOverrides = Join-Path $overrideRoot "ios-overrides"

function Copy-Overrides($from, $to) {
  if (Test-Path $from) {
    Write-Host " - Copy overrides from $from to $to"
    Copy-Item -Recurse -Force "$from\*" $to -ErrorAction SilentlyContinue
  }
}

# 4) Prebuild & Run
if ($Platform -eq "android" -or $Platform -eq "both") {
  Write-Host "==> expo prebuild -p android --clean"
  npx expo prebuild -p android --clean --non-interactive

  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if (Test-Path "android") {
    Copy-Overrides $androidOverrides "android"
  }

  # TIP: μην ανοίγεις emulator αυτόματα – άνοιξέ τον πρώτα μόνος σου
  Write-Host "==> npx expo run:android --no-open"
  npx expo run:android --no-open --variant debug --non-interactive
  exit $LASTEXITCODE
}

if ($Platform -eq "ios" -or $Platform -eq "both") {
  Write-Host "==> expo prebuild -p ios --clean"
  npx expo prebuild -p ios --clean --non-interactive
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if (Test-Path "ios") {
    Copy-Overrides $iosOverrides "ios"
  }

  Write-Host "==> npx expo run:ios --no-open"
  npx expo run:ios --no-open --non-interactive
  exit $LASTEXITCODE
}

Write-Host "==> Done." -ForegroundColor Green
