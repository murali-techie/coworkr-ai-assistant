import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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
    const sessionId = cookieStore.get('coworkr_session')?.value;
    const userId = cookieStore.get('coworkr_user_id')?.value;

    // If no session cookie, user is not authenticated
    if (!sessionId || !userId) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    // Try to get user data from Firebase
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
      authenticated: false,
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
