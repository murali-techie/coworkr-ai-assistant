import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// ElevenLabs best conversational voices for calm, natural speech
const VOICES = {
  // Rachel - warm, natural conversational voice (best for assistants)
  rachel: '21m00Tcm4TlvDq8ikWAM',
  // Domi - friendly, expressive
  domi: 'AZnzlk1XvdvUeBnXmlld',
  // Bella - soft, gentle (great for calm tone)
  bella: 'EXAVITQu4vr4xnSDxMaL',
  // Antoni - warm male voice
  antoni: 'ErXwobaYiN019PkySvjV',
  // Josh - deep, calm male
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  // Sarah - calm, professional female (ElevenLabs default)
  sarah: 'EXAVITQu4vr4xnSDxMaL',
};

export async function POST(request) {
  try {
    await requireAuth();

    const { text, voice = 'rachel' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      // Graceful fallback - voice not available but chat still works
      return NextResponse.json({
        success: false,
        voiceAvailable: false,
        message: 'Voice not configured. Using text-only mode.'
      }, { status: 200 });
    }

    const voiceId = VOICES[voice] || VOICES.rachel;

    // Call ElevenLabs TTS API with calm, natural voice settings
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // Fastest, most natural model
          voice_settings: {
            stability: 0.65,          // Higher = calmer, more consistent
            similarity_boost: 0.75,   // Voice clarity
            style: 0.3,               // Lower = calmer, less dramatic
            use_speaker_boost: true,  // Enhance voice quality
          },
          // Optimize for lowest latency
          optimize_streaming_latency: 4, // Max optimization for real-time
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', errorText);
      return NextResponse.json({ error: 'Text-to-speech failed' }, { status: 500 });
    }

    // Get audio as ArrayBuffer and convert to base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      contentType: 'audio/mpeg',
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('TTS error:', error);
    return NextResponse.json({ error: 'Text-to-speech failed' }, { status: 500 });
  }
}
