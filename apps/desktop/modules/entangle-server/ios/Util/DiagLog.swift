import Foundation

/// Appends diagnostics to `~/Library/Logs/Entangle/pointer-diag.jsonl`.
///
/// The Mac is the end of the wire you can actually read afterwards: while the
/// numbers are being generated, the phone is under a thumb.
///
/// One JSON object per line, so `tail`, `jq` and Console.app all work on it
/// without any tooling of ours.
final class DiagLog {
  static let shared = DiagLog()

  /// Rotate at 4 MB. At one line per active second that is a very long
  /// afternoon of swiping.
  private static let maxBytes: UInt64 = 4 * 1024 * 1024

  private let queue = DispatchQueue(label: "entangle.diaglog", qos: .utility)
  private var handle: FileHandle?

  private init() {}

  /// `nil` until the first successful open, so callers can tell the user where
  /// the log went — or that there is no log.
  private(set) var path: String?

  /// `ENTANGLE_DIAG_LOG_DIR` redirects the log, which is how the harness
  /// exercises this without writing into a real `~/Library/Logs`.
  private var directory: URL {
    if let override = ProcessInfo.processInfo.environment["ENTANGLE_DIAG_LOG_DIR"],
       !override.isEmpty {
      return URL(fileURLWithPath: override, isDirectory: true)
    }
    return FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Logs/Entangle", isDirectory: true)
  }

  private var fileURL: URL {
    directory.appendingPathComponent("pointer-diag.jsonl")
  }

  /// Opens the log and writes a session header. Safe to call repeatedly.
  func open(note: [String: Any] = [:]) {
    queue.sync {
      guard handle == nil else { return }
      let fileManager = FileManager.default
      do {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: fileURL.path) {
          fileManager.createFile(atPath: fileURL.path, contents: nil)
        }
        let handle = try FileHandle(forWritingTo: fileURL)
        handle.seekToEndOfFile()
        self.handle = handle
        self.path = fileURL.path
      } catch {
        NSLog("[Entangle] could not open diagnostics log: \(error.localizedDescription)")
        return
      }
      var payload = note
      payload["type"] = "session"
      writeLocked(payload)
    }
  }

  func close(note: [String: Any] = [:]) {
    queue.sync {
      guard handle != nil else { return }
      var payload = note
      payload["type"] = "session-end"
      writeLocked(payload)
      try? handle?.close()
      handle = nil
    }
  }

  /// Appends one record. Adds `at` (local ISO 8601) if the caller did not.
  func write(_ record: [String: Any]) {
    queue.async { self.writeLocked(record) }
  }

  private func writeLocked(_ record: [String: Any]) {
    guard let handle = handle else { return }
    var payload = record
    if payload["at"] == nil {
      payload["at"] = Self.formatter.string(from: Date())
    }
    guard
      let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
      var line = String(data: data, encoding: .utf8)
    else {
      return
    }
    line += "\n"
    handle.write(Data(line.utf8))
    rotateIfNeededLocked()
  }

  /// Keeps one previous file, so a rotation mid-session cannot lose the run
  /// you just recorded.
  private func rotateIfNeededLocked() {
    guard let handle = handle,
          let size = try? handle.offset(),
          size > Self.maxBytes else {
      return
    }
    try? handle.close()
    self.handle = nil
    let previous = directory.appendingPathComponent("pointer-diag.1.jsonl")
    try? FileManager.default.removeItem(at: previous)
    try? FileManager.default.moveItem(at: fileURL, to: previous)
    // Reopen so the next write lands in a fresh file rather than being lost.
    if let reopened = try? FileHandle(forWritingTo: {
      FileManager.default.createFile(atPath: fileURL.path, contents: nil)
      return fileURL
    }()) {
      reopened.seekToEndOfFile()
      self.handle = reopened
    }
  }

  private static let formatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()
}
