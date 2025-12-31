import { NextResponse } from 'next/server';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Get a signed URL for ElevenLabs Conversational AI
export async function POST(request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs Agent ID not configured. Please create an agent at https://elevenlabs.io/agents' },
        { status: 500 }
      );
    }

    // Get signed URL for the conversation
    const response = await fetch(
      `${ELEVENLABS_API_URL}/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs signed URL error:', error);
      return NextResponse.json(
        { error: 'Failed to get conversation URL' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      signedUrl: data.signed_url,
      agentId: agentId,
    });
  } catch (error) {
    console.error('Conversation URL error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize conversation' },
      { status: 500 }
    );
  }
}

// Get agent configuration
export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    // Check if voice is available (API key exists)
    const voiceAvailable = !!apiKey;
    // Check if ElevenLabs agent is configured
    const agentConfigured = !!(apiKey && agentId);

    return NextResponse.json({
      configured: agentConfigured,
      voiceAvailable: voiceAvailable,
      agentId: agentConfigured ? agentId : null,
      message: !voiceAvailable
        ? 'Voice not configured. Using text-only mode.'
        : !agentConfigured
        ? 'ElevenLabs Agent not configured. Using custom voice mode.'
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get agent config' },
      { status: 500 }
    );
  }
}
