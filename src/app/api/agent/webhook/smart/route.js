import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { generateJSON } from '@/lib/ai/gemini';

const USER_ID = 'demo-user-001';

// Parse natural language date/time
function parseDateTime(dateStr, timeStr, baseDate = new Date()) {
  let date = new Date(baseDate);
  let timeWasSet = false;

  if (dateStr) {
    const lower = dateStr.toLowerCase().trim();

    if (lower === 'today' || lower.includes('today')) {
      date = new Date();
    } else if (lower === 'tomorrow' || lower.includes('tomorrow')) {
      date = new Date();
      date.setDate(date.getDate() + 1);
    } else if (lower.includes('day after tomorrow')) {
      date = new Date();
      date.setDate(date.getDate() + 2);
    } else if (lower.includes('next monday') || lower === 'monday') {
      date = new Date();
      const daysUntil = (1 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
    } else if (lower.includes('next tuesday') || lower === 'tuesday') {
      date = new Date();
      const daysUntil = (2 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
    } else if (lower.includes('next wednesday') || lower === 'wednesday') {
      date = new Date();
      const daysUntil = (3 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
    } else if (lower.includes('next thursday') || lower === 'thursday') {
      date = new Date();
      const daysUntil = (4 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
    } else if (lower.includes('next friday') || lower === 'friday') {
      date = new Date();
      const daysUntil = (5 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntil);
    } else if (lower.includes('next week')) {
      date = new Date();
      date.setDate(date.getDate() + 7);
    } else if (lower.includes('next month')) {
      date = new Date();
      date.setMonth(date.getMonth() + 1);
    } else if (lower.includes('end of day') || lower === 'eod') {
      date = new Date();
      date.setHours(17, 0, 0, 0);
      timeWasSet = true;
    } else if (lower.includes('end of week') || lower === 'eow') {
      date = new Date();
      const daysUntilFriday = (5 - date.getDay() + 7) % 7 || 7;
      date.setDate(date.getDate() + daysUntilFriday);
      date.setHours(17, 0, 0, 0);
      timeWasSet = true;
    } else {
      // Try parsing ISO or other formats
      const parsed = new Date(dateStr);
      if (!isNaN(parsed)) date = parsed;
    }
  }

  if (timeStr) {
    const lower = timeStr.toLowerCase().trim();

    // Handle special time words
    if (lower === 'noon' || lower === 'midday') {
      date.setHours(12, 0, 0, 0);
      timeWasSet = true;
    } else if (lower === 'midnight') {
      date.setHours(0, 0, 0, 0);
      timeWasSet = true;
    } else if (lower === 'morning' || lower === 'this morning') {
      date.setHours(9, 0, 0, 0);
      timeWasSet = true;
    } else if (lower === 'afternoon' || lower === 'this afternoon') {
      date.setHours(14, 0, 0, 0);
      timeWasSet = true;
    } else if (lower === 'evening' || lower === 'this evening') {
      date.setHours(18, 0, 0, 0);
      timeWasSet = true;
    } else if (lower.includes('half past')) {
      const hourMatch = lower.match(/half past (\d{1,2})/);
      if (hourMatch) {
        let hours = parseInt(hourMatch[1]);
        if (hours <= 6) hours += 12;
        date.setHours(hours, 30, 0, 0);
        timeWasSet = true;
      }
    } else if (lower.includes('quarter past')) {
      const hourMatch = lower.match(/quarter past (\d{1,2})/);
      if (hourMatch) {
        let hours = parseInt(hourMatch[1]);
        if (hours <= 6) hours += 12;
        date.setHours(hours, 15, 0, 0);
        timeWasSet = true;
      }
    } else if (lower.includes('quarter to')) {
      const hourMatch = lower.match(/quarter to (\d{1,2})/);
      if (hourMatch) {
        let hours = parseInt(hourMatch[1]);
        if (hours <= 6) hours += 12;
        date.setHours(hours - 1, 45, 0, 0);
        timeWasSet = true;
      }
    } else {
      // Handle "2pm", "2:30pm", "14:00", "2 pm", etc.
      const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2] || '0');
        const period = timeMatch[3]?.toLowerCase().replace(/\./g, '');

        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        // If no period and hour <= 6, assume PM for business hours
        if (!period && hours >= 1 && hours <= 6) hours += 12;

        date.setHours(hours, minutes, 0, 0);
        timeWasSet = true;
      }
    }
  }

  // If no time was explicitly set, default to 9 AM for events/meetings
  if (!timeWasSet) {
    date.setHours(9, 0, 0, 0);
  }

  return date;
}

// Get current context from database
async function getContext(userId = USER_ID) {
  const now = new Date();

  const [tasksSnap, eventsSnap, dealsSnap, contactsSnap, projectsSnap, teamSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).collection('tasks').limit(50).get(),
    adminDb.collection('users').doc(userId).collection('events').limit(50).get(),
    adminDb.collection('users').doc(userId).collection('deals').limit(20).get(),
    adminDb.collection('users').doc(userId).collection('contacts').limit(20).get(),
    adminDb.collection('users').doc(userId).collection('projects').limit(20).get(),
    adminDb.collection('users').where('teamId', '==', 'demo-team').get(),
  ]);

  const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const deals = dealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const contacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const teamMembers = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Calculate workload for each team member
  const teamWithWorkload = await Promise.all(teamMembers.map(async (member) => {
    try {
      const memberTasksSnap = await adminDb.collection('users').doc(member.id).collection('tasks')
        .where('status', 'in', ['pending', 'in_progress', 'open']).get();
      const memberTasks = memberTasksSnap.docs.map(d => d.data());
      const openTasks = memberTasks.length;
      const highPriorityTasks = memberTasks.filter(t => t.priority === 'high').length;
      return {
        ...member,
        workload: {
          openTasks,
          highPriorityTasks,
          score: openTasks + (highPriorityTasks * 2),
        }
      };
    } catch (e) {
      return { ...member, workload: { openTasks: 0, highPriorityTasks: 0, score: 0 } };
    }
  }));

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in-progress');
  const upcomingEvents = events.filter(e => new Date(e.startTime) >= now);
  upcomingEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return {
    userId,
    currentDate: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    currentTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    tasks: pendingTasks,
    allTasks: tasks,
    events: upcomingEvents,
    allEvents: events,
    deals,
    contacts,
    projects,
    teamMembers: teamWithWorkload,
  };
}

