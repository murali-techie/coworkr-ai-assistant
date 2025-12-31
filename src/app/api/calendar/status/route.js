import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { isCalendarConnected } from '@/lib/calendar/google';
import { collections } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const session = await requireAuth();

    const connected = await isCalendarConnected(session.userId);

    return NextResponse.json({ connected });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ connected: false });
  }
}

// Disconnect calendar
export async function DELETE() {
  try {
    const session = await requireAuth();

    await collections.user(session.userId).set({
      googleCalendarTokens: null,
      googleCalendarConnected: false,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ success: true, message: 'Calendar disconnected' });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to disconnect calendar' }, { status: 500 });
  }
}
