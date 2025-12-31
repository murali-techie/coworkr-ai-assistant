import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, saveTokens } from '@/lib/calendar/google';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?calendar_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(new URL('/settings?calendar_error=no_code', request.url));
    }

    // Get userId from cookie
    const cookieStore = await cookies();
    const userId = cookieStore.get('coworkr_user_id')?.value;

    if (!userId) {
      return NextResponse.redirect(new URL('/settings?calendar_error=no_session', request.url));
    }

    // Exchange code for tokens and save
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens(userId, tokens);

    // Redirect to calendar page on success
    return NextResponse.redirect(new URL('/calendar?calendar_connected=true', request.url));
  } catch (error) {
    console.error('Calendar callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings?calendar_error=connection_failed`, request.url)
    );
  }
}
