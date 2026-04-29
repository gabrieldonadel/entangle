import Foundation

/// Lightweight read-only accessor for the preferences the AppDelegate reacts to.
/// The authoritative store lives in the EntangleServer Expo module
/// (`PreferencesStore.swift`); the keys and notification name must match.
enum Preferences {
  static let didChangeNotification = Notification.Name("EntanglePreferencesDidChange")

  static var showMenuBarIcon: Bool {
    UserDefaults.standard.object(forKey: "entangle.pref.showMenuBarIcon") as? Bool ?? true
  }

  static var hideDockIcon: Bool {
    UserDefaults.standard.object(forKey: "entangle.pref.hideDockIcon") as? Bool ?? true
  }
}
