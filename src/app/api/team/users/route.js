import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections, adminDb } from '@/lib/firebase/admin';

// Get all team members
export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeWorkload = searchParams.get('includeWorkload') === 'true';

    // Get the current user to check their team
    const currentUser = await collections.user(session.userId).get();
    const currentUserData = currentUser.data() || {};
    const teamId = currentUserData.teamId || 'demo-team';

    // Get all users in the same team
    const usersSnapshot = await collections.users()
      .where('teamId', '==', teamId)
      .get();

    let users = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        role: data.role || 'member',
        avatar: data.avatar || null,
        title: data.title || '',
        department: data.department || '',
        status: data.status || 'active',
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
      };
    });

    // If workload requested, fetch task counts for each user
    if (includeWorkload) {
      users = await Promise.all(users.map(async (user) => {
        try {
          // Get open tasks for this user
          const tasksSnapshot = await collections.tasks(user.id)
            .where('status', 'in', ['pending', 'in_progress', 'open'])
            .get();

          const tasks = tasksSnapshot.docs.map(doc => doc.data());

          // Calculate workload metrics
          const openTasks = tasks.length;
          const highPriorityTasks = tasks.filter(t => t.priority === 'high').length;
          const tasksDueToday = tasks.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate?.toDate?.() || t.dueDate);
            const today = new Date();
            return due.toDateString() === today.toDateString();
          }).length;

          return {
            ...user,
            workload: {
              openTasks,
              highPriorityTasks,
              tasksDueToday,
              score: openTasks + (highPriorityTasks * 2) + (tasksDueToday * 3), // weighted score
            },
          };
        } catch (e) {
          return { ...user, workload: { openTasks: 0, highPriorityTasks: 0, tasksDueToday: 0, score: 0 } };
        }
      }));
    }

    return NextResponse.json({ users });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Team users fetch error:', error);
    return NextResponse.json({ users: [] });
  }
}

// Create/invite a new team member (admin only)
export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // Check if current user is admin
    const currentUser = await collections.user(session.userId).get();
    const currentUserData = currentUser.data() || {};

    if (currentUserData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { firstName, lastName, email, role, title, department } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Create a user ID from email
    const userId = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const teamId = currentUserData.teamId || 'demo-team';

    const now = new Date();
    const userData = {
      firstName: firstName || '',
      lastName: lastName || '',
      email: email.toLowerCase(),
      role: role || 'member',
      title: title || '',
      department: department || '',
      teamId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await collections.user(userId).set(userData, { merge: true });

    return NextResponse.json({
      success: true,
      user: { id: userId, ...userData },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create team user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
