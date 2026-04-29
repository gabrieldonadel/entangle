import Foundation

final class PairingManager {
  static let shared = PairingManager()

  private let queue = DispatchQueue(label: "entangle.pairing", attributes: .concurrent)
  private let trustedKey = "entangle.trustedHosts"
  private let defaults = UserDefaults.standard

  private var _activeCode: String?
  private var _activeToken: String?
  private var _expiresAt: Date?

  struct PairingWindow {
    let code: String
    let token: String
    let expiresAt: Date
  }

  func currentWindow() -> PairingWindow? {
    queue.sync {
      guard
        let code = _activeCode,
        let token = _activeToken,
        let expiresAt = _expiresAt,
        expiresAt > Date()
      else {
        return nil
      }
      return PairingWindow(code: code, token: token, expiresAt: expiresAt)
    }
  }

  func startPairing(durationSeconds: TimeInterval = 300) -> PairingWindow {
    let code = Self.generateCode()
    let token = Self.generateToken()
    let expiresAt = Date(timeIntervalSinceNow: durationSeconds)

    queue.async(flags: .barrier) {
      self._activeCode = code
      self._activeToken = token
      self._expiresAt = expiresAt
    }

    return PairingWindow(code: code, token: token, expiresAt: expiresAt)
  }

  func stopPairing() {
    queue.async(flags: .barrier) {
      self._activeCode = nil
      self._activeToken = nil
      self._expiresAt = nil
    }
  }

  func isPairing() -> Bool {
    currentWindow() != nil
  }

  // MARK: - Trust list

  func trustedHosts() -> Set<String> {
    let arr = defaults.stringArray(forKey: trustedKey) ?? []
    return Set(arr)
  }

  func isTrusted(host: String) -> Bool {
    trustedHosts().contains(Self.normalize(host: host))
  }

  func trust(host: String) {
    var current = trustedHosts()
    current.insert(Self.normalize(host: host))
    defaults.set(Array(current), forKey: trustedKey)
  }

  func forgetAll() {
    defaults.removeObject(forKey: trustedKey)
  }

  /// Returns whether the new client should be allowed to connect.
  /// Bootstraps trust on first-ever client (fresh install) so the user is not
  /// locked out before they can open the pair sheet.
  func shouldAccept(host: String) -> Bool {
    let normalized = Self.normalize(host: host)
    if trustedHosts().contains(normalized) { return true }
    if isPairing() {
      trust(host: normalized)
      return true
    }
    if trustedHosts().isEmpty {
      trust(host: normalized)
      return true
    }
    return false
  }

  // MARK: - Helpers

  /// Strips the port off "host:port" so we identify by IP/hostname only.
  private static func normalize(host: String) -> String {
    if let colon = host.lastIndex(of: ":") {
      return String(host[..<colon])
    }
    return host
  }

  private static func generateCode() -> String {
    let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
    func pair() -> String {
      String((0..<2).map { _ in alphabet.randomElement()! })
    }
    return "\(pair()) · \(pair()) · \(pair())"
  }

  private static func generateToken() -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes)
    return Data(bytes)
      .base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}
