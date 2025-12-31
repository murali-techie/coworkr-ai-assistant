import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Try to import Firebase, fallback to in-memory if it fails
let collections = null;
try {
  const firebase = await import('@/lib/firebase/admin');
  collections = firebase.collections;
} catch (e) {
  console.log('Firebase not available, using in-memory');
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    let sessionId = cookieStore.get('coworkr_session')?.value;
    let userId = cookieStore.get('coworkr_user_id')?.value;

    // Create new session if none exists
    if (!sessionId || !userId) {
      sessionId = uuidv4();
      userId = uuidv4().split('-')[0];

      cookieStore.set('coworkr_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      cookieStore.set('coworkr_user_id', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }

    // Try to get data from Firebase
    let userData = null;
    let agentData = null;

    if (collections) {
      try {
        const userDoc = await collections.user(userId).get();
        const agentDoc = await collections.agent(userId).get();

        if (userDoc.exists) {
          userData = userDoc.data();
        }
        if (agentDoc.exists) {
          agentData = agentDoc.data();
        }
      } catch (e) {
        console.log('Firebase read error:', e.message);
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email: userData?.email || 'user@coworkr.ai',
        name: userData?.name || 'User',
        hasCompletedOnboarding: userData?.hasCompletedOnboarding ?? true,
      },
      agent: agentData || {
        name: 'Coworkr',
        avatarUrl: '/avatars/avatar-1.svg',
        voiceGender: 'female',
      },
      sessionId,
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({
      authenticated: true,
      user: {
        id: 'demo-user',
        email: 'demo@coworkr.ai',
        name: 'Demo User',
        hasCompletedOnboarding: true,
      },
      agent: {
        name: 'Coworkr',
        avatarUrl: '/avatars/avatar-1.svg',
        voiceGender: 'female',
      },
    });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('coworkr_session');
    cookieStore.delete('coworkr_user_id');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
