import Foundation

/// Measures what happens to the pointer stream on this side of the wire.
///
/// Every figure comes from the Mac's own clock. The phone's timestamps are
/// only ever compared against each other, never against ours, so nothing here
/// needs the two devices to agree about the time — see `jitter` below.
///
/// Disabled by default, and while it is off the dispatcher does not even build
/// the timing — so the hot path pays one flag read per pointer frame.
final class LatencyMonitor {
  static let shared = LatencyMonitor()

  struct Snapshot {
    let rate: Int
    let gapP50: Double
    let gapP95: Double
    let jitter: Double
    let procP50: Double
    let procP95: Double
    let stalls: Int
  }

  /// A gap longer than this reads as a stall rather than as pacing.
  private static let stallThresholdMs: Double = 50

  /// Called once a second while enabled.
  var onSnapshot: ((Snapshot) -> Void)?

  private let lock = NSLock()
  private var isEnabled = false
  private var timer: DispatchSourceTimer?

  private var gaps: [Double] = []
  private var processing: [Double] = []
  private var variations: [Double] = []
  private var stalls = 0
  private var lastArrival: Double?
  private var lastClientTimestamp: Double?

  private init() {}

  var enabled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return isEnabled
  }

  func setEnabled(_ enabled: Bool) {
    lock.lock()
    let changed = enabled != isEnabled
    isEnabled = enabled
    if !enabled { resetLocked() }
    lock.unlock()
    guard changed else { return }
    if enabled { startTimer() } else { stopTimer() }
  }

  /// - Parameters:
  ///   - clientTimestamp: the phone's `ts`, in its own milliseconds.
  ///   - arrival: when the frame reached us, in our milliseconds.
  ///   - posted: when the CGEvent went out, in our milliseconds.
  func record(clientTimestamp: Double?, arrival: Double, posted: Double) {
    lock.lock()
    defer { lock.unlock() }
    guard isEnabled else { return }

    if let previous = lastArrival {
      let gap = arrival - previous
      gaps.append(gap)
      if gap > Self.stallThresholdMs { stalls += 1 }

      // One-way delay variation: how much the arrival gap differs from the
      // send gap. Both terms are differences within a single clock, so a
      // constant offset between the two devices cancels out.
      if let clientTimestamp = clientTimestamp, let previousClient = lastClientTimestamp {
        variations.append(abs(gap - (clientTimestamp - previousClient)))
      }
    }
    lastArrival = arrival
    if let clientTimestamp = clientTimestamp { lastClientTimestamp = clientTimestamp }
    processing.append(posted - arrival)
  }

  /// Milliseconds on a monotonic clock. Unlike `Date`, it cannot step
  /// backwards when the system clock is corrected mid-measurement.
  static func now() -> Double {
    Double(DispatchTime.now().uptimeNanoseconds) / 1_000_000
  }

  // MARK: - Reporting

  private func startTimer() {
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
    timer.schedule(deadline: .now() + 1, repeating: .seconds(1))
    timer.setEventHandler { [weak self] in
      guard let self = self, let snapshot = self.drain() else { return }
      self.onSnapshot?(snapshot)
    }
    timer.resume()
    self.timer = timer
  }

  private func stopTimer() {
    timer?.cancel()
    timer = nil
  }

  private func drain() -> Snapshot? {
    lock.lock()
    defer { lock.unlock() }
    guard isEnabled else { return nil }

    let snapshot = Snapshot(
      // One processing sample per move applied in this window.
      rate: processing.count,
      gapP50: Self.percentile(gaps, 0.5),
      gapP95: Self.percentile(gaps, 0.95),
      jitter: variations.isEmpty
        ? 0
        : variations.reduce(0, +) / Double(variations.count),
      procP50: Self.percentile(processing, 0.5),
      procP95: Self.percentile(processing, 0.95),
      stalls: stalls
    )

    gaps.removeAll(keepingCapacity: true)
    processing.removeAll(keepingCapacity: true)
    variations.removeAll(keepingCapacity: true)
    stalls = 0
    // `lastArrival` deliberately survives the drain: the gap across a window
    // boundary is as real as any other.
    return snapshot
  }

  private func resetLocked() {
    gaps.removeAll(keepingCapacity: true)
    processing.removeAll(keepingCapacity: true)
    variations.removeAll(keepingCapacity: true)
    stalls = 0
    lastArrival = nil
    lastClientTimestamp = nil
  }

  /// Nearest-rank percentile, matching `percentile()` in `@entangle/protocol`.
  private static func percentile(_ samples: [Double], _ p: Double) -> Double {
    if samples.isEmpty { return 0 }
    let sorted = samples.sorted()
    let rank = Int((p * Double(sorted.count)).rounded(.up))
    return sorted[max(0, min(sorted.count - 1, rank - 1))]
  }
}
