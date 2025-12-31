/**
 * Socket.io Server Handler
 * Handles real-time communication between client and server
 */

import { Server } from 'socket.io';
import { EVENTS, createAgentResponse, createError, createVoiceAudio } from '@/lib/socket/events';
import { processMessage } from '@/lib/ai/orchestrator';
import { generateSpeechBase64, estimateDuration } from '@/lib/voice/elevenlabs';
import { collections } from '@/lib/firebase/admin';

let io = null;

/**
 * Initialize Socket.io server
 */
export function initSocketServer(server) {
  if (io) return io;

  io = new Server(server, {
    path: '/api/socketio',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle session join
    socket.on(EVENTS.JOIN_SESSION, async (data) => {
      const { userId, sessionId } = data;

      if (!userId || !sessionId) {
        socket.emit(EVENTS.ERROR, createError('INVALID_SESSION', 'userId and sessionId required'));
        return;
      }

      // Store user info on socket
      socket.data.userId = userId;
      socket.data.sessionId = sessionId;

      // Join room for this session
      socket.join(`session:${sessionId}`);

      // Get agent info
      const agentDoc = await collections.agent(userId).get();
      const agent = agentDoc.exists ? agentDoc.data() : { name: 'Coworkr' };

      socket.emit(EVENTS.SESSION_JOINED, {
        sessionId,
        agentName: agent.name,
        agentAvatar: agent.avatarUrl,
      });

      console.log(`User ${userId} joined session ${sessionId}`);
    });

    // Handle user message
    socket.on(EVENTS.USER_MESSAGE, async (data) => {
      const { text, sessionId } = data;
      const userId = socket.data.userId;

      if (!userId || !sessionId) {
        socket.emit(EVENTS.ERROR, createError('NOT_AUTHENTICATED', 'Please join a session first'));
        return;
      }

      if (!text?.trim()) {
        return;
      }

      try {
        // Show thinking state
        socket.emit(EVENTS.AGENT_STATUS, { status: 'thinking' });
        socket.emit(EVENTS.AGENT_TYPING, { isTyping: true });

        // Process message through orchestrator
        const response = await processMessage(userId, sessionId, text, { voiceMode: true });

        // Send text response
        socket.emit(EVENTS.AGENT_TYPING, { isTyping: false });
        socket.emit(EVENTS.AGENT_RESPONSE, createAgentResponse(response.text, {
          messageId: response.messageId,
          actions: response.actions,
        }));

        // Generate and send voice audio
        socket.emit(EVENTS.AGENT_STATUS, { status: 'speaking' });

        try {
          // Get voice ID from agent settings
          const agentDoc = await collections.agent(userId).get();
          const voiceId = agentDoc.exists ? agentDoc.data().voiceId : null;

          const audioUrl = await generateSpeechBase64(response.voiceText || response.text, voiceId);
          const duration = estimateDuration(response.voiceText || response.text);

          socket.emit(EVENTS.VOICE_AUDIO, createVoiceAudio(audioUrl, duration));
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
          // Continue without voice
        }

        // Emit any side effects (task/calendar updates)
        if (response.actions?.length > 0) {
          for (const action of response.actions) {
            if (action.type.includes('TASK') && action.success) {
              socket.emit(EVENTS.TASK_UPDATED, {
                task: action.data,
                action: action.type.toLowerCase().replace('_task', ''),
              });
            } else if (action.type.includes('MEETING') && action.success) {
              socket.emit(EVENTS.CALENDAR_UPDATED, {
                event: action.data,
                action: action.type.toLowerCase().replace('_meeting', ''),
              });
            }
          }
        }

        socket.emit(EVENTS.AGENT_STATUS, { status: 'idle' });
      } catch (error) {
        console.error('Message processing error:', error);
        socket.emit(EVENTS.AGENT_TYPING, { isTyping: false });
        socket.emit(EVENTS.AGENT_STATUS, { status: 'idle' });
        socket.emit(EVENTS.ERROR, createError('PROCESSING_ERROR', 'Failed to process message'));
      }
    });

    // Handle voice input start
    socket.on(EVENTS.USER_VOICE_START, () => {
      socket.emit(EVENTS.AGENT_STATUS, { status: 'listening' });
    });

    // Handle voice input end (with transcript)
    socket.on(EVENTS.USER_VOICE_END, async (data) => {
      const { sessionId, transcript } = data;

      if (transcript?.trim()) {
        // Process as regular message
        socket.emit(EVENTS.USER_MESSAGE, { text: transcript, sessionId });
      } else {
        socket.emit(EVENTS.AGENT_STATUS, { status: 'idle' });
      }
    });

    // Handle typing indicator
    socket.on(EVENTS.USER_TYPING, () => {
      // Could broadcast to other clients if needed
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

/**
 * Get Socket.io instance
 */
export function getIO() {
  return io;
}

/**
 * Broadcast to a session
 */
export function broadcastToSession(sessionId, event, data) {
  if (io) {
    io.to(`session:${sessionId}`).emit(event, data);
  }
}

export default {
  initSocketServer,
  getIO,
  broadcastToSession,
};
