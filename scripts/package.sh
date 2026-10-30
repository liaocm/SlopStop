#!/usr/bin/env bash
# Zips the extension for upload to the Chrome Web Store, Edge Add-ons, or AMO.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
out="dist/slopstopper-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json src icons -x '.*'
echo "wrote $out"
