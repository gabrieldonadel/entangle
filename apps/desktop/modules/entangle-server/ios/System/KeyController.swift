import CoreGraphics
import Foundation

/// Posts keyboard events via `CGEvent`. Special keys are synthesized with
/// their macOS virtual key codes so system shortcuts (⌘Space, ⌘Tab, arrow
/// navigation) behave the same as a physical keyboard. IME-composed text
/// arrives as `k.text` and is inserted via `keyboardSetUnicodeString`, which
/// bypasses the Mac's own input method.
final class KeyController {
  static let shared = KeyController()

  private let eventSource: CGEventSource?
  private let queue = DispatchQueue(label: "entangle.keyboard", qos: .userInteractive)

  private init() {
    self.eventSource = CGEventSource(stateID: .hidSystemState)
  }

  func pressKey(code: KeyCodeName, phase: KeyPhase, mods: UInt32) {
    queue.async {
      let flags = Self.flagsForMask(mods)
      guard let virtualKey = Self.virtualKey(for: code) else { return }
      switch phase {
      case .down:
        self.postKey(virtualKey, keyDown: true, flags: flags)
      case .up:
        self.postKey(virtualKey, keyDown: false, flags: flags)
      case .tap:
        self.postKey(virtualKey, keyDown: true, flags: flags)
        self.postKey(virtualKey, keyDown: false, flags: flags)
      }
    }
  }

  func typeText(_ text: String) {
    queue.async {
      let utf16 = Array(text.utf16)
      guard !utf16.isEmpty,
            let downEvent = CGEvent(keyboardEventSource: self.eventSource, virtualKey: 0, keyDown: true),
            let upEvent = CGEvent(keyboardEventSource: self.eventSource, virtualKey: 0, keyDown: false) else {
        return
      }
      utf16.withUnsafeBufferPointer { buffer in
        guard let base = buffer.baseAddress else { return }
        downEvent.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: base)
        upEvent.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: base)
      }
      downEvent.post(tap: .cghidEventTap)
      upEvent.post(tap: .cghidEventTap)
    }
  }

  // MARK: - Private

  private func postKey(_ virtualKey: CGKeyCode, keyDown: Bool, flags: CGEventFlags) {
    guard let event = CGEvent(keyboardEventSource: eventSource, virtualKey: virtualKey, keyDown: keyDown) else {
      return
    }
    event.flags = flags
    event.post(tap: .cghidEventTap)
  }

  private static func flagsForMask(_ mask: UInt32) -> CGEventFlags {
    var flags: CGEventFlags = []
    if mask & ModFlag.command.rawValue != 0 { flags.insert(.maskCommand) }
    if mask & ModFlag.option.rawValue != 0 { flags.insert(.maskAlternate) }
    if mask & ModFlag.shift.rawValue != 0 { flags.insert(.maskShift) }
    if mask & ModFlag.control.rawValue != 0 { flags.insert(.maskControl) }
    if mask & ModFlag.fn.rawValue != 0 { flags.insert(.maskSecondaryFn) }
    return flags
  }

  private static let keyMap: [KeyCodeName: CGKeyCode] = [
    .escape: 0x35,
    .tab: 0x30,
    .return: 0x24,
    .backspace: 0x33,
    .delete: 0x75,
    .arrowUp: 0x7E,
    .arrowDown: 0x7D,
    .arrowLeft: 0x7B,
    .arrowRight: 0x7C,
    .space: 0x31,
    .home: 0x73,
    .end: 0x77,
    .pageUp: 0x74,
    .pageDown: 0x79,
    .f1: 0x7A, .f2: 0x78, .f3: 0x63, .f4: 0x76,
    .f5: 0x60, .f6: 0x61, .f7: 0x62, .f8: 0x64,
    .f9: 0x65, .f10: 0x6D, .f11: 0x67, .f12: 0x6F
  ]

  private static func virtualKey(for code: KeyCodeName) -> CGKeyCode? {
    return keyMap[code]
  }
}

enum KeyCodeName: String {
  case escape = "Escape"
  case tab = "Tab"
  case `return` = "Return"
  case backspace = "Backspace"
  case delete = "Delete"
  case arrowUp = "ArrowUp"
  case arrowDown = "ArrowDown"
  case arrowLeft = "ArrowLeft"
  case arrowRight = "ArrowRight"
  case space = "Space"
  case home = "Home"
  case end = "End"
  case pageUp = "PageUp"
  case pageDown = "PageDown"
  case f1 = "F1", f2 = "F2", f3 = "F3", f4 = "F4"
  case f5 = "F5", f6 = "F6", f7 = "F7", f8 = "F8"
  case f9 = "F9", f10 = "F10", f11 = "F11", f12 = "F12"
}

enum KeyPhase: String {
  case down
  case up
  case tap
}

enum ModFlag: UInt32 {
  case command = 1
  case option = 2
  case shift = 4
  case control = 8
  case fn = 16
}
