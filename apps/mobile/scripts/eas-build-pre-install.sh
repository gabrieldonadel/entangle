#!/usr/bin/env bash

set -xeuo pipefail

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../../.. && pwd )"
export PATH="$ROOT_DIR/bin:$PATH"

# if [ "$EAS_BUILD_PLATFORM" = "android" ]; then

  # curl -o commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
  # curl -o commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-7583922_latest.zip
  # mkdir -p "$ANDROID_HOME/cmdline-tools"

  # unzip commandlinetools.zip -d temp
  # cp temp/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
  # ln -s "$ANDROID_HOME/cmdline-tools/tools" "$ANDROID_HOME/cmdline-tools/latest"
# fi

