import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = collections.events(session.userId);

    if (upcoming) {
      const now = new Date();
      query = query.where('startTime', '>=', now).limit(limit);
    } else {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const events = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        startTime: data.startTime?.toDate?.() || data.startTime,
        endTime: data.endTime?.toDate?.() || data.endTime,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    events.sort((a, b) => {
      const dateA = a.startTime ? new Date(a.startTime) : new Date(0);
      const dateB = b.startTime ? new Date(b.startTime) : new Date(0);
      return dateA - dateB;
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Events fetch error:', error);
    return NextResponse.json({ events: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { title, description, type, startTime, endTime, allDay, location, attendees } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const eventId = uuidv4();
    const now = new Date();

    const event = {
      id: eventId,
      userId: session.userId,
      title,
      description: description || null,
      type: type || 'meeting',
      startTime: startTime ? new Date(startTime) : now,
      endTime: endTime ? new Date(endTime) : null,
      allDay: allDay || false,
      location: location || null,
      attendees: attendees || [],
      googleEventId: null,
      recurring: false,
      recurrenceRule: null,
      reminders: [],
      createdAt: now,
      updatedAt: now,
    };

    await collections.event(session.userId, eventId).set(event);

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        startTime: event.startTime?.toISOString(),
        endTime: event.endTime?.toISOString(),
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Event create error:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const eventRef = collections.event(session.userId, id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    if (updates.startTime) updateData.startTime = new Date(updates.startTime);
    if (updates.endTime) updateData.endTime = new Date(updates.endTime);

    await eventRef.update(updateData);

    const updated = await eventRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      event: {
        ...data,
        startTime: data.startTime?.toDate?.()?.toISOString(),
        endTime: data.endTime?.toDate?.()?.toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const eventRef = collections.event(session.userId, id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await eventRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
