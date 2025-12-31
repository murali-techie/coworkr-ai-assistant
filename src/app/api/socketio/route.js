/**
 * Socket.io API Route Handler for Next.js
 * This enables WebSocket connections through Next.js API routes
 */

import { Server } from 'socket.io';
import { EVENTS, createAgentResponse, createError, createVoiceAudio } from '@/lib/socket/events';
import { processMessage } from '@/lib/ai/orchestrator';
import { generateSpeechBase64, estimateDuration } from '@/lib/voice/elevenlabs';
import { collections } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

const ioHandler = (req, res) => {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.io server...');

    const io = new Server(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on(EVENTS.JOIN_SESSION, async (data) => {
        const { userId, sessionId } = data;

        if (!userId || !sessionId) {
          socket.emit(EVENTS.ERROR, createError('INVALID_SESSION', 'userId and sessionId required'));
          return;
        }

        socket.data.userId = userId;
        socket.data.sessionId = sessionId;
        socket.join(`session:${sessionId}`);

        try {
          const agentDoc = await collections.agent(userId).get();
          const agent = agentDoc.exists ? agentDoc.data() : { name: 'Coworkr' };

          socket.emit(EVENTS.SESSION_JOINED, {
            sessionId,
            agentName: agent.name,
            agentAvatar: agent.avatarUrl,
          });
        } catch (e) {
          socket.emit(EVENTS.SESSION_JOINED, {
            sessionId,
            agentName: 'Coworkr',
          });
        }
      });

      socket.on(EVENTS.USER_MESSAGE, async (data) => {
        const { text, sessionId } = data;
        const userId = socket.data.userId;

        if (!userId || !sessionId || !text?.trim()) return;

        try {
          socket.emit(EVENTS.AGENT_STATUS, { status: 'thinking' });
          socket.emit(EVENTS.AGENT_TYPING, { isTyping: true });

          const response = await processMessage(userId, sessionId, text, { voiceMode: true });

          socket.emit(EVENTS.AGENT_TYPING, { isTyping: false });
          socket.emit(EVENTS.AGENT_RESPONSE, createAgentResponse(response.text, {
            messageId: response.messageId,
            actions: response.actions,
          }));

          socket.emit(EVENTS.AGENT_STATUS, { status: 'speaking' });

          try {
            const agentDoc = await collections.agent(userId).get();
            const voiceId = agentDoc.exists ? agentDoc.data().voiceId : null;
            const audioUrl = await generateSpeechBase64(response.voiceText || response.text, voiceId);
            const duration = estimateDuration(response.voiceText || response.text);
            socket.emit(EVENTS.VOICE_AUDIO, createVoiceAudio(audioUrl, duration));
          } catch (e) {
            console.error('TTS error:', e);
          }

          socket.emit(EVENTS.AGENT_STATUS, { status: 'idle' });
        } catch (error) {
          console.error('Message error:', error);
          socket.emit(EVENTS.AGENT_TYPING, { isTyping: false });
          socket.emit(EVENTS.AGENT_STATUS, { status: 'idle' });
          socket.emit(EVENTS.ERROR, createError('ERROR', 'Failed to process'));
        }
      });

      socket.on(EVENTS.USER_VOICE_START, () => {
        socket.emit(EVENTS.AGENT_STATUS, { status: 'listening' });
      });

      socket.on(EVENTS.USER_VOICE_END, (data) => {
        if (data.transcript?.trim()) {
          socket.emit(EVENTS.USER_MESSAGE, {
            text: data.transcript,
            sessionId: socket.data.sessionId,
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export function GET(req, res) {
  return new Response('Socket.io server', { status: 200 });
}
