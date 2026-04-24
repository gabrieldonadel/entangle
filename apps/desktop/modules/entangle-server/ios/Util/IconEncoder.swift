import AppKit
import Foundation

/// Resizes an `NSImage` to a capped square and returns a base64 PNG string.
/// The max dimension is small (64×64) so full-dock payloads stay under 100 KB.
enum IconEncoder {
  static func encode(_ image: NSImage, maxDimension: CGFloat = 64) -> String? {
    let size = NSSize(width: maxDimension, height: maxDimension)
    let resized = NSImage(size: size)
    resized.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    image.draw(
      in: NSRect(origin: .zero, size: size),
      from: .zero,
      operation: .sourceOver,
      fraction: 1.0
    )
    resized.unlockFocus()
    guard let tiff = resized.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
      return nil
    }
    return png.base64EncodedString()
  }
}
