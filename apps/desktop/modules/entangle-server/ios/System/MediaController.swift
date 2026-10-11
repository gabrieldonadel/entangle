import AppKit
import Foundation

/// Drives playback on the Mac and reports what is playing.
///
/// Two halves that deliberately do not depend on each other:
///
/// **Commands** go out as the keyboard's own media keys (`NX_KEYTYPE_PLAY` and
/// friends), posted as system-defined events. Nothing here talks to a
/// particular player, so a command reaches whatever currently owns playback —
/// Music, Spotify, a video in a browser tab, a podcast app nobody has heard
/// of. Like the rest of the input synthesis this needs Accessibility.
///
/// **Metadata** comes from MediaRemote, the private framework behind Control
/// Center's Now Playing, so it covers every app that publishes there — Music,
/// Spotify, a video in Chrome. Since macOS 15.4 MediaRemote answers only
/// processes Apple signed: called from this app it returns an empty
/// dictionary. `osascript` is one of Apple's, so a long-lived JXA script asks
/// on our behalf — see `readerScript`.
///
/// Where the script cannot run (a macOS without `MRNowPlayingRequest`), this
/// falls back to the distributed notification Music and Spotify each post on
/// every track and state change. That only covers those two apps. Anything
/// else gets commands that work and a card with no title, which is why
/// `playing` is tracked separately from the metadata and `State.known` exists
/// — the phone has to tell "paused" apart from "playing something I cannot
/// name".
///
/// Receiving another app's distributed notifications requires this app to be
/// unsandboxed. It is — see `macos/entangle-macOS/entangle.entitlements`.
final class MediaController {
  static let shared = MediaController()

  struct State: Equatable {
    var playing: Bool
    var title: String?
    var artist: String?
    var album: String?
    /// Display name of the app the metadata came from.
    var app: String?
    /// Base64 PNG of that app's icon, 64×64 like the dock's.
    var iconPng: String?

    /// Whether any player actually told us what this is. False means the only
    /// thing we know is that a play/pause went out.
    var known: Bool {
      title != nil || artist != nil || album != nil
    }
  }

  enum Command: String {
    case playPause = "playpause"
    case next
    case prev

    /// `NX_KEYTYPE_*` from IOKit's `ev_keymap.h`, which has no Swift module.
    var keyCode: Int32 {
      switch self {
      case .playPause: return 16  // NX_KEYTYPE_PLAY
      case .next: return 17       // NX_KEYTYPE_NEXT
      case .prev: return 18       // NX_KEYTYPE_PREVIOUS
      }
    }
  }

  private let queue = DispatchQueue(label: "entangle.media")

  /// Called whenever the state changes, on `queue`.
  var onChange: ((State) -> Void)?

  private var state = State(playing: false)
  private var lastEmitted: State?
  private var observers: [NSObjectProtocol] = []
  /// Resolved app icons keyed by bundle id. Looking one up hits the disk, and
  /// the same two or three apps come round again for the life of the process.
  private var iconCache: [String: String?] = [:]
  /// Bundle id behind the current `state`, so a stop reported by some other
  /// player can be told apart from a stop by the one on screen.
  private var currentBundleId: String?
  /// The `osascript` running `readerScript`, while it runs.
  private var reader: Process?
  /// Reader output that has not reached a newline yet.
  private var readerBuffer = Data()

  private init() {}

  // MARK: - Reading

  func currentState() -> State {
    queue.sync { state }
  }

  // MARK: - Commands

  func send(_ command: Command) {
    queue.async {
      Self.postMediaKey(command.keyCode)
      // A player we can hear from will correct this within a moment. For
      // everything else the optimistic flip is the only feedback the phone
      // ever gets, so the button has to act like it worked.
      switch command {
      case .playPause: self.state.playing.toggle()
      case .next, .prev: self.state.playing = true
      }
      self.emit()
    }
  }

  /// A media key is a `systemDefined` event with subtype 8, not a keyboard
  /// event: the key code and the up/down flag are packed into `data1` rather
  /// than carried as a `CGKeyCode`. Both halves have to be posted, and they go
  /// to the HID tap so the WindowServer routes them to whichever app owns
  /// playback — which is the whole reason for using media keys instead of
  /// scripting a particular player.
  private static func postMediaKey(_ keyCode: Int32) {
    for isDown in [true, false] {
      mediaKeyEvent(keyCode, down: isDown)?.cgEvent?.post(tap: .cghidEventTap)
    }
  }

