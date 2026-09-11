import AppKit
import CoreGraphics
import Foundation
import IOKit.pwr_mgt

/// Reads the display's sleep state and wakes it on request.
///
/// Waking goes through `IOPMAssertionDeclareUserActivity`, the same power
/// management call `caffeinate -u` makes. It reports local user activity, which
/// is what lights the screen back up — synthesized CGEvents do not, so a
/// pointer move sent to a sleeping display is simply lost.
///
/// Like `VolumeController`, this needs no Accessibility permission, so the
/// phone can wake the Mac before the user has granted anything else.
final class DisplayController {
  static let shared = DisplayController()

  private let queue = DispatchQueue(label: "entangle.display")

  /// Called whenever the screens sleep or wake, including from the Mac itself.
  var onChange: ((Bool) -> Void)?

  /// Reused across calls so repeated wakes do not leak an assertion each time.
  /// Power management recognizes a previously returned ID and updates it in
  /// place.
  private var assertionID = IOPMAssertionID(0)

  private var observers: [NSObjectProtocol] = []
  private var lastEmitted: Bool?

  private init() {}

  // MARK: - Reading

  func isAsleep() -> Bool {
    CGDisplayIsAsleep(CGMainDisplayID()) != 0
  }

  // MARK: - Waking

  /// Lights the display back up. A no-op when it is already awake, beyond
  /// pushing the idle-sleep timer back — which is what a real keypress does.
  func wake() {
    queue.async {
      let name = "Entangle: wake from phone" as CFString
      let result = IOPMAssertionDeclareUserActivity(
        name, kIOPMUserActiveLocal, &self.assertionID
      )
      if result != kIOReturnSuccess {
        NSLog("[Entangle] wake failed: IOReturn \(result)")
        return
      }
      // `screensDidWake` is the authoritative signal, but it can lag the call
      // by a moment. Report the optimistic state now so the phone's overlay
      // does not sit there looking unresponsive; a later notification with the
      // same value is deduped away.
      self.emit(false)
    }
  }

  // MARK: - Change notifications

  /// Safe to call repeatedly; observers are only installed once.
  func startWatching() {
    guard observers.isEmpty else { return }
    let center = NSWorkspace.shared.notificationCenter

    // `willSleep` covers the whole Mac going down: the screen goes with it,
    // and any phone still on the socket should see that before the connection
    // drops.
    let asleepNotifications: [Notification.Name] = [
      NSWorkspace.screensDidSleepNotification,
      NSWorkspace.willSleepNotification,
    ]
    let awakeNotifications: [Notification.Name] = [
      NSWorkspace.screensDidWakeNotification,
      NSWorkspace.didWakeNotification,
    ]

    for name in asleepNotifications {
      observers.append(
        center.addObserver(forName: name, object: nil, queue: nil) { [weak self] _ in
          self?.queue.async { self?.emit(true) }
        }
      )
    }
    for name in awakeNotifications {
      observers.append(
        center.addObserver(forName: name, object: nil, queue: nil) { [weak self] _ in
          self?.queue.async { self?.emit(false) }
        }
      )
    }
  }

  func stopWatching() {
    let center = NSWorkspace.shared.notificationCenter
    for observer in observers {
      center.removeObserver(observer)
    }
    observers.removeAll()
    queue.async { self.lastEmitted = nil }
  }

  /// The sleep and wake notifications overlap (a system wake fires both
  /// `didWake` and `screensDidWake`), so only report an actual change.
  private func emit(_ asleep: Bool) {
    if lastEmitted == asleep { return }
    lastEmitted = asleep
    onChange?(asleep)
  }
}
