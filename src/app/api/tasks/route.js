import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections, adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const teamView = searchParams.get('team') === 'true';

    let tasks = [];

    if (teamView) {
      // Fetch tasks from all team members
      const currentUser = await collections.user(session.userId).get();
      const currentUserData = currentUser.data() || {};
      const teamId = currentUserData.teamId || 'demo-team';

      // Get all users in the team
      const usersSnapshot = await collections.users()
        .where('teamId', '==', teamId)
        .get();

      const userIds = usersSnapshot.docs.map(doc => doc.id);

      // Fetch tasks for all team members
      const allTasksPromises = userIds.map(async (userId) => {
        let query = collections.tasks(userId);
        if (status) {
          query = query.where('status', '==', status);
        }
        const snapshot = await query.limit(limit).get();
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            userId: userId,
            assignedTo: data.assignedTo || userId,
            dueDate: data.dueDate?.toDate?.() || data.dueDate,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          };
        });
      });

      const allTasksArrays = await Promise.all(allTasksPromises);
      tasks = allTasksArrays.flat();
    } else {
      // Original behavior - fetch only current user's tasks
      let query = collections.tasks(session.userId);

      if (status) {
        query = query.where('status', '==', status).limit(limit);
      } else {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          assignedTo: data.assignedTo || session.userId,
          dueDate: data.dueDate?.toDate?.() || data.dueDate,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        };
      });
    }

    // Sort in memory instead of using orderBy (avoids composite index requirement)
    tasks.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Tasks fetch error:', error);
    // Return empty tasks on error instead of 500
    return NextResponse.json({ tasks: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { title, description, dueDate, dueTime, priority, tags } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const taskId = uuidv4();
    const now = new Date();

    const task = {
      id: taskId,
      userId: session.userId,
      title,
      description: description || null,
      status: 'pending',
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      dueTime: dueTime || null,
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
    };

    await collections.task(session.userId, taskId).set(task);

    return NextResponse.json({
      success: true,
      task: {
        ...task,
        dueDate: task.dueDate?.toISOString(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Task create error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const taskRef = collections.task(session.userId, id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    if (updates.dueDate) {
      updateData.dueDate = new Date(updates.dueDate);
    }

    if (updates.status === 'done') {
      updateData.completedAt = new Date();
    }

    await taskRef.update(updateData);

    const updated = await taskRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      task: {
        ...data,
        dueDate: data.dueDate?.toDate?.()?.toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const taskRef = collections.task(session.userId, id);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await taskRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
