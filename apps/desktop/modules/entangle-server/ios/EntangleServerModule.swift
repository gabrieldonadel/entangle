import AppKit
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
      "preferencesChanged", "pairRejected", "messageStats",
      "cursorStatus", "cursorDelta", "cursorSnapshot", "cursorError", "cursorFiles"
    )

    OnCreate {
      self.lastAccessibilityState = AccessibilityCheck.isTrusted()
      self.startAccessibilityPolling()
      DockEnumerator.shared.start()
      CursorAgentHost.shared.onEvent = { [weak self] event in
        // Host stdout is read off-main; Expo bridge events must hop to main.
        DispatchQueue.main.async {
          guard let self = self, let type = event["type"] as? String else { return }
          switch type {
          case "status":
            self.sendEvent("cursorStatus", event)
          case "delta":
            self.sendEvent("cursorDelta", event)
          case "snapshot":
            self.sendEvent("cursorSnapshot", event)
          case "files":
            self.sendEvent("cursorFiles", event)
          case "diffs":
            self.sendEvent("cursorDiffs", event)
          case "error":
            self.sendEvent("cursorError", event)
          default:
            break
          }
        }
      }
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
      PointerHighlight.shared.setEnabled(false)
      CursorAgentHost.shared.onEvent = nil
      CursorAgentHost.shared.shutdown()
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
      PointerHighlight.shared.setEnabled(false)
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
      self.refreshPointerHighlight()
      let cursorConfigChanged =
        ((before["cursorWorkspacePath"] as? String) != (after["cursorWorkspacePath"] as? String)) ||
        ((before["cursorWorkspaceAllowlist"] as? [String]) != (after["cursorWorkspaceAllowlist"] as? [String])) ||
        ((before["cursorModel"] as? String) != (after["cursorModel"] as? String)) ||
        ((before["cursorAllowPhones"] as? Bool) != (after["cursorAllowPhones"] as? Bool))
      if cursorConfigChanged {
        let pathChanged =
          ((before["cursorWorkspacePath"] as? String) != (after["cursorWorkspacePath"] as? String))
        if pathChanged, let path = after["cursorWorkspacePath"] as? String, !path.isEmpty {
          CursorAgentHost.shared.applyWorkspacePath(path)
        } else {
          CursorAgentHost.shared.shutdown()
        }
      }
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

    // MARK: - Cursor agent

    Function("cursorIsReady") { () -> Bool in
      CursorAgentHost.isCapabilityReady()
    }

    Function("hasCursorApiKey") { () -> Bool in
      CursorKeychain.hasApiKey()
    }

    AsyncFunction("setCursorApiKey") { (key: String) -> [String: Any] in
      let ok = CursorKeychain.saveApiKey(key)
      if !ok {
        throw NSError(
          domain: "entangle.cursor",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Could not save API key to Keychain"]
        )
      }
      // Reconfigure on next prompt; drop current host so new key is picked up.
      CursorAgentHost.shared.shutdown()
      let after = PreferencesStore.shared.snapshot()
      self.sendEvent("preferencesChanged", after)
      return after
    }

    /// Reads the API key from the system pasteboard — macOS secure TextInputs
    /// often never deliver paste into JS `onChangeText`.
    AsyncFunction("setCursorApiKeyFromClipboard") { () -> [String: Any] in
      let raw = NSPasteboard.general.string(forType: .string) ?? ""
      let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !key.isEmpty else {
        throw NSError(
          domain: "entangle.cursor",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "Clipboard is empty — copy your key first"]
        )
      }
      let ok = CursorKeychain.saveApiKey(key)
      if !ok {
        throw NSError(
          domain: "entangle.cursor",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Could not save API key to Keychain"]
        )
      }
      CursorAgentHost.shared.shutdown()
      let after = PreferencesStore.shared.snapshot()
      self.sendEvent("preferencesChanged", after)
      return after
    }

    Function("cursorReadinessDetail") { () -> String in
      let prefs = PreferencesStore.shared
      if !prefs.cursorAllowPhones { return "Turn on Allow phones" }
      if !CursorKeychain.hasApiKey() { return "API key not in Keychain yet" }
      let cwd = prefs.cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
      if cwd.isEmpty || !PreferencesStore.workspaceEntryExists(cwd) {
        return "Add a folder or .code-workspace file phones may use"
      }
      if CursorAgentHost.resolveNodePath() == nil {
        return "Node.js not found (need ≥22.13)"
      }
      if CursorAgentHost.resolveHostScriptPath() == nil {
        return "cursor-agent-host missing — run pnpm cursor-host:build"
      }
      return "Ready"
    }

    /// Base64 PNG for an installed app (same encoding as dock `iconPng`).
    /// Tries `bundleId` first, then `name` via Launch Services. Empty if missing.
    Function("appIconPng") { (bundleId: String, name: String) -> String in
      var url: URL?
      if !bundleId.isEmpty {
        url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId)
      }
      if url == nil, !name.isEmpty,
         let path = NSWorkspace.shared.fullPath(forApplication: name) {
        url = URL(fileURLWithPath: path)
      }
      guard let path = url?.path else { return "" }
      let image = NSWorkspace.shared.icon(forFile: path)
      return IconEncoder.encode(image) ?? ""
    }

    AsyncFunction("clearCursorApiKey") { () -> [String: Any] in
      _ = CursorKeychain.deleteApiKey()
      CursorAgentHost.shared.shutdown()
      let after = PreferencesStore.shared.snapshot()
      self.sendEvent("preferencesChanged", after)
      return after
    }

    AsyncFunction("pickCursorWorkspace") { (promise: Promise) in
      CursorAgentHost.pickWorkspaceFolder { path in
        if let path = path {
          PreferencesStore.shared.addCursorWorkspace(path)
          NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
          CursorAgentHost.shared.applyWorkspacePath(path)
          let after = PreferencesStore.shared.snapshot()
          self.sendEvent("preferencesChanged", after)
          promise.resolve(after)
        } else {
          promise.resolve(PreferencesStore.shared.snapshot())
        }
      }
    }

    AsyncFunction("removeCursorWorkspace") { (path: String) -> [String: Any] in
      let before = PreferencesStore.shared.cursorWorkspacePath
      PreferencesStore.shared.removeCursorWorkspace(path)
      NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
      let afterPath = PreferencesStore.shared.cursorWorkspacePath
      if before != afterPath {
        if afterPath.isEmpty {
          CursorAgentHost.shared.shutdown()
        } else {
          CursorAgentHost.shared.applyWorkspacePath(afterPath)
        }
      }
      let after = PreferencesStore.shared.snapshot()
      self.sendEvent("preferencesChanged", after)
      return after
    }

    AsyncFunction("setActiveCursorWorkspace") { (path: String, promise: Promise) in
      let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
      guard PreferencesStore.shared.setActiveCursorWorkspace(trimmed) else {
        promise.reject(
          "CURSOR_WORKSPACE",
          "Workspace is not on the allowlist. Add it in Preferences first."
        )
        return
      }
      guard PreferencesStore.workspaceEntryExists(trimmed) else {
        promise.reject(
          "CURSOR_WORKSPACE",
          "Workspace path does not exist on this Mac (folder or .code-workspace)."
        )
        return
      }
      NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
      CursorAgentHost.shared.applyWorkspacePath(trimmed) { error in
        if let error = error {
          promise.reject("CURSOR_WORKSPACE", error.localizedDescription)
          return
        }
        let after = PreferencesStore.shared.snapshot()
        self.sendEvent("preferencesChanged", after)
        promise.resolve(after)
      }
    }

    Function("cursorWorkspaces") { () -> [String: Any] in
      PreferencesStore.shared.cursorWorkspacesPayload()
    }

    AsyncFunction("listCursorModels") { (promise: Promise) in
      CursorAgentHost.shared.listModels { result in
        switch result {
        case .success(let models):
          promise.resolve(models)
        case .failure(let error):
          promise.reject("CURSOR_MODELS", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorSetModel") { (modelId: String, paramsJson: String?, promise: Promise) in
      PreferencesStore.shared.cursorModel = modelId
      if let paramsJson = paramsJson {
        PreferencesStore.shared.cursorModelParams = paramsJson
      }
      NotificationCenter.default.post(name: PreferencesStore.didChange, object: nil)
      var op: [String: Any] = ["op": "setModel", "modelId": modelId]
      if let data = (paramsJson ?? "[]").data(using: .utf8),
         let params = try? JSONSerialization.jsonObject(with: data) {
        op["params"] = params
      }
      CursorAgentHost.shared.send(op: op) { error in
        let after = PreferencesStore.shared.snapshot()
        self.sendEvent("preferencesChanged", after)
        if let error = error {
          promise.reject("CURSOR_MODEL", error.localizedDescription)
        } else {
          promise.resolve(after)
        }
      }
    }

    AsyncFunction("cursorUsage") { (agentId: String?, promise: Promise) in
      var op: [String: Any] = ["op": "usage"]
      if let agentId = agentId, !agentId.isEmpty {
        op["agentId"] = agentId
      }
      CursorAgentHost.shared.request(op: op, expectType: "usage") { result in
        switch result {
        case .success(let json):
          promise.resolve(json)
        case .failure(let error):
          promise.reject("CURSOR_USAGE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorMe") { (promise: Promise) in
      CursorAgentHost.shared.request(op: ["op": "me"], expectType: "account") { result in
        switch result {
        case .success(let json):
          promise.resolve(json)
        case .failure(let error):
          promise.reject("CURSOR_ME", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorListAgents") { (cursor: String?, limit: Int?, promise: Promise) in
      var op: [String: Any] = ["op": "listAgents"]
      if let cursor = cursor, !cursor.isEmpty { op["cursor"] = cursor }
      if let limit = limit { op["limit"] = limit }
      CursorAgentHost.shared.request(op: op, expectType: "agents", timeoutSeconds: 30) { result in
        switch result {
        case .success(let json):
          promise.resolve(json)
        case .failure(let error):
          promise.reject("CURSOR_AGENTS", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorOpenAgent") { (agentId: String, promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "openAgent", "agentId": agentId]) { error in
        if let error = error {
          promise.reject("CURSOR_OPEN", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorNewChat") { (promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "newChat"]) { error in
        if let error = error {
          promise.reject("CURSOR_NEW", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorEnsureHost") { (promise: Promise) in
      CursorAgentHost.shared.ensureConfigured { error in
        if let error = error {
          promise.reject("CURSOR_HOST", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorPrompt") { (text: String, agentId: String?, imagesJson: String?, promise: Promise) in
      var op: [String: Any] = ["op": "prompt", "text": text]
      if let agentId = agentId, !agentId.isEmpty {
        op["agentId"] = agentId
      }
      if let imagesJson = imagesJson,
         let data = imagesJson.data(using: .utf8),
         let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
         !arr.isEmpty {
        op["images"] = arr
      }
      CursorAgentHost.shared.send(op: op) { error in
        if let error = error {
          promise.reject("CURSOR_PROMPT", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorCancel") { (promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "cancel"]) { error in
        if let error = error {
          promise.reject("CURSOR_CANCEL", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorResume") { (promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "resume"]) { error in
        if let error = error {
          promise.reject("CURSOR_RESUME", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorGetSnapshot") { (promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "snapshot"]) { error in
        if let error = error {
          // Still return whatever we have locally.
          promise.resolve(CursorAgentHost.shared.snapshotPayload())
          _ = error
        } else {
          // Host will emit snapshot async; also return cached immediately.
          promise.resolve(CursorAgentHost.shared.snapshotPayload())
        }
      }
    }

    AsyncFunction("cursorReadFile") { (path: String, promise: Promise) in
      CursorAgentHost.shared.request(
        op: ["op": "readFile", "path": path],
        expectType: "file",
        timeoutSeconds: 15
      ) { result in
        switch result {
        case .success(let json):
          promise.resolve(json)
        case .failure(let error):
          promise.reject("CURSOR_FILE", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorListDir") { (path: String?, promise: Promise) in
      var op: [String: Any] = ["op": "listDir"]
      if let path = path { op["path"] = path }
      CursorAgentHost.shared.request(op: op, expectType: "listing", timeoutSeconds: 15) { result in
        switch result {
        case .success(let json):
          promise.resolve(json)
        case .failure(let error):
          promise.reject("CURSOR_LIST", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cursorKeepFiles") { (pathsJson: String?, promise: Promise) in
      var op: [String: Any] = ["op": "keepFiles"]
      if let pathsJson = pathsJson,
         let data = pathsJson.data(using: .utf8),
         let paths = try? JSONSerialization.jsonObject(with: data) as? [String] {
        op["paths"] = paths
      }
      CursorAgentHost.shared.send(op: op) { error in
        if let error = error {
          promise.reject("CURSOR_KEEP", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorDiscardFiles") { (pathsJson: String?, promise: Promise) in
      var op: [String: Any] = ["op": "discardFiles"]
      if let pathsJson = pathsJson,
         let data = pathsJson.data(using: .utf8),
         let paths = try? JSONSerialization.jsonObject(with: data) as? [String] {
        op["paths"] = paths
      }
      CursorAgentHost.shared.send(op: op) { error in
        if let error = error {
          promise.reject("CURSOR_DISCARD", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("cursorListDiffs") { (promise: Promise) in
      CursorAgentHost.shared.send(op: ["op": "listDiffs"]) { error in
        if let error = error {
          promise.reject("CURSOR_DIFFS", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
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
    // Prefs "auto" (0) used to bind an ephemeral port, which breaks phone
    // reconnect after a Mac restart. Prefer the protocol default; if that
    // port is taken, WebSocketServer falls back to an ephemeral bind.
    let preferredPort: UInt16 = prefs.port == 0 ? 49827 : prefs.port
    let server = WebSocketServer(
      serviceType: "_entangle._tcp.",
      serviceName: name,
      preferredPort: preferredPort,
      advertiseService: prefs.discoverable,
      fallbackToEphemeral: prefs.port == 0
    )
    self.serviceName = name

    wireServerEvents(server, name: name, promise: promise)
    wireDockEvents(server)
    wireVolumeEvents(server)
    wireDisplayEvents(server)
    wireClipboardEvents(server)
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
      self.refreshPointerHighlight()
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
      ClipboardController.shared.clearClient(id)
      self?.sendEvent("clientDisconnected", ["id": id.uuidString])
      self?.refreshPointerHighlight()
      // Nobody left to read the numbers, and they are not free to collect.
      if self?.connectedClients.isEmpty == true {
        LatencyMonitor.shared.setEnabled(false)
      }
    }
    server.onMessage = { [weak self] id, text in
      // Only allocate a clipboard route when sync is on — pointer frames are hot.
      let route: MessageDispatcher.ClipboardRoute? =
        PreferencesStore.shared.clipboardSync
        ? MessageDispatcher.ClipboardRoute(clientId: id) { targetId, payload in
            self?.server?.send(payload, to: targetId)
          }
        : nil
      let handledNatively = MessageDispatcher.handle(
        text,
        clipboard: route
      ) { response in
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

  private func wireClipboardEvents(_ server: WebSocketServer) {
    ClipboardController.shared.onLocalChange = { [weak server] payload in
      guard let server = server,
            let encoded = ClipboardController.encodePush(payload) else { return }
      for clientId in ClipboardController.shared.syncingClientIds() {
        server.send(encoded, to: clientId)
      }
    }
  }

  /// The ring is only wanted while a phone is actually driving the pointer.
  ///
  /// Reads `connectedClients`, which the callbacks update before calling this
  /// and which is already the module's answer to "is anyone connected". The
  /// original version asked the server for a count, and needed the server
  /// passed in because the connect callback can fire before `startServer` has
  /// finished assigning `self.server`; this has neither problem.
  private func refreshPointerHighlight() {
    PointerHighlight.shared.setEnabled(
      !connectedClients.isEmpty && PreferencesStore.shared.highlightPointer
    )
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
      let route: MessageDispatcher.ClipboardRoute? =
        PreferencesStore.shared.clipboardSync
        ? MessageDispatcher.ClipboardRoute(clientId: id) { targetId, payload in
            self.server?.send(payload, to: targetId)
          }
        : nil
      let handledNatively = MessageDispatcher.handle(
        text,
        transport: .datagram,
        clipboard: route
      ) { response in
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
