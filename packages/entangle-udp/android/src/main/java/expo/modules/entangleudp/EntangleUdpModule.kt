package expo.modules.entangleudp

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.Executors

/**
 * A datagram socket for pointer frames.
 *
 * `send` is synchronous from JavaScript's point of view but does no I/O on the
 * calling thread: the packet goes to a single-threaded executor. This is
 * called up to 120 times a second and must never block the JS thread, which is
 * already the narrowest part of the pointer path.
 */
class EntangleUdpModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private var socket: DatagramSocket? = null
  @Volatile private var address: InetAddress? = null
  @Volatile private var port: Int = 0

  override fun definition() = ModuleDefinition {
    Name("EntangleUdp")

    OnDestroy {
      closeSocket()
    }

    Function("open") { host: String, targetPort: Int ->
      closeSocket()
      if (targetPort <= 0 || targetPort > 65535) {
        return@Function false
      }
      port = targetPort
      // Resolving can touch the network — a `.local` name goes to mDNS — so it
      // happens off the calling thread. `send` no-ops until it lands.
      executor.execute {
        try {
          address = InetAddress.getByName(host)
          socket = DatagramSocket()
        } catch (error: Exception) {
          address = null
          socket = null
        }
      }
      true
    }

    Function("send") { text: String ->
      val target = address ?: return@Function false
      val bytes = text.toByteArray(Charsets.UTF_8)
      val currentPort = port
      executor.execute {
        try {
          socket?.send(DatagramPacket(bytes, bytes.size, target, currentPort))
        } catch (error: Exception) {
          // A dropped frame is the transport working as intended: the next one
          // carries the running total.
        }
      }
      true
    }

    Function("close") {
      closeSocket()
    }
  }

  private fun closeSocket() {
    address = null
    port = 0
    val current = socket
    socket = null
    executor.execute {
      try {
        current?.close()
      } catch (error: Exception) {
      }
    }
  }
}
