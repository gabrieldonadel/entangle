// Exercises the pointer diagnostics log without a phone or a real cursor.
//
// `LatencyMonitor` and `DiagLog` are the only parts of the diagnostics path
// that can be driven headlessly — everything else needs CGEvents, which would
// move the machine's real pointer. This feeds the monitor a synthetic 120 Hz
// stream, goes quiet, and prints the resulting log so the "skip idle seconds"
// and run-summary behaviour can be checked.
//
// Deliberately outside `modules/entangle-server/ios`: the podspec globs
// `**/*.swift` from there, and a second `main` would break the app build.
//
//   swiftc -O -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
//     -target arm64-apple-macos11.0 -o /tmp/diag-harness \
//     scripts/diag-harness/main.swift \
//     apps/desktop/modules/entangle-server/ios/System/LatencyMonitor.swift \
//     apps/desktop/modules/entangle-server/ios/Util/DiagLog.swift \
//     apps/desktop/modules/entangle-server/ios/Util/JSONNumber.swift
//   ENTANGLE_DIAG_LOG_DIR=/tmp/diag-logs /tmp/diag-harness

import CoreGraphics
import Foundation

let logDirectory = ProcessInfo.processInfo.environment["ENTANGLE_DIAG_LOG_DIR"]
  ?? NSHomeDirectory() + "/Library/Logs/Entangle"

// ── PointerAccumulator checks ───────────────────────────────────────────────
// Pure logic, so it can be asserted rather than eyeballed.

var failures = 0

func check(_ name: String, _ condition: Bool) {
  print((condition ? "PASS  " : "FAIL  ") + name)
  if !condition { failures += 1 }
}

func frame(
  dx: CGFloat = 0, dy: CGFloat = 0,
  cx: CGFloat? = nil, cy: CGFloat? = nil,
  g: Int? = nil, seq: Int? = nil
) -> PointerAccumulator.Frame {
  PointerAccumulator.Frame(
    dx: dx, dy: dy,
    cumulative: cx == nil ? nil : CGPoint(x: cx!, y: cy ?? 0),
    gesture: g, seq: seq
  )
}

do {
  // A phone that sends no total at all: fall back to per-frame deltas.
  var accumulator = PointerAccumulator()
  let first = accumulator.resolve(frame(dx: 3, dy: -2, seq: 1))
  check("legacy frame applies its own delta", first?.delta == CGPoint(x: 3, y: -2))
  check("legacy frame does not claim a gesture", first?.startsGesture == false)
}

do {
  var accumulator = PointerAccumulator()
  let opening = accumulator.resolve(frame(cx: 5, cy: 0, g: 1, seq: 1))
  check("gesture opens", opening?.startsGesture == true)
  check("opening total applies in full", opening?.delta == CGPoint(x: 5, y: 0))

  let next = accumulator.resolve(frame(cx: 9, cy: 0, g: 1, seq: 2))
  check("running total applies the difference", next?.delta == CGPoint(x: 4, y: 0))
  check("later frame does not open a gesture", next?.startsGesture == false)

  // A lost frame: seq 3 never arrives, seq 4 carries the whole truth.
  let afterLoss = accumulator.resolve(frame(cx: 20, cy: 0, g: 1, seq: 4))
  check("a lost frame costs nothing", afterLoss?.delta == CGPoint(x: 11, y: 0))

  // Late duplicate of an already-applied frame.
  check("an overtaken frame is dropped", accumulator.resolve(frame(cx: 9, g: 1, seq: 2)) == nil)
  check("a duplicate is dropped", accumulator.resolve(frame(cx: 20, g: 1, seq: 4)) == nil)

  // Next gesture restarts the total from zero.
  let second = accumulator.resolve(frame(cx: 3, cy: 1, g: 2, seq: 5))
  check("a new gesture restarts the total", second?.delta == CGPoint(x: 3, y: 1))
  check("a new gesture is reported as one", second?.startsGesture == true)

  // The phone relaunches: gesture 1 again, sequence back to 1. The watermark
  // must not swallow everything from then on.
  let restarted = accumulator.resolve(frame(cx: 2, cy: 0, g: 1, seq: 1))
  check("a phone restart is not locked out", restarted?.delta == CGPoint(x: 2, y: 0))
}

