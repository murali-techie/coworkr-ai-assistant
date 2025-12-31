import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const USER_ID = 'demo-user-001';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'day'; // day, week, tasks, meetings

    const now = new Date();
    let summary = {};

    if (type === 'day' || type === 'daily') {
      // Daily summary
      const [tasksSnap, eventsSnap, dealsSnap] = await Promise.all([
        adminDb.collection('users').doc(USER_ID).collection('tasks').limit(50).get(),
        adminDb.collection('users').doc(USER_ID).collection('events').limit(50).get(),
        adminDb.collection('users').doc(USER_ID).collection('deals').limit(20).get(),
      ]);

      const tasks = tasksSnap.docs.map(d => d.data());
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');

      const events = eventsSnap.docs.map(d => d.data());
      const todayEvents = events.filter(e => {
        const eventDate = new Date(e.startTime);
        return eventDate.toDateString() === now.toDateString();
      });

      const deals = dealsSnap.docs.map(d => d.data());
      const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

      summary = {
        type: 'daily_summary',
        date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        tasks: {
          total: pendingTasks.length,
          highPriority: highPriorityTasks.length,
          list: pendingTasks.slice(0, 5).map(t => t.title)
        },
        meetings: {
          today: todayEvents.length,
          list: todayEvents.map(e => ({
            title: e.title,
            time: new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            location: e.location || 'No location'
          }))
        },
        deals: {
          active: deals.length,
          totalValue: totalDealValue
        }
      };
    } else if (type === 'tasks') {
      const tasksSnap = await adminDb.collection('users').doc(USER_ID).collection('tasks').limit(50).get();
      const tasks = tasksSnap.docs.map(d => d.data());
      const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
      const byPriority = {
        high: pending.filter(t => t.priority === 'high').map(t => t.title),
        medium: pending.filter(t => t.priority === 'medium').map(t => t.title),
        low: pending.filter(t => t.priority === 'low').map(t => t.title)
      };

      summary = {
        type: 'task_summary',
        total: pending.length,
        byPriority,
        overdue: pending.filter(t => t.dueDate && new Date(t.dueDate) < now).length
      };
    } else if (type === 'meetings' || type === 'calendar') {
      const eventsSnap = await adminDb.collection('users').doc(USER_ID).collection('events').limit(50).get();
      const events = eventsSnap.docs.map(d => d.data()).filter(e => new Date(e.startTime) >= now);
      events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      const todayEvents = events.filter(e => new Date(e.startTime).toDateString() === now.toDateString());
      const thisWeekEvents = events.filter(e => {
        const eventDate = new Date(e.startTime);
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return eventDate <= weekFromNow;
      });

      summary = {
        type: 'meeting_summary',
        today: todayEvents.map(e => ({
          title: e.title,
          time: new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          location: e.location
        })),
        thisWeek: thisWeekEvents.length,
        upcoming: events.slice(0, 5).map(e => ({
          title: e.title,
          date: new Date(e.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }))
      };
    } else if (type === 'deals' || type === 'pipeline') {
      const dealsSnap = await adminDb.collection('users').doc(USER_ID).collection('deals').limit(50).get();
      const deals = dealsSnap.docs.map(d => d.data());

      const byStage = {};
      deals.forEach(d => {
        const stage = d.stage || 'unknown';
        if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
        byStage[stage].count++;
        byStage[stage].value += d.value || 0;
      });

      summary = {
        type: 'deals_summary',
        total: deals.length,
        totalValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
        byStage,
        topDeals: deals.sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 3).map(d => ({
          name: d.name,
          value: d.value,
          stage: d.stage
        }))
      };
    }

    return NextResponse.json({ success: true, summary });

  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