// Detect intent using Gemini
async function detectIntent(message, context) {
  const teamList = (context.teamMembers || []).map(m => `${m.firstName} ${m.lastName}`).join(', ');

  const prompt = `Analyze this voice command for a CRM assistant and extract structured parameters.

CONTEXT:
- Today: ${context.currentDate}, ${context.currentTime}
- Team members: ${teamList || 'None'}
- Tasks: ${context.tasks.slice(0, 3).map(t => t.title).join(', ') || 'None'}

USER SAID: "${message}"

EXTRACT and return JSON with these fields:

{
  "intent": "<one of: GET_TASKS, GET_EVENTS, GET_DEALS, GET_CONTACTS, GET_PROJECTS, CREATE_TASK, UPDATE_TASK, COMPLETE_TASK, DELETE_TASK, CREATE_EVENT, UPDATE_EVENT, CANCEL_EVENT, DAILY_SUMMARY, TASK_SUMMARY, MEETING_SUMMARY, DEAL_SUMMARY, CHECK_WORKLOAD, CHECK_AVAILABILITY, ASSIGN_TASK, SCHEDULE_MEETING_WITH, GREETING, GENERAL_CHAT>",
  "params": {
    "title": "<extracted task/event title - REQUIRED for CREATE_TASK, CREATE_EVENT, ASSIGN_TASK, SCHEDULE_MEETING_WITH>",
    "taskTitle": "<existing task name for updates/completion>",
    "eventTitle": "<existing event name for updates/cancellation>",
    "assigneeName": "<FIRST NAME of team member to assign task to - extract from 'for X', 'to X', 'assign X'>",
    "attendeeName": "<FIRST NAME of person to meet with - extract from 'with X', 'call X'>",
    "memberName": "<team member name for availability check>",
    "dueDate": "<date string: today, tomorrow, friday, next monday, end of week, etc.>",
    "date": "<event date: today, tomorrow, friday, next week>",
    "time": "<event time: 2pm, 3:30pm, 10am, 14:00>",
    "priority": "<high, medium, or low if mentioned>",
    "description": "<description if provided>",
    "location": "<location if mentioned>",
    "duration": "<duration in minutes if mentioned>"
  }
}

EXTRACTION RULES - READ CAREFULLY:

1. TITLE EXTRACTION (critical!):
   - "create task REVIEW THE PROPOSAL" -> title: "review the proposal"
   - "assign task to David called BUDGET REVIEW" -> title: "budget review"
   - "create task for Mike to PREPARE SLIDES" -> title: "prepare slides"
   - "schedule meeting called PROJECT SYNC" -> title: "project sync"
   - "book call about QUARTERLY PLANNING" -> title: "quarterly planning"
   - Title is everything that describes WHAT the task/event is about

2. PERSON NAME EXTRACTION (critical!):
   - "assign to DAVID" -> assigneeName: "David"
   - "create task for MIKE" -> assigneeName: "Mike"
   - "schedule meeting with JANE" -> attendeeName: "Jane"
   - "call with JOHN tomorrow" -> attendeeName: "John"
   - "is SARAH available" -> memberName: "Sarah"
   - Extract the FIRST NAME only, match against: ${teamList}

3. DATE/TIME:
   - Pass dates exactly as spoken: "tomorrow", "friday", "next monday"
   - Pass times exactly as spoken: "2pm", "3:30pm", "10 am", "noon", "afternoon", "morning", "evening", "half past 2", "quarter to 5"

4. INTENT SELECTION:
   - Any task with a person name -> ASSIGN_TASK
   - Meeting/call with a person -> SCHEDULE_MEETING_WITH
   - "create task X" without person -> CREATE_TASK
   - "schedule meeting at X" without person -> CREATE_EVENT

EXAMPLES:

Input: "assign task to David called review proposal due friday"
Output: {"intent":"ASSIGN_TASK","params":{"title":"review proposal","assigneeName":"David","dueDate":"friday"}}

Input: "create a task for Mike to prepare the presentation due tomorrow"
Output: {"intent":"ASSIGN_TASK","params":{"title":"prepare the presentation","assigneeName":"Mike","dueDate":"tomorrow"}}

Input: "schedule meeting with Mike Johnson tomorrow at 3pm about budget review"
Output: {"intent":"SCHEDULE_MEETING_WITH","params":{"title":"budget review","attendeeName":"Mike","date":"tomorrow","time":"3pm"}}

Input: "create task review documentation due tomorrow"
Output: {"intent":"CREATE_TASK","params":{"title":"review documentation","dueDate":"tomorrow"}}

Input: "is David free tomorrow"
Output: {"intent":"CHECK_AVAILABILITY","params":{"memberName":"David"}}

Input: "mark review proposal as done"
Output: {"intent":"COMPLETE_TASK","params":{"taskTitle":"review proposal"}}

Input: "lunch with sarah at noon thursday"
Output: {"intent":"SCHEDULE_MEETING_WITH","params":{"title":"lunch","attendeeName":"Sarah","date":"thursday","time":"noon"}}

Input: "call jane this afternoon"
Output: {"intent":"SCHEDULE_MEETING_WITH","params":{"attendeeName":"Jane","time":"afternoon"}}

Return ONLY valid JSON.`;

  try {
    return await generateJSON(prompt, 'Extract intent from CRM voice command.');
  } catch (e) {
    console.error('Intent detection failed:', e);
    return { intent: 'GENERAL_CHAT', params: {} };
  }
}

