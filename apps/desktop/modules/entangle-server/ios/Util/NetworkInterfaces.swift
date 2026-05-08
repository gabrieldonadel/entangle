import Darwin
import Foundation

/// Resolves the Mac's primary LAN-facing IPv4 address by walking the BSD
/// `getifaddrs()` table. Used by the pairing QR code so the iPhone can
/// connect directly without first scanning Bonjour.
enum NetworkInterfaces {
  /// Returns the IPv4 address of the first interface that is up, running,
  /// not loopback, not a point-to-point link, and looks like a wired or
  /// wireless interface (`en*`, `bridge*`). Nil if nothing matches.
  static func primaryIPv4() -> String? {
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return nil }
    defer { freeifaddrs(ifaddr) }

    var pointer: UnsafeMutablePointer<ifaddrs>? = first
    while let cursor = pointer {
      defer { pointer = cursor.pointee.ifa_next }

      let flags = Int32(cursor.pointee.ifa_flags)
      let isUp = (flags & IFF_UP) == IFF_UP
      let isRunning = (flags & IFF_RUNNING) == IFF_RUNNING
      let isLoopback = (flags & IFF_LOOPBACK) == IFF_LOOPBACK
      let isPointToPoint = (flags & IFF_POINTOPOINT) == IFF_POINTOPOINT
      guard isUp, isRunning, !isLoopback, !isPointToPoint else { continue }

      guard let sockaddr = cursor.pointee.ifa_addr,
            sockaddr.pointee.sa_family == sa_family_t(AF_INET) else {
        continue
      }

      let name = String(cString: cursor.pointee.ifa_name)
      guard name.hasPrefix("en") || name.hasPrefix("bridge") else { continue }

      var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      let result = getnameinfo(
        sockaddr,
        socklen_t(sockaddr.pointee.sa_len),
        &hostBuffer,
        socklen_t(hostBuffer.count),
        nil,
        0,
        NI_NUMERICHOST
      )
      if result == 0 {
        return String(cString: hostBuffer)
      }
    }
    return nil
  }
}
