#!/usr/bin/env bash
# Checks each plugin ZIP holds only its manifest and bundle, then prints their hashes.
set -euo pipefail

for zip in "$@"; do
    names=$(unzip -Z1 "$zip" | sort | tr '\n' ' ')
    if [ "$names" != "index.js manifest.json " ]; then
        echo "::error::Unexpected files in $zip: $names"
        exit 1
    fi

    sha256sum "$zip"
    for file in manifest.json index.js; do
        printf '%s  %s\n' "$(unzip -p "$zip" "$file" | sha256sum | cut -d ' ' -f 1)" "$file"
    done
done
