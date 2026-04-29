import Foundation
import Network

final class WebSocketServer {
  struct Client {
    let id: UUID
    let connection: NWConnection
    var remoteHost: String
    var lastSeen: Date
  }

  private let queue = DispatchQueue(label: "entangle.server", qos: .userInitiated)
  private var listener: NWListener?
  private var clients: [UUID: Client] = [:]
  private let serviceType: String
  private let serviceName: String
  private let preferredPort: UInt16
  private let advertiseService: Bool

  var onClientConnected: ((UUID, String) -> Void)?
  var onClientDisconnected: ((UUID) -> Void)?
  var onMessage: ((UUID, String) -> Void)?
  var onError: ((String) -> Void)?
  var onReady: ((UInt16) -> Void)?
  var onPairRejected: ((String, String) -> Void)?

  init(
    serviceType: String,
    serviceName: String,
    preferredPort: UInt16 = 0,
    advertiseService: Bool = true
  ) {
    self.serviceType = serviceType
    self.serviceName = serviceName
    self.preferredPort = preferredPort
    self.advertiseService = advertiseService
  }

  func start() throws {
    let params = NWParameters(tls: nil)
    params.allowLocalEndpointReuse = true
    params.includePeerToPeer = false

    let wsOptions = NWProtocolWebSocket.Options()
    wsOptions.autoReplyPing = true
    params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

    let endpoint: NWEndpoint.Port
    if preferredPort > 0, let p = NWEndpoint.Port(rawValue: preferredPort) {
      endpoint = p
    } else {
      endpoint = .any
    }
    let listener = try NWListener(using: params, on: endpoint)
    if advertiseService {
      listener.service = NWListener.Service(
        name: serviceName,
        type: serviceType,
        domain: nil,
        txtRecord: buildTxtRecord()
      )
    }

    listener.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        if let port = listener.port?.rawValue {
          self.onReady?(port)
        }
      case .failed(let error):
        self.onError?("listener failed: \(error.localizedDescription)")
      default:
        break
      }
    }

    listener.newConnectionHandler = { [weak self] connection in
      self?.accept(connection)
    }

    listener.start(queue: queue)
    self.listener = listener
  }

  func stop() {
    queue.async {
      for (_, client) in self.clients {
        client.connection.cancel()
      }
      self.clients.removeAll()
      self.listener?.cancel()
      self.listener = nil
    }
  }

  func broadcast(_ text: String) {
    queue.async {
      for (_, client) in self.clients {
        self.send(text, to: client.connection)
      }
    }
  }

  func send(_ text: String, to clientId: UUID) {
    queue.async {
      guard let client = self.clients[clientId] else { return }
      self.send(text, to: client.connection)
    }
  }

  // MARK: - Private

  private func buildTxtRecord() -> Data? {
    var dict: [String: String] = [
      "v": "1",
      "name": serviceName,
      "id": UUID().uuidString,
    ]
    var data = Data()
    for (key, value) in dict {
      let entry = "\(key)=\(value)"
      guard let bytes = entry.data(using: .utf8), bytes.count <= 255 else { continue }
      data.append(UInt8(bytes.count))
      data.append(bytes)
    }
    return data
  }

  private func accept(_ connection: NWConnection) {
    let id = UUID()
    let host = Self.describeEndpoint(connection.endpoint)

    if PairingManager.shared.isTrusted(host: host) {
      acceptAsAuthenticated(connection: connection, id: id, host: host)
      return
    }

    if !PairingManager.shared.isPairing() {
      rejectAndClose(connection: connection, id: id, host: host, reason: "pairing not active")
      return
    }

    awaitHandshake(connection: connection, id: id, host: host)
  }

  private func acceptAsAuthenticated(connection: NWConnection, id: UUID, host: String) {
    let client = Client(id: id, connection: connection, remoteHost: host, lastSeen: Date())
    clients[id] = client

    connection.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        self.onClientConnected?(id, host)
        self.receive(on: connection, id: id)
      case .failed, .cancelled:
        if self.clients.removeValue(forKey: id) != nil {
          self.onClientDisconnected?(id)
        }
      default:
        break
      }
    }

    connection.start(queue: queue)
  }

  private func registerAuthenticatedAfterHandshake(
    connection: NWConnection, id: UUID, host: String
  ) {
    let client = Client(id: id, connection: connection, remoteHost: host, lastSeen: Date())
    clients[id] = client

    connection.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .failed, .cancelled:
        if self.clients.removeValue(forKey: id) != nil {
          self.onClientDisconnected?(id)
        }
      default:
        break
      }
    }
  }

  private func awaitHandshake(connection: NWConnection, id: UUID, host: String) {
    connection.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        self.receiveHandshake(on: connection, id: id, host: host)
      case .failed, .cancelled:
        break
      default:
        break
      }
    }
    connection.start(queue: queue)
  }

  private func receiveHandshake(on connection: NWConnection, id: UUID, host: String) {
    connection.receiveMessage { [weak self] data, context, _, error in
      guard let self = self else { return }
      if error != nil {
        connection.cancel()
        return
      }
      let wsMeta = context?.protocolMetadata(definition: NWProtocolWebSocket.definition)
        as? NWProtocolWebSocket.Metadata
      guard
        let data = data,
        let metadata = wsMeta,
        metadata.opcode == .text,
        let text = String(data: data, encoding: .utf8)
      else {
        self.rejectAndClose(
          connection: connection, id: id, host: host, reason: "expected text frame"
        )
        return
      }
      switch PairingManager.shared.verifyHandshake(host: host, message: text) {
      case .trusted:
        self.send("{\"v\":1,\"t\":\"pair.accepted\"}", to: connection)
        self.registerAuthenticatedAfterHandshake(connection: connection, id: id, host: host)
        self.onClientConnected?(id, host)
        self.receive(on: connection, id: id)
      case .rejected(let reason):
        self.rejectAndClose(connection: connection, id: id, host: host, reason: reason)
      }
    }
  }

  private func rejectAndClose(connection: NWConnection, id: UUID, host: String, reason: String) {
    let escaped = reason.replacingOccurrences(of: "\"", with: "\\\"")
    let payload = "{\"v\":1,\"t\":\"pair.rejected\",\"reason\":\"\(escaped)\"}"

    let sendReject = {
      self.send(payload, to: connection)
      self.onPairRejected?(id.uuidString, host)
      DispatchQueue.global().asyncAfter(deadline: .now() + 0.05) {
        connection.cancel()
      }
    }

    if connection.state == .ready {
      sendReject()
    } else {
      connection.stateUpdateHandler = { state in
        if case .ready = state {
          sendReject()
        }
      }
      connection.start(queue: queue)
    }
  }

  func disconnectAll() {
    queue.async {
      for (_, client) in self.clients {
        client.connection.cancel()
      }
    }
  }

  private func receive(on connection: NWConnection, id: UUID) {
    connection.receiveMessage { [weak self] data, context, _, error in
      guard let self = self else { return }
      if let error = error {
        self.onError?("receive error: \(error.localizedDescription)")
        connection.cancel()
        return
      }

      let wsMeta = context?.protocolMetadata(definition: NWProtocolWebSocket.definition)
        as? NWProtocolWebSocket.Metadata
      if let data = data,
         let metadata = wsMeta,
         metadata.opcode == .text,
         let text = String(data: data, encoding: .utf8) {
        self.clients[id]?.lastSeen = Date()
        self.onMessage?(id, text)
      }

      if context?.isFinal == true && connection.state == .cancelled {
        return
      }
      self.receive(on: connection, id: id)
    }
  }

  private func send(_ text: String, to connection: NWConnection) {
    let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
    let context = NWConnection.ContentContext(identifier: "send", metadata: [metadata])
    let data = Data(text.utf8)
    let completion: NWConnection.SendCompletion = .contentProcessed { [weak self] error in
      if let error = error {
        self?.onError?("send error: \(error.localizedDescription)")
      }
    }
    connection.send(content: data, contentContext: context, isComplete: true, completion: completion)
  }

  private static func describeEndpoint(_ endpoint: NWEndpoint) -> String {
    switch endpoint {
    case .hostPort(let host, let port):
      return "\(host):\(port)"
    default:
      return "\(endpoint)"
    }
  }
}
