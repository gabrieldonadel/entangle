import ExpoModulesCore
import Network

/// A datagram socket for pointer frames.
///
/// `send` is a synchronous `Function` rather than an `AsyncFunction` on
/// purpose: this is called up to 120 times a second, and a promise per frame
/// would cost more than the frame. `NWConnection.send` hands the bytes to its
/// own queue, so the call returns immediately.
public class EntangleUdpModule: Module {
  private var connection: NWConnection?
  private let queue = DispatchQueue(label: "entangle.udp.client", qos: .userInteractive)

  public func definition() -> ModuleDefinition {
    Name("EntangleUdp")

    OnDestroy {
      self.closeConnection()
    }

    Function("open") { (host: String, port: Int) -> Bool in
      self.closeConnection()
      guard port > 0, port <= 65535,
            let endpointPort = NWEndpoint.Port(rawValue: UInt16(port)) else {
        return false
      }
      let connection = NWConnection(
        host: NWEndpoint.Host(host), port: endpointPort, using: .udp
      )
      connection.start(queue: self.queue)
      self.connection = connection
      return true
    }

    Function("send") { (text: String) -> Bool in
      guard let connection = self.connection else { return false }
      // `.idempotent` skips the per-send completion block. A dropped frame is
      // the transport working as intended: the next one carries the total.
      connection.send(content: Data(text.utf8), completion: .idempotent)
      return true
    }

    Function("close") { () -> Void in
      self.closeConnection()
    }
  }

  private func closeConnection() {
    connection?.cancel()
    connection = nil
  }
}
