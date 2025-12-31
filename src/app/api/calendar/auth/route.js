import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { getAuthUrl, exchangeCodeForTokens, saveTokens } from '@/lib/calendar/google';

// GET - Get authorization URL
export async function GET() {
  try {
    const session = await requireAuth();

    const authUrl = getAuthUrl(session.userId);

    return NextResponse.json({ authUrl });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to get auth URL' }, { status: 500 });
  }
}

// POST - Exchange code for tokens (called after OAuth redirect)
export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const tokens = await exchangeCodeForTokens(code);
    await saveTokens(session.userId, tokens);

    return NextResponse.json({ success: true, message: 'Calendar connected successfully' });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Calendar auth error:', error);
    return NextResponse.json({ error: 'Failed to connect calendar' }, { status: 500 });
  }
}
