import { io } from 'socket.io-client';
import { EVENTS } from './events';

let socket = null;

/**
 * Initialize socket connection
 */
export function initSocket() {
  if (socket) return socket;

  socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
    path: '/api/socketio',
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });

  return socket;
}

/**
 * Get existing socket instance
 */
export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

/**
 * Connect to socket server
 */
export function connectSocket(userId, sessionId) {
  const sock = getSocket();

  if (!sock.connected) {
    sock.connect();
  }

  sock.emit(EVENTS.JOIN_SESSION, { userId, sessionId });

  return sock;
}

/**
 * Disconnect from socket server
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Send a user message
 */
export function sendMessage(text, sessionId) {
  const sock = getSocket();
  sock.emit(EVENTS.USER_MESSAGE, { text, sessionId, timestamp: new Date().toISOString() });
}

/**
 * Notify voice input started
 */
export function startVoiceInput(sessionId) {
  const sock = getSocket();
  sock.emit(EVENTS.USER_VOICE_START, { sessionId });
}

/**
 * Send voice transcript
 */
export function endVoiceInput(sessionId, transcript) {
  const sock = getSocket();
  sock.emit(EVENTS.USER_VOICE_END, { sessionId, transcript });
}

/**
 * Notify typing status
 */
export function sendTyping(sessionId, isTyping = true) {
  const sock = getSocket();
  sock.emit(EVENTS.USER_TYPING, { sessionId, isTyping });
}

export default {
  initSocket,
  getSocket,
  connectSocket,
  disconnectSocket,
  sendMessage,
  startVoiceInput,
  endVoiceInput,
  sendTyping,
  EVENTS,
};
