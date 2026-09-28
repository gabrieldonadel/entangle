import AppKit
import Foundation

/// Reads and writes the system pasteboard for phone ↔ Mac clipboard sync.
///
/// Matches the shared protocol caps: longest edge 2048 px, max decoded PNG
/// 1_048_576 bytes. Image wins when both text and image are present.
final class ClipboardController {
  static let shared = ClipboardController()

  /// Keep in sync with `CLIPBOARD_MAX_IMAGE_EDGE` / `CLIPBOARD_MAX_IMAGE_BYTES`
  /// in `@entangle/protocol`.
  private static let maxEdge: CGFloat = 2048
  private static let maxBytes = 1_048_576
  private static let pollInterval: TimeInterval = 0.4

  enum Kind: String {
    case text
    case image
    case empty
  }

  struct Payload {
    let kind: Kind
    let text: String?
    let imagePngBase64: String?
    let gen: Int
    let fingerprint: String
  }

  /// Fired when the local pasteboard changes for a reason other than applying
  /// a remote push. The module broadcasts to every syncing client.
  var onLocalChange: ((Payload) -> Void)?

  private let queue = DispatchQueue(label: "entangle.clipboard")
  private var syncClients = Set<UUID>()
  private var lastAppliedGenByClient: [UUID: Int] = [:]
  private var localGen = 0
  private var lastChangeCount = NSPasteboard.general.changeCount
  /// Ignore the next pasteboard changeCount bump after applying a remote push
  /// (re-encoding PNG rarely matches the bytes we just wrote).
  private var suppressNextLocalChange = false
  private var pollTimer: DispatchSourceTimer?
  private var prefsObserver: NSObjectProtocol?

  private init() {
    prefsObserver = NotificationCenter.default.addObserver(
      forName: PreferencesStore.didChange,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.queue.async {
        if !PreferencesStore.shared.clipboardSync {
          self?.clearAllSyncLocked()
        }
      }
    }
  }

  deinit {
    if let prefsObserver {
      NotificationCenter.default.removeObserver(prefsObserver)
    }
  }

  // MARK: - Sync membership

  /// Returns true when the preference allows clipboard sync.
  var isAllowed: Bool {
    PreferencesStore.shared.clipboardSync
  }

  /// Enable or disable auto-sync for a client. When turning on, returns the
  /// current Mac clipboard so the caller can push it immediately.
  func setSync(clientId: UUID, on: Bool) -> Payload? {
    queue.sync {
      guard isAllowed else {
        syncClients.remove(clientId)
        lastAppliedGenByClient.removeValue(forKey: clientId)
        refreshPollingLocked()
        return nil
      }
      if on {
        syncClients.insert(clientId)
        refreshPollingLocked()
        return readCurrentLocked(bumpGen: false)
      } else {
        syncClients.remove(clientId)
        lastAppliedGenByClient.removeValue(forKey: clientId)
        refreshPollingLocked()
        return nil
      }
    }
  }

  func clearClient(_ clientId: UUID) {
    queue.async {
      self.syncClients.remove(clientId)
      self.lastAppliedGenByClient.removeValue(forKey: clientId)
      self.refreshPollingLocked()
    }
  }

  func syncingClientIds() -> [UUID] {
    queue.sync { Array(syncClients) }
  }

  func hasSyncClients() -> Bool {
    queue.sync { !syncClients.isEmpty }
  }

  // MARK: - Remote apply

  /// Apply a phone push. Returns the payload that was written (for fan-out to
  /// other syncing clients), or nil if ignored / failed.
  @discardableResult
  func applyRemote(
    from clientId: UUID,
    kindRaw: String,
    text: String?,
    imagePngBase64: String?,
    gen: Int
  ) -> Payload? {
    queue.sync {
      guard isAllowed, syncClients.contains(clientId) else { return nil }
      if let last = lastAppliedGenByClient[clientId], gen <= last {
        return nil
      }
      guard let kind = Kind(rawValue: kindRaw) else { return nil }

      let fingerprint: String
      switch kind {
      case .text:
        guard let text, !text.isEmpty else { return nil }
        fingerprint = Self.fingerprint(kind: .text, text: text, image: nil)
      case .image:
        guard let imagePngBase64, !imagePngBase64.isEmpty else { return nil }
        fingerprint = Self.fingerprint(kind: .image, text: nil, image: imagePngBase64)
      case .empty:
        fingerprint = Self.fingerprint(kind: .empty, text: nil, image: nil)
      }

      let wrote: Bool
      switch kind {
      case .text:
        wrote = writeText(text!)
      case .image:
        wrote = writeImagePngBase64(imagePngBase64!)
      case .empty:
        wrote = writeEmpty()
      }
      lastChangeCount = NSPasteboard.general.changeCount
      if !wrote {
        return nil
      }
      // The write itself bumps changeCount; also PNG re-read rarely matches.
      suppressNextLocalChange = true
      lastAppliedGenByClient[clientId] = gen
      return Payload(
        kind: kind,
        text: kind == .text ? text : nil,
        imagePngBase64: kind == .image ? imagePngBase64 : nil,
        gen: gen,
        fingerprint: fingerprint
      )
    }
  }

  /// Snapshot the current pasteboard without bumping local gen (for seed push).
  func readCurrent() -> Payload? {
    queue.sync { readCurrentLocked(bumpGen: false) }
  }

  // MARK: - Polling

  private func refreshPollingLocked() {
    if syncClients.isEmpty || !isAllowed {
      stopPollingLocked()
    } else {
      startPollingLocked()
    }
  }

