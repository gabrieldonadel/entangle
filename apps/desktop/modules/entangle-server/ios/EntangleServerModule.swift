import ExpoModulesCore
import Foundation

public class EntangleServerModule: Module {
  private var server: WebSocketServer?
  private var serverPort: UInt16 = 0
  private var serviceName: String = ""
  private var accessibilityTimer: DispatchSourceTimer?
  private var lastAccessibilityState: Bool = false

  // swiftlint:disable:next function_body_length
  public func definition() -> ModuleDefinition {
    Name("EntangleServer")

    Events(
      "clientConnected", "clientDisconnected", "message", "error", "serverReady",
      "accessibilityChanged", "pairingExpired", "pairingStarted", "pairingStopped",
      "preferencesChanged", "pairRejected"
    )

    OnCreate {
      self.lastAccessibilityState = AccessibilityCheck.isTrusted()
      self.startAccessibilityPolling()
      DockEnumerator.shared.start()
    }

    OnDestroy {
      self.accessibilityTimer?.cancel()
      self.accessibilityTimer = nil
      DockEnumerator.shared.stop()
      DockEnumerator.shared.onUpdate = nil
      self.server?.stop()
      self.server = nil
    }

    AsyncFunction("startServer") { (promise: Promise) in
      self.startServer(promise: promise)
    }

    AsyncFunction("stopServer") { (promise: Promise) in
      self.server?.stop()
      self.server = nil
      self.serverPort = 0
      promise.resolve(nil)
    }

    AsyncFunction("sendToClient") { (clientId: String, text: String) in
      guard let uuid = UUID(uuidString: clientId) else { return }
      self.server?.send(text, to: uuid)
    }

    AsyncFunction("broadcast") { (text: String) in
      self.server?.broadcast(text)
    }

    Function("isAccessibilityTrusted") { () -> Bool in
      return AccessibilityCheck.isTrusted()
    }

    AsyncFunction("promptAccessibility") { () -> Bool in
      return AccessibilityCheck.promptIfNeeded()
    }

    // MARK: - Pairing

    AsyncFunction("startPairing") { () -> [String: Any] in
      let window = PairingManager.shared.startPairing()
      let payload: [String: Any] = [
        "code": window.code,
        "token": window.token,
        "expiresAt": window.expiresAt.timeIntervalSince1970 * 1000
      ]
      self.sendEvent("pairingStarted", payload)
      self.schedulePairingExpiry(at: window.expiresAt)
      return payload
    }

    AsyncFunction("stopPairing") { () -> Void in
      PairingManager.shared.stopPairing()
      self.cancelPairingExpiry()
      self.sendEvent("pairingStopped", [:])
    }

    AsyncFunction("forgetAllPaired") { () -> Void in
      PairingManager.shared.forgetAll()
      self.server?.disconnectAll()
    }

    Function("isPairing") { () -> Bool in
      PairingManager.shared.isPairing()
    }

    // MARK: - Preferences

    Function("getPreferences") { () -> [String: Any] in
      PreferencesStore.shared.snapshot()
    }

    AsyncFunction("setPreferences") { (patch: [String: Any]) -> [String: Any] in
      let before = PreferencesStore.shared.snapshot()
      PreferencesStore.shared.apply(patch)
      let after = PreferencesStore.shared.snapshot()
      self.sendEvent("preferencesChanged", after)
      let needsRestart =
        ((before["port"] as? Int) != (after["port"] as? Int)) ||
        ((before["serverName"] as? String) != (after["serverName"] as? String)) ||
        ((before["discoverable"] as? Bool) != (after["discoverable"] as? Bool))
      if needsRestart, self.server != nil {
        self.server?.stop()
        self.server = nil
        self.serverPort = 0
        self.startServer(promise: nil)
      }
      return after
    }
  }

  private var pairingExpiryWorkItem: DispatchWorkItem?

