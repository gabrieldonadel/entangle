import ExpoModulesCore
import Foundation

public class EntangleServerModule: Module {
  private var server: WebSocketServer?
  private var serverPort: UInt16 = 0
  private var serviceName: String = ""

  public func definition() -> ModuleDefinition {
    Name("EntangleServer")

    Events("clientConnected", "clientDisconnected", "message", "error", "serverReady")

    AsyncFunction("startServer") { (promise: Promise) in
      if self.server != nil {
        promise.resolve([
          "port": Int(self.serverPort),
          "serviceName": self.serviceName,
        ])
        return
      }

      let name = Host.current().localizedName ?? ProcessInfo.processInfo.hostName
      let server = WebSocketServer(serviceType: "_entangle._tcp.", serviceName: name)
      self.serviceName = name

      server.onReady = { [weak self] port in
        guard let self = self else { return }
        self.serverPort = port
        self.sendEvent("serverReady", ["port": Int(port), "serviceName": name])
        promise.resolve([
          "port": Int(port),
          "serviceName": name,
        ])
      }
      server.onClientConnected = { [weak self] id, host in
        self?.sendEvent("clientConnected", [
          "id": id.uuidString,
          "host": host,
        ])
      }
      server.onClientDisconnected = { [weak self] id in
        self?.sendEvent("clientDisconnected", ["id": id.uuidString])
      }
      server.onMessage = { [weak self] id, text in
        self?.sendEvent("message", [
          "id": id.uuidString,
          "text": text,
        ])
      }
      server.onError = { [weak self] message in
        self?.sendEvent("error", ["message": message])
      }

      do {
        try server.start()
        self.server = server
      } catch {
        promise.reject("ENTANGLE_START_FAILED", error.localizedDescription)
      }
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
  }
}
