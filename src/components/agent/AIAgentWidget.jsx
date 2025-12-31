'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '@/hooks/useVoice';
import { useElevenLabsConversation } from '@/hooks/useElevenLabsConversation';

// Filler phrases for natural conversation flow (used with custom voice mode)
const THINKING_FILLERS = [
  "Hmm, let me check...",
  "One moment...",
  "Let me see...",
  "Checking that for you...",
  "Just a sec...",
];

export default function AIAgentWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentStatus, setAgentStatus] = useState('idle'); // idle, listening, thinking, speaking
  const [showChat, setShowChat] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [useElevenLabsAgent, setUseElevenLabsAgent] = useState(false);
  const [agentConfigured, setAgentConfigured] = useState(null); // null = checking, true/false = result
  const [voiceAvailable, setVoiceAvailable] = useState(null); // null = checking, true/false = result
  const messagesEndRef = useRef(null);
  const fillerAudioRef = useRef(null);
  const sendMessageRef = useRef(null);

  // Check if ElevenLabs agent is configured and voice is available
  useEffect(() => {
    fetch('/api/agent/conversation')
      .then(res => res.json())
      .then(data => {
        setAgentConfigured(data.configured);
        setVoiceAvailable(data.voiceAvailable);
        setUseElevenLabsAgent(data.configured);
        // Auto-show chat view if voice is not available
        if (!data.voiceAvailable) {
          setShowChat(true);
        }
      })
      .catch(() => {
        setAgentConfigured(false);
        setVoiceAvailable(false);
        setShowChat(true); // Fallback to chat on error
      });
  }, []);

  // ElevenLabs Conversation hook (for native agent experience)
  const elevenLabs = useElevenLabsConversation({
    onMessage: (message) => {
      // Handle transcript messages
      if (message.type === 'user_transcript' && message.user_transcript_event?.is_final) {
        const text = message.user_transcript_event.user_transcript;
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'user',
          content: text,
          timestamp: new Date(),
        }]);
      } else if (message.type === 'agent_response') {
        const text = message.agent_response_event?.agent_response;
        if (text) {
          setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'agent',
            content: text,
            timestamp: new Date(),
          }]);
        }
      }
    },
    onModeChange: ({ mode }) => {
      if (mode === 'listening') {
        setAgentStatus('listening');
      } else if (mode === 'speaking') {
        setAgentStatus('speaking');
      } else {
        setAgentStatus('idle');
      }
    },
  });

  // Custom Voice hook (for our Gemini backend)
  const customVoice = useVoice({
    onTranscript: (text) => {
      if (text.trim() && sendMessageRef.current) {
        sendMessageRef.current(text, true);
      }
    },
    onAudioLevel: (level) => {
      setVoiceLevel(level);
    },
  });

  // Determine which mode to use
  const isElevenLabsMode = useElevenLabsAgent && agentConfigured;

  // Unified state from whichever system is active
  const isListening = isElevenLabsMode ? elevenLabs.isListening : customVoice.isListening;
  const isSpeaking = isElevenLabsMode ? elevenLabs.isSpeaking : agentStatus === 'speaking';
  const isConnected = isElevenLabsMode ? elevenLabs.isConnected : customVoice.conversationMode;
  const currentVolume = isElevenLabsMode ? elevenLabs.inputVolume : voiceLevel;
  const isVoiceProcessing = isElevenLabsMode ? false : customVoice.isProcessing;
  const interimTranscript = isElevenLabsMode ? '' : customVoice.interimTranscript;
  const error = isElevenLabsMode ? elevenLabs.error : customVoice.error;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update status based on ElevenLabs mode
  useEffect(() => {
    if (isElevenLabsMode) {
      if (elevenLabs.status === 'connecting') {
        setAgentStatus('thinking');
      }
    }
  }, [isElevenLabsMode, elevenLabs.status]);

  // Play a filler phrase immediately when thinking starts (custom mode only)
  const playFillerAudio = useCallback(async () => {
    if (isElevenLabsMode) return; // ElevenLabs handles this

    const filler = THINKING_FILLERS[Math.floor(Math.random() * THINKING_FILLERS.length)];

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: filler, voice: 'rachel' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          if (fillerAudioRef.current) {
            fillerAudioRef.current.pause();
          }

          const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
          fillerAudioRef.current = audio;
          setAgentStatus('speaking');

          await audio.play();
          await new Promise((resolve) => {
            audio.onended = resolve;
          });
        }
      }
    } catch (err) {
      console.error('Filler audio error:', err);
    }
  }, [isElevenLabsMode]);

  const stopFillerAudio = useCallback(() => {
    if (fillerAudioRef.current) {
      fillerAudioRef.current.pause();
      fillerAudioRef.current = null;
    }
  }, []);

  // Send message (handles both ElevenLabs and custom mode)
  const sendMessage = useCallback(async (text, withVoice = false) => {
    if (!text.trim() || isProcessing) return;

    // Always add user message to state immediately
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (isElevenLabsMode && elevenLabs.isConnected) {
      // ElevenLabs mode - send via WebSocket
      elevenLabs.sendTextMessage(text);
      return;
    }

    // Custom mode - use our Gemini backend
    setIsProcessing(true);
    setAgentStatus('thinking');

    try {
      const fillerPromise = withVoice ? playFillerAudio() : Promise.resolve();

      const apiPromise = fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId: user?.id,
          withVoice,
        }),
      });

      const res = await apiPromise;
      const data = await res.json();

      stopFillerAudio();
      await fillerPromise;

      const agentMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: data.text || 'Sorry, I could not process that.',
        actions: data.actions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, agentMessage]);

      if (withVoice && data.audio) {
        setAgentStatus('speaking');
        const result = await customVoice.playAudioData(data.audio, 'audio/mpeg', customVoice.conversationMode);

        if (result?.shouldAutoListen || customVoice.conversationMode) {
          setTimeout(() => {
            customVoice.startListening();
            setAgentStatus('listening');
          }, 300);
          return;
        }
      } else if (withVoice && customVoice.conversationMode) {
        setTimeout(() => {
          customVoice.startListening();
          setAgentStatus('listening');
        }, 300);
        return;
      }

      setAgentStatus('idle');
    } catch (err) {
      console.error('Agent chat error:', err);
      stopFillerAudio();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'agent',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
      setAgentStatus('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [isElevenLabsMode, user?.id, isProcessing, playFillerAudio, stopFillerAudio, customVoice, elevenLabs]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!isElevenLabsMode) {
      if (customVoice.isListening) {
        setAgentStatus('listening');
      } else if (!isProcessing && agentStatus === 'listening') {
        setAgentStatus('idle');
      }
    }
  }, [isElevenLabsMode, customVoice.isListening, isProcessing, agentStatus]);

  const handleStartConversation = () => {
    if (isElevenLabsMode) {
      elevenLabs.startConversation();
    } else {
      customVoice.startConversation();
    }
  };

  const handleEndConversation = () => {
    if (isElevenLabsMode) {
      elevenLabs.endConversation();
    } else {
      customVoice.endConversation();
    }
    setAgentStatus('idle');
  };

  const handleVoiceToggle = () => {
    if (isConnected) {
      handleEndConversation();
    } else if (isListening) {
      if (isElevenLabsMode) {
        elevenLabs.setMuted(true);
      } else {
        customVoice.stopListening();
      }
    } else {
      if (isElevenLabsMode) {
        elevenLabs.startConversation();
      } else {
        customVoice.startListening();
      }
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText, false);
      setInputText('');
    }
  };

  const getStatusText = () => {
    if (error) return 'Error: ' + error;
    if (agentStatus === 'speaking') return 'Speaking...';
    if (agentStatus === 'thinking') return isElevenLabsMode ? 'Connecting...' : 'Thinking...';
    if (agentStatus === 'listening') return 'Listening...';
    if (isVoiceProcessing) return 'Processing...';
    return isConnected ? 'Ready to listen' : 'Tap to speak';
  };

  const getOrbAnimation = () => {
    switch (agentStatus) {
      case 'listening':
        return { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] };
      case 'thinking':
        return { scale: [1, 1.08, 1, 1.05, 1] };
      case 'speaking':
        return { scale: [1, 1.2, 1.1, 1.25, 1] };
      default:
        return { scale: [1, 1.02, 1] };
    }
  };

  const getOrbTransition = () => {
    switch (agentStatus) {
      case 'listening':
        return { duration: 1.5, repeat: Infinity, ease: 'easeInOut' };
      case 'thinking':
        return { duration: 2, repeat: Infinity, ease: 'linear' };
      case 'speaking':
        return { duration: 0.5, repeat: Infinity, ease: 'easeInOut' };
      default:
        return { duration: 3, repeat: Infinity, ease: 'easeInOut' };
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            {/* Assistant headset icon */}
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828" />
              <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
            </svg>
            {/* Pulse indicator */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
          </div>
        )}
      </motion.button>

      {/* Main Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-50 w-[360px] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >

            {/* Orb View */}
            {!showChat && (
              <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
                {/* Status */}
                <p className="text-slate-400 text-sm mb-8">{getStatusText()}</p>

                {/* Animated Orb */}
                <div className="relative mb-8">
                  {/* Outer glow */}
                  <motion.div
                    className="absolute inset-0 rounded-full blur-xl"
                    animate={{
                      opacity: agentStatus === 'idle' ? 0.3 : 0.6,
                      scale: agentStatus === 'speaking' ? 1.3 : 1.1,
                    }}
                    style={{
                      background: 'radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, transparent 70%)',
                    }}
                  />

                  {/* Main Orb */}
                  <motion.button
                    onClick={handleVoiceToggle}
                    disabled={isProcessing || agentConfigured === null}
                    className="relative w-32 h-32 rounded-full cursor-pointer focus:outline-none disabled:cursor-not-allowed"
                    animate={{
                      ...getOrbAnimation(),
                      scale: agentStatus === 'listening'
                        ? 1 + (currentVolume * 0.25)
                        : getOrbAnimation().scale,
                    }}
                    transition={getOrbTransition()}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      background: agentStatus === 'listening'
                        ? 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 50%, #8b5cf6 100%)'
                        : agentStatus === 'speaking'
                        ? 'linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #3b82f6 100%)'
                        : agentStatus === 'thinking'
                        ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)'
                        : 'linear-gradient(135deg, #94a3b8 0%, #64748b 50%, #475569 100%)',
                      boxShadow: `
                        inset 0 2px 20px rgba(255, 255, 255, 0.2),
                        inset 0 -2px 20px rgba(0, 0, 0, 0.2),
                        0 0 ${40 + (currentVolume * 30)}px ${agentStatus === 'listening' ? `rgba(34, 211, 238, ${0.4 + currentVolume * 0.4})` : agentStatus === 'speaking' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(148, 163, 184, 0.2)'}
                      `,
                    }}
                  >
                    {/* Inner highlight */}
                    <div
                      className="absolute inset-4 rounded-full"
                      style={{
                        background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)',
                      }}
                    />

                    {/* Mic icon when idle */}
                    {agentStatus === 'idle' && (
                      <svg className="absolute inset-0 m-auto w-10 h-10 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}

                    {/* Thinking animation */}
                    {agentStatus === 'thinking' && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-3 h-3 bg-white/80 rounded-full"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Speaking animation */}
                    {agentStatus === 'speaking' && (
                      <div className="absolute inset-0 flex items-center justify-center gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 bg-white/80 rounded-full"
                            animate={{ height: [12, 24 + Math.random() * 16, 12] }}
                            transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Listening waves */}
                    {agentStatus === 'listening' && (
                      <div className="absolute inset-0 flex items-center justify-center gap-1">
                        {[...Array(5)].map((_, i) => {
                          const baseHeight = 12;
                          const maxHeight = 40;
                          const waveMultiplier = i === 2 ? 1 : i === 1 || i === 3 ? 0.7 : 0.4;
                          const height = baseHeight + (currentVolume * (maxHeight - baseHeight) * waveMultiplier);

                          return (
                            <motion.div
                              key={i}
                              className="w-1.5 bg-white/90 rounded-full"
                              animate={{ height: `${height}px` }}
                              transition={{ duration: 0.05, ease: 'easeOut' }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </motion.button>

                  {/* Ripple effect */}
                  {agentStatus === 'listening' && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-400/20"
                        animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                      />
                    </>
                  )}
                </div>

                {/* Interim transcript (custom mode only) */}
                {!isElevenLabsMode && isListening && interimTranscript && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-white/70 text-center text-sm max-w-[280px] mb-4"
                  >
                    "{interimTranscript}"
                  </motion.p>
                )}

                {/* Last message preview */}
                {messages.length > 0 && !isListening && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center max-w-[280px]"
                  >
                    <p className="text-white/90 text-sm line-clamp-2">
                      {messages[messages.length - 1].content}
                    </p>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-4 mt-8">
                  <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat
                  </button>
                  {messages.length > 0 && (
                    <button
                      onClick={() => setMessages([])}
                      className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Start/End Conversation button */}
                {!isProcessing && agentStatus !== 'thinking' && agentStatus !== 'speaking' && (
                  isConnected ? (
                    <button
                      onClick={handleEndConversation}
                      className="mt-4 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-full transition-all"
                    >
                      End Conversation
                    </button>
                  ) : (
                    <button
                      onClick={handleStartConversation}
                      className="mt-4 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-medium rounded-full transition-all shadow-lg shadow-cyan-500/25"
                    >
                      Start Conversation
                    </button>
                  )
                )}

                {/* Quick prompts */}
                {messages.length === 0 && !isConnected && (
                  <div className="flex flex-wrap justify-center gap-2 mt-6">
                    {['Create a task', 'My schedule', 'Show deals'].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt, true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-full transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat View */}
            {showChat && (
              <div className="flex flex-col h-[480px]">
                {/* Voice unavailable banner */}
                {voiceAvailable === false && (
                  <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                    <p className="text-xs text-amber-400 text-center">
                      Voice not available. Using text chat mode.
                    </p>
                  </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  {voiceAvailable !== false ? (
                    <button
                      onClick={() => setShowChat(false)}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-7" /> // Spacer when voice not available
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-slate-500'}`} />
                    <span className="text-white text-sm font-medium">Coworkr</span>
                  </div>
                  {voiceAvailable !== false ? (
                    <button
                      onClick={handleVoiceToggle}
                      disabled={isProcessing}
                      className={`p-2 rounded-lg transition-colors ${
                        isListening ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  ) : (
                    <div className="w-9" /> // Spacer when voice not available
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm">Start a conversation</p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-100'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        {message.actions?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            {message.actions.map((action, i) => (
                              <p key={i} className="text-xs text-white/60">
                                {action.type.replace(/_/g, ' ').toLowerCase()}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {(isProcessing || isVoiceProcessing) && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-slate-500 rounded-full"
                              animate={{ y: [0, -6, 0] }}
                              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isElevenLabsMode && isListening && interimTranscript && (
                    <div className="flex justify-end">
                      <div className="bg-blue-500/50 text-white/70 rounded-2xl px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm italic">{interimTranscript}</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-800">
                  <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-slate-600 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isProcessing}
                      className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
