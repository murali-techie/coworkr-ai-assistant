import { NextResponse } from 'next/server';
import { processMessage } from '@/lib/ai/orchestrator';

export async function POST(request) {
  try {
    const { userId, sessionId, message } = await request.json();

    if (!userId || !sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process through orchestrator
    const response = await processMessage(userId, sessionId, message, {
      voiceMode: false,
    });

    return NextResponse.json({
      success: true,
      messageId: response.messageId,
      text: response.text,
      intent: response.intent,
      actions: response.actions,
    });
  } catch (error) {
    console.error('Chat process error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    );
  }
}