// Action handlers
const actionHandlers = {
  async GET_TASKS(_params, context) {
    const tasks = context.tasks;
    if (tasks.length === 0) {
      return { success: true, message: "You don't have any pending tasks right now." };
    }
    const highPriority = tasks.filter(t => t.priority === 'high');
    const taskList = tasks.slice(0, 5).map(t => t.title).join(', ');
    return {
      success: true,
      message: `You have ${tasks.length} pending tasks${highPriority.length > 0 ? `, ${highPriority.length} high priority` : ''}. Top ones are: ${taskList}.`,
      data: tasks.slice(0, 5)
    };
  },

  async GET_EVENTS(_params, context) {
    const now = new Date();
    const todayEvents = context.events.filter(e =>
      new Date(e.startTime).toDateString() === now.toDateString()
    );

    if (context.events.length === 0) {
      return { success: true, message: "You don't have any upcoming events." };
    }

    if (todayEvents.length > 0) {
      const eventList = todayEvents.map(e => {
        const time = new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${e.title} at ${time}`;
      }).join(', ');
      return {
        success: true,
        message: `You have ${todayEvents.length} meeting${todayEvents.length > 1 ? 's' : ''} today: ${eventList}.`,
        data: todayEvents
      };
    }

    const nextEvent = context.events[0];
    const nextDate = new Date(nextEvent.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return {
      success: true,
      message: `No meetings today. Your next meeting is ${nextEvent.title} on ${nextDate}.`,
      data: context.events.slice(0, 3)
    };
  },

  async GET_DEALS(_params, context) {
    const deals = context.deals;
    if (deals.length === 0) {
      return { success: true, message: "You don't have any deals in your pipeline." };
    }
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    return {
      success: true,
      message: `You have ${deals.length} deals in your pipeline worth $${totalValue.toLocaleString()} total.`,
      data: deals.slice(0, 5)
    };
  },

  async GET_CONTACTS(_params, context) {
    const contacts = context.contacts;
    if (contacts.length === 0) {
      return { success: true, message: "You don't have any contacts yet." };
    }
    return {
      success: true,
      message: `You have ${contacts.length} contacts in your CRM.`,
      data: contacts.slice(0, 5)
    };
  },

  async GET_PROJECTS(_params, context) {
    const projects = context.projects || [];
    if (projects.length === 0) {
      return { success: true, message: "You don't have any projects yet." };
    }
    const activeProjects = projects.filter(p => p.status === 'in-progress' || p.status === 'open');
    const projectList = projects.slice(0, 5).map(p => `${p.name} (${p.status})`).join(', ');
    return {
      success: true,
      message: `You have ${projects.length} project${projects.length > 1 ? 's' : ''}${activeProjects.length > 0 ? `, ${activeProjects.length} active` : ''}. Projects: ${projectList}.`,
      data: projects.slice(0, 5)
    };
  },

  async CREATE_TASK(params, context) {
    if (!params.title) {
      return { success: false, message: "I need a title for the task. What should I call it?" };
    }

    const taskData = {
      title: params.title,
      description: params.description || '',
      priority: params.priority || 'medium',
      status: 'pending',
      dueDate: params.dueDate ? parseDateTime(params.dueDate, null).toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('users').doc(context.userId).collection('tasks').add(taskData);

    return {
      success: true,
      message: `Created task "${params.title}"${params.priority === 'high' ? ' with high priority' : ''}.`,
      taskId: docRef.id
    };
  },

  async COMPLETE_TASK(params, context) {
    if (!params.taskTitle) {
      return { success: false, message: "Which task should I mark as complete?" };
    }

    const searchTitle = params.taskTitle.toLowerCase();
    const matchedTask = context.allTasks.find(t => {
      const title = t.title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedTask) {
      return { success: false, message: `I couldn't find a task called "${params.taskTitle}".` };
    }

    await adminDb.collection('users').doc(context.userId).collection('tasks').doc(matchedTask.id).update({
      status: 'done',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: `Done! Marked "${matchedTask.title}" as complete.`,
      taskId: matchedTask.id
    };
  },

  async UPDATE_TASK(params, context) {
    if (!params.taskTitle) {
      return { success: false, message: "Which task do you want to update?" };
    }

    const searchTitle = params.taskTitle.toLowerCase();
    const matchedTask = context.allTasks.find(t => {
      const title = t.title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedTask) {
      return { success: false, message: `I couldn't find a task called "${params.taskTitle}".` };
    }

    const updates = { updatedAt: new Date().toISOString() };
    const changes = [];

    if (params.dueDate) {
      updates.dueDate = parseDateTime(params.dueDate, null).toISOString();
      changes.push(`due date to ${params.dueDate}`);
    }
    if (params.priority) {
      updates.priority = params.priority;
      changes.push(`priority to ${params.priority}`);
    }
    if (params.status) {
      updates.status = params.status;
      changes.push(`status to ${params.status}`);
    }
    if (params.newTitle) {
      updates.title = params.newTitle;
      changes.push(`title to "${params.newTitle}"`);
    }
    if (params.description) {
      updates.description = params.description;
      changes.push('added description');
    }

    if (changes.length === 0) {
      return { success: false, message: "What would you like to change about this task?" };
    }

    await adminDb.collection('users').doc(context.userId).collection('tasks').doc(matchedTask.id).update(updates);

    return {
      success: true,
      message: `Updated "${matchedTask.title}": ${changes.join(', ')}.`,
      taskId: matchedTask.id
    };
  },

  async DELETE_TASK(params, context) {
    if (!params.taskTitle) {
      return { success: false, message: "Which task should I delete?" };
    }

    const searchTitle = params.taskTitle.toLowerCase();
    const matchedTask = context.allTasks.find(t => {
      const title = t.title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedTask) {
      return { success: false, message: `I couldn't find a task called "${params.taskTitle}".` };
    }

    await adminDb.collection('users').doc(context.userId).collection('tasks').doc(matchedTask.id).delete();

    return {
      success: true,
      message: `Deleted task "${matchedTask.title}".`,
      taskId: matchedTask.id
    };
  },

  async CREATE_EVENT(params, context) {
    if (!params.title) {
      return { success: false, message: "What should I call this event?" };
    }

    const startTime = parseDateTime(params.date, params.time);
    const duration = parseInt(params.duration) || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const eventData = {
      title: params.title,
      description: params.description || '',
      location: params.location || '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: params.attendees ? params.attendees.split(',').map(a => a.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('users').doc(context.userId).collection('events').add(eventData);

    const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return {
      success: true,
      message: `Created "${params.title}" on ${dateStr} at ${timeStr}.`,
      eventId: docRef.id
    };
  },

  async UPDATE_EVENT(params, context) {
    if (!params.eventTitle) {
      return { success: false, message: "Which event do you want to update?" };
    }

    const searchTitle = params.eventTitle.toLowerCase();
    const matchedEvent = context.allEvents.find(e => {
      const title = e.title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedEvent) {
      return { success: false, message: `I couldn't find an event called "${params.eventTitle}".` };
    }

    const updates = { updatedAt: new Date().toISOString() };
    const changes = [];

    if (params.date || params.time) {
      const currentStart = new Date(matchedEvent.startTime);
      const currentEnd = new Date(matchedEvent.endTime);
      const duration = currentEnd - currentStart;

      const newStart = parseDateTime(params.date, params.time, currentStart);
      const newEnd = new Date(newStart.getTime() + duration);

      updates.startTime = newStart.toISOString();
      updates.endTime = newEnd.toISOString();

      const dateStr = newStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const timeStr = newStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      changes.push(`rescheduled to ${dateStr} at ${timeStr}`);
    }
    if (params.newTitle) {
      updates.title = params.newTitle;
      changes.push(`title to "${params.newTitle}"`);
    }
    if (params.location) {
      updates.location = params.location;
      changes.push(`location to "${params.location}"`);
    }
    if (params.description) {
      updates.description = params.description;
      changes.push('added description');
    }

    if (changes.length === 0) {
      return { success: false, message: "What would you like to change about this event?" };
    }

    await adminDb.collection('users').doc(context.userId).collection('events').doc(matchedEvent.id).update(updates);

    return {
      success: true,
      message: `Updated "${matchedEvent.title}": ${changes.join(', ')}.`,
      eventId: matchedEvent.id
    };
  },

  async CANCEL_EVENT(params, context) {
    if (!params.eventTitle) {
      return { success: false, message: "Which event should I cancel?" };
    }

    const searchTitle = params.eventTitle.toLowerCase();
    const matchedEvent = context.allEvents.find(e => {
      const title = e.title?.toLowerCase() || '';
      return title.includes(searchTitle) || searchTitle.includes(title);
    });

    if (!matchedEvent) {
      return { success: false, message: `I couldn't find an event called "${params.eventTitle}".` };
    }

    await adminDb.collection('users').doc(context.userId).collection('events').doc(matchedEvent.id).delete();

    return {
      success: true,
      message: `Cancelled "${matchedEvent.title}".`,
      eventId: matchedEvent.id
    };
  },

  async DAILY_SUMMARY(_params, context) {
    const now = new Date();
    const todayEvents = context.events.filter(e =>
      new Date(e.startTime).toDateString() === now.toDateString()
    );
    const highPriorityTasks = context.tasks.filter(t => t.priority === 'high');

    let summary = `Today is ${context.currentDate}. `;

    if (todayEvents.length > 0) {
      summary += `You have ${todayEvents.length} meeting${todayEvents.length > 1 ? 's' : ''} today. `;
      if (todayEvents.length <= 2) {
        const eventList = todayEvents.map(e => {
          const time = new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return `${e.title} at ${time}`;
        }).join(' and ');
        summary += `${eventList}. `;
      }
    } else {
      summary += 'No meetings today. ';
    }

    if (context.tasks.length > 0) {
      summary += `You have ${context.tasks.length} pending task${context.tasks.length > 1 ? 's' : ''}`;
      if (highPriorityTasks.length > 0) {
        summary += `, ${highPriorityTasks.length} high priority`;
      }
      summary += '. ';
    } else {
      summary += 'No pending tasks. ';
    }

    return { success: true, message: summary.trim() };
  },

  async TASK_SUMMARY(_params, context) {
    const tasks = context.tasks;
    if (tasks.length === 0) {
      return { success: true, message: "You don't have any pending tasks." };
    }

    const high = tasks.filter(t => t.priority === 'high');
    const medium = tasks.filter(t => t.priority === 'medium');
    const low = tasks.filter(t => t.priority === 'low');

    let summary = `You have ${tasks.length} pending tasks: `;
    const parts = [];
    if (high.length > 0) parts.push(`${high.length} high priority`);
    if (medium.length > 0) parts.push(`${medium.length} medium priority`);
    if (low.length > 0) parts.push(`${low.length} low priority`);
    summary += parts.join(', ') + '. ';

    if (high.length > 0) {
      summary += `Top priority: ${high.slice(0, 2).map(t => t.title).join(' and ')}.`;
    }

    return { success: true, message: summary };
  },

  async MEETING_SUMMARY(_params, context) {
    const now = new Date();
    const todayEvents = context.events.filter(e =>
      new Date(e.startTime).toDateString() === now.toDateString()
    );
    const thisWeekEvents = context.events.filter(e => {
      const eventDate = new Date(e.startTime);
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return eventDate <= weekFromNow;
    });

    if (context.events.length === 0) {
      return { success: true, message: "You don't have any upcoming meetings." };
    }

    let summary = '';
    if (todayEvents.length > 0) {
      summary += `Today you have ${todayEvents.length} meeting${todayEvents.length > 1 ? 's' : ''}: `;
      summary += todayEvents.slice(0, 3).map(e => {
        const time = new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `${e.title} at ${time}`;
      }).join(', ') + '. ';
    } else {
      summary += 'No meetings today. ';
    }

    if (thisWeekEvents.length > todayEvents.length) {
      summary += `This week you have ${thisWeekEvents.length} meetings total.`;
    }

    return { success: true, message: summary.trim() };
  },

  async DEAL_SUMMARY(_params, context) {
    const deals = context.deals;
    if (deals.length === 0) {
      return { success: true, message: "You don't have any deals in your pipeline." };
    }

    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const byStage = {};
    deals.forEach(d => {
      const stage = d.stage || 'unknown';
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
      byStage[stage].count++;
      byStage[stage].value += d.value || 0;
    });

    let summary = `You have ${deals.length} deals worth $${totalValue.toLocaleString()}. `;
    const stages = Object.entries(byStage).map(([stage, data]) =>
      `${data.count} in ${stage}`
    ).join(', ');
    summary += stages + '.';

    return { success: true, message: summary };
  },

  async GREETING(_params, context) {
    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const todayEvents = context.events.filter(e =>
      new Date(e.startTime).toDateString() === new Date().toDateString()
    );

    let message = `${greeting}! `;
    if (todayEvents.length > 0) {
      message += `You have ${todayEvents.length} meeting${todayEvents.length > 1 ? 's' : ''} today. `;
    }
    if (context.tasks.length > 0) {
      const highPriority = context.tasks.filter(t => t.priority === 'high').length;
      if (highPriority > 0) {
        message += `${highPriority} high priority task${highPriority > 1 ? 's' : ''} need your attention.`;
      } else {
        message += `${context.tasks.length} task${context.tasks.length > 1 ? 's' : ''} on your list.`;
      }
    }
    message += ' How can I help you?';

    return { success: true, message: message.trim() };
  },

  async GENERAL_CHAT(_params, _context) {
    return {
      success: true,
      message: "I can help you manage tasks, schedule meetings, check your deals, and more. What would you like to do?"
    };
  },

  async CHECK_WORKLOAD(_params, context) {
    const teamMembers = context.teamMembers || [];
    if (teamMembers.length === 0) {
      return { success: true, message: "No team members found." };
    }

    // Sort by workload score (ascending - least busy first)
    const sorted = [...teamMembers].sort((a, b) =>
      (a.workload?.score || 0) - (b.workload?.score || 0)
    );

    const leastBusy = sorted[0];
    const mostBusy = sorted[sorted.length - 1];

    const workloadList = sorted.slice(0, 4).map(m =>
      `${m.firstName} ${m.lastName} has ${m.workload?.openTasks || 0} tasks`
    ).join(', ');

    return {
      success: true,
      message: `${leastBusy.firstName} ${leastBusy.lastName} is the least busy with ${leastBusy.workload?.openTasks || 0} open tasks. ${mostBusy.firstName} is most busy with ${mostBusy.workload?.openTasks || 0} tasks. Team workload: ${workloadList}.`,
      data: sorted
    };
  },

  async CHECK_AVAILABILITY(params, context) {
    const teamMembers = context.teamMembers || [];

    if (!params.memberName) {
      // Return all team availability
      const availabilityList = teamMembers.map(m => {
        const busyLevel = m.workload?.openTasks || 0;
        const status = busyLevel <= 2 ? 'available' : busyLevel <= 4 ? 'moderately busy' : 'very busy';
        return `${m.firstName} is ${status} with ${busyLevel} tasks`;
      }).join('. ');

      return {
        success: true,
        message: `Team availability: ${availabilityList}.`,
        data: teamMembers
      };
    }

    // Find specific team member - require at least 2 chars
    const searchName = (params.memberName || '').toLowerCase().trim();
    if (searchName.length < 2) {
      return { success: false, message: "I couldn't understand the team member's name." };
    }

    const member = teamMembers.find(m =>
      m.firstName?.toLowerCase() === searchName ||
      m.lastName?.toLowerCase() === searchName ||
      `${m.firstName} ${m.lastName}`.toLowerCase() === searchName ||
      m.firstName?.toLowerCase().startsWith(searchName) ||
      m.lastName?.toLowerCase().startsWith(searchName)
    );

    if (!member) {
      return { success: false, message: `Could not find team member: ${params.memberName}.` };
    }

    // Get their events for today/this week
    const eventsSnap = await adminDb.collection('users').doc(member.id).collection('events').limit(20).get();
    const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === now.toDateString();
    });

    const busyLevel = member.workload?.openTasks || 0;
    const status = busyLevel <= 2 ? 'pretty free' : busyLevel <= 4 ? 'moderately busy' : 'quite busy';

    let message = `${member.firstName} ${member.lastName} is ${status} with ${busyLevel} tasks.`;
    if (todayEvents.length > 0) {
      message += ` They have ${todayEvents.length} meeting${todayEvents.length > 1 ? 's' : ''} today.`;
    } else {
      message += ` No meetings scheduled today.`;
    }

    return {
      success: true,
      message,
      data: { member, events: todayEvents }
    };
  },

  async ASSIGN_TASK(params, context) {
    const teamMembers = context.teamMembers || [];

    if (!params.title) {
      return { success: false, message: "What's the task you want to assign?" };
    }
    if (!params.assigneeName) {
      return { success: false, message: "Who should this task be assigned to?" };
    }

    // Find team member - require at least 2 chars in search name
    const searchName = (params.assigneeName || '').toLowerCase().trim();
    if (searchName.length < 2) {
      return { success: false, message: "I couldn't understand the team member's name. Who should I assign this to?" };
    }

    const assignee = teamMembers.find(m =>
      m.firstName?.toLowerCase() === searchName ||
      m.lastName?.toLowerCase() === searchName ||
      `${m.firstName} ${m.lastName}`.toLowerCase() === searchName ||
      m.firstName?.toLowerCase().startsWith(searchName) ||
      m.lastName?.toLowerCase().startsWith(searchName)
    );

    if (!assignee) {
      return { success: false, message: `Could not find team member: ${params.assigneeName}.` };
    }

    const taskData = {
      title: params.title,
      description: params.description || '',
      priority: params.priority || 'medium',
      status: 'pending',
      dueDate: params.dueDate ? parseDateTime(params.dueDate, null).toISOString() : null,
      assignedTo: assignee.id,
      assignedBy: context.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('users').doc(assignee.id).collection('tasks').add(taskData);

    return {
      success: true,
      message: `Created task "${params.title}" and assigned it to ${assignee.firstName} ${assignee.lastName}.`,
      taskId: docRef.id
    };
  },

  async SCHEDULE_MEETING_WITH(params, context) {
    const teamMembers = context.teamMembers || [];

    if (!params.attendeeName && !params.attendees) {
      return { success: false, message: "Who do you want to schedule a meeting with?" };
    }
    if (!params.title) {
      return { success: false, message: "What should I call this meeting?" };
    }

    // Find team member(s) - require at least 2 chars in search name
    const searchName = (params.attendeeName || '').toLowerCase().trim();
    if (searchName.length < 2) {
      return { success: false, message: "I couldn't understand the team member's name. Who should I schedule with?" };
    }

    const attendee = teamMembers.find(m =>
      m.firstName?.toLowerCase() === searchName ||
      m.lastName?.toLowerCase() === searchName ||
      `${m.firstName} ${m.lastName}`.toLowerCase() === searchName ||
      m.firstName?.toLowerCase().startsWith(searchName) ||
      m.lastName?.toLowerCase().startsWith(searchName)
    );

    if (!attendee) {
      return { success: false, message: `Could not find team member: ${params.attendeeName}.` };
    }

    const startTime = parseDateTime(params.date, params.time);
    const duration = parseInt(params.duration) || 30;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const eventData = {
      title: params.title,
      description: params.description || `Meeting with ${attendee.firstName} ${attendee.lastName}`,
      location: params.location || '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: [attendee.email],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('users').doc(context.userId).collection('events').add(eventData);

    const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return {
      success: true,
      message: `Scheduled "${params.title}" with ${attendee.firstName} ${attendee.lastName} on ${dateStr} at ${timeStr}.`,
      eventId: docRef.id
    };
  }
};

export async function POST(request) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[WEBHOOK ${timestamp}]`;

  try {
    // Log raw request
    const rawBody = await request.text();
    console.log(`${logPrefix} === INCOMING REQUEST ===`);
    console.log(`${logPrefix} Headers:`, JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
    console.log(`${logPrefix} Raw Body:`, rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error(`${logPrefix} JSON Parse Error:`, parseError.message);
      return NextResponse.json({
        success: false,
        response: "Invalid request format."
      }, { status: 400 });
    }

    console.log(`${logPrefix} Parsed Body:`, JSON.stringify(body, null, 2));

    // ElevenLabs sends the user's speech as text - check multiple possible fields
    const userMessage = body.text || body.message || body.input || body.query || body.description || body.transcript;

    console.log(`${logPrefix} Extracted Message: "${userMessage}"`);

    if (!userMessage) {
      console.log(`${logPrefix} ERROR: No message found in request`);
      return NextResponse.json({
        success: false,
        response: "I didn't catch that. Could you please repeat?"
      });
    }

    console.log(`${logPrefix} Processing: "${userMessage}"`);

    // Get current context from database
    console.log(`${logPrefix} Fetching context...`);
    const context = await getContext();
    console.log(`${logPrefix} Context loaded: ${context.tasks.length} tasks, ${context.events.length} events, ${context.teamMembers?.length || 0} team members`);

    // Detect intent using Gemini
    console.log(`${logPrefix} Detecting intent...`);
    const intent = await detectIntent(userMessage, context);
    console.log(`${logPrefix} Intent detected:`, JSON.stringify(intent, null, 2));

    // Execute the appropriate action
    const handlerName = intent.intent || 'GENERAL_CHAT';
    const handler = actionHandlers[handlerName] || actionHandlers.GENERAL_CHAT;
    console.log(`${logPrefix} Executing handler: ${handlerName}`);

    const result = await handler(intent.params || {}, context);
    console.log(`${logPrefix} Handler result:`, JSON.stringify({ success: result.success, message: result.message }, null, 2));

    const response = {
      success: result.success,
      response: result.message,
      intent: intent.intent,
      data: result.data || null
    };

    console.log(`${logPrefix} === RESPONSE ===`);
    console.log(`${logPrefix} Success: ${result.success}`);
    console.log(`${logPrefix} Response: "${result.message}"`);
    console.log(`${logPrefix} =================`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`${logPrefix} === ERROR ===`);
    console.error(`${logPrefix} Error Name:`, error.name);
    console.error(`${logPrefix} Error Message:`, error.message);
    console.error(`${logPrefix} Error Stack:`, error.stack);
    console.error(`${logPrefix} ==============`);

    return NextResponse.json({
      success: false,
      response: "Sorry, something went wrong. Please try again."
    }, { status: 500 });
  }
}

// Also support GET for testing
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const userMessage = url.searchParams.get('text') || url.searchParams.get('message') || url.searchParams.get('q');

    if (!userMessage) {
      return NextResponse.json({
        success: false,
        response: "Please provide a 'text' or 'message' query parameter.",
        example: "/api/agent/webhook/smart?text=what are my tasks"
      });
    }

    // Reuse POST logic
    const context = await getContext();
    const intent = await detectIntent(userMessage, context);
    const handler = actionHandlers[intent.intent] || actionHandlers.GENERAL_CHAT;
    const result = await handler(intent.params || {}, context);

    return NextResponse.json({
      success: result.success,
      response: result.message,
      intent: intent.intent,
      data: result.data || null
    });

  } catch (error) {
    console.error('Smart webhook GET error:', error);
    return NextResponse.json({
      success: false,
      response: "Sorry, something went wrong. Please try again."
    }, { status: 500 });
  }
}
