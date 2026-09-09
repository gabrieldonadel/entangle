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
    /// Stalls the wire caused: the frames were sent evenly and arrived late.
    let stallsDelivery: Int
    /// Stalls the phone caused: it sent nothing for that long. A finger held
    /// still mid-gesture looks exactly like this, and so does a blocked JS
    /// thread — either way the wire is innocent.
    let stallsSource: Int
    /// Worst amount by which an arrival gap exceeded its send gap.
    let deliveryWorst: Double
  }

  /// A gap longer than this reads as a stall rather than as pacing.
  private static let stallThresholdMs: Double = 50

  /// How much an arrival gap has to exceed its send gap before the wire, and
  /// not the phone, is responsible for it.
  private static let deliveryMarginMs: Double = 20

  /// Called once a second while enabled.
  var onSnapshot: ((Snapshot) -> Void)?

  /// Where the log is being appended, or nil if it could not be opened.
  var logPath: String? { DiagLog.shared.path }

  private let lock = NSLock()
  private var isEnabled = false
  private var timer: DispatchSourceTimer?

  private var gaps: [Double] = []
  private var processing: [Double] = []
  private var variations: [Double] = []
  private var stalls = 0
  private var stallsDelivery = 0
  private var stallsSource = 0
  private var deliveryExcess: [Double] = []
  private var gestures = 0
  private var udpFrames = 0
  private var streamFrames = 0
  /// Frames the accumulator discarded as duplicates or overtaken. Zero over
  /// TCP; the number to watch once pointer frames move to UDP.
  private var stale = 0
  private var lastArrival: Double?
  private var lastClientTimestamp: Double?

  /// The phone's own figures, as of its last `diag.report`.
  private var phoneSendRate: Int?
  private var phoneTouchRate: Int?
  private var phoneRttP50: Double?
  private var phoneRttP95: Double?

  /// A run is an unbroken stretch of seconds with pointer activity — one
  /// swipe session. Percentiles over a whole run are the numbers worth
  /// quoting; a single second is a small sample.
  private var runGaps: [Double] = []
  private var runProcessing: [Double] = []
  private var runVariations: [Double] = []
  private var runPhoneSendRates: [Int] = []
  private var runPhoneRtt: [Double] = []
  private var runStalls = 0
  private var runStallsDelivery = 0
  private var runStallsSource = 0
  private var runDeliveryWorst: Double = 0
  private var runGestures = 0
  private var runStale = 0
  private var runUdpFrames = 0
  private var runStreamFrames = 0
  private var runSeconds = 0
  private var runTruncated = false

  /// Bounds the memory a very long run can hold: at 120 Hz this is about four
  /// minutes of continuous swiping before we stop collecting raw samples.
  private static let runSampleCap = 30_000

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
    if !enabled {
      // Do not lose the swipe that was in progress when the toggle went off.
      if runSeconds > 0 { logRunLocked() }
      resetLocked()
    }
    lock.unlock()
    guard changed else { return }
    if enabled {
      DiagLog.shared.open(note: ["reason": "diagnostics enabled"])
      startTimer()
    } else {
      stopTimer()
      DiagLog.shared.close(note: ["reason": "diagnostics disabled"])
    }
  }

  /// - Parameters:
  ///   - clientTimestamp: the phone's `ts`, in its own milliseconds.
  ///   - arrival: when the frame reached us, in our milliseconds.
  ///   - posted: when the CGEvent went out, in our milliseconds.
  ///   - viaDatagram: arrived over UDP rather than the WebSocket.
  ///   - firstOfGesture: the frame opened a gesture, so the gap before it is
  ///     the finger being off the glass rather than a delivery gap. Recording
  ///     it would put a stall in the numbers for every pause between swipes.
  func record(
    clientTimestamp: Double?,
    arrival: Double,
    posted: Double,
    firstOfGesture: Bool = false,
    viaDatagram: Bool = false
  ) {
    lock.lock()
    defer { lock.unlock() }
    guard isEnabled else { return }

    if viaDatagram { udpFrames += 1 } else { streamFrames += 1 }

    if firstOfGesture {
      lastArrival = nil
      lastClientTimestamp = nil
      gestures += 1
    }

    if let previous = lastArrival {
      let gap = arrival - previous
      gaps.append(gap)

      // One-way delay variation: how much the arrival gap differs from the
      // send gap. Both terms are differences within a single clock, so a
      // constant offset between the two devices cancels out.
      var sendGap: Double?
      if let clientTimestamp = clientTimestamp, let previousClient = lastClientTimestamp {
        sendGap = clientTimestamp - previousClient
        variations.append(abs(gap - sendGap!))
      }

      if gap > Self.stallThresholdMs {
        stalls += 1
        // A long gap only indicts the wire if the phone was sending during it.
        // Otherwise it is a finger held still inside a gesture, or a stalled
        // JS thread — neither of which UDP would fix.
        if let sendGap = sendGap {
          let excess = gap - sendGap
          if excess > Self.deliveryMarginMs {
            stallsDelivery += 1
            deliveryExcess.append(excess)
          } else {
            stallsSource += 1
          }
        }
      }
    }
    lastArrival = arrival
    if let clientTimestamp = clientTimestamp { lastClientTimestamp = clientTimestamp }
    processing.append(posted - arrival)
  }

  func recordPhoneReport(sendRate: Int, touchRate: Int, rttP50: Double, rttP95: Double) {
    lock.lock()
    defer { lock.unlock() }
    guard isEnabled else { return }
    phoneSendRate = sendRate
    phoneTouchRate = touchRate
    phoneRttP50 = rttP50
    phoneRttP95 = rttP95
  }

  func recordStale() {
    lock.lock()
    defer { lock.unlock() }
    guard isEnabled else { return }
    stale += 1
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
      stalls: stalls,
      stallsDelivery: stallsDelivery,
      stallsSource: stallsSource,
      deliveryWorst: deliveryExcess.max() ?? 0
    )

    if snapshot.rate > 0 {
      logSampleLocked(snapshot)
      foldIntoRunLocked(snapshot)
    } else if runSeconds > 0 {
      // The swipe stopped. Summarize it while the samples are still here.
      logRunLocked()
      resetRunLocked()
    }

    gaps.removeAll(keepingCapacity: true)
    processing.removeAll(keepingCapacity: true)
    variations.removeAll(keepingCapacity: true)
    stalls = 0
    stallsDelivery = 0
    stallsSource = 0
    deliveryExcess.removeAll(keepingCapacity: true)
    gestures = 0
    stale = 0
    udpFrames = 0
    streamFrames = 0
    // `lastArrival` deliberately survives the drain: the gap across a window
    // boundary is as real as any other.
    return snapshot
  }

  // MARK: - Logging

  /// A second with no pointer activity says nothing about the pointer path, so
  /// only active seconds are written. That keeps the file to the moments the
  /// user was actually swiping.
  private func logSampleLocked(_ snapshot: Snapshot) {
    var record: [String: Any] = [
      "type": "second",
      "moves": snapshot.rate,
      "gapP50": jsonNumber(snapshot.gapP50),
      "gapP95": jsonNumber(snapshot.gapP95),
      "jitter": jsonNumber(snapshot.jitter),
      "procP50": jsonNumber(snapshot.procP50),
      "procP95": jsonNumber(snapshot.procP95),
      "stalls": snapshot.stalls,
      "stallsNet": snapshot.stallsDelivery,
      "stallsSrc": snapshot.stallsSource,
      "netWorst": jsonNumber(snapshot.deliveryWorst),
      "gestures": gestures,
      "stale": stale,
      "udp": udpFrames,
      "tcp": streamFrames,
      "gaps": Self.histogram(gaps)
    ]
    if let sendRate = phoneSendRate { record["phoneSent"] = sendRate }
    if let touchRate = phoneTouchRate { record["phoneTouches"] = touchRate }
    if let rtt = phoneRttP50 { record["phoneRttP50"] = jsonNumber(rtt) }
    if let rtt = phoneRttP95 { record["phoneRttP95"] = jsonNumber(rtt) }
    DiagLog.shared.write(record)
  }

  private func foldIntoRunLocked(_ snapshot: Snapshot) {
    runSeconds += 1
    runStalls += snapshot.stalls
    runStallsDelivery += snapshot.stallsDelivery
    runStallsSource += snapshot.stallsSource
    runDeliveryWorst = max(runDeliveryWorst, snapshot.deliveryWorst)
    runGestures += gestures
    runStale += stale
    runUdpFrames += udpFrames
    runStreamFrames += streamFrames
    if runGaps.count + gaps.count > Self.runSampleCap {
      runTruncated = true
    } else {
      runGaps.append(contentsOf: gaps)
      runProcessing.append(contentsOf: processing)
      runVariations.append(contentsOf: variations)
    }
    if let sendRate = phoneSendRate { runPhoneSendRates.append(sendRate) }
    if let rtt = phoneRttP50 { runPhoneRtt.append(rtt) }
  }

  /// Percentiles over the whole swipe, which is the figure worth quoting — a
  /// single second is a small sample, and the per-second lines above already
  /// show how it varied.
  private func logRunLocked() {
    var record: [String: Any] = [
      "type": "run",
      "seconds": runSeconds,
      "moves": runProcessing.count,
      "gapP50": jsonNumber(Self.percentile(runGaps, 0.5)),
      "gapP95": jsonNumber(Self.percentile(runGaps, 0.95)),
      "gapMax": jsonNumber(runGaps.max() ?? 0),
      "jitter": runVariations.isEmpty
        ? 0
        : jsonNumber(runVariations.reduce(0, +) / Double(runVariations.count)),
      "procP50": jsonNumber(Self.percentile(runProcessing, 0.5)),
      "procP95": jsonNumber(Self.percentile(runProcessing, 0.95)),
      "procMax": jsonNumber(runProcessing.max() ?? 0),
      "stalls": runStalls,
      "stallsNet": runStallsDelivery,
      "stallsSrc": runStallsSource,
      "netWorst": jsonNumber(runDeliveryWorst),
      "gestures": runGestures,
      "stale": runStale,
      "udp": runUdpFrames,
      "tcp": runStreamFrames,
      "gaps": Self.histogram(runGaps)
    ]
    if !runPhoneSendRates.isEmpty {
      let total = runPhoneSendRates.reduce(0, +)
      record["phoneSentAvg"] = jsonNumber(Double(total) / Double(runPhoneSendRates.count))
    }
    if !runPhoneRtt.isEmpty {
      record["phoneRttP50"] = jsonNumber(Self.percentile(runPhoneRtt, 0.5))
      record["phoneRttWorst"] = jsonNumber(runPhoneRtt.max() ?? 0)
    }
    if runTruncated { record["truncated"] = true }
    DiagLog.shared.write(record)
  }

  private func resetRunLocked() {
    runGaps.removeAll(keepingCapacity: true)
    runProcessing.removeAll(keepingCapacity: true)
    runVariations.removeAll(keepingCapacity: true)
    runPhoneSendRates.removeAll(keepingCapacity: true)
    runPhoneRtt.removeAll(keepingCapacity: true)
    runStalls = 0
    runStallsDelivery = 0
    runStallsSource = 0
    runDeliveryWorst = 0
    runGestures = 0
    runStale = 0
    runUdpFrames = 0
    runStreamFrames = 0
    runSeconds = 0
    runTruncated = false
  }



  private func resetLocked() {
    gaps.removeAll(keepingCapacity: true)
    processing.removeAll(keepingCapacity: true)
    variations.removeAll(keepingCapacity: true)
    stalls = 0
    stallsDelivery = 0
    stallsSource = 0
    deliveryExcess.removeAll(keepingCapacity: true)
    gestures = 0
    stale = 0
    udpFrames = 0
    streamFrames = 0
    lastArrival = nil
    lastClientTimestamp = nil
    phoneSendRate = nil
    phoneTouchRate = nil
    phoneRttP50 = nil
    phoneRttP95 = nil
    resetRunLocked()
  }

  /// Distribution of arrival gaps, in milliseconds. Percentiles hide the
  /// shape that matters here: an even 120 Hz stream and a stream delivered in
  /// clumps can share a median.
  private static let gapBuckets: [(label: String, upTo: Double)] = [
    ("lt2", 2), ("2to8", 8), ("8to12", 12), ("12to20", 20),
    ("20to40", 40), ("40to100", 100), ("gt100", .infinity)
  ]

  private static func histogram(_ samples: [Double]) -> [String: Int] {
    var counts: [String: Int] = [:]
    for bucket in gapBuckets { counts[bucket.label] = 0 }
    for sample in samples {
      for bucket in gapBuckets where sample < bucket.upTo {
        counts[bucket.label, default: 0] += 1
        break
      }
    }
    return counts
  }

  /// Nearest-rank percentile, matching `percentile()` in `@entangle/protocol`.
  private static func percentile(_ samples: [Double], _ p: Double) -> Double {
    if samples.isEmpty { return 0 }
    let sorted = samples.sorted()
    let rank = Int((p * Double(sorted.count)).rounded(.up))
    return sorted[max(0, min(sorted.count - 1, rank - 1))]
  }
}