  private func startPollingLocked() {
    guard pollTimer == nil else { return }
    lastChangeCount = NSPasteboard.general.changeCount
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + Self.pollInterval, repeating: Self.pollInterval)
    timer.setEventHandler { [weak self] in
      self?.pollLocked()
    }
    timer.resume()
    pollTimer = timer
  }

  private func stopPollingLocked() {
    pollTimer?.cancel()
    pollTimer = nil
  }

  private func clearAllSyncLocked() {
    syncClients.removeAll()
    lastAppliedGenByClient.removeAll()
    stopPollingLocked()
  }

  private func pollLocked() {
    guard !syncClients.isEmpty, isAllowed else { return }
    let count = NSPasteboard.general.changeCount
    guard count != lastChangeCount else { return }
    lastChangeCount = count
    if suppressNextLocalChange {
      suppressNextLocalChange = false
      return
    }
    guard let payload = readCurrentLocked(bumpGen: true) else { return }
    let callback = onLocalChange
    DispatchQueue.main.async {
      callback?(payload)
    }
  }

  // MARK: - Read / write

  private func readCurrentLocked(bumpGen: Bool) -> Payload? {
    let board = NSPasteboard.general

    if let pngData = readPngData(from: board),
       let encoded = encodePngUnderCap(pngData) {
      if bumpGen { localGen += 1 }
      let gen = localGen
      let fingerprint = Self.fingerprint(kind: .image, text: nil, image: encoded)
      return Payload(
        kind: .image,
        text: nil,
        imagePngBase64: encoded,
        gen: gen,
        fingerprint: fingerprint
      )
    }

    if let text = board.string(forType: .string) {
      if bumpGen { localGen += 1 }
      let gen = localGen
      if text.isEmpty {
        let fingerprint = Self.fingerprint(kind: .empty, text: nil, image: nil)
        return Payload(kind: .empty, text: nil, imagePngBase64: nil, gen: gen, fingerprint: fingerprint)
      }
      let fingerprint = Self.fingerprint(kind: .text, text: text, image: nil)
      return Payload(kind: .text, text: text, imagePngBase64: nil, gen: gen, fingerprint: fingerprint)
    }

    if bumpGen { localGen += 1 }
    let gen = localGen
    let fingerprint = Self.fingerprint(kind: .empty, text: nil, image: nil)
    return Payload(kind: .empty, text: nil, imagePngBase64: nil, gen: gen, fingerprint: fingerprint)
  }

  private func readPngData(from board: NSPasteboard) -> Data? {
    if let png = board.data(forType: .png), !png.isEmpty {
      return png
    }
    if let tiff = board.data(forType: .tiff), !tiff.isEmpty {
      guard let rep = NSBitmapImageRep(data: tiff),
            let png = rep.representation(using: .png, properties: [:]) else {
        return nil
      }
      return png
    }
    // Some apps only expose a file URL or NSImage via pasteboard items.
    if let image = NSImage(pasteboard: board),
       let tiff = image.tiffRepresentation,
       let rep = NSBitmapImageRep(data: tiff),
       let png = rep.representation(using: .png, properties: [:]) {
      return png
    }
    return nil
  }

  private func encodePngUnderCap(_ data: Data) -> String? {
    guard let image = NSImage(data: data) else { return nil }
    let size = image.size
    guard size.width > 0, size.height > 0 else { return nil }

    let longest = max(size.width, size.height)
    let scale = longest > Self.maxEdge ? Self.maxEdge / longest : 1
    let target = NSSize(width: floor(size.width * scale), height: floor(size.height * scale))

    let resized = NSImage(size: target)
    resized.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    image.draw(
      in: NSRect(origin: .zero, size: target),
      from: NSRect(origin: .zero, size: size),
      operation: .sourceOver,
      fraction: 1.0
    )
    resized.unlockFocus()

    guard let tiff = resized.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
      return nil
    }
    if png.count > Self.maxBytes {
      return nil
    }
    return png.base64EncodedString()
  }

  private func writeText(_ text: String) -> Bool {
    let board = NSPasteboard.general
    board.clearContents()
    return board.setString(text, forType: .string)
  }

  private func writeImagePngBase64(_ base64: String) -> Bool {
    guard let data = Data(base64Encoded: base64), !data.isEmpty else { return false }
    if data.count > Self.maxBytes { return false }
    let board = NSPasteboard.general
    board.clearContents()
    return board.setData(data, forType: .png)
  }

  private func writeEmpty() -> Bool {
    NSPasteboard.general.clearContents()
    return true
  }

  static func fingerprint(kind: Kind, text: String?, image: String?) -> String {
    switch kind {
    case .empty:
      return "empty"
    case .text:
      return "text:\(text ?? "")"
    case .image:
      // Full base64 can be large; fingerprint length + a prefix is enough to
      // suppress the echo of our own write.
      let img = image ?? ""
      let prefix = img.prefix(64)
      return "image:\(img.count):\(prefix)"
    }
  }

  static func encodePush(_ payload: Payload) -> String? {
    var dict: [String: Any] = [
      "v": 1,
      "t": "cb.push",
      "kind": payload.kind.rawValue,
      "gen": payload.gen,
    ]
    if let text = payload.text {
      dict["text"] = text
    }
    if let image = payload.imagePngBase64 {
      dict["imagePng"] = image
    }
    guard let data = try? JSONSerialization.data(withJSONObject: dict) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }
}
