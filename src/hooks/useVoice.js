'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export function useVoice(options = {}) {
  const { onTranscript, onStart, onEnd, onInterimTranscript, onAudioLevel, autoListen = false } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [conversationMode, setConversationMode] = useState(false); // Continuous conversation

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const isRecordingRef = useRef(false);
  const speechStartTimeRef = useRef(null);
  const stopListeningRef = useRef(null);

  // VAD settings - tuned for natural conversation
  const SPEECH_THRESHOLD = 25; // Threshold to detect speech (higher = less sensitive)
  const SILENCE_THRESHOLD = 12; // Lower threshold for silence (hysteresis)
  const SILENCE_DURATION = 1200; // 1.2 seconds of silence to stop
  const MAX_LISTEN_TIME = 15000; // Maximum 15 seconds of listening
  const MIN_SPEECH_TIME = 200; // At least 200ms of speech before allowing stop

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices;

  // Cleanup
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
  }, []);

  // Process audio with ElevenLabs STT
  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.log('No audio to process');
      return;
    }

    setIsProcessing(true);
    setInterimTranscript(''); // Clean UI during processing

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('Sending audio to ElevenLabs, size:', audioBlob.size);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('ElevenLabs STT result:', data);

      const text = data.text?.trim() || '';
      setTranscript(text);
      setInterimTranscript('');

      if (text && !text.match(/^\(.*\)$/)) {
        onTranscript?.(text);
      } else {
        setError('Could not understand. Please try again.');
      }

    } catch (err) {
      console.error('STT error:', err);
      setError(err.message || 'Transcription failed');
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
    }
  }, [onTranscript]);

  // Calculate RMS volume from time-domain data (more accurate than frequency data)
  const getVolumeLevel = useCallback((analyser, dataArray) => {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return rms * 100; // Scale to 0-100 range
  }, []);

  // Start Voice Activity Detection with hysteresis
  const startVAD = useCallback((stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512; // More samples for accuracy
    analyser.smoothingTimeConstant = 0.3; // Some smoothing to reduce noise
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    let isSpeaking = false;
    let silenceStart = null;
    let maxTimeoutId = null;
    let frameCount = 0;

    // Force stop after MAX_LISTEN_TIME
    maxTimeoutId = setTimeout(() => {
      console.log('[VAD] Max time reached, forcing stop');
      if (stopListeningRef.current) {
        stopListeningRef.current();
      }
    }, MAX_LISTEN_TIME);

    const checkLevel = () => {
      if (!isRecordingRef.current) {
        if (maxTimeoutId) clearTimeout(maxTimeoutId);
        return;
      }

      const level = getVolumeLevel(analyser, dataArray);
      setAudioLevel(Math.min(level / 30, 1));
      onAudioLevel?.(Math.min(level / 30, 1));

      // Log every 30 frames (~0.5s) for debugging
      frameCount++;
      if (frameCount % 30 === 0) {
        console.log('[VAD] Level:', level.toFixed(1), 'Speaking:', isSpeaking, 'SilenceStart:', silenceStart ? 'yes' : 'no');
      }

      // Hysteresis: use higher threshold to START speaking, lower to STOP
      if (!isSpeaking && level > SPEECH_THRESHOLD) {
        // Start speaking
        isSpeaking = true;
        silenceStart = null;
        speechStartTimeRef.current = Date.now();
        console.log('[VAD] Speech STARTED, level:', level.toFixed(1));
      } else if (isSpeaking) {
        if (level > SILENCE_THRESHOLD) {
          // Still speaking (above lower threshold)
          silenceStart = null;
        } else {
          // Below silence threshold - start counting silence
          if (!silenceStart) {
            silenceStart = Date.now();
            console.log('[VAD] Silence began, level:', level.toFixed(1));
          }

          const silenceDuration = Date.now() - silenceStart;
          const speechDuration = Date.now() - speechStartTimeRef.current;

          // Stop if enough silence after enough speech
          if (silenceDuration >= SILENCE_DURATION && speechDuration >= MIN_SPEECH_TIME) {
            console.log('[VAD] STOPPING - Speech:', speechDuration + 'ms, Silence:', silenceDuration + 'ms');
            if (maxTimeoutId) clearTimeout(maxTimeoutId);
            if (stopListeningRef.current) {
              stopListeningRef.current();
            }
            return;
          }
        }
      }

      requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }, [getVolumeLevel, onAudioLevel]);

  // Start listening
  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return;

    try {
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      audioChunksRef.current = [];
      speechStartTimeRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing...');
        isRecordingRef.current = false;
        processAudio();
      };

      mediaRecorder.start(100);
      isRecordingRef.current = true;
      setIsListening(true);
      onStart?.();

      // Start VAD
      startVAD(stream);

    } catch (err) {
      console.error('Mic error:', err);
      setError('Microphone access denied');
      setIsListening(false);
    }
  }, [isListening, isProcessing, onStart, processAudio, startVAD]);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log('[VAD] stopListening called');

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    isRecordingRef.current = false;
    speechStartTimeRef.current = null;

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }

    setIsListening(false);
    onEnd?.();
  }, [onEnd]);

  // Keep stopListening ref updated for VAD callback
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // Toggle
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Play audio
  const playAudio = useCallback((audioUrl) => {
    return new Promise((resolve, reject) => {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  }, []);

  // Ref to track if we should auto-listen after audio
  const autoListenAfterAudioRef = useRef(false);
  const conversationModeRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  const playAudioData = useCallback((audioData, mimeType = 'audio/mpeg', autoListenAfter = false) => {
    autoListenAfterAudioRef.current = autoListenAfter;

    return new Promise((resolve, reject) => {
      if (audioRef.current) audioRef.current.pause();

      const audioUrl = typeof audioData === 'string'
        ? `data:${mimeType};base64,${audioData}`
        : URL.createObjectURL(new Blob([audioData], { type: mimeType }));

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        const shouldAutoListen = autoListenAfterAudioRef.current || conversationModeRef.current;
        resolve({ shouldAutoListen });
      };
      audio.onerror = (err) => {
        if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        reject(err);
      };
      audio.play().catch(reject);
    });
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Start continuous conversation mode
  const startConversation = useCallback(() => {
    setConversationMode(true);
    conversationModeRef.current = true; // Set ref immediately
    startListening();
  }, [startListening]);

  // End continuous conversation mode
  const endConversation = useCallback(() => {
    setConversationMode(false);
    conversationModeRef.current = false; // Set ref immediately
    stopListening();
    stopAudio();
  }, [stopListening, stopAudio]);

  return {
    isListening,
    isProcessing,
    transcript,
    interimTranscript,
    error,
    audioLevel,
    conversationMode,
    startListening,
    stopListening,
    toggleListening,
    startConversation,
    endConversation,
    playAudio,
    playAudioData,
    stopAudio,
    isSupported,
  };
}

export default useVoice;
