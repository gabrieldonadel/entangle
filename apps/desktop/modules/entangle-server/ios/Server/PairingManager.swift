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

  enum HandshakeOutcome {
    case trusted
    case rejected(reason: String)
  }

  /// Validates the first message a non-trusted connection sent against the
  /// active pair window. On success, marks the host as trusted.
  func verifyHandshake(host: String, message text: String) -> HandshakeOutcome {
    guard let window = currentWindow() else {
      return .rejected(reason: "pairing not active")
    }
    guard let data = text.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let kind = raw["t"] as? String else {
      return .rejected(reason: "expected pair.request or pair.qr")
    }
    switch kind {
    case "pair.qr":
      guard let token = raw["token"] as? String else {
        return .rejected(reason: "missing token")
      }
      guard token == window.token else {
        return .rejected(reason: "invalid token")
      }
    case "pair.request":
      guard let code = raw["code"] as? String else {
        return .rejected(reason: "missing code")
      }
      guard Self.normalizeCode(code) == Self.normalizeCode(window.code) else {
        return .rejected(reason: "invalid code")
      }
    default:
      return .rejected(reason: "expected pair.request or pair.qr")
    }
    trust(host: host)
    return .trusted
  }

  private static func normalizeCode(_ raw: String) -> String {
    raw.uppercased().filter { $0.isLetter || $0.isNumber }
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
