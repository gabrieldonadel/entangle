#!/usr/bin/env bash
# Checks that a built .ipa actually contains a native module.
#
# A pod skipped by `use_expo_modules!` — most easily by declaring a platform
# floor above the app's deployment target — produces a green build and an app
# with the module missing. Nothing fails until the feature is used on a device.
#
#   scripts/verify-ios-module.sh build.ipa EntangleUdpModule
set -euo pipefail

ipa=${1:?usage: verify-ios-module.sh <ipa> <symbol> [control-symbol]}
symbol=${2:?usage: verify-ios-module.sh <ipa> <symbol> [control-symbol]}
# A module known to be linked, to prove the search itself works.
control=${3:-ExpoModulesProvider}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
unzip -q "$ipa" 'Payload/*.app/*' -d "$work"
binary=$(find "$work/Payload" -maxdepth 2 -type f -perm -111 ! -name '*.dylib' | head -1)
[ -n "$binary" ] || { echo "no app binary inside $ipa"; exit 1; }

control_hits=$(strings -a "$binary" | grep -c "$control" || true)
hits=$(strings -a "$binary" | grep -c "$symbol" || true)

if [ "$control_hits" -eq 0 ]; then
  echo "inconclusive: control symbol '$control' not found either, so the search is wrong"
  exit 2
fi
if [ "$hits" -eq 0 ]; then
  echo "MISSING: '$symbol' is not in $(basename "$binary") (control '$control': $control_hits hits)"
  exit 1
fi
echo "OK: '$symbol' found $hits times in $(basename "$binary")"
