import AVFoundation
import MediaPlayer
import UIKit

/// Watches the system output volume and reports hardware volume button presses.
///
/// Three pieces are needed:
///
///  1. An active `AVAudioSession`, or `outputVolume` never changes under
///     observation. The category is `.ambient` with `.mixWithOthers` so music
///     the user already has playing is not interrupted or ducked.
///  2. KVO on `outputVolume` to notice the press.
///  3. An off-screen `MPVolumeView`, which suppresses the system volume HUD —
///     without it a large overlay flashes on every press. Its embedded
///     `UISlider` is also the only public route to writing the system volume,
///     which is what re-centring needs.
///
/// Only reports presses while it is running, and only in the foreground: iOS
/// deactivates the session in the background, which is deliberate here — the
/// alternative is a background audio session, which drains the battery and
/// invites an App Store rejection.
enum VolumeButtonError: LocalizedError {
  case systemSliderUnavailable

  var errorDescription: String? {
    switch self {
    case .systemSliderUnavailable:
      return "The system volume slider is not reachable on this iOS version, "
        + "so the volume buttons cannot be re-armed after reaching an end."
    }
  }
}

final class VolumeButtonWatcher: NSObject {
  /// Reports a press. Called on the main thread.
  var onPress: ((VolumeButtonDirection) -> Void)?
  /// Reports that the watcher had to stop, with a reason.
  var onFailure: ((String) -> Void)?

  private var volumeView: MPVolumeView?
  private var observation: NSKeyValueObservation?
  private var lastVolume: Float = 0
  /// Set while we write the volume ourselves, so the resulting observation is
  /// not mistaken for a button press.
  private var suppressUntil: Date?

  private(set) var isRunning = false

  // MARK: - Lifecycle

  func start() throws {
    if isRunning { return }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
    try session.setActive(true)

    attachVolumeView()

    // Re-centring depends on the slider inside MPVolumeView, the only public
    // route to writing the system volume. If it is not reachable the buttons
    // would work until they hit an end and then quietly stop, so fail here
    // instead of half-way through a session.
    guard volumeSlider() != nil else {
      volumeView?.removeFromSuperview()
      volumeView = nil
      try? session.setActive(false)
      throw VolumeButtonError.systemSliderUnavailable
    }

    lastVolume = session.outputVolume
    observation = session.observe(\.outputVolume, options: [.new]) { [weak self] _, change in
      guard let self = self, let volume = change.newValue else { return }
      // KVO can arrive off the main thread; UIKit work below must not.
      if Thread.isMainThread {
        self.handle(volume)
      } else {
        DispatchQueue.main.async { self.handle(volume) }
      }
    }

    isRunning = true

    // If we start pinned at a rail, the first press in one direction would be
    // invisible. Move off it now rather than swallow that press.
    if VolumeButtonDecision.needsInitialRecenter(lastVolume) {
      recenter()
    }
  }

  func stop() {
    guard isRunning else { return }
    isRunning = false
    observation?.invalidate()
    observation = nil
    volumeView?.removeFromSuperview()
    volumeView = nil
    suppressUntil = nil
    // Leave the session deactivated so we stop holding the audio route.
    try? AVAudioSession.sharedInstance().setActive(false)
  }

  // MARK: - Handling

  private func handle(_ volume: Float) {
    guard isRunning else { return }

    if let until = suppressUntil {
      if Date() < until {
        // Our own write. Re-baseline so the next real press measures from here.
        lastVolume = volume
        return
      }
      suppressUntil = nil
    }

    let outcome = VolumeButtonDecision.evaluate(previous: lastVolume, current: volume)
    lastVolume = volume

    switch outcome {
    case .ignore:
      return
    case let .press(direction, recenter):
      onPress?(direction)
      if recenter {
        self.recenter()
      }
    }
  }

  /// Writes the system volume back toward the middle so the buttons keep
  /// reporting. There is no public setter for the system volume; the slider
  /// inside `MPVolumeView` is the supported route.
  private func recenter() {
    guard let slider = volumeSlider() else {
      // Without the slider we cannot move off the rail, and presses in that
      // direction would silently stop working. Better to stop and say so.
      let reason = "Could not reach the system volume slider, so the volume buttons cannot be re-armed"
      stop()
      onFailure?(reason)
      return
    }
    // Cover the write plus the observation it triggers.
    suppressUntil = Date().addingTimeInterval(0.6)
    lastVolume = VolumeButtonDecision.center
    DispatchQueue.main.async {
      slider.setValue(VolumeButtonDecision.center, animated: false)
      slider.sendActions(for: .valueChanged)
    }
  }

  // MARK: - MPVolumeView plumbing

  private func attachVolumeView() {
    guard volumeView == nil else { return }
    // Off-screen but in the hierarchy: an MPVolumeView that is never drawn
    // still suppresses the system HUD, and a detached one does not.
    let view = MPVolumeView(frame: CGRect(x: -4000, y: -4000, width: 1, height: 1))
    view.alpha = 0.0001
    view.isUserInteractionEnabled = false
    view.showsRouteButton = false
    hostWindow()?.addSubview(view)
    volumeView = view
  }

  private func volumeSlider() -> UISlider? {
    volumeView?.subviews.compactMap { $0 as? UISlider }.first
  }

  private func hostWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow } ??
      UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first
  }
}
