import CoreGraphics
import Foundation

/// Posts pixel-precise scroll wheel events with phase information so apps
/// such as Safari and Finder treat them as genuine trackpad scrolls.
final class ScrollController {
  static let shared = ScrollController()

  private let eventSource: CGEventSource?
  private let queue = DispatchQueue(label: "entangle.scroll", qos: .userInteractive)

  private init() {
    self.eventSource = CGEventSource(stateID: .hidSystemState)
  }

  func scroll(dx: Int32, dy: Int32, phase: ScrollPhase) {
    queue.async {
      self.postScroll(dx: dx, dy: dy, phase: phase)
    }
  }

  private func postScroll(dx: Int32, dy: Int32, phase: ScrollPhase) {
    guard let event = CGEvent(
      scrollWheelEvent2Source: eventSource,
      units: .pixel,
      wheelCount: 2,
      wheel1: dy,
      wheel2: dx,
      wheel3: 0
    ) else {
      return
    }
    event.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
    event.setIntegerValueField(.scrollWheelEventScrollPhase, value: Int64(phase.rawValue))
    event.post(tap: .cghidEventTap)
  }
}

/// Bitmask values for `kCGScrollWheelEventScrollPhase` as documented by
/// the Core Graphics event tap reference.
enum ScrollPhase: Int {
  case begin = 1    // kCGScrollPhaseBegan
  case change = 2   // kCGScrollPhaseChanged
  case end = 4      // kCGScrollPhaseEnded
}
