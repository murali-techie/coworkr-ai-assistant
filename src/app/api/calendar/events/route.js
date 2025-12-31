import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  isCalendarConnected,
} from '@/lib/calendar/google';
import { startOfDay, endOfDay, addDays, parseISO } from 'date-fns';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    // Check if calendar is connected
    const connected = await isCalendarConnected(session.userId);
    if (!connected) {
      return NextResponse.json({
        connected: false,
        events: [],
        message: 'Calendar not connected',
      });
    }

    const dateParam = searchParams.get('date');
    const days = parseInt(searchParams.get('days') || '1', 10);

    const startDate = dateParam ? startOfDay(parseISO(dateParam)) : startOfDay(new Date());
    const endDate = endOfDay(addDays(startDate, days - 1));

    const events = await getCalendarEvents(session.userId, startDate, endDate);

    return NextResponse.json({ connected: true, events });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Calendar fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { title, description, startTime, endTime, location, attendees } = body;

    if (!title || !startTime) {
      return NextResponse.json(
        { error: 'Title and start time are required' },
        { status: 400 }
      );
    }

    // Default end time to 1 hour after start
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000);

    const eventData = {
      summary: title,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      location,
      attendees: attendees?.map(email => ({ email })),
    };

    const event = await createCalendarEvent(session.userId, eventData);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Calendar not connected') {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }
    console.error('Calendar create error:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { eventId, ...updates } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const event = await updateCalendarEvent(session.userId, eventId, updates);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    await deleteCalendarEvent(session.userId, eventId);

    return NextResponse.json({ success: true, deletedId: eventId });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
