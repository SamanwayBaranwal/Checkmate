import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | undefined;

export function getSocket(token?: string): Socket {
  // Reuse the existing socket unless the auth token changed.
  // socket.io handles reconnection internally — don't recreate on transient drops.
  if (socket && currentToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
    auth: token ? { token } : {},
    autoConnect: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 8000,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = undefined;
}
