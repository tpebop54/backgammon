// src/utils/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:4000'); // Adjust if server runs elsewhere
  }
  return socket;
}
