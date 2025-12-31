import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Demo user for hackathon
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@coworkr.ai',
  name: 'Demo User',
  avatar: null,
  hasCompletedOnboarding: true,
  createdAt: new Date().toISOString(),
};

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Set demo user cookies
    cookieStore.set('coworkr_user_id', DEMO_USER.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    cookieStore.set('coworkr_session', uuidv4(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: DEMO_USER,
      message: 'Demo login successful'
    });
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json(
      { error: 'Demo login failed' },
      { status: 500 }
    );
  }
}
