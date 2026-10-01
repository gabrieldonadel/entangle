import Foundation
import Security

/// Stores the Cursor API key in the macOS Keychain — never UserDefaults.
enum CursorKeychain {
  private static let service = "app.entangle.cursor"
  private static let account = "apiKey"

  static func hasApiKey() -> Bool {
    loadApiKey() != nil
  }

  static func loadApiKey() -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  @discardableResult
  static func saveApiKey(_ key: String) -> Bool {
    let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return deleteApiKey()
    }
    let data = Data(trimmed.utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    let update = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if update == errSecSuccess { return true }
    if update == errSecItemNotFound {
      var add = query
      add[kSecValueData as String] = data
      add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let addStatus = SecItemAdd(add as CFDictionary, nil)
      if addStatus != errSecSuccess {
        NSLog("[entangle] CursorKeychain save failed: \(addStatus)")
      }
      return addStatus == errSecSuccess
    }
    NSLog("[entangle] CursorKeychain update failed: \(update)")
    return false
  }

  @discardableResult
  static func deleteApiKey() -> Bool {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    let status = SecItemDelete(query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }
}
