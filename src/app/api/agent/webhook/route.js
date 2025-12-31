import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Webhook endpoint for ElevenLabs Conversational AI tools
 * This allows the agent to fetch/modify real data from our database
 */

const USER_ID = 'demo-user-001'; // Default user for demo

// Get tasks
async function getTasks() {
  try {
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .limit(20)
      .get();

    const tasks = snapshot.docs
      .map(doc => ({
        id: doc.id,
        title: doc.data().title,
        priority: doc.data().priority,
        status: doc.data().status,
        dueDate: doc.data().dueDate,
      }))
      .filter(t => t.status === 'pending' || t.status === 'in_progress')
      .slice(0, 10);

    return { success: true, tasks, count: tasks.length };
  } catch (error) {
    console.error('Get tasks error:', error);
    return { success: false, error: error.message };
  }
}

// Get events/schedule
async function getEvents() {
  try {
    const now = new Date();
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('events')
      .limit(20)
      .get();

    const events = snapshot.docs
      .map(doc => ({
        id: doc.id,
        title: doc.data().title,
        startTime: doc.data().startTime,
        endTime: doc.data().endTime,
        location: doc.data().location,
      }))
      .filter(e => new Date(e.startTime) >= now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 10);

    return { success: true, events, count: events.length };
  } catch (error) {
    console.error('Get events error:', error);
    return { success: false, error: error.message };
  }
}

// Get deals
async function getDeals() {
  try {
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('deals')
      .limit(10)
      .get();

    const deals = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      value: doc.data().value,
      stage: doc.data().stage,
    }));

    return { success: true, deals, count: deals.length };
  } catch (error) {
    console.error('Get deals error:', error);
    return { success: false, error: error.message };
  }
}

// Get contacts
async function getContacts() {
  try {
    const snapshot = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('contacts')
      .limit(10)
      .get();

    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      name: `${doc.data().firstName} ${doc.data().lastName}`,
      email: doc.data().email,
      company: doc.data().company,
    }));

    return { success: true, contacts, count: contacts.length };
  } catch (error) {
    console.error('Get contacts error:', error);
    return { success: false, error: error.message };
  }
}

// Create task
async function createTask(params) {
  try {
    const taskData = {
      title: params.title,
      description: params.description || '',
      priority: params.priority || 'medium',
      status: 'pending',
      dueDate: params.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .add(taskData);

    return { success: true, taskId: docRef.id, task: taskData };
  } catch (error) {
    console.error('Create task error:', error);
    return { success: false, error: error.message };
  }
}

// Complete task
async function completeTask(params) {
  try {
    let taskId = params.taskId;

    // If we have a task title but no ID, look it up
    if (!taskId && params.taskTitle) {
      const snapshot = await adminDb
        .collection('users')
        .doc(USER_ID)
        .collection('tasks')
        .get();

      const searchTitle = params.taskTitle.toLowerCase();
      const matchedTask = snapshot.docs.find(doc => {
        const title = doc.data().title?.toLowerCase() || '';
        return title.includes(searchTitle) || searchTitle.includes(title);
      });

      if (matchedTask) {
        taskId = matchedTask.id;
      }
    }

    if (!taskId) {
      return { success: false, error: 'Task not found' };
    }

    await adminDb
      .collection('users')
      .doc(USER_ID)
      .collection('tasks')
      .doc(taskId)
      .update({
        status: 'done',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return { success: true, taskId };
  } catch (error) {
    console.error('Complete task error:', error);
    return { success: false, error: error.message };
  }
}

// Get daily summary
async function getDailySummary() {
  try {
    const [tasksResult, eventsResult, dealsResult] = await Promise.all([
      getTasks(),
      getEvents(),
      getDeals(),
    ]);

    const now = new Date();
    const todayEvents = (eventsResult.events || []).filter(e => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === now.toDateString();
    });

    return {
      success: true,
      summary: {
        date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        pendingTasks: tasksResult.count || 0,
        todayEvents: todayEvents.length,
        totalDeals: dealsResult.count || 0,
        topTasks: (tasksResult.tasks || []).slice(0, 3).map(t => t.title),
        upcomingEvents: todayEvents.slice(0, 3).map(e => e.title),
      },
    };
  } catch (error) {
    console.error('Daily summary error:', error);
    return { success: false, error: error.message };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // ElevenLabs sends tool calls in a specific format
    const toolName = body.tool_name || body.name || body.action;
    const params = body.parameters || body.params || body;

    let result;

    switch (toolName) {
      case 'get_tasks':
        result = await getTasks();
        break;
      case 'get_events':
      case 'get_schedule':
        result = await getEvents();
        break;
      case 'get_deals':
        result = await getDeals();
        break;
      case 'get_contacts':
        result = await getContacts();
        break;
      case 'create_task':
        result = await createTask(params);
        break;
      case 'complete_task':
        result = await completeTask(params);
        break;
      case 'get_daily_summary':
        result = await getDailySummary();
        break;
      default:
        result = { success: false, error: `Unknown tool: ${toolName}` };
    }

    console.log('Webhook result:', JSON.stringify(result, null, 2));
    return NextResponse.json(result);

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Handle GET requests (ElevenLabs may send GET for some tools)
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const toolName = url.searchParams.get('tool_name') || url.searchParams.get('name') || url.searchParams.get('action');

    if (!toolName) {
      return NextResponse.json({ status: 'Webhook endpoint ready. Pass ?tool_name=get_tasks to test.' });
    }

    let result;
    switch (toolName) {
      case 'get_tasks':
        result = await getTasks();
        break;
      case 'get_events':
      case 'get_schedule':
        result = await getEvents();
        break;
      case 'get_deals':
        result = await getDeals();
        break;
      case 'get_contacts':
        result = await getContacts();
        break;
      case 'get_daily_summary':
        result = await getDailySummary();
        break;
      default:
        result = { success: false, error: `Unknown tool: ${toolName}` };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Webhook GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
