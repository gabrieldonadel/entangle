import Foundation

/// Parses JSON messages from mobile clients and dispatches hot-path events
/// (pointer, click) directly to native controllers.
///
/// Returns true when the message was handled natively and does not need to be
/// surfaced to JavaScript for further processing.
enum MessageDispatcher {
  static func handle(_ text: String) -> Bool {
    guard let data = text.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let tag = json["t"] as? String else {
      return false
    }

    switch tag {
    case "p.move":
      guard let dx = numeric(json["dx"]), let dy = numeric(json["dy"]) else {
        return false
      }
      CursorController.shared.move(dx: CGFloat(dx), dy: CGFloat(dy))
      return true

    case "p.click":
      guard let buttonRaw = json["button"] as? String,
            let button = MouseButton(rawValue: buttonRaw),
            let phaseRaw = json["phase"] as? String,
            let phase = ClickPhase(rawValue: phaseRaw) else {
        return false
      }
      CursorController.shared.click(button: button, phase: phase)
      return true

    default:
      return false
    }
  }

  private static func numeric(_ value: Any?) -> Double? {
    if let n = value as? Double { return n }
    if let n = value as? Int { return Double(n) }
    if let n = value as? NSNumber { return n.doubleValue }
    return nil
  }
}
