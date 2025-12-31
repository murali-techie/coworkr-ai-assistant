'use client';

export function Avatar({
  src,
  alt = '',
  size = 'md',
  status,
  className = '',
}) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const statusColors = {
    idle: 'bg-gray-400',
    listening: 'bg-blue-500',
    thinking: 'bg-yellow-500',
    speaking: 'bg-green-500',
    online: 'bg-green-500',
    offline: 'bg-gray-400',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div className={`${sizes[size]} rounded-full overflow-hidden bg-gray-200 flex items-center justify-center`}>
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-1/2 h-1/2 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        )}
      </div>
      {status && (
        <span className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[status] || statusColors.idle} border-2 border-white rounded-full ${status !== 'idle' && status !== 'offline' ? 'animate-pulse' : ''}`} />
      )}
    </div>
  );
}

export default Avatar;
