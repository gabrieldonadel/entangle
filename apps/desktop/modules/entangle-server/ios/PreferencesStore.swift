import Foundation
import ServiceManagement

@objc final class PreferencesStore: NSObject {
  @objc static let shared = PreferencesStore()

  private let defaults = UserDefaults.standard

  private enum Key {
    static let serverName = "entangle.pref.serverName"
    static let port = "entangle.pref.port"
    static let discoverable = "entangle.pref.discoverable"
    static let sensitivity = "entangle.pref.sensitivity"
    static let naturalScroll = "entangle.pref.naturalScroll"
    static let tapToClick = "entangle.pref.tapToClick"
    static let openAtLogin = "entangle.pref.openAtLogin"
    static let showMenuBarIcon = "entangle.pref.showMenuBarIcon"
    static let hideDockIcon = "entangle.pref.hideDockIcon"
  }

  override init() {
    super.init()
    defaults.register(defaults: [
      Key.discoverable: true,
      Key.sensitivity: 1.5,
      Key.naturalScroll: true,
      Key.tapToClick: true,
      Key.openAtLogin: false,
      Key.showMenuBarIcon: true,
      Key.hideDockIcon: true,
      Key.port: 0, // 0 = auto
    ])
  }

  // MARK: - Server

  var serverName: String {
    get { defaults.string(forKey: Key.serverName) ?? (Host.current().localizedName ?? "Mac") }
    set { defaults.set(newValue, forKey: Key.serverName) }
  }

  var port: UInt16 {
    get { UInt16(defaults.integer(forKey: Key.port)) }
    set { defaults.set(Int(newValue), forKey: Key.port) }
  }

  var discoverable: Bool {
    get { defaults.bool(forKey: Key.discoverable) }
    set { defaults.set(newValue, forKey: Key.discoverable) }
  }

  // MARK: - Pointer

  var sensitivity: Double {
    get { defaults.double(forKey: Key.sensitivity) }
    set { defaults.set(newValue, forKey: Key.sensitivity) }
  }

  var naturalScroll: Bool {
    get { defaults.bool(forKey: Key.naturalScroll) }
    set { defaults.set(newValue, forKey: Key.naturalScroll) }
  }

  var tapToClick: Bool {
    get { defaults.bool(forKey: Key.tapToClick) }
    set { defaults.set(newValue, forKey: Key.tapToClick) }
  }

  // MARK: - Launch

  var openAtLogin: Bool {
    get {
      if #available(macOS 13.0, *) {
        return SMAppService.mainApp.status == .enabled
      }
      return defaults.bool(forKey: Key.openAtLogin)
    }
    set {
      defaults.set(newValue, forKey: Key.openAtLogin)
      if #available(macOS 13.0, *) {
        do {
          if newValue {
            if SMAppService.mainApp.status != .enabled {
              try SMAppService.mainApp.register()
            }
          } else {
            if SMAppService.mainApp.status == .enabled {
              try SMAppService.mainApp.unregister()
            }
          }
        } catch {
          NSLog("[Entangle] failed to update open-at-login: \(error.localizedDescription)")
        }
      }
    }
  }

  var showMenuBarIcon: Bool {
    get { defaults.bool(forKey: Key.showMenuBarIcon) }
    set { defaults.set(newValue, forKey: Key.showMenuBarIcon) }
  }

  var hideDockIcon: Bool {
    get { defaults.bool(forKey: Key.hideDockIcon) }
    set { defaults.set(newValue, forKey: Key.hideDockIcon) }
  }

  // MARK: - Bridge

  func snapshot() -> [String: Any] {
    [
      "serverName": serverName,
      "port": Int(port),
      "discoverable": discoverable,
      "sensitivity": sensitivity,
      "naturalScroll": naturalScroll,
      "tapToClick": tapToClick,
      "openAtLogin": openAtLogin,
      "showMenuBarIcon": showMenuBarIcon,
      "hideDockIcon": hideDockIcon,
    ]
  }

  func apply(_ patch: [String: Any]) {
    if let v = patch["serverName"] as? String { serverName = v }
    if let v = patch["port"] as? Int { port = UInt16(max(0, min(65535, v))) }
    if let v = patch["discoverable"] as? Bool { discoverable = v }
    if let v = patch["sensitivity"] as? Double { sensitivity = v }
    if let v = patch["sensitivity"] as? Int { sensitivity = Double(v) }
    if let v = patch["naturalScroll"] as? Bool { naturalScroll = v }
    if let v = patch["tapToClick"] as? Bool { tapToClick = v }
    if let v = patch["openAtLogin"] as? Bool { openAtLogin = v }
    if let v = patch["showMenuBarIcon"] as? Bool { showMenuBarIcon = v }
    if let v = patch["hideDockIcon"] as? Bool { hideDockIcon = v }
    NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
  }

  static let didChange = Notification.Name("EntanglePreferencesDidChange")
}
