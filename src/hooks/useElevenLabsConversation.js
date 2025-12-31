'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation } from '@elevenlabs/client';

export function useElevenLabsConversation(options = {}) {
  const {
    onMessage,
    onStatusChange,
    onModeChange,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [mode, setMode] = useState('idle'); // idle, listening, speaking
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);

  const conversationRef = useRef(null);
  const volumeIntervalRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession().catch(() => {});
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }
    };
  }, []);

  // Start conversation
  const startConversation = useCallback(async () => {
    if (conversationRef.current) {
      console.log('[ElevenLabs] Already connected');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from our API
      const response = await fetch('/api/agent/conversation', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initialize conversation');
      }

      const { signedUrl, agentId } = await response.json();

      console.log('[ElevenLabs] Starting session with agent:', agentId);

      // Start the ElevenLabs conversation
      const conversation = await Conversation.startSession({
        signedUrl,
        onConnect: () => {
          console.log('[ElevenLabs] Connected');
          setStatus('connected');
          onConnect?.();
        },
        onDisconnect: () => {
          console.log('[ElevenLabs] Disconnected');
          setStatus('disconnected');
          setMode('idle');
          conversationRef.current = null;
          onDisconnect?.();
        },
        onMessage: (message) => {
          console.log('[ElevenLabs] Message:', message);

          // Track transcript
          if (message.type === 'user_transcript' && message.user_transcript_event) {
            const text = message.user_transcript_event.user_transcript;
            if (message.user_transcript_event.is_final) {
              setTranscript(prev => [...prev, { role: 'user', text }]);
            }
          } else if (message.type === 'agent_response' && message.agent_response_event) {
            const text = message.agent_response_event.agent_response;
            setTranscript(prev => [...prev, { role: 'agent', text }]);
          }

          onMessage?.(message);
        },
        onError: (err) => {
          console.error('[ElevenLabs] Error:', err);
          setError(err.message || 'Conversation error');
          onError?.(err);
        },
        onStatusChange: (newStatus) => {
          console.log('[ElevenLabs] Status:', newStatus);
          setStatus(newStatus.status);
          onStatusChange?.(newStatus);
        },
        onModeChange: (newMode) => {
          console.log('[ElevenLabs] Mode:', newMode);
          setMode(newMode.mode);
          onModeChange?.(newMode);
        },
      });

      conversationRef.current = conversation;

      // Start volume monitoring
      volumeIntervalRef.current = setInterval(() => {
        if (conversationRef.current) {
          try {
            setInputVolume(conversationRef.current.getInputVolume() || 0);
            setOutputVolume(conversationRef.current.getOutputVolume() || 0);
          } catch (e) {
            // Ignore volume errors
          }
        }
      }, 100);

    } catch (err) {
      console.error('[ElevenLabs] Failed to start:', err);
      setError(err.message);
      setStatus('disconnected');
      onError?.(err);
    }
  }, [onConnect, onDisconnect, onMessage, onError, onStatusChange, onModeChange]);

  // End conversation
  const endConversation = useCallback(async () => {
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }

    if (conversationRef.current) {
      try {
        await conversationRef.current.endSession();
      } catch (err) {
        console.error('[ElevenLabs] Error ending session:', err);
      }
      conversationRef.current = null;
    }

    setStatus('disconnected');
    setMode('idle');
    setInputVolume(0);
    setOutputVolume(0);
  }, []);

  // Mute/unmute microphone
  const setMuted = useCallback((muted) => {
    if (conversationRef.current) {
      conversationRef.current.setMicMuted(muted);
    }
  }, []);

  // Set output volume
  const setVolume = useCallback((volume) => {
    if (conversationRef.current) {
      conversationRef.current.setVolume({ volume });
    }
  }, []);

  // Send text message (for typing instead of speaking)
  const sendTextMessage = useCallback((text) => {
    if (conversationRef.current) {
      conversationRef.current.sendUserMessage({ text });
    }
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  return {
    // State
    status,
    mode,
    transcript,
    error,
    inputVolume,
    outputVolume,
    isConnected: status === 'connected',
    isListening: mode === 'listening',
    isSpeaking: mode === 'speaking',

    // Actions
    startConversation,
    endConversation,
    setMuted,
    setVolume,
    sendTextMessage,
    clearTranscript,
  };
}

export default useElevenLabsConversation;
