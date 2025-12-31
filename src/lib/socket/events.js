/**
 * Socket.io Event Contracts
 *
 * Client -> Server Events:
 * - user:message      { text: string, sessionId: string }
 * - user:voice:start  { sessionId: string }
 * - user:voice:end    { sessionId: string, transcript: string }
 * - user:typing       { sessionId: string }
 * - join:session      { sessionId: string, userId: string }
 *
 * Server -> Client Events:
 * - agent:response    { text: string, actions?: Action[], messageId: string }
 * - agent:typing      { isTyping: boolean }
 * - agent:thinking    { thought: string }
 * - agent:status      { status: 'idle' | 'listening' | 'thinking' | 'speaking' }
 * - voice:audio       { audioUrl: string, duration: number }
 * - voice:chunk       { chunk: ArrayBuffer }
 * - task:updated      { task: Task, action: 'created' | 'updated' | 'deleted' }
 * - calendar:updated  { event: CalendarEvent, action: 'created' | 'updated' | 'deleted' }
 * - error             { code: string, message: string }
 */

export const EVENTS = {
  // Client -> Server
  USER_MESSAGE: 'user:message',
  USER_VOICE_START: 'user:voice:start',
  USER_VOICE_END: 'user:voice:end',
  USER_TYPING: 'user:typing',
  JOIN_SESSION: 'join:session',
  LEAVE_SESSION: 'leave:session',

  // Server -> Client
  AGENT_RESPONSE: 'agent:response',
  AGENT_TYPING: 'agent:typing',
  AGENT_THINKING: 'agent:thinking',
  AGENT_STATUS: 'agent:status',
  VOICE_AUDIO: 'voice:audio',
  VOICE_CHUNK: 'voice:chunk',
  TASK_UPDATED: 'task:updated',
  CALENDAR_UPDATED: 'calendar:updated',
  ERROR: 'error',
  SESSION_JOINED: 'session:joined',

  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
};

/**
 * Create a standardized error response
 */
export function createError(code, message) {
  return { code, message, timestamp: new Date().toISOString() };
}

/**
 * Create an agent response payload
 */
export function createAgentResponse(text, options = {}) {
  return {
    text,
    messageId: options.messageId || null,
    actions: options.actions || [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a voice audio payload
 */
export function createVoiceAudio(audioUrl, duration) {
  return {
    audioUrl,
    duration,
    timestamp: new Date().toISOString(),
  };
}
