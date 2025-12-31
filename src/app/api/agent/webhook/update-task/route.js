import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

// Parse natural language date
function parseDate(dateStr) {
  if (!dateStr) return null;

  const now = new Date();
  const lower = dateStr.toLowerCase();

  if (lower === 'today') {
    return now.toISOString();
  } else if (lower === 'tomorrow') {
    now.setDate(now.getDate() + 1);
    return now.toISOString();
  } else if (lower.includes('next week')) {
    now.setDate(now.getDate() + 7);
    return now.toISOString();
  } else if (lower.includes('next month')) {
    now.setMonth(now.getMonth() + 1);
    return now.toISOString();
  } else {
    // Try to parse as date
    const parsed = new Date(dateStr);
    if (!isNaN(parsed)) return parsed.toISOString();
  }
  return null;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const taskTitle = url.searchParams.get('taskTitle') || url.searchParams.get('title') || url.searchParams.get('task');
    const newDueDate = url.searchParams.get('dueDate') || url.searchParams.get('due');
    const newPriority = url.searchParams.get('priority');
    const newDescription = url.searchParams.get('description');
    const newStatus = url.searchParams.get('status');
    const newTitle = url.searchParams.get('newTitle');

    if (!taskTitle) {
      return NextResponse.json({ success: false, error: 'taskTitle parameter required to identify the task' });
    }

    // Find the task
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .limit(50)
      .get();

    const searchTitle = taskTitle.toLowerCase();
    const matchedTask = snapshot.docs.find(doc => {
      const title = doc.data().title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedTask) {
      return NextResponse.json({ success: false, error: `Task "${taskTitle}" not found` });
    }

    // Build update object
    const updates = { updatedAt: new Date().toISOString() };
    const changes = [];

    if (newDueDate) {
      const parsed = parseDate(newDueDate);
      if (parsed) {
        updates.dueDate = parsed;
        changes.push(`due date to ${newDueDate}`);
      }
    }
    if (newPriority) {
      updates.priority = newPriority;
      changes.push(`priority to ${newPriority}`);
    }
    if (newDescription) {
      updates.description = newDescription;
      changes.push(`added description`);
    }
    if (newStatus) {
      updates.status = newStatus;
      changes.push(`status to ${newStatus}`);
    }
    if (newTitle) {
      updates.title = newTitle;
      changes.push(`title to "${newTitle}"`);
    }

    if (changes.length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided. Use dueDate, priority, description, status, or newTitle parameters.' });
    }

    await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .doc(matchedTask.id)
      .update(updates);

    return NextResponse.json({
      success: true,
      message: `Updated "${matchedTask.data().title}": changed ${changes.join(', ')}`,
      taskId: matchedTask.id
    });

  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
