import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

// Parse natural language date/time
function parseDateTime(dateStr, timeStr) {
  const now = new Date();
  let date = new Date();

  // Parse date
  if (dateStr) {
    const lower = dateStr.toLowerCase();
    if (lower === 'today') {
      // keep today
    } else if (lower === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (lower.includes('monday')) {
      date.setDate(date.getDate() + ((1 - date.getDay() + 7) % 7 || 7));
    } else if (lower.includes('tuesday')) {
      date.setDate(date.getDate() + ((2 - date.getDay() + 7) % 7 || 7));
    } else if (lower.includes('wednesday')) {
      date.setDate(date.getDate() + ((3 - date.getDay() + 7) % 7 || 7));
    } else if (lower.includes('thursday')) {
      date.setDate(date.getDate() + ((4 - date.getDay() + 7) % 7 || 7));
    } else if (lower.includes('friday')) {
      date.setDate(date.getDate() + ((5 - date.getDay() + 7) % 7 || 7));
    } else if (lower.includes('next week')) {
      date.setDate(date.getDate() + 7);
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed)) date = parsed;
    }
  }

  // Parse time
  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const period = timeMatch[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      date.setHours(hours, minutes, 0, 0);
    }
  }

  return date;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const title = url.searchParams.get('title') || url.searchParams.get('event');
    const date = url.searchParams.get('date');
    const time = url.searchParams.get('time');
    const duration = parseInt(url.searchParams.get('duration') || '60'); // minutes
    const location = url.searchParams.get('location') || '';
    const description = url.searchParams.get('description') || '';
    const attendees = url.searchParams.get('attendees') || '';

    if (!title) {
      return NextResponse.json({ success: false, error: 'title parameter required' });
    }

    const startTime = parseDateTime(date, time);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const eventData = {
      title,
      description,
      location,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: attendees ? attendees.split(',').map(a => a.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('events')
      .add(eventData);

    const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return NextResponse.json({
      success: true,
      message: `Created event "${title}" on ${dateStr} at ${timeStr}`,
      eventId: docRef.id,
      event: eventData
    });

  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
