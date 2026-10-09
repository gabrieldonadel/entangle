/** Live WebSocket handle — kept out of `connection.ts` so `send` / stores
 *  can import it without a require cycle through the connection store. */
let socket: WebSocket | null = null;

export function getSocket(): WebSocket | null {
  return socket;
}

export function setSocket(next: WebSocket | null) {
  socket = next;
}
