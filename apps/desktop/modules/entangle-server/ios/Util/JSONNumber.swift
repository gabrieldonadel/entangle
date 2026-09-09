import Foundation

/// Rounds a measurement for output at a fixed number of decimals.
///
/// `JSONSerialization` prints a `Double` at full precision, so a rounded
/// 8.15 comes out as `8.1500000000000004` and the log becomes hard to read.
/// An `NSDecimalNumber` built from the formatted string serializes as the
/// short form.
func jsonNumber(_ value: Double, places: Int = 2) -> NSNumber {
  guard value.isFinite else { return NSDecimalNumber.zero }
  return NSDecimalNumber(string: String(format: "%.\(places)f", value))
}
