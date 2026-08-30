import ExpoModulesCore

public class VolumeButtonsModule: Module {
  private let watcher = VolumeButtonWatcher()

  public func definition() -> ModuleDefinition {
    Name("VolumeButtons")

    Events("volumeButton", "volumeButtonsUnavailable")

    OnCreate {
      self.watcher.onPress = { [weak self] direction in
        self?.sendEvent("volumeButton", ["direction": direction.rawValue])
      }
      self.watcher.onFailure = { [weak self] reason in
        self?.sendEvent("volumeButtonsUnavailable", ["reason": reason])
      }
    }

    AsyncFunction("start") { (promise: Promise) in
      DispatchQueue.main.async {
        do {
          try self.watcher.start()
          promise.resolve(nil)
        } catch {
          promise.reject("VOLUME_BUTTONS_START_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      DispatchQueue.main.async {
        self.watcher.stop()
        promise.resolve(nil)
      }
    }

    Function("isRunning") { () -> Bool in
      self.watcher.isRunning
    }

    // The audio session cannot stay active in the background, so drop it on the
    // way out and pick it back up when we return.
    OnAppEntersBackground {
      DispatchQueue.main.async {
        if self.watcher.isRunning {
          self.wasRunningBeforeBackground = true
          self.watcher.stop()
        }
      }
    }

    OnAppEntersForeground {
      DispatchQueue.main.async {
        guard self.wasRunningBeforeBackground else { return }
        self.wasRunningBeforeBackground = false
        try? self.watcher.start()
      }
    }

    OnDestroy {
      self.watcher.stop()
    }
  }

  private var wasRunningBeforeBackground = false
}
