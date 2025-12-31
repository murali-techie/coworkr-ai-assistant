import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

function parseDateTime(dateStr, timeStr, baseDate = new Date()) {
  let date = new Date(baseDate);

  if (dateStr) {
    const lower = dateStr.toLowerCase();
    if (lower === 'today') {
      date = new Date();
    } else if (lower === 'tomorrow') {
      date = new Date();
      date.setDate(date.getDate() + 1);
    } else if (lower.includes('next week')) {
      date.setDate(date.getDate() + 7);
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed)) date = parsed;
    }
  }

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
    const eventTitle = url.searchParams.get('eventTitle') || url.searchParams.get('title') || url.searchParams.get('event');
    const newDate = url.searchParams.get('date') || url.searchParams.get('newDate');
    const newTime = url.searchParams.get('time') || url.searchParams.get('newTime');
    const newTitle = url.searchParams.get('newTitle');
    const newLocation = url.searchParams.get('location');
    const newDescription = url.searchParams.get('description');
    const cancel = url.searchParams.get('cancel');

    if (!eventTitle) {
      return NextResponse.json({ success: false, error: 'eventTitle parameter required to identify the event' });
    }

    // Find the event
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('events')
      .limit(50)
      .get();

    const searchTitle = eventTitle.toLowerCase();
    const matchedEvent = snapshot.docs.find(doc => {
      const title = doc.data().title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedEvent) {
      return NextResponse.json({ success: false, error: `Event "${eventTitle}" not found` });
    }

    // Handle cancellation
    if (cancel === 'true' || cancel === '1') {
      await adminDb
        .collection('users')
        .doc(USER_ID)
        .collection('events')
        .doc(matchedEvent.id)
        .delete();

      return NextResponse.json({
        success: true,
        message: `Event "${matchedEvent.data().title}" has been cancelled`,
        eventId: matchedEvent.id
      });
    }

    // Build update object
    const updates = { updatedAt: new Date().toISOString() };
    const changes = [];
    const currentData = matchedEvent.data();

    if (newDate || newTime) {
      const currentStart = new Date(currentData.startTime);
      const currentEnd = new Date(currentData.endTime);
      const duration = currentEnd - currentStart;

      const newStart = parseDateTime(newDate, newTime, currentStart);
      const newEnd = new Date(newStart.getTime() + duration);

      updates.startTime = newStart.toISOString();
      updates.endTime = newEnd.toISOString();

      const dateStr = newStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const timeStr = newStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      changes.push(`rescheduled to ${dateStr} at ${timeStr}`);
    }

    if (newTitle) {
      updates.title = newTitle;
      changes.push(`title to "${newTitle}"`);
    }
    if (newLocation) {
      updates.location = newLocation;
      changes.push(`location to "${newLocation}"`);
    }
    if (newDescription) {
      updates.description = newDescription;
      changes.push(`added description`);
    }

    if (changes.length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided. Use date, time, newTitle, location, description, or cancel parameters.' });
    }

    await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('events')
      .doc(matchedEvent.id)
      .update(updates);

    return NextResponse.json({
      success: true,
      message: `Updated "${currentData.title}": ${changes.join(', ')}`,
      eventId: matchedEvent.id
    });

  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
