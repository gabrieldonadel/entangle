import ExpoModulesCore
import Foundation

public class EntangleServerModule: Module {
  private var server: WebSocketServer?
  private let datagrams = DatagramServer()
  /// UDP port the datagram listener bound to, or 0 if it could not start.
  private var datagramPort: UInt16 = 0
  /// Datagrams received per client since the last `udp.ok`.
  private var datagramCounts: [UUID: Int] = [:]
  private let datagramCountLock = NSLock()
  private var serverPort: UInt16 = 0
  private var serviceName: String = ""
  private var accessibilityTimer: DispatchSourceTimer?
  private var lastAccessibilityState: Bool = false
  private var statsTimer: DispatchSourceTimer?
  /// Ids of the phones currently connected. Only ever touched from the
  /// server's serial queue, where the connect and disconnect callbacks run.
  private var connectedClients = Set<String>()
  /// Inbound message counts since the last stats tick, keyed by client id.
  /// Written from the server queue, drained from the stats timer.
  private var inboundCounts: [String: Int] = [:]
  private let statsLock = NSLock()

  // swiftlint:disable:next function_body_length
  public func definition() -> ModuleDefinition {
    Name("EntangleServer")

    Events(
      "clientConnected", "clientDisconnected", "message", "error", "serverReady",
      "accessibilityChanged", "pairingExpired", "pairingStarted", "pairingStopped",
      "preferencesChanged", "pairRejected", "messageStats"
    )

    OnCreate {
      self.lastAccessibilityState = AccessibilityCheck.isTrusted()
      self.startAccessibilityPolling()
      DockEnumerator.shared.start()
    }

    OnDestroy {
      self.accessibilityTimer?.cancel()
      self.accessibilityTimer = nil
      self.stopStatsTimer()
      DockEnumerator.shared.stop()
      DockEnumerator.shared.onUpdate = nil
      VolumeController.shared.stopWatching()
      VolumeController.shared.onChange = nil
      DisplayController.shared.stopWatching()
      DisplayController.shared.onChange = nil
      LatencyMonitor.shared.setEnabled(false)
      LatencyMonitor.shared.onSnapshot = nil
      self.datagrams.stop()
      self.server?.stop()
      self.server = nil
    }

    AsyncFunction("startServer") { (promise: Promise) in
      self.startServer(promise: promise)
    }

    AsyncFunction("stopServer") { (promise: Promise) in
      self.stopStatsTimer()
      VolumeController.shared.stopWatching()
      VolumeController.shared.onChange = nil
      DisplayController.shared.stopWatching()
      DisplayController.shared.onChange = nil
      LatencyMonitor.shared.setEnabled(false)
      LatencyMonitor.shared.onSnapshot = nil
      self.datagrams.stop()
      self.datagramPort = 0
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

    Function("getLanHost") { () -> String? in
      NetworkInterfaces.primaryIPv4()
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

    AsyncFunction("disconnectClient") { (clientId: String) -> Void in
      guard let uuid = UUID(uuidString: clientId) else { return }
      _ = self.server?.disconnect(id: uuid)
    }

    AsyncFunction("forgetClient") { (clientId: String) -> Void in
      guard let uuid = UUID(uuidString: clientId) else { return }
      let host = self.server?.disconnect(id: uuid)
      if let host = host {
        PairingManager.shared.untrust(host: host)
      }
    }

    Function("getClientNames") { () -> [String: String] in
      PairingManager.shared.clientNames()
    }

    AsyncFunction("setClientName") { (host: String, name: String?) -> Void in
      PairingManager.shared.setName(host: host, name: name)
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
    wireVolumeEvents(server)
    wireDisplayEvents(server)
    wireDiagnostics(server)

    do {
      try server.start()
      self.server = server
      self.startStatsTimer()
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
      self.startDatagrams(on: port)
      let host = NetworkInterfaces.primaryIPv4()
      var payload: [String: Any] = ["port": Int(port), "serviceName": name]
      if let host = host { payload["lanHost"] = host }
      self.sendEvent("serverReady", payload)
      promise?.resolve(payload)
    }
    server.onClientConnected = { [weak self, weak server] id, host in
      guard let self = self else { return }
      self.connectedClients.insert(id.uuidString)
      var payload: [String: Any] = ["id": id.uuidString, "host": host]
      // The datagram token is issued here and travels to the phone inside
      // `welcome`, which JavaScript builds.
      if self.datagramPort > 0 {
        payload["udpPort"] = Int(self.datagramPort)
        payload["udpToken"] = self.datagrams.issueToken(for: id)
      }
      self.sendEvent("clientConnected", payload)
      // Seed the phone's volume slider so it does not start from a guess.
      if let state = VolumeController.shared.currentState(),
         let payload = MessageDispatcher.encodeAudioState(
           level: state.level, muted: state.muted
         ) {
        server?.send(payload, to: id)
      }
      // Same for the screen: a phone that connects to a sleeping Mac should
      // offer to wake it right away, not after the next sleep/wake edge.
      if let payload = MessageDispatcher.encodeDisplayState(
        asleep: DisplayController.shared.isAsleep()
      ) {
        server?.send(payload, to: id)
      }
    }
    server.onClientDisconnected = { [weak self] id in
      self?.datagrams.revokeTokens(for: id)
      self?.clearDatagramCount(for: id)
      self?.connectedClients.remove(id.uuidString)
      self?.sendEvent("clientDisconnected", ["id": id.uuidString])
      // Nobody left to read the numbers, and they are not free to collect.
      if self?.connectedClients.isEmpty == true {
        LatencyMonitor.shared.setEnabled(false)
      }
    }
    server.onMessage = { [weak self] id, text in
      let handledNatively = MessageDispatcher.handle(text) { response in
        self?.server?.send(response, to: id)
      }
      self?.countInbound(id)
      // Pointer moves arrive at the display refresh rate. Handing every one of
      // them to JavaScript costs a bridge crossing, a JSON.parse and a store
      // update — a React render per cursor sample, on the same machine that
      // has to post the CGEvent. Natively handled messages stay native; the
      // UI gets counts once a second from `messageStats` instead.
      guard !handledNatively else { return }
      self?.sendEvent("message", [
        "id": id.uuidString,
        "text": text,
        "handledNatively": false
      ])
    }
    server.onError = { [weak self] message in
      self?.sendEvent("error", ["message": message])
    }
    server.onPairRejected = { [weak self] id, host in
      self?.sendEvent("pairRejected", ["id": id, "host": host])
    }
  }

  private func wireVolumeEvents(_ server: WebSocketServer) {
    VolumeController.shared.onChange = { [weak server] level, muted in
      guard let server = server,
            let payload = MessageDispatcher.encodeAudioState(level: level, muted: muted)
      else { return }
      server.broadcast(payload)
    }
    VolumeController.shared.startWatching()
  }

  private func wireDisplayEvents(_ server: WebSocketServer) {
    DisplayController.shared.onChange = { [weak server] asleep in
      guard let server = server,
            let payload = MessageDispatcher.encodeDisplayState(asleep: asleep)
      else { return }
      server.broadcast(payload)
    }
    DisplayController.shared.startWatching()
  }

  private func wireDiagnostics(_ server: WebSocketServer) {
    LatencyMonitor.shared.onSnapshot = { [weak server] snapshot in
      guard let server = server,
            let payload = MessageDispatcher.encodeDiagState(snapshot) else { return }
      server.broadcast(payload)
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

  // MARK: - Datagram path

  private func startDatagrams(on port: UInt16) {
    datagrams.onMessage = { [weak self] id, text in
      guard let self = self else { return }
      let handledNatively = MessageDispatcher.handle(text, transport: .datagram) { response in
        self.server?.send(response, to: id)
      }
      self.countInbound(id)
      self.countDatagram(for: id)
      guard !handledNatively else { return }
      // A datagram carrying something off the hot path is not expected, but
      // the token vouches for it, so treat it like any other message.
      self.sendEvent("message", [
        "id": id.uuidString,
        "text": text,
        "handledNatively": false
      ])
    }
    datagrams.onReady = { [weak self] boundPort in
      self?.datagramPort = boundPort
    }
    datagrams.onError = { [weak self] message in
      self?.sendEvent("error", ["message": message])
    }
    do {
      try datagrams.start(port: port)
      // Optimistic: `onReady` confirms it, but a client connecting in the
      // meantime should still get an offer.
      datagramPort = port
    } catch {
      datagramPort = 0
      sendEvent("error", ["message": "udp listener failed: \(error.localizedDescription)"])
    }
  }

  private func countDatagram(for id: UUID) {
    datagramCountLock.lock()
    datagramCounts[id, default: 0] += 1
    datagramCountLock.unlock()
  }

  private func clearDatagramCount(for id: UUID) {
    datagramCountLock.lock()
    datagramCounts.removeValue(forKey: id)
    datagramCountLock.unlock()
  }

  /// Tells each phone that its datagrams are landing. Without this a blocked
  /// port is indistinguishable from a working one at the sending end, and the
  /// pointer would die silently.
  private func flushDatagramAcks() {
    datagramCountLock.lock()
    let counts = datagramCounts
    datagramCounts.removeAll(keepingCapacity: true)
    datagramCountLock.unlock()
    for (id, frames) in counts where frames > 0 {
      if let payload = MessageDispatcher.encodeUdpOk(frames: frames) {
        server?.send(payload, to: id)
      }
    }
  }

  // MARK: - Inbound message stats

  private func countInbound(_ id: UUID) {
    let key = id.uuidString
    statsLock.lock()
    inboundCounts[key, default: 0] += 1
    statsLock.unlock()
  }

  /// Drains the per-client counters once a second. The desktop UI uses this
  /// for its rate sparkline and per-phone event counts; nothing else needs to
  /// see the hot path.
  private func startStatsTimer() {
    guard statsTimer == nil else { return }
    let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
    timer.schedule(deadline: .now() + 1, repeating: .seconds(1))
    timer.setEventHandler { [weak self] in
      guard let self = self else { return }
      self.statsLock.lock()
      let counts = self.inboundCounts
      self.inboundCounts.removeAll(keepingCapacity: true)
      self.statsLock.unlock()
      let clients = counts.map { ["id": $0.key, "count": $0.value] }
      let total = counts.values.reduce(0, +)
      self.sendEvent("messageStats", ["clients": clients, "total": total])
      self.flushDatagramAcks()
    }
    timer.resume()
    statsTimer = timer
  }

  private func stopStatsTimer() {
    statsTimer?.cancel()
    statsTimer = nil
    statsLock.lock()
    inboundCounts.removeAll()
    statsLock.unlock()
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