  /// Split out from `postMediaKey` so the packing can be checked without
  /// actually pressing play on somebody's Mac — see
  /// `scripts/media-harness/main.swift`.
  static func mediaKeyEvent(_ keyCode: Int32, down: Bool) -> NSEvent? {
    let phase = down ? 0xA : 0xB
    return NSEvent.otherEvent(
      with: .systemDefined,
      location: .zero,
      modifierFlags: NSEvent.ModifierFlags(rawValue: UInt(phase << 8)),
      timestamp: 0,
      windowNumber: 0,
      context: nil,
      subtype: 8,
      data1: Int(keyCode) << 16 | (phase << 8),
      data2: -1
    )
  }

  // MARK: - Metadata

  /// Starts listening for track changes. Safe to call repeatedly.
  func startWatching() {
    queue.async {
      guard self.reader == nil, self.observers.isEmpty else { return }
      self.startReader()
    }
  }

  func stopWatching() {
    queue.async {
      if let reader = self.reader {
        // Cleared first, so the termination handler sees a stop it asked for.
        self.reader = nil
        reader.terminate()
      }
      self.readerBuffer.removeAll()
      let center = DistributedNotificationCenter.default()
      for observer in self.observers {
        center.removeObserver(observer)
      }
      self.observers.removeAll()
    }
  }

  /// Prints the Now Playing item as one JSON line a second, forever.
  ///
  /// Printing every second rather than on change is what ends it: once this
  /// app is gone, the next write hits a closed pipe and SIGPIPE takes
  /// `osascript` with it. `emit()` drops the repeats. A poll costs about
  /// 5 ms of CPU (0.1 s over 20 s, measured); MediaRemote's change
  /// notifications need a C call with a dispatch queue, which JXA cannot make.
  static let readerScript = """
    ObjC.import('Foundation');
    $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/MediaRemote.framework/').load;
    const R = $.NSClassFromString('MRNowPlayingRequest');
    if (R.isNil()) throw 'MRNowPlayingRequest unavailable';
    const out = $.NSFileHandle.fileHandleWithStandardOutput;
    for (;;) {
      const info = ObjC.deepUnwrap(R.localNowPlayingItem.nowPlayingInfo) || {};
      const client = R.localNowPlayingPlayerPath.client;
      const line = JSON.stringify({
        playing: R.localIsPlaying,
        title: info.kMRMediaRemoteNowPlayingInfoTitle,
        artist: info.kMRMediaRemoteNowPlayingInfoArtist,
        album: info.kMRMediaRemoteNowPlayingInfoAlbum,
        app: client?.displayName?.js,
        bundleId: client?.bundleIdentifier?.js,
      });
      out.writeData($(line + '\\n').dataUsingEncoding($.NSUTF8StringEncoding));
      delay(1);
    }
    """

