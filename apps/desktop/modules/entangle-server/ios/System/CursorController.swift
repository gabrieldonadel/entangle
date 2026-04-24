import AppKit
import CoreGraphics
import Foundation

final class CursorController {
  static let shared = CursorController()

  private let eventSource: CGEventSource?
  private let queue = DispatchQueue(label: "entangle.cursor", qos: .userInteractive)

  private init() {
    self.eventSource = CGEventSource(stateID: .hidSystemState)
  }

  func move(dx: CGFloat, dy: CGFloat) {
    queue.async {
      let current = self.currentMouseLocation()
      let target = self.clampToScreens(CGPoint(x: current.x + dx, y: current.y + dy))
      self.postMove(to: target)
    }
  }

  func click(button: MouseButton, phase: ClickPhase) {
    queue.async {
      switch phase {
      case .down:
        self.postButton(button, isDown: true)
      case .up:
        self.postButton(button, isDown: false)
      case .tap:
        self.postButton(button, isDown: true)
        self.postButton(button, isDown: false)
      }
    }
  }

  // MARK: - Private

  private func currentMouseLocation() -> CGPoint {
    if let location = CGEvent(source: nil)?.location {
      return location
    }
    let ns = NSEvent.mouseLocation
    let primary = NSScreen.screens.first?.frame ?? .zero
    return CGPoint(x: ns.x, y: primary.height - ns.y)
  }

  private func clampToScreens(_ point: CGPoint) -> CGPoint {
    let screens = NSScreen.screens
    guard !screens.isEmpty else { return point }

    var unionRect: CGRect = .null
    for screen in screens {
      let frame = screen.frame
      let primaryHeight = screens[0].frame.height
      // CGEvent uses top-left origin; NSScreen uses bottom-left. Convert to CG coords.
      let converted = CGRect(
        x: frame.origin.x,
        y: primaryHeight - frame.origin.y - frame.height,
        width: frame.width,
        height: frame.height
      )
      unionRect = unionRect.isNull ? converted : unionRect.union(converted)
    }

    let x = min(max(point.x, unionRect.minX), unionRect.maxX - 1)
    let y = min(max(point.y, unionRect.minY), unionRect.maxY - 1)
    return CGPoint(x: x, y: y)
  }

  private func postMove(to point: CGPoint) {
    let event = CGEvent(
      mouseEventSource: eventSource,
      mouseType: .mouseMoved,
      mouseCursorPosition: point,
      mouseButton: .left
    )
    event?.post(tap: .cghidEventTap)
  }

  private func postButton(_ button: MouseButton, isDown: Bool) {
    let location = currentMouseLocation()
    let type: CGEventType
    let cgButton: CGMouseButton
    switch button {
    case .left:
      type = isDown ? .leftMouseDown : .leftMouseUp
      cgButton = .left
    case .right:
      type = isDown ? .rightMouseDown : .rightMouseUp
      cgButton = .right
    }
    let event = CGEvent(
      mouseEventSource: eventSource,
      mouseType: type,
      mouseCursorPosition: location,
      mouseButton: cgButton
    )
    event?.post(tap: .cghidEventTap)
  }
}

enum MouseButton: String {
  case left
  case right
}

enum ClickPhase: String {
  case down
  case up
  case tap
}
