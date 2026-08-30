import Foundation

public enum VolumeButtonDirection: String {
  case up
  case down
}

/// Turns a pair of observed system-volume readings into a button press.
///
/// iOS gives no access to the hardware volume buttons. What it does give is
/// `AVAudioSession.outputVolume`, which changes when they are pressed — so a
/// press has to be inferred from the delta. Two consequences shape the rules
/// below:
///
///  - The observation fires for our own writes too, and occasionally twice for
///    one press, so a delta below `epsilon` is not a press.
///  - At 0% or 100% the volume cannot move any further, and a press produces no
///    change at all — the button would appear dead. Once a reading lands on a
///    rail the caller has to put the volume back near the middle so the next
///    press is observable again.
///
/// Kept free of AVFoundation on purpose: this is the part worth testing, and a
/// simulator cannot press a volume button.
public struct VolumeButtonDecision {
  public enum Outcome: Equatable {
    case ignore
    case press(direction: VolumeButtonDirection, recenter: Bool)
  }

  /// Smallest delta treated as a real press. iOS moves the volume in 1/16
  /// steps, so this is far below one notch.
  public static let epsilon: Float = 0.005
  public static let railLow: Float = 0.02
  public static let railHigh: Float = 0.98
  /// Where to put the volume back to when a rail is reached.
  public static let center: Float = 0.5

  public static func evaluate(previous: Float, current: Float) -> Outcome {
    let delta = current - previous
    if abs(delta) < epsilon {
      return .ignore
    }
    let direction: VolumeButtonDirection = delta > 0 ? .up : .down
    let atRail = current <= railLow || current >= railHigh
    return .press(direction: direction, recenter: atRail)
  }

  /// True when a starting volume sits on a rail, so the first press in either
  /// direction could go unnoticed and the level should be centred up front.
  public static func needsInitialRecenter(_ volume: Float) -> Bool {
    volume <= railLow || volume >= railHigh
  }
}
