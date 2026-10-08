import ApplicationServices
import Foundation

enum AccessibilityCheck {
  static func isTrusted() -> Bool {
    return AXIsProcessTrusted()
  }

  static func promptIfNeeded() -> Bool {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue()
    let options: CFDictionary = [key: kCFBooleanTrue!] as CFDictionary
    return AXIsProcessTrustedWithOptions(options)
  }
}
