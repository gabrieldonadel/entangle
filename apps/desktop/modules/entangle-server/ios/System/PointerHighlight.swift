import AppKit
import Foundation

/// Draws a ring around the system pointer so it is easy to find while a phone
/// is driving it — the cursor is often nowhere near where the user is looking.
///
/// This is an overlay rather than a change to the macOS pointer size. The
/// accessibility pointer-size preference (`com.apple.universalaccess`
/// `mouseDriverCursorSize`) is not reliably applied to a running session, so
/// toggling it per connection would work on some Macs and silently do nothing
/// on others.
final class PointerHighlight {
  static let shared = PointerHighlight()

  /// Diameter of the ring in points.
  private static let size: CGFloat = 58
  /// Pointer polling interval. The window only moves when the pointer does.
  private static let interval: TimeInterval = 1.0 / 60.0

  private var window: NSWindow?
  private var timer: Timer?
  private var lastPoint: NSPoint = .zero

  private init() {}

  var isEnabled: Bool { window != nil }

  func setEnabled(_ enabled: Bool) {
    // AppKit is main-thread only, and callers are server-queue callbacks.
    if Thread.isMainThread {
      apply(enabled)
    } else {
      DispatchQueue.main.async { self.apply(enabled) }
    }
  }

  private func apply(_ enabled: Bool) {
    if enabled {
      show()
    } else {
      hide()
    }
  }

  private func show() {
    if window != nil { return }

    let frame = NSRect(x: 0, y: 0, width: Self.size, height: Self.size)
    let panel = NSWindow(
      contentRect: frame,
      styleMask: .borderless,
      backing: .buffered,
      defer: false
    )
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = false
    // Above normal windows and menus, and present on every Space and over
    // full-screen apps.
    panel.level = .screenSaver
    panel.collectionBehavior = [
      .canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary
    ]
    // Never take a click or the focus away from whatever the user is driving.
    panel.ignoresMouseEvents = true
    panel.contentView = HighlightView(frame: frame)
    panel.orderFrontRegardless()
    window = panel

    reposition(force: true)

    let timer = Timer(timeInterval: Self.interval, repeats: true) { [weak self] _ in
      self?.reposition(force: false)
    }
    // .common keeps it ticking during window drags and menu tracking.
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
  }

  private func hide() {
    timer?.invalidate()
    timer = nil
    window?.orderOut(nil)
    window = nil
  }

  private func reposition(force: Bool) {
    guard let window = window else { return }
    let point = NSEvent.mouseLocation
    if !force, abs(point.x - lastPoint.x) < 0.5, abs(point.y - lastPoint.y) < 0.5 {
      return
    }
    lastPoint = point
    window.setFrameOrigin(
      NSPoint(x: point.x - Self.size / 2, y: point.y - Self.size / 2)
    )
  }
}

private final class HighlightView: NSView {
  override var isOpaque: Bool { false }

  override func draw(_ dirtyRect: NSRect) {
    guard let context = NSGraphicsContext.current?.cgContext else { return }
    let accent = NSColor(
      calibratedRed: 163 / 255, green: 187 / 255, blue: 214 / 255, alpha: 1
    )

    // Soft glow, a dark contour, then the accent ring. The middle is left
    // untouched so the real pointer stays readable underneath.
    //
    // The dark contour matters: the accent is a pale steel blue and would all
    // but vanish on white content, which is most of what people look at.
    // Pairing it with a translucent black outline keeps the ring legible on
    // light and dark backgrounds alike.
    let outer = bounds.insetBy(dx: 3, dy: 3)
    let ring = outer.insetBy(dx: 8, dy: 8)

    context.saveGState()
    context.setStrokeColor(accent.withAlphaComponent(0.20).cgColor)
    context.setLineWidth(8)
    context.strokeEllipse(in: outer.insetBy(dx: 4, dy: 4))
    context.restoreGState()

    context.saveGState()
    context.setStrokeColor(NSColor.black.withAlphaComponent(0.45).cgColor)
    context.setLineWidth(5)
    context.strokeEllipse(in: ring)
    context.restoreGState()

    context.saveGState()
    context.setStrokeColor(accent.withAlphaComponent(1).cgColor)
    context.setLineWidth(2.5)
    context.strokeEllipse(in: ring)
    context.restoreGState()
  }
}
