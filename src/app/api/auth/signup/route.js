import { NextResponse } from 'next/server';
import { createUser, setSessionCookie } from '@/lib/utils/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const { user, session } = await createUser(email, password, name);

    // Set session cookie
    setSessionCookie(session.sessionId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasCompletedOnboarding: false,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);

    if (error.message === 'User already exists') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
