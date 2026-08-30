import AudioToolbox
import CoreAudio
import Foundation

/// Reads and writes the system output volume through CoreAudio.
///
/// CoreAudio needs no special permission, unlike the input synthesis the rest
/// of the module relies on — volume control keeps working even when
/// Accessibility has not been granted.
///
/// Two volume properties are tried in order. `kAudioDevicePropertyVirtualMainVolume`
/// is the single logical slider the Sound menu shows and is what we want, but
/// not every device implements it (aggregate and some USB devices do not). For
/// those we fall back to writing every output channel's `VolumeScalar`
/// individually.
final class VolumeController {
  static let shared = VolumeController()

  /// Matches the 1/16 step macOS itself uses for the volume keys.
  private static let step: Float32 = 1.0 / 16.0

  private let queue = DispatchQueue(label: "entangle.volume")

  /// Called whenever the level or mute state changes, including changes made
  /// on the Mac itself.
  var onChange: ((Float32, Bool) -> Void)?

  private var listenedDevice: AudioDeviceID?
  private var watchingDefaultDevice = false
  private var lastEmitted: (level: Float32, muted: Bool)?

  private typealias Registration = (
    device: AudioDeviceID,
    address: AudioObjectPropertyAddress,
    block: AudioObjectPropertyListenerBlock
  )
  private var registered: [Registration] = []

  private init() {}

  // MARK: - Reading

  struct State {
    let level: Float32
    let muted: Bool
  }

  func currentState() -> State? {
    guard let device = defaultOutputDevice() else { return nil }
    guard let level = readLevel(device) else { return nil }
    return State(level: level, muted: readMute(device) ?? false)
  }

  // MARK: - Writing

  func setLevel(_ level: Float32) {
    queue.async {
      guard let device = self.defaultOutputDevice() else { return }
      let clamped = min(max(level, 0), 1)
      self.writeLevel(clamped, to: device)
      // Raising the volume from silence should also lift the mute, otherwise
      // the slider moves and nothing is heard.
      if clamped > 0, self.readMute(device) == true {
        self.writeMute(false, to: device)
      }
      self.emit(device)
    }
  }

  func step(up: Bool) {
    queue.async {
      guard let device = self.defaultOutputDevice() else { return }
      // A step away from silence unmutes rather than changing a level nobody
      // can hear — this is what the hardware keys on a Mac do.
      if self.readMute(device) == true {
        if up {
          self.writeMute(false, to: device)
          self.emit(device)
          return
        }
        // Already silent and asked for less: nothing to do.
        self.emit(device)
        return
      }
      guard let current = self.readLevel(device) else { return }
      let next = min(max(current + (up ? Self.step : -Self.step), 0), 1)
      self.writeLevel(next, to: device)
      self.emit(device)
    }
  }

  /// Pass `nil` to toggle.
  func setMuted(_ muted: Bool?) {
    queue.async {
      guard let device = self.defaultOutputDevice() else { return }
      let target = muted ?? !(self.readMute(device) ?? false)
      self.writeMute(target, to: device)
      self.emit(device)
    }
  }

  /// One write can trip several of the properties we watch (virtual main
  /// volume, the main element's scalar, and each channel's scalar), so the
  /// listeners fire in bursts. Only report a value that actually differs,
  /// otherwise a slider drag would put five identical messages on the wire per
  /// tick.
  private func emit(_ device: AudioDeviceID) {
    guard let level = readLevel(device) else { return }
    let muted = readMute(device) ?? false
    if let last = lastEmitted,
       last.muted == muted,
       abs(last.level - level) < 0.0005 {
      return
    }
    lastEmitted = (level, muted)
    onChange?(level, muted)
  }

  // MARK: - Change notifications

  /// Starts reporting volume changes made anywhere on the Mac. Safe to call
  /// repeatedly; listeners are only installed once per device.
  func startWatching() {
    queue.async {
      self.watchDeviceLocked()
      self.watchDefaultDeviceChangesLocked()
    }
  }

  func stopWatching() {
    queue.async { self.unwatchDeviceLocked() }
  }

