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
        // Press the modifier keys explicitly so the WindowServer's modifier
        // state matches the synthesized event sequence — without these, Ctrl
        // (and friends) would stay latched after the tap and bleed into
        // subsequent clicks (e.g. registering as a right-click).
        let modifierKeys = Self.modifierVirtualKeys(for: mods)
        for modKey in modifierKeys {
          self.postModifier(modKey, keyDown: true, flags: flags)
        }
        self.postKey(virtualKey, keyDown: true, flags: flags)
        self.postKey(virtualKey, keyDown: false, flags: flags)
        for modKey in modifierKeys.reversed() {
          self.postModifier(modKey, keyDown: false, flags: [])
        }
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
    var combinedFlags = flags
    if Self.extendedKeys.contains(virtualKey) {
      combinedFlags.insert(.maskSecondaryFn)
    }
    event.flags = combinedFlags
    event.post(tap: .cghidEventTap)
  }

  /// Posts a modifier-key transition (Control, Shift, etc.). The event must
  /// not carry `.maskSecondaryFn` even though it is technically a key press —
  /// that flag is reserved for arrow / nav / F-keys.
  private func postModifier(_ virtualKey: CGKeyCode, keyDown: Bool, flags: CGEventFlags) {
    guard let event = CGEvent(
      keyboardEventSource: eventSource,
      virtualKey: virtualKey,
      keyDown: keyDown
    ) else { return }
    event.flags = flags
    event.post(tap: .cghidEventTap)
  }

  /// Maps a `ModFlag` bitmask to the virtual key codes for the corresponding
  /// modifier keys, ordered as a real typist would press them so we can
  /// release them in reverse.
  private static func modifierVirtualKeys(for mask: UInt32) -> [CGKeyCode] {
    var keys: [CGKeyCode] = []
    if mask & ModFlag.command.rawValue != 0 { keys.append(0x37) } // left command
    if mask & ModFlag.shift.rawValue   != 0 { keys.append(0x38) } // left shift
    if mask & ModFlag.option.rawValue  != 0 { keys.append(0x3A) } // left option
    if mask & ModFlag.control.rawValue != 0 { keys.append(0x3B) } // left control
    if mask & ModFlag.fn.rawValue      != 0 { keys.append(0x3F) } // fn
    return keys
  }

  /// Arrow keys, navigation keys and F-keys carry `kCGEventFlagMaskSecondaryFn`
  /// when typed on a real Mac keyboard. macOS shortcut detection (Spaces,
  /// Mission Control, etc.) requires this flag to be set, so we add it for
  /// these keys when synthesizing events.
  private static let extendedKeys: Set<CGKeyCode> = [
    0x7B, 0x7C, 0x7D, 0x7E,           // arrow keys
    0x73, 0x74, 0x77, 0x79,           // home, pageUp, end, pageDown
    0x7A, 0x78, 0x63, 0x76,           // F1–F4
    0x60, 0x61, 0x62, 0x64,           // F5–F8
    0x65, 0x6D, 0x67, 0x6F            // F9–F12
  ]

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
    .f9: 0x65, .f10: 0x6D, .f11: 0x67, .f12: 0x6F,
    // ANSI letters, digits and punctuation. Present so a modifier can be
    // combined with an ordinary character (⌘C, ⌘⇧Z, ⌘+): `k.text` inserts a
    // Unicode string and carries no modifier mask, so a shortcut has to be
    // posted as a real key event instead.
    .keyA: 0x00, .keyB: 0x0B, .keyC: 0x08, .keyD: 0x02, .keyE: 0x0E,
    .keyF: 0x03, .keyG: 0x05, .keyH: 0x04, .keyI: 0x22, .keyJ: 0x26,
    .keyK: 0x28, .keyL: 0x25, .keyM: 0x2E, .keyN: 0x2D, .keyO: 0x1F,
    .keyP: 0x23, .keyQ: 0x0C, .keyR: 0x0F, .keyS: 0x01, .keyT: 0x11,
    .keyU: 0x20, .keyV: 0x09, .keyW: 0x0D, .keyX: 0x07, .keyY: 0x10,
    .keyZ: 0x06,
    .digit0: 0x1D, .digit1: 0x12, .digit2: 0x13, .digit3: 0x14, .digit4: 0x15,
    .digit5: 0x17, .digit6: 0x16, .digit7: 0x1A, .digit8: 0x1C, .digit9: 0x19,
    .minus: 0x1B,
    .equal: 0x18,
    .bracketLeft: 0x21,
    .bracketRight: 0x1E,
    .backslash: 0x2A,
    .semicolon: 0x29,
    .quote: 0x27,
    .backquote: 0x32,
    .comma: 0x2B,
    .period: 0x2F,
    .slash: 0x2C
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
  case keyA = "KeyA", keyB = "KeyB", keyC = "KeyC", keyD = "KeyD"
  case keyE = "KeyE", keyF = "KeyF", keyG = "KeyG", keyH = "KeyH"
  case keyI = "KeyI", keyJ = "KeyJ", keyK = "KeyK", keyL = "KeyL"
  case keyM = "KeyM", keyN = "KeyN", keyO = "KeyO", keyP = "KeyP"
  case keyQ = "KeyQ", keyR = "KeyR", keyS = "KeyS", keyT = "KeyT"
  case keyU = "KeyU", keyV = "KeyV", keyW = "KeyW", keyX = "KeyX"
  case keyY = "KeyY", keyZ = "KeyZ"
  case digit0 = "Digit0", digit1 = "Digit1", digit2 = "Digit2"
  case digit3 = "Digit3", digit4 = "Digit4", digit5 = "Digit5"
  case digit6 = "Digit6", digit7 = "Digit7", digit8 = "Digit8"
  case digit9 = "Digit9"
  case minus = "Minus"
  case equal = "Equal"
  case bracketLeft = "BracketLeft"
  case bracketRight = "BracketRight"
  case backslash = "Backslash"
  case semicolon = "Semicolon"
  case quote = "Quote"
  case backquote = "Backquote"
  case comma = "Comma"
  case period = "Period"
  case slash = "Slash"
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
