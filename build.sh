#!/usr/bin/env bash
set -euo pipefail

# Publish only the website, never repository metadata or workspace files.
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
cp index.html shop.html product.html thanks.html dist/
cp -R assets css js dist/
echo "Static site ready in dist/"
