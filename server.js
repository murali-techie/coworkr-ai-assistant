const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || (dev ? 3000 : 8080);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Store io instance globally for API routes
  global.io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join session
    socket.on('join:session', ({ userId, sessionId }) => {
      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.join(`user:${userId}`);
      socket.join(`session:${sessionId}`);
      console.log(`User ${userId} joined session ${sessionId}`);

      socket.emit('session:joined', {
        status: 'connected',
        sessionId
      });
    });

    // Handle user message
    socket.on('user:message', async (data) => {
      const { text, sessionId, voiceMode = false } = data;
      const userId = socket.userId;

      console.log(`Message from ${userId}:`, text, voiceMode ? '(voice)' : '(text)');

      // Set typing indicator
      socket.emit('agent:status', { status: 'thinking' });

      try {
        // Call the API endpoint to process the message (runs in Next.js context)
        const response = await fetch(`http://127.0.0.1:${port}/api/chat/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            sessionId,
            message: text,
            voiceMode,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Processing failed');
        }

        // Generate TTS audio if voice mode is enabled
        let audioBase64 = null;
        if (voiceMode && result.text) {
          try {
            socket.emit('agent:status', { status: 'speaking' });
            const ttsResponse = await fetch(`http://127.0.0.1:${port}/api/tts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: result.text }),
            });

            if (ttsResponse.ok) {
              const ttsResult = await ttsResponse.json();
              audioBase64 = ttsResult.audio;
              console.log('TTS audio generated, length:', audioBase64?.length);
            }
          } catch (ttsError) {
            console.error('TTS error:', ttsError);
          }
        }

        // Send response
        socket.emit('agent:status', { status: voiceMode ? 'speaking' : 'idle' });
        socket.emit('agent:response', {
          messageId: result.messageId || Date.now().toString(),
          text: result.text,
          actions: result.actions || [],
          audio: audioBase64,
        });

        // Reset status after speaking
        if (voiceMode && audioBase64) {
          // Estimate audio duration (rough: ~150 words per minute)
          const wordCount = result.text.split(/\s+/).length;
          const estimatedDuration = (wordCount / 150) * 60 * 1000;
          setTimeout(() => {
            socket.emit('agent:status', { status: 'idle' });
          }, Math.max(estimatedDuration, 2000));
        } else {
          setTimeout(() => {
            socket.emit('agent:status', { status: 'idle' });
          }, 500);
        }

      } catch (error) {
        console.error('Error processing message:', error);
        socket.emit('error', { code: 'PROCESSING_ERROR', message: error.message || 'Failed to process message' });
        socket.emit('agent:status', { status: 'idle' });
      }
    });

    socket.on('user:voice:start', () => {
      console.log('Voice input started');
    });

    socket.on('user:voice:end', ({ transcript }) => {
      console.log('Voice input ended:', transcript);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    console.log('> Socket.io server running');
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
  });
});
