'use client';

export function VoiceButton({
  isListening,
  isProcessing,
  status,
  isSupported,
  onClick,
  large = false,
}) {
  if (!isSupported) {
    return null;
  }

  const getButtonStyle = () => {
    if (isProcessing) {
      return 'bg-yellow-500 text-white';
    }
    if (isListening) {
      return 'bg-red-500 text-white';
    }

    const statusColors = {
      idle: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      listening: 'bg-blue-500 text-white',
      thinking: 'bg-yellow-500 text-white',
      speaking: 'bg-green-500 text-white',
    };

    return statusColors[status] || statusColors.idle;
  };

  return (
    <button
      onClick={onClick}
      disabled={isProcessing}
      className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${getButtonStyle()} ${large ? 'w-20 h-20' : 'w-12 h-12'} ${isListening ? 'pulse-ring' : ''} disabled:opacity-70`}
      aria-label={isListening ? 'Stop listening' : isProcessing ? 'Processing...' : 'Start voice input'}
    >
      {isProcessing ? (
        // Processing spinner
        <svg className={`animate-spin ${large ? 'w-8 h-8' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : isListening ? (
        // Recording indicator (red square to stop)
        <div className={`${large ? 'w-6 h-6' : 'w-4 h-4'} bg-white rounded-sm`} />
      ) : (
        // Microphone icon
        <svg
          className={`${large ? 'w-8 h-8' : 'w-5 h-5'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      )}
    </button>
  );
}

export default VoiceButton;
