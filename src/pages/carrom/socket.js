import { io } from 'socket.io-client';

export const socket = io('http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 700,
  reconnectionDelayMax: 4000
});

export function connect() {
  if (!socket.connected) socket.connect();
}

export default socket;