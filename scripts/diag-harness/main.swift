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

import Foundation

let logDirectory = ProcessInfo.processInfo.environment["ENTANGLE_DIAG_LOG_DIR"]
  ?? NSHomeDirectory() + "/Library/Logs/Entangle"

let monitor = LatencyMonitor.shared
monitor.onSnapshot = { snapshot in
  print("snapshot rate=\(snapshot.rate) gapP50=\(snapshot.gapP50) stalls=\(snapshot.stalls)")
}
monitor.setEnabled(true)
print("log path: \(monitor.logPath ?? "<none>")")

var clientClock = 1000.0
var arrivalClock = 5000.0

/// Frames at `hz`, with arrival jitter and an optional periodic stall.
func burst(seconds: Double, hz: Double, jitterMs: Double, stallEvery: Int? = nil) {
  let step = 1000.0 / hz
  for index in 0..<Int(seconds * hz) {
    clientClock += step
    var advance = step
    if let stallEvery = stallEvery, index > 0, index % stallEvery == 0 { advance += 80 }
    arrivalClock += advance + Double.random(in: -jitterMs...jitterMs)
    monitor.record(
      clientTimestamp: clientClock,
      arrival: arrivalClock,
      posted: arrivalClock + Double.random(in: 0.05...0.4)
    )
  }
}

monitor.recordPhoneReport(sendRate: 118, rttP50: 11, rttP95: 23)
burst(seconds: 1.0, hz: 120, jitterMs: 1.5)
RunLoop.current.run(until: Date().addingTimeInterval(1.2))

monitor.recordPhoneReport(sendRate: 115, rttP50: 12, rttP95: 41)
burst(seconds: 1.0, hz: 120, jitterMs: 3.0, stallEvery: 60)
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
