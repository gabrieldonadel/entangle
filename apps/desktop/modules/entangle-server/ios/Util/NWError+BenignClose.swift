import Network

extension NWError {
  /// The connection was cancelled: the phone closed the socket, or the server
  /// did. Not a fault, so not worth an error event.
  var isBenignClose: Bool {
    if case .posix(.ECANCELED) = self { return true }
    return false
  }
}
