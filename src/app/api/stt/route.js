import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

export async function POST(request) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      // Graceful fallback - voice not available but chat still works
      return NextResponse.json({
        success: false,
        voiceAvailable: false,
        message: 'Voice transcription not configured. Please use text input.'
      }, { status: 200 });
    }

    // Forward to ElevenLabs STT API
    // Convert the file to proper format for ElevenLabs
    const arrayBuffer = await audioFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: audioFile.type || 'audio/webm' });

    const elevenLabsFormData = new FormData();
    // ElevenLabs expects 'file' not 'audio'
    elevenLabsFormData.append('file', blob, audioFile.name || 'audio.webm');
    elevenLabsFormData.append('model_id', 'scribe_v1');
    // Enable automatic language detection for better accuracy
    elevenLabsFormData.append('language_code', 'en'); // Default to English
    elevenLabsFormData.append('tag_audio_events', 'false'); // Skip tagging for faster response
    elevenLabsFormData.append('diarize', 'false'); // No speaker diarization needed

    const response = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs STT error:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({
          error: 'Transcription failed',
          detail: errorData.detail
        }, { status: 500 });
      } catch {
        return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
      }
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      text: data.text,
      language: data.language_code,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('STT error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
