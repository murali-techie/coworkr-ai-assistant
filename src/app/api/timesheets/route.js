import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = collections.activities(session.userId);

    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    let entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        date: data.date?.toDate?.() || data.date,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    // Filter by type (only time entries)
    entries = entries.filter(e => e.type === 'time_entry');

    // Filter by date range if provided
    if (startDate) {
      const start = new Date(startDate);
      entries = entries.filter(e => new Date(e.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      entries = entries.filter(e => new Date(e.date) <= end);
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ entries });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Timesheets fetch error:', error);
    return NextResponse.json({ entries: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { description, projectId, taskId, date, duration, billable } = body;

    if (!description || !duration) {
      return NextResponse.json({ error: 'Description and duration are required' }, { status: 400 });
    }

    const entryId = uuidv4();
    const now = new Date();

    const entry = {
      id: entryId,
      userId: session.userId,
      type: 'time_entry',
      description,
      projectId: projectId || null,
      taskId: taskId || null,
      date: date ? new Date(date) : now,
      duration: parseFloat(duration), // hours
      billable: billable || false,
      createdAt: now,
      updatedAt: now,
    };

    await collections.activity(session.userId, entryId).set(entry);

    return NextResponse.json({
      success: true,
      entry: {
        ...entry,
        date: entry.date.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Timesheet create error:', error);
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const entryRef = collections.activity(session.userId, id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    if (updates.date) updateData.date = new Date(updates.date);
    if (updates.duration) updateData.duration = parseFloat(updates.duration);

    await entryRef.update(updateData);

    const updated = await entryRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      entry: {
        ...data,
        date: data.date?.toDate?.()?.toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    const entryRef = collections.activity(session.userId, id);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    await entryRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
  }
}
