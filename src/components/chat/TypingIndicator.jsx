'use client';

export function TypingIndicator({ agentName = 'Coworkr' }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
        <span className="text-xs font-medium text-primary-600">
          {agentName?.charAt(0)?.toUpperCase() || 'A'}
        </span>
      </div>
      <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100">
        <div className="typing-dots text-gray-400">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
