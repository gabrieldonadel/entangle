import AppKit
import Foundation

/// Spawns the Node `cursor-agent-host` sidecar and speaks JSONL over stdin/stdout.
final class CursorAgentHost {
  static let shared = CursorAgentHost()

  private let queue = DispatchQueue(label: "entangle.cursor.host")
  private var process: Process?
  private var stdinPipe: Pipe?
  private var stdoutPipe: Pipe?
  private var stdoutBuffer = Data()
  private var configured = false
  private var ready = false

  /// Latest snapshot kept so `cursor.get` can answer without waking the sidecar.
  private(set) var lastStatus: [String: Any] = ["status": "idle"]
  private(set) var transcript: [[String: String]] = []

  var onEvent: (([String: Any]) -> Void)?

  private var replyWaiter: ((Result<[String: Any], Error>) -> Void)?
  private var replyExpectType: String?
  private var replyTimeout: DispatchWorkItem?
  /// Serializes request/response ops — settings opens me/models/usage/agents together
  /// and a single waiter used to cancel earlier completions (account stuck on Loading).
  private var pendingRequests: [PendingHostRequest] = []
  private var requestInFlight = false

  private init() {}

  private struct PendingHostRequest {
    let op: [String: Any]
    let expectType: String
    let timeoutSeconds: Double
    let completion: (Result<[String: Any], Error>) -> Void
  }

  /// True when Preferences allow Cursor and a key + workspace are present.
  static func isCapabilityReady() -> Bool {
    let prefs = PreferencesStore.shared
    guard prefs.cursorAllowPhones else { return false }
    guard CursorKeychain.hasApiKey() else { return false }
    let cwd = prefs.cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cwd.isEmpty, PreferencesStore.workspaceEntryExists(cwd) else { return false }
    return resolveNodePath() != nil && resolveHostScriptPath() != nil
  }

  func ensureConfigured(completion: @escaping (Error?) -> Void) {
    queue.async {
      do {
        try self.ensureProcessLocked()
        try self.configureLocked()
        DispatchQueue.main.async { completion(nil) }
      } catch {
        DispatchQueue.main.async { completion(error) }
      }
    }
  }

  func send(op: [String: Any], completion: ((Error?) -> Void)? = nil) {
    queue.async {
      do {
        try self.ensureProcessLocked()
        try self.configureLocked()
        try self.writeLocked(op)
        DispatchQueue.main.async { completion?(nil) }
      } catch {
        DispatchQueue.main.async { completion?(error) }
      }
    }
  }

  /// Sends an op and waits for a stdout event of `expectType` (or `error`).
  /// Requests are queued so concurrent phone settings fetches do not clobber each other.
  func request(
    op: [String: Any],
    expectType: String,
    timeoutSeconds: Double = 20,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    queue.async {
      self.pendingRequests.append(
        PendingHostRequest(
          op: op,
          expectType: expectType,
          timeoutSeconds: timeoutSeconds,
          completion: completion
        )
      )
      self.pumpRequestsLocked()
    }
  }

  private func pumpRequestsLocked() {
    guard !requestInFlight, !pendingRequests.isEmpty else { return }
    let next = pendingRequests.removeFirst()
    requestInFlight = true
    replyExpectType = next.expectType
    replyWaiter = { [weak self] result in
      DispatchQueue.main.async { next.completion(result) }
      self?.queue.async {
        self?.requestInFlight = false
        self?.replyWaiter = nil
        self?.replyExpectType = nil
        self?.pumpRequestsLocked()
      }
    }
    do {
      try ensureProcessLocked()
      try configureLocked()
      try writeLocked(next.op)
      let timeout = DispatchWorkItem { [weak self] in
        self?.queue.async {
          self?.clearReplyWaiter(with: CursorHostError.modelsTimeout)
        }
      }
      replyTimeout = timeout
      queue.asyncAfter(deadline: .now() + next.timeoutSeconds, execute: timeout)
    } catch {
      let waiter = replyWaiter
      replyWaiter = nil
      replyExpectType = nil
      requestInFlight = false
      replyTimeout?.cancel()
      replyTimeout = nil
      waiter?(.failure(error))
    }
  }

