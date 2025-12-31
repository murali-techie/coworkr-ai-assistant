/**
 * ElevenLabs Speech-to-Text Integration
 */

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Transcribe audio using ElevenLabs Speech-to-Text
 * @param {Blob|File} audioBlob - Audio file to transcribe
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioBlob) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs STT error: ${error}`);
  }

  const data = await response.json();
  return data.text;
}

/**
 * Transcribe audio with language detection
 */
export async function transcribeWithLanguage(audioBlob, languageCode = 'en') {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('language_code', languageCode);

  const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs STT error: ${error}`);
  }

  const data = await response.json();
  return {
    text: data.text,
    language: data.language_code || languageCode,
  };
}

export default {
  transcribeAudio,
  transcribeWithLanguage,
};
