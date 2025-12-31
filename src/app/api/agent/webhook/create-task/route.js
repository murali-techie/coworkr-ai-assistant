import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const title = url.searchParams.get('title') || url.searchParams.get('task');
    const priority = url.searchParams.get('priority') || 'medium';
    const description = url.searchParams.get('description') || '';

    if (!title) {
      return NextResponse.json({ success: false, error: 'title parameter required' });
    }

    const taskData = {
      title,
      description,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .add(taskData);

    return NextResponse.json({
      success: true,
      message: `Task "${title}" created successfully`,
      taskId: docRef.id,
      task: taskData
    });

  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
