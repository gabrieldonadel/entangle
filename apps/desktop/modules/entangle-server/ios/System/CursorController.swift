import AppKit
import CoreGraphics
import Foundation

final class CursorController {
  static let shared = CursorController()

  private let eventSource: CGEventSource?
  private let queue = DispatchQueue(label: "entangle.cursor", qos: .userInteractive)
  private var isDragging: Bool = false

  // Click-count tracking for double / triple click recognition. macOS expects
  // mouseDown events with `mouseEventClickState = 2/3` for the 2nd/3rd click
  // in a series, otherwise apps see only single clicks.
  private var lastClickAt: Date = .distantPast
  private var lastClickPosition: CGPoint = .zero
  private var currentClickState: Int64 = 1

  /// Maximum gap (px) between two clicks to still count as a multi-click.
  private static let doubleClickPositionTolerance: CGFloat = 5

  private init() {
    self.eventSource = CGEventSource(stateID: .hidSystemState)
  }

  func move(dx: CGFloat, dy: CGFloat) {
    let scale = CGFloat(PreferencesStore.shared.sensitivity)
    queue.async {
      let current = self.currentMouseLocation()
      let target = self.clampToScreens(CGPoint(x: current.x + dx * scale, y: current.y + dy * scale))
      self.postMove(to: target, dragging: self.isDragging)
    }
  }

  func click(button: MouseButton, phase: ClickPhase) {
    queue.async {
      switch phase {
      case .down:
        let state = self.advanceClickState(at: self.currentMouseLocation())
        self.postButton(button, isDown: true, clickState: state)
      case .up:
        // Pair the up event with whatever click count the matching down used.
        self.postButton(button, isDown: false, clickState: self.currentClickState)
      case .tap:
        guard PreferencesStore.shared.tapToClick else { return }
        let state = self.advanceClickState(at: self.currentMouseLocation())
        self.postButton(button, isDown: true, clickState: state)
        self.postButton(button, isDown: false, clickState: state)
      }
    }
  }

  func dragBegin() {
    queue.async {
      guard !self.isDragging else { return }
      self.isDragging = true
      // Drag is always a fresh single-click gesture; reset any double-click
      // streak so the press isn't interpreted as the 2nd click of a pair.
      self.resetClickState()
      self.postButton(.left, isDown: true, clickState: 1)
    }
  }

  func dragEnd() {
    queue.async {
      guard self.isDragging else { return }
      self.postButton(.left, isDown: false, clickState: 1)
      self.isDragging = false
    }
  }

  // MARK: - Click-state tracking

  private func advanceClickState(at location: CGPoint) -> Int64 {
    let now = Date()
    let elapsed = now.timeIntervalSince(lastClickAt)
    let deltaX = location.x - lastClickPosition.x
    let deltaY = location.y - lastClickPosition.y
    let distance = sqrt(deltaX * deltaX + deltaY * deltaY)

    if elapsed <= NSEvent.doubleClickInterval
        && distance <= Self.doubleClickPositionTolerance {
      currentClickState += 1
    } else {
      currentClickState = 1
    }
    lastClickAt = now
    lastClickPosition = location
    return currentClickState
  }

  private func resetClickState() {
    currentClickState = 1
    lastClickAt = .distantPast
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

  private func postMove(to point: CGPoint, dragging: Bool) {
    let event = CGEvent(
      mouseEventSource: eventSource,
      mouseType: dragging ? .leftMouseDragged : .mouseMoved,
      mouseCursorPosition: point,
      mouseButton: .left
    )
    if dragging {
      // Apps that implement text selection (editors, terminals) ignore
      // dragged events whose click count is 0. Match the click count of the
      // synthetic mouseDown that started the drag so they're recognized as
      // a real selection gesture.
      event?.setIntegerValueField(.mouseEventClickState, value: 1)
    }
    event?.post(tap: .cghidEventTap)
  }

  private func postButton(_ button: MouseButton, isDown: Bool, clickState: Int64) {
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
    // clickState carries the multi-click count: 1 for a single click, 2 for
    // the 2nd click in a double-click pair, 3 for triple-click, etc. AppKit
    // selection (and drag) tracking ignores synthetic mouseDown events whose
    // clickState is 0, so this must be set on every press.
    event?.setIntegerValueField(.mouseEventClickState, value: clickState)
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
