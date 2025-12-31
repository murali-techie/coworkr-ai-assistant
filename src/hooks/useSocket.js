'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { EVENTS } from '@/lib/socket/events';

export function useSocket(userId, sessionId) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState('idle');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const [lastAudio, setLastAudio] = useState(null);

  // Initialize socket
  useEffect(() => {
    if (!userId || !sessionId) return;

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(EVENTS.JOIN_SESSION, { userId, sessionId });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on(EVENTS.AGENT_STATUS, (data) => {
      setAgentStatus(data.status);
    });

    socket.on(EVENTS.AGENT_TYPING, (data) => {
      setIsTyping(data.isTyping);
    });

    socket.on(EVENTS.AGENT_RESPONSE, (data) => {
      setMessages(prev => [...prev, {
        id: data.messageId || Date.now().toString(),
        role: 'agent',
        content: data.text,
        actions: data.actions,
        audioData: data.audio, // Base64 audio for TTS playback
        timestamp: new Date(),
      }]);
    });

    socket.on(EVENTS.VOICE_AUDIO, (data) => {
      setLastAudio({
        url: data.audioUrl,
        duration: data.duration,
        timestamp: new Date(),
      });
    });

    socket.on(EVENTS.ERROR, (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, sessionId]);

  // Send message
  const sendMessage = useCallback((text, voiceMode = false) => {
    if (!socketRef.current || !text?.trim()) return;

    // Add user message to list
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);

    socketRef.current.emit(EVENTS.USER_MESSAGE, {
      text,
      sessionId,
      voiceMode, // Request TTS audio in response
    });
  }, [sessionId]);

  // Notify voice input started
  const startVoiceInput = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit(EVENTS.USER_VOICE_START, { sessionId });
  }, [sessionId]);

  // Send voice transcript
  const endVoiceInput = useCallback((transcript) => {
    if (!socketRef.current) return;
    socketRef.current.emit(EVENTS.USER_VOICE_END, { sessionId, transcript });
  }, [sessionId]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    agentStatus,
    isTyping,
    messages,
    lastAudio,
    sendMessage,
    startVoiceInput,
    endVoiceInput,
    clearMessages,
  };
}

export default useSocket;
