import AppKit
import CoreGraphics
import Foundation

/// Reads whether the Mac is sitting on its lock screen, and reports the edges.
///
/// Separate from `DisplayController` because the two states are independent and
/// the phone needs both: waking a sleeping Mac usually lands on the lock
/// screen, so "awake" alone is not enough to know the trackpad is useful.
///
/// Needs no Accessibility permission — the session dictionary is readable by
/// any process in the session.
final class LockController {
  static let shared = LockController()

  private let queue = DispatchQueue(label: "entangle.lock")

  /// Called whenever the screen locks or unlocks, including from the Mac
  /// itself.
  var onChange: ((Bool) -> Void)?

  private var observers: [NSObjectProtocol] = []
  private var lastEmitted: Bool?

  private init() {}

  // MARK: - Reading

  func isLocked() -> Bool {
    guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else {
      return false
    }
    // Present and true only while locked; the key is absent entirely otherwise,
    // so this cannot be read as a plain `Bool` cast.
    return (session["CGSSessionScreenIsLocked"] as? NSNumber)?.boolValue ?? false
  }

  // MARK: - Change notifications

  /// Safe to call repeatedly; observers are only installed once.
  func startWatching() {
    guard observers.isEmpty else { return }
    // Lock state arrives on the distributed centre rather than `NSWorkspace`'s
    // — there is no workspace notification for it. These are undocumented but
    // long-standing, and the app is not sandboxed, so it can receive them.
    let center = DistributedNotificationCenter.default()
    let edges: [(String, Bool)] = [
      ("com.apple.screenIsLocked", true),
      ("com.apple.screenIsUnlocked", false),
    ]
    for (name, locked) in edges {
      observers.append(
        center.addObserver(
          forName: Notification.Name(name), object: nil, queue: nil
        ) { [weak self] _ in
          self?.queue.async { self?.emit(locked) }
        }
      )
    }
  }

  func stopWatching() {
    let center = DistributedNotificationCenter.default()
    for observer in observers {
      center.removeObserver(observer)
    }
    observers.removeAll()
    queue.async { self.lastEmitted = nil }
  }

  /// Re-reads the session dictionary and reports a change if there is one.
  ///
  /// The notifications are the fast path, but a Mac that locks on its way into
  /// sleep can wake with the phone's idea of the lock state stale, so the
  /// display's own sleep/wake edges call through here as well.
  func refresh() {
    let locked = isLocked()
    queue.async { self.emit(locked) }
  }

  private func emit(_ locked: Bool) {
    if lastEmitted == locked { return }
    lastEmitted = locked
    onChange?(locked)
  }
}
