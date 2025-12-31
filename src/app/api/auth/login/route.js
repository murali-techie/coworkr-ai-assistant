import { NextResponse } from 'next/server';
import { loginUser, setSessionCookie } from '@/lib/utils/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { user, session } = await loginUser(email, password);

    // Set session cookie
    setSessionCookie(session.sessionId);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error.message === 'Invalid credentials') {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