  /// Asks the sidecar for models available to the stored API key.
  func listModels(completion: @escaping (Result<[[String: Any]], Error>) -> Void) {
    request(op: ["op": "listModels"], expectType: "models") { result in
      switch result {
      case .success(let json):
        let models = json["models"] as? [[String: Any]] ?? []
        completion(.success(models))
      case .failure(let error):
        completion(.failure(error))
      }
    }
  }

  private func clearReplyWaiter(with error: Error) {
    replyTimeout?.cancel()
    replyTimeout = nil
    guard let waiter = replyWaiter else {
      requestInFlight = false
      return
    }
    replyWaiter = nil
    replyExpectType = nil
    // Waiter itself clears requestInFlight and pumps the queue.
    waiter(.failure(error))
  }

  private func resolveReply(_ json: [String: Any], type: String) {
    guard let expected = replyExpectType, expected == type, let waiter = replyWaiter else {
      return
    }
    replyTimeout?.cancel()
    replyTimeout = nil
    replyWaiter = nil
    replyExpectType = nil
    waiter(.success(json))
  }

  private func failReply(_ message: String) {
    guard let waiter = replyWaiter else { return }
    replyTimeout?.cancel()
    replyTimeout = nil
    replyWaiter = nil
    replyExpectType = nil
    waiter(.failure(NSError(
      domain: "entangle.cursor",
      code: 3,
      userInfo: [NSLocalizedDescriptionKey: message]
    )))
  }

  func snapshotPayload() -> [String: Any] {
    var payload = lastStatus
    payload["transcript"] = transcript
    return payload
  }

  func shutdown() {
    queue.async {
      self.writeLockedQuiet(["op": "shutdown"])
      self.process?.terminate()
      self.process = nil
      self.stdinPipe = nil
      self.stdoutPipe = nil
      self.configured = false
      self.ready = false
    }
  }

  // MARK: - Process