  private func schedulePairingExpiry(at date: Date) {
    cancelPairingExpiry()
    let work = DispatchWorkItem { [weak self] in
      guard let self = self else { return }
      if PairingManager.shared.isPairing() == false {
        self.sendEvent("pairingExpired", [:])
      }
    }
    pairingExpiryWorkItem = work
    let interval = max(0, date.timeIntervalSinceNow)
    DispatchQueue.main.asyncAfter(deadline: .now() + interval, execute: work)
  }

  private func cancelPairingExpiry() {
    pairingExpiryWorkItem?.cancel()
    pairingExpiryWorkItem = nil
  }

  // MARK: - Server lifecycle

  private func startServer(promise: Promise?) {
    if self.server != nil {
      promise?.resolve([
        "port": Int(self.serverPort),
        "serviceName": self.serviceName
      ])
      return
    }

    let prefs = PreferencesStore.shared
    let name = prefs.serverName
    let server = WebSocketServer(
      serviceType: "_entangle._tcp.",
      serviceName: name,
      preferredPort: prefs.port,
      advertiseService: prefs.discoverable
    )
    self.serviceName = name

    wireServerEvents(server, name: name, promise: promise)
    wireDockEvents(server)

    do {
      try server.start()
      self.server = server
      // Fresh installs (no trusted hosts yet) need a pair window to be open
      // so the first phone has something to talk to. We open one automatically
      // and emit pairingStarted so the UI can surface the code/QR.
      if PairingManager.shared.trustedHosts().isEmpty,
         PairingManager.shared.currentWindow() == nil {
        let window = PairingManager.shared.startPairing()
        self.sendEvent("pairingStarted", [
          "code": window.code,
          "token": window.token,
          "expiresAt": window.expiresAt.timeIntervalSince1970 * 1000
        ])
        self.schedulePairingExpiry(at: window.expiresAt)
      }
    } catch {
      promise?.reject("ENTANGLE_START_FAILED", error.localizedDescription)
    }
  }

  // MARK: - Wiring helpers

  private func wireServerEvents(_ server: WebSocketServer, name: String, promise: Promise?) {
    server.onReady = { [weak self] port in
      guard let self = self else { return }
      self.serverPort = port
      self.sendEvent("serverReady", ["port": Int(port), "serviceName": name])
      promise?.resolve([
        "port": Int(port),
        "serviceName": name
      ])
    }
    server.onClientConnected = { [weak self] id, host in
      self?.sendEvent("clientConnected", ["id": id.uuidString, "host": host])
    }
    server.onClientDisconnected = { [weak self] id in
      self?.sendEvent("clientDisconnected", ["id": id.uuidString])
    }
    server.onMessage = { [weak self] id, text in
      let handledNatively = MessageDispatcher.handle(text) { response in
        self?.server?.send(response, to: id)
      }
      self?.sendEvent("message", [
        "id": id.uuidString,
        "text": text,
        "handledNatively": handledNatively
      ])
    }
    server.onError = { [weak self] message in
      self?.sendEvent("error", ["message": message])
    }
    server.onPairRejected = { [weak self] id, host in
      self?.sendEvent("pairRejected", ["id": id, "host": host])
    }
  }

  private func wireDockEvents(_ server: WebSocketServer) {
    DockEnumerator.shared.onUpdate = { [weak server] apps in
      guard let server = server,
            let payload = MessageDispatcher.encodeDockList(apps) else { return }
      server.broadcast(payload)
    }
    DockEnumerator.shared.onError = { [weak self] message in
      self?.sendEvent("error", ["message": message])
    }
  }

  // MARK: - Accessibility polling

  private func startAccessibilityPolling() {
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
    timer.schedule(deadline: .now() + 1, repeating: .seconds(1))
    timer.setEventHandler { [weak self] in
      guard let self = self else { return }
      let current = AccessibilityCheck.isTrusted()
      if current != self.lastAccessibilityState {
        self.lastAccessibilityState = current
        self.sendEvent("accessibilityChanged", ["trusted": current])
      }
    }
    timer.resume()
    accessibilityTimer = timer
  }
}
