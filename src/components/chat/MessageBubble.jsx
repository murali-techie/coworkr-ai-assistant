'use client';

import { Avatar } from '@/components/ui/Avatar';

export function MessageBubble({ message, agentName, agentAvatar }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <Avatar
          src={agentAvatar}
          alt={agentName}
          size="sm"
        />
      )}

      <div className={`max-w-[70%] ${isUser ? 'ml-auto' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Action badges */}
        {message.actions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.actions.map((action, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  action.success
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {action.type.replace(/_/g, ' ').toLowerCase()}
              </span>
            ))}
          </div>
        )}

        <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

export default MessageBubble;
