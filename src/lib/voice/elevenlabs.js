/**
 * ElevenLabs Text-to-Speech Integration
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Generate speech from text
 */
export async function generateSpeech(text, voiceId = null) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  // Use provided voice or default
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID_FEMALE;

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  // Return audio as ArrayBuffer
  return await response.arrayBuffer();
}

/**
 * Generate speech and return as base64
 */
export async function generateSpeechBase64(text, voiceId = null) {
  const audioBuffer = await generateSpeech(text, voiceId);
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

/**
 * Generate speech with streaming
 */
export async function generateSpeechStream(text, voiceId = null) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID_FEMALE;

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice}/stream`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  return response.body; // Return the ReadableStream
}

/**
 * Get available voices
 */
export async function getVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch voices');
  }

  const data = await response.json();
  return data.voices;
}

/**
 * Get voice by ID
 */
export async function getVoice(voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  const response = await fetch(`${ELEVENLABS_API_URL}/voices/${voiceId}`, {
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch voice');
  }

  return await response.json();
}

/**
 * Estimate audio duration (rough estimate)
 */
export function estimateDuration(text) {
  // Average speaking rate: ~150 words per minute
  // ~4.5 characters per word average
  const words = text.length / 4.5;
  const minutes = words / 150;
  return Math.ceil(minutes * 60); // Return seconds
}

/**
 * Voice configuration
 */
export const VOICE_CONFIG = {
  male: {
    id: process.env.ELEVENLABS_VOICE_ID_MALE || 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
  },
  female: {
    id: process.env.ELEVENLABS_VOICE_ID_FEMALE || '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
  },
};

export default {
  generateSpeech,
  generateSpeechBase64,
  generateSpeechStream,
  getVoices,
  getVoice,
  estimateDuration,
  VOICE_CONFIG,
};
