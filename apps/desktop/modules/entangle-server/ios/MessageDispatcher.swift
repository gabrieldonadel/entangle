import Foundation

/// Parses JSON messages from mobile clients and dispatches hot-path events
/// (pointer, click, scroll, drag, keyboard, dock) directly to native
/// controllers.
///
/// Returns true when the message was handled natively and does not need to be
/// surfaced to JavaScript for further processing. Handlers can call the
/// supplied `respond` closure to send a message back to the originating
/// client (used for request-response pairs like `d.list`).
enum MessageDispatcher {
  static func handle(_ text: String, respond: (String) -> Void) -> Bool {
    guard let data = text.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let tag = json["t"] as? String else {
      return false
    }

    if let handled = dispatchInput(tag: tag, json: json) {
      return handled
    }
    if let handled = dispatchSystem(tag: tag, json: json, respond: respond) {
      return handled
    }
    return false
  }

  private static func dispatchInput(tag: String, json: [String: Any]) -> Bool? {
    switch tag {
    case "p.move": return handlePointerMove(json)
    case "p.click": return handlePointerClick(json)
    case "p.drag": return handlePointerDrag(json)
    case "s.wheel": return handleScrollWheel(json)
    case "k.text": return handleKeyText(json)
    case "k.key": return handleKeyPress(json)
    default: return nil
    }
  }

  private static func dispatchSystem(
    tag: String,
    json: [String: Any],
    respond: (String) -> Void
  ) -> Bool? {
    switch tag {
    case "d.list": return handleDockList(respond: respond)
    case "d.activate": return handleDockActivate(json)
    case "g.space": return handleSpaceGesture(json)
    case "g.mission":
      GestureController.missionControl()
      return true
    default: return nil
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

  private static func handleKeyText(_ json: [String: Any]) -> Bool {
    guard let text = json["text"] as? String, !text.isEmpty else { return false }
    KeyController.shared.typeText(text)
    return true
  }

  private static func handleKeyPress(_ json: [String: Any]) -> Bool {
    guard let codeRaw = json["code"] as? String,
          let code = KeyCodeName(rawValue: codeRaw),
          let phaseRaw = json["phase"] as? String,
          let phase = KeyPhase(rawValue: phaseRaw) else {
      return false
    }
    let mods: UInt32
    if let maskValue = numeric(json["mods"]) {
      mods = UInt32(maskValue)
    } else {
      mods = 0
    }
    KeyController.shared.pressKey(code: code, phase: phase, mods: mods)
    return true
  }

  private static func handleDockList(respond: (String) -> Void) -> Bool {
    let apps = DockEnumerator.shared.currentApps()
    if let encoded = encodeDockList(apps) {
      respond(encoded)
    }
    return true
  }

  private static func handleDockActivate(_ json: [String: Any]) -> Bool {
    guard let bundleId = json["bundleId"] as? String, !bundleId.isEmpty else {
      return false
    }
    DockEnumerator.shared.activate(bundleId: bundleId)
    return true
  }

  private static func handleSpaceGesture(_ json: [String: Any]) -> Bool {
    guard let dir = json["dir"] as? String else { return false }
    switch dir {
    case "left":
      GestureController.spaceLeft()
      return true
    case "right":
      GestureController.spaceRight()
      return true
    default:
      return false
    }
  }

  // MARK: - Helpers

  static func encodeDockList(_ apps: [DockEnumerator.DockApp]) -> String? {
    let payload: [String: Any] = [
      "v": 1,
      "t": "d.list",
      "apps": apps.map { $0.toDictionary() }
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  private static func numeric(_ value: Any?) -> Double? {
    if let number = value as? Double { return number }
    if let number = value as? Int { return Double(number) }
    if let number = value as? NSNumber { return number.doubleValue }
    return nil
  }
}
