#!/bin/sh
# Builds the Chromebook (installable web app) version from the shared app code in src/.
# Usage: sh chromebook/build.sh <output folder> <version>
# The GitHub Actions Pages job runs this into download/app/, so it's served at .../Isaac-s-Smart-School-Tool/app/.
set -eu
OUT="$1"
VERSION="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rm -rf "$OUT"
mkdir -p "$OUT/vendor" "$OUT/icons"

# The app itself (same files as the Windows and Mac versions, minus the desktop-only ones).
cp "$ROOT"/src/*.html "$ROOT"/src/*.css "$ROOT"/src/*.js "$OUT/"
rm -f "$OUT/main.js" "$OUT/updater.js"
cp "$ROOT/node_modules/@supabase/supabase-js/dist/umd/supabase.js" "$OUT/vendor/supabase.js"

# Chromebook extras: app manifest, offline/auto-update worker, install button, icons.
cp "$ROOT/chromebook/manifest.webmanifest" "$ROOT/chromebook/sw.js" "$ROOT/chromebook/pwa.js" "$ROOT/chromebook/pwa.css" "$OUT/"
cp "$ROOT"/chromebook/icons/*.png "$OUT/icons/"

# Wire them into the page.
sed -i \
  -e 's|\.\./node_modules/@supabase/supabase-js/dist/umd/supabase\.js|vendor/supabase.js|' \
  -e 's|</head>|  <link rel="manifest" href="manifest.webmanifest">\n  <meta name="theme-color" content="#0b0e16">\n  <link rel="icon" href="icons/icon-192.png">\n  <link rel="stylesheet" href="pwa.css">\n</head>|' \
  -e 's|</body>|  <script src="pwa.js"></script>\n</body>|' \
  "$OUT/index.html"
sed -i "s/__VERSION__/$VERSION/g" "$OUT/sw.js" "$OUT/pwa.js"

echo "Chromebook app $VERSION built in $OUT"
