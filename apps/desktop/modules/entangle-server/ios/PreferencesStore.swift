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
    static let highlightPointer = "entangle.pref.highlightPointer"
    static let openAtLogin = "entangle.pref.openAtLogin"
    static let showMenuBarIcon = "entangle.pref.showMenuBarIcon"
    static let hideDockIcon = "entangle.pref.hideDockIcon"
    static let cursorAllowPhones = "entangle.pref.cursorAllowPhones"
    static let cursorWorkspacePath = "entangle.pref.cursorWorkspacePath"
    static let cursorWorkspaceAllowlist = "entangle.pref.cursorWorkspaceAllowlist"
    static let cursorModel = "entangle.pref.cursorModel"
    static let cursorModelParams = "entangle.pref.cursorModelParams"
    static let clipboardSync = "entangle.pref.clipboardSync"
  }

  override init() {
    super.init()
    defaults.register(defaults: [
      Key.discoverable: true,
      Key.sensitivity: 1.5,
      Key.naturalScroll: true,
      Key.tapToClick: true,
      Key.highlightPointer: true,
      Key.openAtLogin: false,
      Key.showMenuBarIcon: true,
      Key.hideDockIcon: true,
      Key.port: 0, // 0 = auto
      Key.cursorAllowPhones: false,
      Key.cursorWorkspacePath: "",
      Key.cursorModel: "default",
      Key.cursorModelParams: "[]",
      Key.clipboardSync: false,
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

  /// Ring the pointer while a phone is connected, so it is easier to spot.
  var highlightPointer: Bool {
    get { defaults.bool(forKey: Key.highlightPointer) }
    set { defaults.set(newValue, forKey: Key.highlightPointer) }
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

  // MARK: - Cursor

  /// When true (and key + workspace + Node host are ready), advertise the `cursor` cap.
  var cursorAllowPhones: Bool {
    get { defaults.bool(forKey: Key.cursorAllowPhones) }
    set { defaults.set(newValue, forKey: Key.cursorAllowPhones) }
  }

  var cursorWorkspacePath: String {
    get { defaults.string(forKey: Key.cursorWorkspacePath) ?? "" }
    set { defaults.set(newValue, forKey: Key.cursorWorkspacePath) }
  }

  /// Folders phones may switch between. Active path is `cursorWorkspacePath`.
  var cursorWorkspaceAllowlist: [String] {
    get {
      let stored = Self.normalizeWorkspacePaths(
        defaults.stringArray(forKey: Key.cursorWorkspaceAllowlist) ?? []
      )
      if !stored.isEmpty { return stored }
      // Migrate from the single-path pref used before allowlists existed.
      let legacy = cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
      return legacy.isEmpty ? [] : [legacy]
    }
    set {
      let next = Self.normalizeWorkspacePaths(newValue)
      defaults.set(next, forKey: Key.cursorWorkspaceAllowlist)
      let active = cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
      if active.isEmpty || !next.contains(active) {
        cursorWorkspacePath = next.first ?? ""
      }
    }
  }

  /// Adds a folder to the allowlist and makes it the active workspace.
  func addCursorWorkspace(_ path: String) {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    var list = cursorWorkspaceAllowlist
    if !list.contains(trimmed) {
      list.append(trimmed)
    }
    cursorWorkspaceAllowlist = list
    cursorWorkspacePath = trimmed
  }

  /// Removes a folder from the allowlist. If it was active, activates another.
  func removeCursorWorkspace(_ path: String) {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    cursorWorkspaceAllowlist = cursorWorkspaceAllowlist.filter { $0 != trimmed }
  }

  /// Sets the active workspace if it is already on the allowlist.
  @discardableResult
  func setActiveCursorWorkspace(_ path: String) -> Bool {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, cursorWorkspaceAllowlist.contains(trimmed) else { return false }
    cursorWorkspacePath = trimmed
    return true
  }

  static func normalizeWorkspacePaths(_ paths: [String]) -> [String] {
    var seen = Set<String>()
    var out: [String] = []
    for raw in paths {
      let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmed.isEmpty, !seen.contains(trimmed) else { continue }
      seen.insert(trimmed)
      out.append(trimmed)
    }
    return out
  }

  /// Display label: `Partners` for `Partners.code-workspace`, else folder basename.
  static func cursorWorkspaceDisplayName(_ path: String) -> String {
    let base = (path as NSString).lastPathComponent
    if base.lowercased().hasSuffix(".code-workspace") {
      let name = (base as NSString).deletingPathExtension
      return name.isEmpty ? base : name
    }
    return base.isEmpty ? path : base
  }

  static func isCodeWorkspacePath(_ path: String) -> Bool {
    (path as NSString).lastPathComponent.lowercased().hasSuffix(".code-workspace")
  }

  /// True when the allowlist entry exists (folder or `.code-workspace` file).
  static func workspaceEntryExists(_ path: String) -> Bool {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return false }
    var isDir: ObjCBool = false
    guard FileManager.default.fileExists(atPath: trimmed, isDirectory: &isDir) else {
      return false
    }
    if Self.isCodeWorkspacePath(trimmed) {
      return !isDir.boolValue
    }
    return isDir.boolValue
  }

  /// Payload for `cursor.workspaces` (path + display name + kind).
  func cursorWorkspacesPayload() -> [String: Any] {
    let workspaces: [[String: String]] = cursorWorkspaceAllowlist.map { path in
      [
        "path": path,
        "name": Self.cursorWorkspaceDisplayName(path),
        "kind": Self.isCodeWorkspacePath(path) ? "code-workspace" : "folder",
      ]
    }
    let active = cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
    var payload: [String: Any] = ["workspaces": workspaces]
    if !active.isEmpty {
      payload["active"] = active
    }
    return payload
  }

  var cursorModel: String {
    get {
      let value = defaults.string(forKey: Key.cursorModel) ?? "default"
      return value.isEmpty ? "default" : value
    }
    set { defaults.set(newValue.isEmpty ? "default" : newValue, forKey: Key.cursorModel) }
  }

  /// JSON array of `{id,value}` model params, stored as a string for UserDefaults.
  var cursorModelParams: String {
    get { defaults.string(forKey: Key.cursorModelParams) ?? "[]" }
    set { defaults.set(newValue.isEmpty ? "[]" : newValue, forKey: Key.cursorModelParams) }
  }

  func cursorModelParamsJSONObject() -> [[String: String]]? {
    guard let data = cursorModelParams.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      return nil
    }
    let mapped: [[String: String]] = raw.compactMap { item in
      guard let id = item["id"] as? String, let value = item["value"] as? String,
            !id.isEmpty, !value.isEmpty else { return nil }
      return ["id": id, "value": value]
    }
    return mapped.isEmpty ? nil : mapped
  }

  // MARK: - Clipboard

  /// When true, advertise the `clipboard` cap and allow phone ↔ Mac sync.
  var clipboardSync: Bool {
    get { defaults.bool(forKey: Key.clipboardSync) }
    set { defaults.set(newValue, forKey: Key.clipboardSync) }
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
      "highlightPointer": highlightPointer,
      "openAtLogin": openAtLogin,
      "showMenuBarIcon": showMenuBarIcon,
      "hideDockIcon": hideDockIcon,
      "cursorAllowPhones": cursorAllowPhones,
      "cursorWorkspacePath": cursorWorkspacePath,
      "cursorWorkspaceAllowlist": cursorWorkspaceAllowlist,
      "cursorModel": cursorModel,
      "cursorModelParams": cursorModelParams,
      "cursorHasApiKey": CursorKeychain.hasApiKey(),
      "cursorReady": CursorAgentHost.isCapabilityReady(),
      "clipboardSync": clipboardSync,
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
    if let v = patch["highlightPointer"] as? Bool { highlightPointer = v }
    if let v = patch["openAtLogin"] as? Bool { openAtLogin = v }
    if let v = patch["showMenuBarIcon"] as? Bool { showMenuBarIcon = v }
    if let v = patch["hideDockIcon"] as? Bool { hideDockIcon = v }
    if let v = patch["cursorAllowPhones"] as? Bool { cursorAllowPhones = v }
    if let v = patch["cursorWorkspaceAllowlist"] as? [String] {
      cursorWorkspaceAllowlist = v
    }
    if let v = patch["cursorWorkspacePath"] as? String {
      let trimmed = v.trimmingCharacters(in: .whitespacesAndNewlines)
      if !trimmed.isEmpty {
        addCursorWorkspace(trimmed)
      } else {
        cursorWorkspacePath = ""
      }
    }
    if let v = patch["cursorModel"] as? String { cursorModel = v }
    if let v = patch["cursorModelParams"] as? String { cursorModelParams = v }
    if let v = patch["clipboardSync"] as? Bool { clipboardSync = v }
    NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
  }

  static let didChange = Notification.Name("EntanglePreferencesDidChange")
}
