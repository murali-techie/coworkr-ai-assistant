import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const taskTitle = url.searchParams.get('taskTitle') || url.searchParams.get('title') || url.searchParams.get('task');

    if (!taskTitle) {
      return NextResponse.json({ success: false, error: 'taskTitle parameter required' });
    }

    // Find the task by title
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

    // Mark as complete
    await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .doc(matchedTask.id)
      .update({
        status: 'done',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: `Task "${matchedTask.data().title}" marked as complete`,
      taskId: matchedTask.id,
      taskTitle: matchedTask.data().title
    });

  } catch (error) {
    console.error('Complete task error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
