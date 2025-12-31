import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('coworkr_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch stats from various collections
    // For hackathon demo, we'll use sample data and fetch from APIs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const headers = {
      Cookie: `coworkr_user_id=${userId}`,
      'x-internal-call': 'true',
      'x-coworkr-user-id': userId,
    };

    // Fetch data in parallel
    const [tasksRes, projectsRes, contactsRes, dealsRes, eventsRes, timesheetsRes] = await Promise.all([
      fetch(`${baseUrl}/api/tasks`, { headers }).catch(() => ({ ok: false })),
      fetch(`${baseUrl}/api/projects`, { headers }).catch(() => ({ ok: false })),
      fetch(`${baseUrl}/api/contacts`, { headers }).catch(() => ({ ok: false })),
      fetch(`${baseUrl}/api/deals`, { headers }).catch(() => ({ ok: false })),
      fetch(`${baseUrl}/api/events`, { headers }).catch(() => ({ ok: false })),
      fetch(`${baseUrl}/api/timesheets`, { headers }).catch(() => ({ ok: false })),
    ]);

    // Parse responses
    const [tasks, projects, contacts, deals, events, timesheets] = await Promise.all([
      tasksRes.ok ? tasksRes.json().catch(() => ({ tasks: [] })) : { tasks: [] },
      projectsRes.ok ? projectsRes.json().catch(() => ({ projects: [] })) : { projects: [] },
      contactsRes.ok ? contactsRes.json().catch(() => ({ contacts: [] })) : { contacts: [] },
      dealsRes.ok ? dealsRes.json().catch(() => ({ deals: [] })) : { deals: [] },
      eventsRes.ok ? eventsRes.json().catch(() => ({ events: [] })) : { events: [] },
      timesheetsRes.ok ? timesheetsRes.json().catch(() => ({ entries: [] })) : { entries: [] },
    ]);

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const openTasks = (tasks.tasks || []).filter(t => t.status !== 'done').length;
    const openProjects = (projects.projects || []).filter(p => p.status === 'open' || p.status === 'in_progress').length;
    const tasksThisMonth = (tasks.tasks || []).filter(t => {
      const created = new Date(t.createdAt);
      return created >= startOfMonth;
    }).length;

    const activeDeals = (deals.deals || []).filter(d => !['won', 'lost'].includes(d.stage)).length;
    const dealPipeline = (deals.deals || [])
      .filter(d => !['won', 'lost'].includes(d.stage))
      .reduce((sum, d) => sum + (d.value || 0), 0);

    // Calculate actual time tracked from timesheets (field is 'duration' not 'hours')
    const timeTracked = (timesheets.entries || []).reduce((sum, entry) => sum + (entry.duration || 0), 0);

    return NextResponse.json({
      stats: {
        openProjects,
        openTasks,
        tasksThisMonth,
        timeTracked,
        contacts: (contacts.contacts || []).length,
        activeDeals,
        dealPipeline,
        activities: Math.floor(Math.random() * 50) + 10,
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
