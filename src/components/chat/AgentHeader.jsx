'use client';

import { Avatar } from '@/components/ui/Avatar';

export function AgentHeader({
  agent,
  status,
  connected,
  voiceOnly,
  onVoiceOnlyToggle,
}) {
  const statusText = {
    idle: 'Ready',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Avatar
            src={agent?.avatarUrl}
            alt={agent?.name}
            size="md"
            status={status}
          />
          <div>
            <h1 className="font-semibold text-gray-900">
              {agent?.name || 'Coworkr'}
            </h1>
            <p className="text-xs text-gray-500">
              {connected ? statusText[status] || 'Ready' : 'Connecting...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice-only toggle */}
          <button
            onClick={onVoiceOnlyToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              voiceOnly
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            Voice Only
          </button>

          {/* Connection status */}
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
        </div>
      </div>
    </header>
  );
}

export default AgentHeader;