print(failures == 0 ? "accumulator: all checks passed" : "accumulator: \(failures) FAILED")
print()

let monitor = LatencyMonitor.shared
monitor.onSnapshot = { snapshot in
  print("snapshot rate=\(snapshot.rate) gapP50=\(snapshot.gapP50) stalls=\(snapshot.stalls)")
}
monitor.setEnabled(true)
print("log path: \(monitor.logPath ?? "<none>")")

var clientClock = 1000.0
var arrivalClock = 5000.0

/// One gesture: `hz` frames per second with arrival jitter, optionally with a
/// mid-gesture stall so a real one can be told apart from a finger pause.
func gesture(seconds: Double, hz: Double, jitterMs: Double, stallEvery: Int? = nil) {
  let step = 1000.0 / hz
  for index in 0..<Int(seconds * hz) {
    clientClock += step
    var advance = step
    if let stallEvery = stallEvery, index > 0, index % stallEvery == 0 { advance += 80 }
    arrivalClock += advance + Double.random(in: -jitterMs...jitterMs)
    monitor.record(
      clientTimestamp: clientClock,
      arrival: arrivalClock,
      posted: arrivalClock + Double.random(in: 0.05...0.4),
      firstOfGesture: index == 0
    )
  }
}

/// Finger off the glass. Both clocks advance, but nothing is recorded — the
/// next gesture's first frame must not turn this into a stall.
func pause(ms: Double) {
  clientClock += ms
  arrivalClock += ms
}

monitor.recordPhoneReport(sendRate: 118, touchRate: 120, rttP50: 11, rttP95: 23)
gesture(seconds: 1.0, hz: 120, jitterMs: 1.5)
RunLoop.current.run(until: Date().addingTimeInterval(1.2))

// A long pause, then a second gesture with a real 80 ms stall inside it.
pause(ms: 900)
monitor.recordPhoneReport(sendRate: 115, touchRate: 120, rttP50: 12, rttP95: 41)
gesture(seconds: 1.0, hz: 120, jitterMs: 3.0, stallEvery: 60)
RunLoop.current.run(until: Date().addingTimeInterval(1.2))

// A third gesture holding both kinds of long gap, to prove they are told
// apart: one where the phone kept sending and the frames arrived late (the
// wire's fault), and one where the phone sent nothing for just as long — a
// finger held still mid-gesture, which no transport change would fix.
monitor.recordPhoneReport(sendRate: 60, touchRate: 60, rttP50: 14, rttP95: 30)
gesture(seconds: 0.2, hz: 120, jitterMs: 0.5)
// Wire stall: 200 ms late, but sent on the usual 8.3 ms cadence.
clientClock += 8.3
arrivalClock += 208.3
monitor.record(clientTimestamp: clientClock, arrival: arrivalClock, posted: arrivalClock + 0.2)
// Finger still: both clocks advance together, so nothing was held up.
clientClock += 200
arrivalClock += 200
monitor.record(clientTimestamp: clientClock, arrival: arrivalClock, posted: arrivalClock + 0.2)
RunLoop.current.run(until: Date().addingTimeInterval(1.2))

// Idle: this window must write nothing, but must close the run.
RunLoop.current.run(until: Date().addingTimeInterval(1.4))
monitor.setEnabled(false)
RunLoop.current.run(until: Date().addingTimeInterval(0.3))

print("---- \(logDirectory)/pointer-diag.jsonl ----")
print(
  (try? String(contentsOfFile: logDirectory + "/pointer-diag.jsonl", encoding: .utf8))
    ?? "<missing>"
)

exit(failures == 0 ? 0 : 1)
