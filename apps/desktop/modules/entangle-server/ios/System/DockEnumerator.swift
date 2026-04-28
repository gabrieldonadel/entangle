import AppKit
import Foundation

/// Mirrors the user's Dock: persistent apps from `com.apple.dock.plist` plus
/// currently running regular apps. Icons are cached by bundle path so
/// subsequent enumerations are cheap. NSWorkspace notifications trigger a
/// full re-emit whenever apps launch or terminate.
final class DockEnumerator {
  static let shared = DockEnumerator()

  struct DockApp {
    let bundleId: String
    let name: String
    let iconPng: String
    let running: Bool
    let pinned: Bool
    let path: String?

    func toDictionary() -> [String: Any] {
      var dict: [String: Any] = [
        "bundleId": bundleId,
        "name": name,
        "iconPng": iconPng,
        "running": running,
        "pinned": pinned
      ]
      if let path = path {
        dict["path"] = path
      }
      return dict
    }
  }

  var onUpdate: (([DockApp]) -> Void)?
  var onError: ((String) -> Void)?

  private var iconCache: [String: String] = [:]
  private var pathByBundleId: [String: String] = [:]
  private var observers: [NSObjectProtocol] = []
  private let observersLock = NSLock()
  private let queue = DispatchQueue(label: "entangle.dock", qos: .utility)

  func start() {
    let center = NSWorkspace.shared.notificationCenter
    observersLock.lock()
    defer { observersLock.unlock() }

    // Idempotent: drop any prior observers before adding new ones so a
    // bridge reload (e.g. expo-updates) doesn't leak duplicates or race
    // with a concurrent stop().
    for token in observers {
      center.removeObserver(token)
    }
    observers.removeAll()

    let names: [Notification.Name] = [
      NSWorkspace.didLaunchApplicationNotification,
      NSWorkspace.didTerminateApplicationNotification
    ]
    for name in names {
      let token = center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        self?.emit()
      }
      observers.append(token)
    }
  }

  func stop() {
    let center = NSWorkspace.shared.notificationCenter
    observersLock.lock()
    defer { observersLock.unlock() }
    for token in observers {
      center.removeObserver(token)
    }
    observers.removeAll()
  }

  /// Synchronously computes the current dock snapshot. Safe to call off the
  /// main thread; uses `NSWorkspace` APIs only.
  func currentApps() -> [DockApp] {
    var byBundleId: [String: DockApp] = [:]
    var order: [String] = []

    for entry in persistentDockEntries() {
      guard let bundleId = entry.bundleId else { continue }
      let app = DockApp(
        bundleId: bundleId,
        name: entry.name,
        iconPng: iconFor(path: entry.path),
        running: false,
        pinned: true,
        path: entry.path
      )
      byBundleId[bundleId] = app
      order.append(bundleId)
    }

    for runningApp in NSWorkspace.shared.runningApplications
      where runningApp.activationPolicy == .regular {
      guard let bundleId = runningApp.bundleIdentifier else { continue }
      let path = runningApp.bundleURL?.path
      if let existing = byBundleId[bundleId] {
        byBundleId[bundleId] = DockApp(
          bundleId: bundleId,
          name: existing.name,
          iconPng: existing.iconPng,
          running: true,
          pinned: existing.pinned,
          path: existing.path ?? path
        )
      } else {
        let icon = iconFor(path: path)
        byBundleId[bundleId] = DockApp(
          bundleId: bundleId,
          name: runningApp.localizedName ?? bundleId,
          iconPng: icon,
          running: true,
          pinned: false,
          path: path
        )
        order.append(bundleId)
      }
    }

    let ordered = order.compactMap { byBundleId[$0] }
    for app in ordered {
      if let path = app.path {
        pathByBundleId[app.bundleId] = path
      }
    }
    return ordered
  }

  func activate(bundleId: String) {
    queue.async {
      let url = self.resolveURL(for: bundleId)
      guard let appURL = url else {
        self.onError?("Could not resolve app URL for \(bundleId)")
        return
      }
      let configuration = NSWorkspace.OpenConfiguration()
      configuration.activates = true
      NSWorkspace.shared.openApplication(at: appURL, configuration: configuration) { _, error in
        if let error = error {
          self.onError?("openApplication failed for \(bundleId): \(error.localizedDescription)")
        }
      }
    }
  }

  private func resolveURL(for bundleId: String) -> URL? {
    if let path = pathByBundleId[bundleId] {
      return URL(fileURLWithPath: path)
    }
    if let runningURL = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first?.bundleURL {
      return runningURL
    }
    return NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId)
  }

  // MARK: - Private

  private func emit() {
    queue.async { [weak self] in
      guard let self = self else { return }
      let apps = self.currentApps()
      self.onUpdate?(apps)
    }
  }

  private struct PersistentEntry {
    let bundleId: String?
    let name: String
    let path: String?
  }

  private func persistentDockEntries() -> [PersistentEntry] {
    guard let defaults = UserDefaults(suiteName: "com.apple.dock"),
          let persistent = defaults.array(forKey: "persistent-apps") as? [[String: Any]] else {
      return []
    }
    return persistent.compactMap { entry in
      guard let tile = entry["tile-data"] as? [String: Any] else { return nil }
      let name = tile["file-label"] as? String ?? ""
      let fileData = tile["file-data"] as? [String: Any]
      let urlString = fileData?["_CFURLString"] as? String
      let path = urlString.flatMap { URL(string: $0)?.path }
      let bundleId = tile["bundle-identifier"] as? String ?? bundleIdFor(path: path)
      return PersistentEntry(bundleId: bundleId, name: name, path: path)
    }
  }

  private func bundleIdFor(path: String?) -> String? {
    guard let path = path else { return nil }
    return Bundle(path: path)?.bundleIdentifier
  }

  private func iconFor(path: String?) -> String {
    guard let path = path else { return "" }
    if let cached = iconCache[path] {
      return cached
    }
    let image = NSWorkspace.shared.icon(forFile: path)
    let encoded = IconEncoder.encode(image) ?? ""
    iconCache[path] = encoded
    return encoded
  }
}
