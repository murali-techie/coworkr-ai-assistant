// Agent configuration
export const DEFAULT_AVATARS = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg',
];

export const VOICE_OPTIONS = {
  male: {
    id: 'pNInz6obpgDQGcFmaJgB', // ElevenLabs Adam
    name: 'Adam',
  },
  female: {
    id: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs Rachel
    name: 'Rachel',
  },
};

// Action types from Gemini
export const ACTION_TYPES = {
  QUERY_DAY: 'QUERY_DAY',
  CREATE_TASK: 'CREATE_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  LIST_TASKS: 'LIST_TASKS',
  CREATE_MEETING: 'CREATE_MEETING',
  UPDATE_MEETING: 'UPDATE_MEETING',
  DELETE_MEETING: 'DELETE_MEETING',
  LIST_MEETINGS: 'LIST_MEETINGS',
  QUERY_RAG: 'QUERY_RAG',
  GENERAL_CHAT: 'GENERAL_CHAT',
};

// Task statuses
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

// Task priorities
export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// Agent states
export const AGENT_STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
};

// Socket events
export const SOCKET_EVENTS = {
  // Client -> Server
  USER_MESSAGE: 'user:message',
  USER_VOICE_START: 'user:voice:start',
  USER_VOICE_END: 'user:voice:end',
  USER_TYPING: 'user:typing',

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

  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_SESSION: 'join:session',
};

// RAG configuration
export const RAG_CONFIG = {
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  TOP_K: 5,
  SIMILARITY_THRESHOLD: 0.7,
};
