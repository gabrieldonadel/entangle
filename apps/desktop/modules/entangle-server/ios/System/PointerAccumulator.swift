import CoreGraphics
import Foundation

/// Turns the wire's pointer frames into the movement to apply.
///
/// The phone sends both a per-frame delta and a running total for the gesture.
/// The total is what we use: applying `total - lastApplied` means a frame that
/// arrives late, twice, or not at all costs nothing, because the next frame
/// carries the whole truth. Measured delivery is bursty — 22% of frames land
/// within 2 ms of the previous one after a stall — and this is what makes the
/// transport's re-timing harmless.
///
/// Not thread-safe by design: `CursorController` owns one and only touches it
/// from its serial queue.
struct PointerAccumulator {
  struct Frame {
    /// Movement since the previous frame, used when the phone sends no total.
    let dx: CGFloat
    let dy: CGFloat
    /// Total movement since the gesture began, if the phone sent one.
    let cumulative: CGPoint?
    /// Gesture counter. A change restarts the total.
    let gesture: Int?
    let seq: Int?
  }

  struct Resolution {
    let delta: CGPoint
    /// The frame opened a gesture, so the gap before it was a finger off the
    /// glass rather than a delivery gap.
    let startsGesture: Bool
  }

  private var lastGesture: Int?
  private var lastCumulative: CGPoint = .zero
  private var lastSeq: Int?

  /// Returns the movement to apply, or `nil` for a frame that has nothing left
  /// to say — a duplicate or one overtaken by a newer frame.
  mutating func resolve(_ frame: Frame) -> Resolution? {
    let startsGesture = frame.gesture != nil && frame.gesture != lastGesture
    if startsGesture {
      lastGesture = frame.gesture
      lastCumulative = .zero
      // A phone that restarts (fresh app launch, new socket) begins its
      // sequence again from a low number. Clearing the watermark at each
      // gesture boundary means that self-heals instead of dropping every
      // frame forever.
      lastSeq = nil
    }

    if let seq = frame.seq, let previous = lastSeq, seq <= previous {
      return nil
    }
    if let seq = frame.seq {
      lastSeq = seq
    }

    // The total is only trustworthy when we can see gesture boundaries;
    // without `g` we cannot know when it restarted.
    guard frame.gesture != nil, let cumulative = frame.cumulative else {
      return Resolution(
        delta: CGPoint(x: frame.dx, y: frame.dy),
        startsGesture: startsGesture
      )
    }

    let delta = CGPoint(
      x: cumulative.x - lastCumulative.x,
      y: cumulative.y - lastCumulative.y
    )
    lastCumulative = cumulative
    return Resolution(delta: delta, startsGesture: startsGesture)
  }
}
