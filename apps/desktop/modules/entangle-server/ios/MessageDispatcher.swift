import Foundation

/// Parses JSON messages from mobile clients and dispatches hot-path events
/// (pointer, click, scroll, drag) directly to native controllers.
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
      return handlePointerMove(json)
    case "p.click":
      return handlePointerClick(json)
    case "p.drag":
      return handlePointerDrag(json)
    case "s.wheel":
      return handleScrollWheel(json)
    default:
      return false
    }
  }

  // MARK: - Handlers

  private static func handlePointerMove(_ json: [String: Any]) -> Bool {
    guard let deltaX = numeric(json["dx"]), let deltaY = numeric(json["dy"]) else {
      return false
    }
    CursorController.shared.move(dx: CGFloat(deltaX), dy: CGFloat(deltaY))
    return true
  }

  private static func handlePointerClick(_ json: [String: Any]) -> Bool {
    guard let buttonRaw = json["button"] as? String,
          let button = MouseButton(rawValue: buttonRaw),
          let phaseRaw = json["phase"] as? String,
          let phase = ClickPhase(rawValue: phaseRaw) else {
      return false
    }
    CursorController.shared.click(button: button, phase: phase)
    return true
  }

  private static func handlePointerDrag(_ json: [String: Any]) -> Bool {
    guard let phase = json["phase"] as? String else { return false }
    switch phase {
    case "begin":
      CursorController.shared.dragBegin()
      return true
    case "end":
      CursorController.shared.dragEnd()
      return true
    default:
      return false
    }
  }

  private static func handleScrollWheel(_ json: [String: Any]) -> Bool {
    guard let deltaX = numeric(json["dx"]),
          let deltaY = numeric(json["dy"]),
          let phaseRaw = json["phase"] as? String else {
      return false
    }
    let phase: ScrollPhase
    switch phaseRaw {
    case "begin": phase = .begin
    case "change": phase = .change
    case "end": phase = .end
    default: return false
    }
    ScrollController.shared.scroll(dx: Int32(deltaX), dy: Int32(deltaY), phase: phase)
    return true
  }

  // MARK: - Helpers

  private static func numeric(_ value: Any?) -> Double? {
    if let number = value as? Double { return number }
    if let number = value as? Int { return Double(number) }
    if let number = value as? NSNumber { return number.doubleValue }
    return nil
  }
}
