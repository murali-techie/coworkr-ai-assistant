'use client';

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useVoice } from '@/hooks/useVoice';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import VoiceButton from './VoiceButton';
import TypingIndicator from './TypingIndicator';
import AgentHeader from './AgentHeader';

export function ChatContainer({ userId, sessionId, agent }) {
  const messagesEndRef = useRef(null);
  const [voiceOnly, setVoiceOnly] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const {
    connected,
    agentStatus,
    isTyping,
    messages,
    sendMessage,
    startVoiceInput,
  } = useSocket(userId, sessionId);

  const {
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    error: voiceError,
    isSupported,
    startListening,
    stopListening,
    playAudioData,
  } = useVoice({
    onTranscript: async (text) => {
      if (text.trim()) {
        setCurrentTranscript('');
        sendMessage(text, true); // true = voice mode, get TTS response
      }
    },
    onStart: () => {
      startVoiceInput();
    },
    onInterimTranscript: (text) => {
      setCurrentTranscript(text);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  // Handle TTS playback when agent responds
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'agent' && lastMessage.audioData) {
      playAudioData(lastMessage.audioData).catch(console.error);
    }
  }, [messages, playAudioData]);

  const handleSendMessage = (text) => {
    if (text.trim()) {
      sendMessage(text, false); // false = text mode, no TTS needed
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
      setCurrentTranscript('');
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <AgentHeader
        agent={agent}
        status={agentStatus}
        connected={connected}
        voiceOnly={voiceOnly}
        onVoiceOnlyToggle={() => setVoiceOnly(!voiceOnly)}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !isListening && (
          <div className="text-center text-gray-500 py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-3xl">👋</span>
            </div>
            <p className="text-lg mb-2">Hi! I'm {agent?.name || 'Coworkr'}.</p>
            <p className="text-sm">Click the mic and start talking!</p>
            <p className="text-xs text-gray-400 mt-4">
              Voice powered by ElevenLabs + Google Gemini
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            agentName={agent?.name}
            agentAvatar={agent?.avatarUrl}
          />
        ))}

        {isTyping && <TypingIndicator agentName={agent?.name} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Real-time transcription display */}
      {(isListening || currentTranscript || interimTranscript) && (
        <div className="px-4 py-3 border-t bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            {isListening && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <p className="text-gray-700 flex-1">
              {currentTranscript || interimTranscript || (
                <span className="text-gray-400 italic">Listening...</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{voiceError}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          {!voiceOnly && (
            <InputBar
              onSend={handleSendMessage}
              disabled={!connected || isProcessing || isListening}
              placeholder={
                isListening
                  ? 'Listening...'
                  : connected
                  ? `Ask ${agent?.name || 'Coworkr'}...`
                  : 'Connecting...'
              }
            />
          )}

          <VoiceButton
            isListening={isListening}
            isProcessing={isProcessing}
            status={agentStatus}
            isSupported={isSupported}
            onClick={handleVoiceToggle}
            large={voiceOnly}
          />
        </div>

        {voiceOnly && (
          <p className="text-center text-xs text-gray-400 mt-3">
            {isListening ? 'Speak now...' : 'Tap microphone to speak'}
          </p>
        )}
      </div>
    </div>
  );
}

export default ChatContainer;
