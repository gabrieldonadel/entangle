import ApplicationServices
import Foundation

enum AccessibilityCheck {
  /// Authoritative trust status. Never use the prompting variant for this —
  /// `AXIsProcessTrustedWithOptions(prompt: true)` can return false even when
  /// the process is already trusted (macOS returns the prompt-flow result).
  static func isTrusted() -> Bool {
    AXIsProcessTrusted()
  }

  /// Ask macOS to show the Accessibility consent UI if needed, then re-read
  /// trust with the non-prompting API so we don't overwrite a granted grant.
  @discardableResult
  static func promptIfNeeded() -> Bool {
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue()
    let options: CFDictionary = [key: kCFBooleanTrue!] as CFDictionary
    _ = AXIsProcessTrustedWithOptions(options)
    let trusted = AXIsProcessTrusted()
    NSLog("[Entangle] Accessibility trusted=%d", trusted)
    return trusted
  }
}
