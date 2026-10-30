#!/usr/bin/env bash
# Builds the zip to upload to the Chrome Web Store (also accepted by Edge
# Add-ons). The Firefox-only `browser_specific_settings` key is stripped so
# Chrome doesn't warn about an unrecognized manifest key.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/slopstopper-chrome-${version}.zip"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

cp -R src icons "$stage/"
python3 - "$stage/manifest.json" <<'EOF'
import json, sys
manifest = json.load(open("manifest.json"))
manifest.pop("browser_specific_settings", None)
with open(sys.argv[1], "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
EOF

mkdir -p dist
rm -f "$out"
(cd "$stage" && zip -qr -X - manifest.json src icons -x '.*') > "$out"
echo "wrote $out"