  private func watchDeviceLocked() {
    guard let device = defaultOutputDevice() else { return }
    if listenedDevice == device { return }
    unwatchDeviceLocked()

    for address in Self.watchedAddresses {
      // CoreAudio removes listeners by block identity, so each block has to be
      // retained exactly as it was registered.
      let block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
        guard let self = self, let device = self.listenedDevice else { return }
        self.emit(device)
      }
      var mutableAddress = address
      guard AudioObjectAddPropertyListenerBlock(device, &mutableAddress, queue, block) == noErr else {
        continue
      }
      registered.append((device, address, block))
    }
    listenedDevice = device
  }

  private func unwatchDeviceLocked() {
    for entry in registered {
      var address = entry.address
      AudioObjectRemovePropertyListenerBlock(entry.device, &address, queue, entry.block)
    }
    registered.removeAll()
    listenedDevice = nil
  }

  /// The default output device changes when headphones are plugged in, which
  /// invalidates every per-device listener.
  private func watchDefaultDeviceChangesLocked() {
    guard !watchingDefaultDevice else { return }
    watchingDefaultDevice = true
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDefaultOutputDevice,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
      guard let self = self else { return }
      self.watchDeviceLocked()
      if let device = self.listenedDevice { self.emit(device) }
    }
    if AudioObjectAddPropertyListenerBlock(
      AudioObjectID(kAudioObjectSystemObject), &address, queue, block
    ) != noErr {
      watchingDefaultDevice = false
    }
  }

  private static let watchedAddresses: [AudioObjectPropertyAddress] = [
    AudioObjectPropertyAddress(
      mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    ),
    AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyVolumeScalar,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    ),
    AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyMute,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    ),
  ]

  // MARK: - CoreAudio plumbing

  private func defaultOutputDevice() -> AudioDeviceID? {
    var device = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDefaultOutputDevice,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &device
    )
    guard status == noErr, device != kAudioObjectUnknown else { return nil }
    return device
  }

  /// Candidate single-slider properties, best first. `VirtualMainVolume` is
  /// the control the Sound menu shows and it preserves channel balance;
  /// `VolumeScalar` on the main element is the plain HAL equivalent. Devices
  /// implementing neither fall through to per-channel writes.
  private static let mainVolumeSelectors: [AudioObjectPropertySelector] = [
    kAudioHardwareServiceDeviceProperty_VirtualMainVolume,
    kAudioDevicePropertyVolumeScalar,
  ]

  private func readLevel(_ device: AudioDeviceID) -> Float32? {
    for selector in Self.mainVolumeSelectors {
      if let level = readFloat(device, selector, element: kAudioObjectPropertyElementMain) {
        return level
      }
    }
    // Per-channel fallback: report the loudest channel so the slider does not
    // jump to the quieter side of an unbalanced device.
    let levels = outputChannels(device).compactMap {
      readFloat(device, kAudioDevicePropertyVolumeScalar, element: $0)
    }
    return levels.max()
  }

  private func writeLevel(_ level: Float32, to device: AudioDeviceID) {
    for selector in Self.mainVolumeSelectors {
      if writeFloat(level, device, selector, element: kAudioObjectPropertyElementMain) {
        return
      }
    }
    for channel in outputChannels(device) {
      _ = writeFloat(level, device, kAudioDevicePropertyVolumeScalar, element: channel)
    }
  }

  private func readMute(_ device: AudioDeviceID) -> Bool? {
    var muted = UInt32(0)
    var size = UInt32(MemoryLayout<UInt32>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyMute,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(device, &address, 0, nil, &size, &muted)
    guard status == noErr else { return nil }
    return muted != 0
  }

  private func writeMute(_ muted: Bool, to device: AudioDeviceID) {
    var value = UInt32(muted ? 1 : 0)
    let size = UInt32(MemoryLayout<UInt32>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyMute,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    guard AudioObjectHasProperty(device, &address) else { return }
    _ = AudioObjectSetPropertyData(device, &address, 0, nil, size, &value)
  }

  /// Channel numbers of the device's output stream. CoreAudio numbers channels
  /// from 1; element 0 is the "main" pseudo-channel.
  private func outputChannels(_ device: AudioDeviceID) -> [AudioObjectPropertyElement] {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyPreferredChannelsForStereo,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: kAudioObjectPropertyElementMain
    )
    var channels: [UInt32] = [1, 2]
    var size = UInt32(MemoryLayout<UInt32>.size * 2)
    let status = AudioObjectGetPropertyData(device, &address, 0, nil, &size, &channels)
    if status != noErr { return [1, 2] }
    return channels
  }

  private func readFloat(
    _ device: AudioDeviceID,
    _ selector: AudioObjectPropertySelector,
    element: AudioObjectPropertyElement
  ) -> Float32? {
    var value = Float32(0)
    var size = UInt32(MemoryLayout<Float32>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: selector,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: element
    )
    guard AudioObjectHasProperty(device, &address) else { return nil }
    let status = AudioObjectGetPropertyData(device, &address, 0, nil, &size, &value)
    guard status == noErr else { return nil }
    return value
  }

  private func writeFloat(
    _ value: Float32,
    _ device: AudioDeviceID,
    _ selector: AudioObjectPropertySelector,
    element: AudioObjectPropertyElement
  ) -> Bool {
    var address = AudioObjectPropertyAddress(
      mSelector: selector,
      mScope: kAudioDevicePropertyScopeOutput,
      mElement: element
    )
    guard AudioObjectHasProperty(device, &address) else { return false }
    var settable = DarwinBoolean(false)
    guard AudioObjectIsPropertySettable(device, &address, &settable) == noErr, settable.boolValue else {
      return false
    }
    var mutableValue = value
    let size = UInt32(MemoryLayout<Float32>.size)
    return AudioObjectSetPropertyData(device, &address, 0, nil, size, &mutableValue) == noErr
  }
}
