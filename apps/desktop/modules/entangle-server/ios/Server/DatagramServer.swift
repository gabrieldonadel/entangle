import Foundation
import Network

/// Receives pointer frames over UDP.
///
/// TCP guarantees the wrong thing for a pointer: it will not hand over frame
/// N+1 until frame N has been retransmitted, even though N is stale and only
/// N+1 matters. Measured sessions show the result — a 40–300 ms hole followed
/// by a burst of frames landing within 2 ms of each other. On a datagram
/// nothing waits for anything: a lost frame is simply gone, and the phone's
/// cumulative deltas mean the next frame carries the whole truth.
///
/// Only the hot path moves here. Pairing, dock, audio and state stay on the
/// WebSocket, which is also how the token below is issued.
final class DatagramServer {
  private let queue = DispatchQueue(label: "entangle.udp", qos: .userInteractive)
  private var listener: NWListener?
  /// One NWConnection per remote endpoint, held so it keeps receiving.
  private var connections: [ObjectIdentifier: NWConnection] = [:]

  /// Session tokens issued over the WebSocket, mapped to the client that owns
  /// them. A datagram carrying anything else is dropped.
  private var tokens: [String: UUID] = [:]
  private let tokenLock = NSLock()

  /// Called for every authenticated datagram, with the message inside it.
  var onMessage: ((UUID, String) -> Void)?
  var onError: ((String) -> Void)?
  var onReady: ((UInt16) -> Void)?

  // MARK: - Lifecycle

  func start(port: UInt16) throws {
    let params = NWParameters.udp
    params.allowLocalEndpointReuse = true
    params.includePeerToPeer = false

    let endpoint: NWEndpoint.Port = NWEndpoint.Port(rawValue: port) ?? .any
    let listener = try NWListener(using: params, on: endpoint)

    listener.stateUpdateHandler = { [weak self] state in
      guard let self = self else { return }
      switch state {
      case .ready:
        if let port = listener.port?.rawValue { self.onReady?(port) }
      case .failed(let error):
        self.onError?("udp listener failed: \(error.localizedDescription)")
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
      for (_, connection) in self.connections { connection.cancel() }
      self.connections.removeAll()
      self.listener?.cancel()
      self.listener = nil
    }
    tokenLock.lock()
    tokens.removeAll()
    tokenLock.unlock()
  }

  // MARK: - Tokens

  /// Issues a token for a client. Returns it so the caller can put it in
  /// `welcome`.
  func issueToken(for clientId: UUID) -> String {
    let token = UUID().uuidString.replacingOccurrences(of: "-", with: "")
    tokenLock.lock()
    // One token per client: a reconnect invalidates the previous one.
    tokens = tokens.filter { $0.value != clientId }
    tokens[token] = clientId
    tokenLock.unlock()
    return token
  }

  func revokeTokens(for clientId: UUID) {
    tokenLock.lock()
    tokens = tokens.filter { $0.value != clientId }
    tokenLock.unlock()
  }

  private func client(for token: String) -> UUID? {
    tokenLock.lock()
    defer { tokenLock.unlock() }
    return tokens[token]
  }

  // MARK: - Receiving

  private func accept(_ connection: NWConnection) {
    let key = ObjectIdentifier(connection)
    connections[key] = connection

    connection.stateUpdateHandler = { [weak self] state in
      switch state {
      case .failed, .cancelled:
        self?.queue.async { self?.connections.removeValue(forKey: key) }
      default:
        break
      }
    }

    connection.start(queue: queue)
    receive(on: connection)
  }

  private func receive(on connection: NWConnection) {
    connection.receiveMessage { [weak self] data, _, isComplete, error in
      guard let self = self else { return }
      if let error = error {
        self.onError?("udp receive error: \(error.localizedDescription)")
        connection.cancel()
        return
      }
      if let data = data, !data.isEmpty {
        self.handle(data)
      }
      // A completed datagram does not end the flow; keep listening unless the
      // connection itself went away.
      if isComplete, connection.state == .cancelled { return }
      self.receive(on: connection)
    }
  }

  private func handle(_ data: Data) {
    guard
      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let token = json["tk"] as? String,
      let clientId = client(for: token),
      let message = json["m"],
      let payload = try? JSONSerialization.data(withJSONObject: message),
      let text = String(data: payload, encoding: .utf8)
    else {
      // Unparseable or unauthenticated: drop it without comment. This socket
      // is reachable by anything on the LAN.
      return
    }
    onMessage?(clientId, text)
  }
}
