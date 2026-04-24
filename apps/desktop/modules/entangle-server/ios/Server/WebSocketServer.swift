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

  var onClientConnected: ((UUID, String) -> Void)?
  var onClientDisconnected: ((UUID) -> Void)?
  var onMessage: ((UUID, String) -> Void)?
  var onError: ((String) -> Void)?
  var onReady: ((UInt16) -> Void)?

  init(serviceType: String, serviceName: String) {
    self.serviceType = serviceType
    self.serviceName = serviceName
  }

  func start() throws {
    let params = NWParameters(tls: nil)
    params.allowLocalEndpointReuse = true
    params.includePeerToPeer = false

    let wsOptions = NWProtocolWebSocket.Options()
    wsOptions.autoReplyPing = true
    params.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)

    let listener = try NWListener(using: params, on: .any)
    listener.service = NWListener.Service(
      name: serviceName,
      type: serviceType,
      domain: nil,
      txtRecord: buildTxtRecord()
    )

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

  private func receive(on connection: NWConnection, id: UUID) {
    connection.receiveMessage { [weak self] data, context, _, error in
      guard let self = self else { return }
      if let error = error {
        self.onError?("receive error: \(error.localizedDescription)")
        connection.cancel()
        return
      }

      if let data = data,
         let metadata = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata,
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
    connection.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { [weak self] error in
      if let error = error {
        self?.onError?("send error: \(error.localizedDescription)")
      }
    })
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
