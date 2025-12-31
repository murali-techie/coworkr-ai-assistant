import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Demo user for hackathon
const DEMO_USER = {
  id: 'demo-user-001',
  email: 'demo@coworkr.ai',
  name: 'Demo User',
  avatar: null,
  hasCompletedOnboarding: true,
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('coworkr_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ user: null });
    }

    // For hackathon demo, return demo user if ID matches
    if (userId === 'demo-user-001' || userId.startsWith('demo-')) {
      return NextResponse.json({ user: { ...DEMO_USER, id: userId } });
    }

    // For real users, we would fetch from Firebase here
    // For now, return a user object based on the cookie
    return NextResponse.json({
      user: {
        id: userId,
        email: 'user@coworkr.ai',
        name: 'User',
        hasCompletedOnboarding: true,
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ user: null });
  }
}
