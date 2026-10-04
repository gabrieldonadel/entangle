// Checks the two halves of `MediaController` that can be exercised without
// touching the machine.
//
// The command half is deliberately *not* posted: a real `NX_KEYTYPE_PLAY`
// starts whatever the Mac was last playing, which is not something a test run
// should do. What can be checked is the event itself — a media key is a
// `systemDefined` event with the key code and the up/down phase packed into
// `data1`, and getting that packing wrong produces an event that is posted
// successfully and silently ignored. So the harness builds the event and reads
// the packing back.
//
// The metadata half folds a player's notification payload into a `State`.
// `fold` is pure, so the interesting cases — a missing field, an empty string,
// one player pausing while another is on screen — can be asserted instead of
// driven by starting Spotify.
//
// Deliberately outside `modules/entangle-server/ios`: the podspec globs
// `**/*.swift` from there, and a second `main` would break the app build.
//
//   swiftc -O -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
//     -target arm64-apple-macos14.0 -o /tmp/media-harness \
//     scripts/media-harness/main.swift \
//     apps/desktop/modules/entangle-server/ios/System/MediaController.swift \
//     apps/desktop/modules/entangle-server/ios/Util/IconEncoder.swift
//   /tmp/media-harness

import AppKit
import Foundation

var failures = 0

func check(_ name: String, _ condition: Bool) {
  print((condition ? "PASS  " : "FAIL  ") + name)
  if !condition { failures += 1 }
}

// ── Media key packing ───────────────────────────────────────────────────────

for (name, command, expectedCode) in [
  ("playpause", MediaController.Command.playPause, Int32(16)),
  ("next", MediaController.Command.next, Int32(17)),
  ("prev", MediaController.Command.prev, Int32(18)),
] {
  check("\(name) maps to NX_KEYTYPE \(expectedCode)", command.keyCode == expectedCode)

  for (phaseName, down, expectedPhase) in [("down", true, 0xA), ("up", false, 0xB)] {
    guard let event = MediaController.mediaKeyEvent(command.keyCode, down: down) else {
      check("\(name) \(phaseName) builds an event", false)
      continue
    }
    check("\(name) \(phaseName) is systemDefined", event.type == .systemDefined)
    check("\(name) \(phaseName) is subtype 8", event.subtype.rawValue == 8)
    // What the WindowServer reads back out of data1.
    check(
      "\(name) \(phaseName) packs the key code",
      Int32((event.data1 & 0xFFFF0000) >> 16) == expectedCode
    )
    check(
      "\(name) \(phaseName) packs the phase",
      ((event.data1 & 0xFF00) >> 8) == expectedPhase
    )
    check("\(name) \(phaseName) converts to a CGEvent", event.cgEvent != nil)
  }
}

// ── Command parsing ─────────────────────────────────────────────────────────
// The wire carries the raw strings the protocol declares; a rename on one side
// would otherwise fail silently as an unhandled message.

check("playpause parses", MediaController.Command(rawValue: "playpause") == .playPause)
check("next parses", MediaController.Command(rawValue: "next") == .next)
check("prev parses", MediaController.Command(rawValue: "prev") == .prev)
check("an unknown command is rejected", MediaController.Command(rawValue: "seek") == nil)

// ── Metadata folding ────────────────────────────────────────────────────────

let spotify = MediaController.sources.first { $0.bundleId == "com.spotify.client" }!
let music = MediaController.sources.first { $0.bundleId == "com.apple.Music" }!

do {
  let state = MediaController.fold(
    [
      "Player State": "Playing",
      "Name": "Everything In Its Right Place",
      "Artist": "Radiohead",
      "Album": "Kid A",
    ],
    from: spotify,
    showing: nil
  )
  check("a playing track is reported playing", state?.playing == true)
  check("the title comes through", state?.title == "Everything In Its Right Place")
  check("the artist comes through", state?.artist == "Radiohead")
  check("the app is named", state?.app == "Spotify")
  check("a named track is known", state?.known == true)
}

do {
  // Spotify sends a bare pause with no track fields at all.
  let state = MediaController.fold(
    ["Player State": "Paused"],
    from: spotify,
    showing: "com.spotify.client"
  )
  check("a pause from the showing player applies", state != nil)
  check("a pause is not playing", state?.playing == false)
  check("a pause with no fields is unknown", state?.known == false)
}

do {
  // Music quitting must not blank a card that is showing Spotify.
  let state = MediaController.fold(
    ["Player State": "Stopped"],
    from: music,
    showing: "com.spotify.client"
  )
  check("another player's stop is ignored", state == nil)
}

do {
  // But another player *starting* takes the card over.
  let state = MediaController.fold(
    ["Player State": "Playing", "Name": "Sonata"],
    from: music,
    showing: "com.spotify.client"
  )
  check("another player's start takes over", state?.app == "Music")
  check("the new track is reported", state?.title == "Sonata")
}

do {
  // Empty strings are the shape Music uses for an absent album, and an empty
  // title would render as a blank line rather than as "no metadata".
  let state = MediaController.fold(
    ["Player State": "Playing", "Name": "Track", "Artist": "", "Album": "   "],
    from: music,
    showing: nil
  )
  check("an empty artist is dropped", state?.artist == nil)
  check("a whitespace album is dropped", state?.album == nil)
  check("the real title survives", state?.title == "Track")
}

do {
  // A payload with no `Player State` at all: treat it as not playing rather
  // than crashing or guessing.
  let state = MediaController.fold(["Name": "Track"], from: music, showing: nil)
  check("a payload with no player state is not playing", state?.playing == false)
}

do {
  let lower = MediaController.fold(["Player State": "playing"], from: music, showing: nil)
  check("the player state is matched case-insensitively", lower?.playing == true)
}

// ── Starting state ──────────────────────────────────────────────────────────

do {
  let initial = MediaController.shared.currentState()
  check("nothing is playing before a player reports", initial.playing == false)
  check("nothing is known before a player reports", initial.known == false)
}

print()
print(failures == 0 ? "media: all checks passed" : "media: \(failures) FAILED")
exit(failures == 0 ? 0 : 1)