  /// Caller must be on `queue`.
  private func startReader() {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    process.arguments = ["-l", "JavaScript", "-e", Self.readerScript]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let chunk = handle.availableData
      if chunk.isEmpty {
        // EOF. Left set, the handler fires again for every empty read.
        handle.readabilityHandler = nil
        return
      }
      guard let self = self else { return }
      self.queue.async { self.consume(chunk) }
    }
    // An exit nobody asked for means the script cannot run on this Mac.
    // ponytail: a reader that dies mid-session also falls back for good;
    // restart it here if that ever shows up in practice.
    process.terminationHandler = { [weak self] exited in
      guard let self = self else { return }
      self.queue.async {
        guard self.reader === exited else { return }
        self.reader = nil
        self.observeNotifications()
      }
    }
    do {
      try process.run()
      reader = process
    } catch {
      observeNotifications()
    }
  }

  /// Caller must be on `queue`.
  private func consume(_ chunk: Data) {
    readerBuffer.append(chunk)
    while let newline = readerBuffer.firstIndex(of: 0x0A) {
      let line = readerBuffer[..<newline]
      readerBuffer.removeSubrange(...newline)
      guard let read = Self.fold(readerLine: line) else { continue }
      var next = read.state
      next.iconPng = read.bundleId.flatMap { icon(for: $0) }
      currentBundleId = read.bundleId
      state = next
      emit()
    }
  }

  /// What one line of `readerScript` output means, or nil when it is not one.
  /// Pure, so it can be asserted in `scripts/media-harness/main.swift`.
  static func fold(readerLine line: Data) -> (state: State, bundleId: String?)? {
    guard let info = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] else {
      return nil
    }
    let state = State(
      playing: info["playing"] as? Bool ?? false,
      title: nonEmpty(info["title"]),
      artist: nonEmpty(info["artist"]),
      album: nonEmpty(info["album"]),
      app: nonEmpty(info["app"])
    )
    return (state, nonEmpty(info["bundleId"]))
  }

  /// Fallback for a Mac where `readerScript` cannot run. Caller must be on
  /// `queue`.
  private func observeNotifications() {
    let center = DistributedNotificationCenter.default()
    for source in Self.sources {
      let observer = center.addObserver(
        forName: Notification.Name(source.notification),
        object: nil,
        queue: nil
      ) { [weak self] note in
        guard let self = self else { return }
        self.queue.async { self.apply(note, from: source) }
      }
      observers.append(observer)
    }
  }

  /// The players that post a usable notification.
  ///
  /// All three happen to agree on `Name` / `Artist` / `Album` / `Player
  /// State`, so there is nothing per-source to configure beyond the name —
  /// but a fourth player with different keys would want this struct to grow,
  /// not the handler to sprout a branch.
  struct Source {
    let notification: String
    let bundleId: String
    let displayName: String
  }

  static let sources: [Source] = [
    Source(
      notification: "com.apple.Music.playerInfo",
      bundleId: "com.apple.Music",
      displayName: "Music"
    ),
    // Pre-Catalina name. Cheap to keep listening for — one more observer —
    // and a Mac still running iTunes posts nothing else.
    Source(
      notification: "com.apple.iTunes.playerInfo",
      bundleId: "com.apple.iTunes",
      displayName: "iTunes"
    ),
    Source(
      notification: "com.spotify.client.PlaybackStateChanged",
      bundleId: "com.spotify.client",
      displayName: "Spotify"
    ),
  ]

  private func apply(_ note: Notification, from source: Source) {
    guard var next = Self.fold(
      note.userInfo ?? [:],
      from: source,
      showing: currentBundleId
    ) else {
      return
    }
    next.iconPng = icon(for: source.bundleId)
    currentBundleId = source.bundleId
    state = next
    emit()
  }

  /// What a player's notification payload means, or nil when it should be
  /// ignored. Pure, so it can be asserted in
  /// `scripts/media-harness/main.swift` rather than by driving a real player.
  ///
  /// `showing` is the bundle id behind the card the phone is currently
  /// looking at.
  static func fold(
    _ info: [AnyHashable: Any],
    from source: Source,
    showing: String?
  ) -> State? {
    let playerState = (info["Player State"] as? String) ?? ""
    let playing = playerState.caseInsensitiveCompare("Playing") == .orderedSame

    // A player reports itself stopping; it never reports that some *other* app
    // took over. Ignore a paused report from a player that is not the one on
    // screen, otherwise quitting Music blanks a card showing Spotify.
    if !playing, let showing = showing, showing != source.bundleId {
      return nil
    }

    return State(
      playing: playing,
      title: nonEmpty(info["Name"]),
      artist: nonEmpty(info["Artist"]),
      album: nonEmpty(info["Album"]),
      app: source.displayName
    )
  }

  private static func nonEmpty(_ value: Any?) -> String? {
    guard let text = value as? String else { return nil }
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  /// Caller must be on `queue`.
  private func icon(for bundleId: String) -> String? {
    if let cached = iconCache[bundleId] { return cached }
    var encoded: String?
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) {
      encoded = IconEncoder.encode(NSWorkspace.shared.icon(forFile: url.path))
    }
    // Cached either way: an app that is not installed will not become
    // installed often enough to be worth asking the disk again every track.
    iconCache[bundleId] = encoded
    return encoded
  }

  /// Players are chatty — Spotify posts on seek as well as on track change —
  /// and an unchanged card is not worth a broadcast to every phone.
  private func emit() {
    if lastEmitted == state { return }
    lastEmitted = state
    onChange?(state)
  }
}
