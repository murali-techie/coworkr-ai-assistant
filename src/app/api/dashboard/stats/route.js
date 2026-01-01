import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { collections, getAdminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('coworkr_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      console.error('Firebase not initialized');
      return NextResponse.json({
        stats: {
          openProjects: 0,
          openTasks: 0,
          tasksThisMonth: 0,
          timeTracked: 0,
          contacts: 0,
          activeDeals: 0,
          dealPipeline: 0,
          activities: 0,
        }
      });
    }

    // Fetch data directly from Firestore
    const [tasksSnap, projectsSnap, contactsSnap, dealsSnap, timesheetsSnap] = await Promise.all([
      collections.tasks(userId).get(),
      collections.projects(userId).get(),
      collections.contacts(userId).get(),
      collections.deals(userId).get(),
      db.collection('users').doc(userId).collection('timesheets').get(),
    ]);

    const tasks = tasksSnap.docs.map(doc => doc.data());
    const projects = projectsSnap.docs.map(doc => doc.data());
    const contacts = contactsSnap.docs.map(doc => doc.data());
    const deals = dealsSnap.docs.map(doc => doc.data());
    const timesheets = timesheetsSnap.docs.map(doc => doc.data());

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const openTasks = tasks.filter(t => t.status !== 'done').length;
    const openProjects = projects.filter(p => p.status === 'open' || p.status === 'in_progress' || p.status === 'active').length;
    const tasksThisMonth = tasks.filter(t => {
      const created = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      return created >= startOfMonth;
    }).length;

    const activeDeals = deals.filter(d => !['won', 'lost', 'closed'].includes(d.stage)).length;
    const dealPipeline = deals
      .filter(d => !['won', 'lost', 'closed'].includes(d.stage))
      .reduce((sum, d) => sum + (d.value || 0), 0);

    // Calculate actual time tracked from timesheets
    const timeTracked = timesheets.reduce((sum, entry) => sum + (entry.duration || entry.hours || 0), 0);

    return NextResponse.json({
      stats: {
        openProjects: openProjects || projects.length,
        openTasks,
        tasksThisMonth,
        timeTracked,
        contacts: contacts.length,
        activeDeals: activeDeals || deals.length,
        dealPipeline,
        activities: tasks.length + (deals.length * 2),
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({
      stats: {
        openProjects: 0,
        openTasks: 0,
        tasksThisMonth: 0,
        timeTracked: 0,
        contacts: 0,
        activeDeals: 0,
        dealPipeline: 0,
        activities: 0,
      }
    });
  }
}
