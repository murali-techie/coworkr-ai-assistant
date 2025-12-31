import { NextResponse } from 'next/server';
import { chat } from '@/lib/ai/gemini';

/**
 * OpenAI-compatible Chat Completions endpoint for ElevenLabs Custom LLM
 *
 * ElevenLabs will call this endpoint with messages in OpenAI format
 * We process with Gemini and return in OpenAI format
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, stream = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: { message: 'Messages array is required' } },
        { status: 400 }
      );
    }

    // Extract system prompt and conversation
    let systemPrompt = '';
    const conversationMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n';
      } else {
        conversationMessages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          content: msg.content,
        });
      }
    }

    // Add voice-optimized instructions to system prompt
    const voiceSystemPrompt = `${systemPrompt}

CRITICAL VOICE RULES:
- Keep responses SHORT (1-2 sentences max)
- Use simple, everyday words
- No lists, bullets, markdown, or special characters
- Say numbers naturally ("three" not "3")
- End with a follow-up question when appropriate`;

    // Get response from Gemini
    const lastUserMessage = conversationMessages.filter(m => m.role === 'user').pop();
    const response = await chat(
      conversationMessages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.content,
      })),
      voiceSystemPrompt
    );

    // Clean response for voice
    const cleanResponse = response
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^["']|["']$/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Return in OpenAI format
    const completion = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-1.5-flash',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: cleanResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    return NextResponse.json(completion);

  } catch (error) {
    console.error('Custom LLM error:', error);
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
        }
      },
      { status: 500 }
    );
  }
}
