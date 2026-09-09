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
  /// Which wire a message came in on. Pointer frames arrive on either; the
  /// diagnostics log counts them separately so the datagram path can be seen
  /// working, or seen falling back.
  enum Transport {
    case stream
    case datagram
  }

  static func handle(
    _ text: String,
    transport: Transport = .stream,
    respond: (String) -> Void
  ) -> Bool {
    guard let data = text.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let tag = json["t"] as? String else {
      return false
    }

    if let handled = dispatchInput(tag: tag, json: json, transport: transport) {
      return handled
    }
    if let handled = dispatchSystem(tag: tag, json: json, respond: respond) {
      return handled
    }
    return false
  }

  private static func dispatchInput(
    tag: String,
    json: [String: Any],
    transport: Transport
  ) -> Bool? {
    switch tag {
    case "p.move": return handlePointerMove(json, transport: transport)
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
    case "a.set": return handleAudioSet(json)
    case "a.step": return handleAudioStep(json)
    case "a.mute": return handleAudioMute(json)
    case "sys.wake":
      DisplayController.shared.wake()
      return true
    case "diag.set":
      guard let on = json["on"] as? Bool else { return false }
      LatencyMonitor.shared.setEnabled(on)
      return true
    case "diag.report": return handleDiagReport(json)
    case "ping": return handlePing(json, respond: respond)
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

  private static func handlePointerMove(
    _ json: [String: Any],
    transport: Transport = .stream
  ) -> Bool {
    guard let deltaX = numeric(json["dx"]), let deltaY = numeric(json["dy"]) else {
      return false
    }
    // `cx`/`cy` are the gesture's running total and take precedence; `dx`/`dy`
    // are the fallback for a phone that predates them.
    var cumulative: CGPoint?
    if let totalX = numeric(json["cx"]), let totalY = numeric(json["cy"]) {
      cumulative = CGPoint(x: totalX, y: totalY)
    }
    let frame = PointerAccumulator.Frame(
      dx: CGFloat(deltaX),
      dy: CGFloat(deltaY),
      cumulative: cumulative,
      gesture: numeric(json["g"]).map { Int($0) },
      seq: numeric(json["seq"]).map { Int($0) }
    )
    // Stamp the arrival before the queue hop, so the measured processing time
    // includes the hop rather than hiding it.
    let timing = LatencyMonitor.shared.enabled
      ? CursorController.MoveTiming(
          clientTimestamp: numeric(json["ts"]),
          arrival: LatencyMonitor.now(),
          viaDatagram: transport == .datagram
        )
      : nil
    CursorController.shared.apply(frame, timing: timing)
    return true
  }

  /// The phone's half of the diagnostics, folded into the same log line as
  /// ours so the two sides can be read together.
  private static func handleDiagReport(_ json: [String: Any]) -> Bool {
    guard let sendRate = numeric(json["sendRate"]),
          let rttP50 = numeric(json["rttP50"]),
          let rttP95 = numeric(json["rttP95"]) else {
      return false
    }
    LatencyMonitor.shared.recordPhoneReport(
      sendRate: Int(sendRate),
      touchRate: Int(numeric(json["touchRate"]) ?? sendRate),
      rttP50: rttP50,
      rttP95: rttP95
    )
    return true
  }

  /// Answered natively so the round trip the phone measures is the transport,
  /// not a lap through the desktop's JavaScript.
  private static func handlePing(_ json: [String: Any], respond: (String) -> Void) -> Bool {
    guard let id = numeric(json["id"]) else { return false }
    respond("{\"v\":1,\"t\":\"pong\",\"id\":\(Int(id))}")
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

  private static func handleAudioSet(_ json: [String: Any]) -> Bool {
    guard let level = numeric(json["level"]) else { return false }
    VolumeController.shared.setLevel(Float32(level))
    return true
  }

  private static func handleAudioStep(_ json: [String: Any]) -> Bool {
    guard let dir = json["dir"] as? String else { return false }
    switch dir {
    case "up":
      VolumeController.shared.step(up: true)
      return true
    case "down":
      VolumeController.shared.step(up: false)
      return true
    default:
      return false
    }
  }

  private static func handleAudioMute(_ json: [String: Any]) -> Bool {
    // Absent `muted` means toggle.
    VolumeController.shared.setMuted(json["muted"] as? Bool)
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

  static func encodeAudioState(level: Float32, muted: Bool) -> String? {
    let payload: [String: Any] = [
      "v": 1,
      "t": "state.audio",
      "level": Double(level),
      "muted": muted
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  static func encodeDisplayState(asleep: Bool) -> String? {
    let payload: [String: Any] = [
      "v": 1,
      "t": "state.display",
      "asleep": asleep
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  static func encodeUdpOk(frames: Int) -> String? {
    let payload: [String: Any] = ["v": 1, "t": "udp.ok", "frames": frames]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  static func encodeDiagState(_ snapshot: LatencyMonitor.Snapshot) -> String? {
    var payload: [String: Any] = [
      "v": 1,
      "t": "state.diag",
      "rate": snapshot.rate,
      "gapP50": jsonNumber(snapshot.gapP50),
      "gapP95": jsonNumber(snapshot.gapP95),
      "jitter": jsonNumber(snapshot.jitter),
      "procP50": jsonNumber(snapshot.procP50),
      "procP95": jsonNumber(snapshot.procP95),
      "stalls": snapshot.stalls
    ]
    if let logPath = LatencyMonitor.shared.logPath {
      payload["logPath"] = logPath
    }
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

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