  private func ensureProcessLocked() throws {
    if let process = process, process.isRunning { return }

    guard let node = Self.resolveNodePath() else {
      throw CursorHostError.nodeMissing
    }
    guard let script = Self.resolveHostScriptPath() else {
      throw CursorHostError.scriptMissing
    }

    let stdin = Pipe()
    let stdout = Pipe()
    let stderr = Pipe()
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: node)
    proc.arguments = [script]
    proc.standardInput = stdin
    proc.standardOutput = stdout
    proc.standardError = stderr
    var env = ProcessInfo.processInfo.environment
    // GUI apps get a minimal PATH; the SDK may spawn helpers that need Homebrew.
    var pathParts = (env["PATH"] ?? "")
      .split(separator: ":")
      .map(String.init)
      .filter { !$0.isEmpty }
    for extra in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
      if !pathParts.contains(extra) { pathParts.append(extra) }
    }
    env["PATH"] = pathParts.joined(separator: ":")
    if let apiKey = CursorKeychain.loadApiKey(), !apiKey.isEmpty {
      env["CURSOR_API_KEY"] = apiKey
    }
    proc.environment = env

    stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let chunk = handle.availableData
      guard !chunk.isEmpty else { return }
      self?.queue.async { self?.consumeStdout(chunk) }
    }
    stderr.fileHandleForReading.readabilityHandler = { handle in
      let chunk = handle.availableData
      if let text = String(data: chunk, encoding: .utf8), !text.isEmpty {
        NSLog("[Entangle] cursor-agent-host stderr: %@", text)
        // Also append to a log file so we can diagnose hangs without Console.app.
        let dir = FileManager.default.homeDirectoryForCurrentUser
          .appendingPathComponent("Library/Logs/Entangle", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("cursor-host.log")
        if let handle = try? FileHandle(forWritingTo: file) {
          defer { try? handle.close() }
          handle.seekToEndOfFile()
          if let data = text.data(using: .utf8) {
            handle.write(data)
          }
        } else {
          FileManager.default.createFile(atPath: file.path, contents: text.data(using: .utf8))
        }
      }
    }
    proc.terminationHandler = { [weak self] _ in
      self?.queue.async {
        self?.process = nil
        self?.configured = false
        self?.ready = false
      }
    }

    try proc.run()
    self.process = proc
    self.stdinPipe = stdin
    self.stdoutPipe = stdout
    self.configured = false
    self.ready = false
    Self.appendHostLog(
      "spawned pid=\(proc.processIdentifier) node=\(node) script=\(script)\n"
    )
  }

  private static func appendHostLog(_ text: String) {
    let dir = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Logs/Entangle", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("cursor-host.log")
    let line = "[\(ISO8601DateFormatter().string(from: Date()))] \(text)"
    if let handle = try? FileHandle(forWritingTo: file) {
      defer { try? handle.close() }
      handle.seekToEndOfFile()
      if let data = line.data(using: .utf8) {
        handle.write(data)
      }
    } else {
      FileManager.default.createFile(atPath: file.path, contents: line.data(using: .utf8))
    }
  }

  private func configureLocked() throws {
    if configured { return }
    guard let apiKey = CursorKeychain.loadApiKey(), !apiKey.isEmpty else {
      throw CursorHostError.missingApiKey
    }
    let prefs = PreferencesStore.shared
    let cwd = prefs.cursorWorkspacePath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cwd.isEmpty else { throw CursorHostError.missingWorkspace }

    let statePath = Self.stateFileURL().path
    var configure: [String: Any] = [
      "op": "configure",
      "apiKey": apiKey,
      "cwd": cwd,
      "model": prefs.cursorModel,
      "statePath": statePath,
    ]
    if let params = prefs.cursorModelParamsJSONObject() {
      configure["modelParams"] = params
    }
    try writeLocked(configure)
    configured = true
  }

  private func writeLocked(_ obj: [String: Any]) throws {
    guard let pipe = stdinPipe else { throw CursorHostError.notRunning }
    let data = try JSONSerialization.data(withJSONObject: obj)
    var line = data
    line.append(0x0A) // \n
    try pipe.fileHandleForWriting.write(contentsOf: line)
  }

  private func writeLockedQuiet(_ obj: [String: Any]) {
    try? writeLocked(obj)
  }

  private func consumeStdout(_ chunk: Data) {
    stdoutBuffer.append(chunk)
    while let range = stdoutBuffer.range(of: Data([0x0A])) {
      let lineData = stdoutBuffer.subdata(in: stdoutBuffer.startIndex..<range.lowerBound)
      stdoutBuffer.removeSubrange(stdoutBuffer.startIndex...range.lowerBound)
      guard let line = String(data: lineData, encoding: .utf8),
            let raw = line.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: raw) as? [String: Any],
            let type = json["type"] as? String else { continue }

      if type == "ready" {
        ready = true
      }
      if type == "models" || type == "usage" || type == "account" || type == "agents"
        || type == "file" || type == "listing" {
        resolveReply(json, type: type)
      }
      if type == "error" {
        failReply((json["message"] as? String) ?? "Cursor host error")
      }
      if type == "status" || type == "snapshot" {
        lastStatus = json.filter { $0.key != "transcript" && $0.key != "type" }
        if let items = json["transcript"] as? [[String: String]] {
          transcript = items
        }
        if type == "status", lastStatus["status"] == nil, let s = json["status"] {
          lastStatus["status"] = s
        }
      }
      if type == "delta",
         let kind = json["kind"] as? String,
         let text = json["text"] as? String {
        let role: String
        switch kind {
        case "assistant": role = "assistant"
        case "thinking": role = "thinking"
        case "tool": role = "tool"
        case "shell": role = "shell"
        case "result": role = "result"
        default: role = kind
        }
        // Streaming assistant / thinking / shell chunks append to the last matching item.
        if (role == "assistant" || role == "thinking" || role == "shell"),
           let last = transcript.last, last["role"] == role {
          var updated = last
          updated["text"] = (last["text"] ?? "") + text
          transcript[transcript.count - 1] = updated
        } else if role == "user" || role == "assistant" || role == "thinking" || role == "tool" || role == "shell" || role == "result" {
          if !(role == "assistant" && text.isEmpty) {
            if role != "assistant" || transcript.last?["role"] != "assistant" {
              transcript.append(["role": role, "text": text])
            }
          }
        }
      }
      onEvent?(json)
    }
  }

  // MARK: - Paths

  static func stateFileURL() -> URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    let dir = base.appendingPathComponent("Entangle", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("cursor-agent.json")
  }

  static func resolveNodePath() -> String? {
    let candidates = [
      ProcessInfo.processInfo.environment["ENTANGLE_NODE"],
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
    ].compactMap { $0 }
    for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
      return path
    }
    // `which node` via /bin/zsh
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/bin/zsh")
    task.arguments = ["-lc", "command -v node"]
    let pipe = Pipe()
    task.standardOutput = pipe
    task.standardError = Pipe()
    do {
      try task.run()
      task.waitUntilExit()
      let data = pipe.fileHandleForReading.readDataToEndOfFile()
      if let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
         !path.isEmpty,
         FileManager.default.isExecutableFile(atPath: path) {
        return path
      }
    } catch {}
    return nil
  }

  static func resolveHostScriptPath() -> String? {
    if let env = ProcessInfo.processInfo.environment["ENTANGLE_CURSOR_HOST"],
       FileManager.default.fileExists(atPath: env) {
      return env
    }
    if let bundled = Bundle.main.path(forResource: "cli", ofType: "js", inDirectory: "cursor-agent-host"),
       FileManager.default.fileExists(atPath: bundled) {
      return bundled
    }
    // Debug / monorepo: walk up from this source file to packages/cursor-agent-host/dist/cli.js
    let thisFile = URL(fileURLWithPath: #file)
    var dir = thisFile.deletingLastPathComponent()
    for _ in 0..<12 {
      let candidate = dir
        .appendingPathComponent("packages/cursor-agent-host/dist/cli.js")
      if FileManager.default.fileExists(atPath: candidate.path) {
        return candidate.path
      }
      let parent = dir.deletingLastPathComponent()
      if parent.path == dir.path { break }
      dir = parent
    }
    return nil
  }

  /// Opens a picker for a folder or a `.code-workspace` file.
  static func pickWorkspaceFolder(completion: @escaping (String?) -> Void) {
    DispatchQueue.main.async {
      let panel = NSOpenPanel()
      panel.canChooseFiles = true
      panel.canChooseDirectories = true
      panel.allowsMultipleSelection = false
      panel.treatsFilePackagesAsDirectories = false
      panel.prompt = "Add"
      panel.message = "Select a folder or a .code-workspace file phones may use with Cursor"
      // Do not lock allowedContentTypes — that blocks navigating into folders to
      // reach a .code-workspace. Validate the selection instead.
      let result = panel.runModal()
      guard result == .OK, let path = panel.url?.path else {
        completion(nil)
        return
      }
      if PreferencesStore.workspaceEntryExists(path) {
        completion(path)
        return
      }
      // Soft reject: not a folder and not a .code-workspace file.
      let alert = NSAlert()
      alert.messageText = "Unsupported workspace"
      alert.informativeText =
        "Choose a folder or a Visual Studio Code / Cursor .code-workspace file."
      alert.runModal()
      completion(nil)
    }
  }

  /// Switches the host to a new cwd when already running; otherwise prefs alone suffice.
  func applyWorkspacePath(_ path: String, completion: ((Error?) -> Void)? = nil) {
    queue.async {
      do {
        if self.process != nil, self.configured {
          try self.writeLocked(["op": "setCwd", "cwd": path])
          self.lastStatus = [
            "status": "idle",
            "cwd": path,
            "model": PreferencesStore.shared.cursorModel,
          ]
          self.transcript = []
        } else {
          // Next ensureConfigured will pick up the new prefs path.
          self.configured = false
        }
        DispatchQueue.main.async { completion?(nil) }
      } catch {
        DispatchQueue.main.async { completion?(error) }
      }
    }
  }
}

enum CursorHostError: LocalizedError {
  case nodeMissing
  case scriptMissing
  case missingApiKey
  case missingWorkspace
  case notRunning
  case modelsTimeout

  var errorDescription: String? {
    switch self {
    case .nodeMissing:
      return "Node.js 22.13+ was not found. Install Node and restart Entangle."
    case .scriptMissing:
      return "cursor-agent-host script not found. Build packages/cursor-agent-host."
    case .missingApiKey:
      return "Set a Cursor API key in Entangle Preferences."
    case .missingWorkspace:
      return "Set a Cursor workspace folder in Entangle Preferences."
    case .notRunning:
      return "Cursor agent host is not running."
    case .modelsTimeout:
      return "Timed out listing models. Check the API key (Admin keys are not supported)."
    }
  }
}
