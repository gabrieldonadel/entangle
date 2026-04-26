import Foundation

/// Synthesizes the macOS-native equivalents of trackpad gestures by sending
/// the default Spaces / Mission Control keyboard shortcuts. `KeyController`
/// adds `kCGEventFlagMaskSecondaryFn` to arrow-key events so the WindowServer
/// recognizes them as real keypresses (without it, ⌃← / ⌃→ / ⌃↑ would be
/// posted but ignored).
enum GestureController {
  static let shortcutModifiers: UInt32 = ModFlag.control.rawValue

  static func spaceLeft() {
    KeyController.shared.pressKey(code: .arrowLeft, phase: .tap, mods: shortcutModifiers)
  }

  static func spaceRight() {
    KeyController.shared.pressKey(code: .arrowRight, phase: .tap, mods: shortcutModifiers)
  }

  static func missionControl() {
    KeyController.shared.pressKey(code: .arrowUp, phase: .tap, mods: shortcutModifiers)
  }
}
