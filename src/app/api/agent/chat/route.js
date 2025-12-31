import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateJSON, chat } from '@/lib/ai/gemini';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Conversation memory (in production, use Redis or database)
const conversationMemory = new Map();

// Pending action context (for multi-turn conversations)
const pendingActionContext = new Map();

// Helper to make internal API calls
async function apiCall(endpoint, method = 'GET', body = null, userId) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `coworkr_user_id=${userId}`,
      'x-internal-call': 'true',
      'x-coworkr-user-id': userId,
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error(`API call failed: ${endpoint}`, e);
    return null;
  }
}

// Get current context - fetch ALL data for accurate responses
async function getContext(userId) {
  const now = new Date();

  const [tasks, localEvents, googleEvents, projects, contacts, deals, accounts, teamUsers] = await Promise.all([
    apiCall('/api/tasks?limit=50', 'GET', null, userId),
    apiCall('/api/events?limit=20', 'GET', null, userId),
    apiCall('/api/calendar/events?days=7', 'GET', null, userId),
    apiCall('/api/projects?limit=20', 'GET', null, userId),
    apiCall('/api/contacts?limit=50', 'GET', null, userId),
    apiCall('/api/deals?limit=20', 'GET', null, userId),
    apiCall('/api/accounts?limit=20', 'GET', null, userId),
    apiCall('/api/team/users?includeWorkload=true', 'GET', null, userId),
  ]);

  // Combine local and Google Calendar events
  const allLocalEvents = (localEvents?.events || []).map(e => ({ ...e, source: 'local' }));
  const allGoogleEvents = (googleEvents?.events || []).map(e => ({ ...e, source: 'google' }));
  const combinedEvents = [...allGoogleEvents, ...allLocalEvents];

  return {
    currentDate: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    currentTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    tasks: tasks?.tasks || [],
    events: combinedEvents,
    projects: projects?.projects || [],
    contacts: contacts?.contacts || [],
    deals: deals?.deals || [],
    accounts: accounts?.accounts || [],
    teamMembers: teamUsers?.users || [],
  };
}

// Get conversation history
function getConversationHistory(userId) {
  return conversationMemory.get(userId) || [];
}

// Add to conversation history
function addToHistory(userId, role, content) {
  const history = getConversationHistory(userId);
  history.push({ role, content, timestamp: Date.now() });
  // Keep last 10 exchanges
  if (history.length > 20) history.shift();
  conversationMemory.set(userId, history);
}

// Action handlers
const actionHandlers = {
  async CREATE_TASK(params, userId) {
    // Validate required fields
    if (!params.title) {
      return { success: false, needsMoreInfo: "What's the task you want to create?" };
    }

    const result = await apiCall('/api/tasks', 'POST', {
      title: params.title,
      description: params.description,
      priority: params.priority || 'medium',
      dueDate: params.dueDate,
      projectId: params.projectId,
    }, userId);
    return result?.success ? { success: true, task: result.task } : { success: false };
  },

  async UPDATE_TASK(params, userId) {
    let taskId = params.taskId;

    // If we have a task title but no ID, look it up
    if (!taskId && params.taskTitle) {
      const tasksResult = await apiCall('/api/tasks', 'GET', null, userId);
      if (tasksResult?.tasks) {
        const searchTitle = params.taskTitle.toLowerCase();
        const matchedTask = tasksResult.tasks.find(t =>
          t.title.toLowerCase().includes(searchTitle) ||
          searchTitle.includes(t.title.toLowerCase())
        );
        if (matchedTask) {
          taskId = matchedTask.id;
        }
      }
    }

    if (!taskId) {
      return { success: false, error: 'Could not find the task' };
    }

    const result = await apiCall('/api/tasks', 'PUT', {
      id: taskId,
      ...params.updates,
    }, userId);
    return result?.success ? { success: true, task: result.task } : { success: false };
  },

  async COMPLETE_TASK(params, userId) {
    let taskId = params.taskId;

    // If we have a task title but no ID, look it up
    if (!taskId && params.taskTitle) {
      const tasksResult = await apiCall('/api/tasks', 'GET', null, userId);
      if (tasksResult?.tasks) {
        const searchTitle = params.taskTitle.toLowerCase();
        const matchedTask = tasksResult.tasks.find(t =>
          t.title.toLowerCase().includes(searchTitle) ||
          searchTitle.includes(t.title.toLowerCase())
        );
        if (matchedTask) {
          taskId = matchedTask.id;
        }
      }
    }

    if (!taskId) {
      return { success: false, error: 'Could not find the task' };
    }

    const result = await apiCall('/api/tasks', 'PUT', {
      id: taskId,
      status: 'done',
    }, userId);
    return result?.success ? { success: true } : { success: false };
  },

  async CREATE_EVENT(params, userId) {
    // Validate required fields
    if (!params.title) {
      return { success: false, needsMoreInfo: "What would you like to call this event?" };
    }
    if (!params.startTime) {
      return { success: false, needsMoreInfo: "When should this event be scheduled?" };
    }

    const eventData = {
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      attendees: params.attendees,
    };

    // Try Google Calendar first (will work if connected)
    let result = await apiCall('/api/calendar/events', 'POST', eventData, userId);

    // Fallback to local events if Google Calendar fails or not connected
    if (!result?.success) {
      result = await apiCall('/api/events', 'POST', eventData, userId);
    }

    return result?.success ? { success: true, event: result.event } : { success: false };
  },

  async UPDATE_EVENT(params, userId) {
    let eventId = params.eventId;
    let isGoogleEvent = false;
    console.log('UPDATE_EVENT called with params:', JSON.stringify(params));

    // If no event ID, try to find by title or time
    // Always search if we don't have an ID, regardless of params
    if (!eventId) {
      // Fetch from both Google Calendar and local events
      const [googleEventsResult, localEventsResult] = await Promise.all([
        apiCall('/api/calendar/events?days=7', 'GET', null, userId),
        apiCall('/api/events?limit=50', 'GET', null, userId),
      ]);

      const googleEvents = (googleEventsResult?.events || []).map(e => ({ ...e, isGoogle: true }));
      const localEvents = (localEventsResult?.events || []).map(e => ({ ...e, isGoogle: false }));
      const allEvents = [...googleEvents, ...localEvents];

      console.log('Fetched events for matching - Google:', googleEvents.length, 'Local:', localEvents.length);

      const searchTitle = params.eventTitle?.toLowerCase();
      const searchTime = params.eventTime ? new Date(params.eventTime) : null;

      console.log('Searching for - title:', searchTitle, 'time:', searchTime);

      // Try to match by title first, then by time
      let matchedEvent = null;

      // First pass: exact title match
      if (searchTitle) {
        matchedEvent = allEvents.find(e => e.title?.toLowerCase() === searchTitle);
        if (matchedEvent) {
          console.log('Exact title match:', matchedEvent.title);
        }
      }

      // Second pass: partial title match or time match
      if (!matchedEvent) {
        for (const e of allEvents) {
          // Match by title (partial match)
          if (searchTitle && e.title?.toLowerCase().includes(searchTitle)) {
            console.log('Matched by partial title:', e.title, 'isGoogle:', e.isGoogle);
            matchedEvent = e;
            break;
          }

          // Match by time - compare hours and day
          if (searchTime && e.startTime) {
            const eventTime = new Date(e.startTime);

            // Check if same day
            const sameDay = eventTime.toDateString() === searchTime.toDateString();

            // Check if same hour (allow 1 hour tolerance)
            const eventHour = eventTime.getHours();
            const searchHour = searchTime.getHours();
            const hourDiff = Math.abs(eventHour - searchHour);

            if (sameDay && hourDiff <= 1) {
              console.log('Matched by time:', e.title, 'at', eventTime.toISOString(), 'isGoogle:', e.isGoogle);
              matchedEvent = e;
              break;
            }
          }
        }
      }

      // Third pass: try common time patterns (6pm, 5pm, etc.) for today
      if (!matchedEvent && allEvents.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Try to extract hour from eventTime string if parsing failed
        let targetHour = searchTime ? searchTime.getHours() : null;

        // If no targetHour, try to find any event today
        if (targetHour !== null) {
          matchedEvent = allEvents.find(e => {
            if (!e.startTime) return false;
            const eventTime = new Date(e.startTime);
            const eventDay = new Date(eventTime);
            eventDay.setHours(0, 0, 0, 0);

            return eventDay.getTime() === today.getTime() && eventTime.getHours() === targetHour;
          });

          if (matchedEvent) {
            console.log('Matched by hour today:', matchedEvent.title, 'hour:', targetHour);
          }
        }

        // If still no match and we have a newTitle, check if it's NOT already an event
        // This handles "New Meeting title change to X" pattern
        if (!matchedEvent && params.newTitle) {
          // Find events today that are NOT the newTitle
          const todayEvents = allEvents.filter(e => {
            if (!e.startTime) return false;
            const eventTime = new Date(e.startTime);
            const eventDay = new Date(eventTime);
            eventDay.setHours(0, 0, 0, 0);
            return eventDay.getTime() === today.getTime();
          });

          console.log('Today events:', todayEvents.map(e => `${e.title} at ${new Date(e.startTime).getHours()}:00`));

          // If user mentioned "New Meeting" somewhere in their message, find it
          if (params.eventTitle) {
            matchedEvent = todayEvents.find(e =>
              e.title?.toLowerCase().includes(params.eventTitle.toLowerCase())
            );
          }

          // Last resort: find the 6pm event today (common pattern)
          if (!matchedEvent) {
            matchedEvent = todayEvents.find(e => {
              const eventTime = new Date(e.startTime);
              return eventTime.getHours() === 18; // 6pm
            });
            if (matchedEvent) {
              console.log('Found 6pm event as last resort:', matchedEvent.title);
            }
          }
        }
      }

      if (matchedEvent) {
        eventId = matchedEvent.id || matchedEvent.googleEventId;
        isGoogleEvent = matchedEvent.isGoogle;
        console.log('Found event to update:', matchedEvent.title, 'ID:', eventId, 'isGoogle:', isGoogleEvent);
      }
    }

    if (!eventId) {
      console.log('Could not find event to update');
      return { success: false, error: 'Could not find the event to update. Please specify the event name or time more precisely.' };
    }

    const updatePayload = {
      eventId: eventId,
      id: eventId, // For local events
      title: params.newTitle || params.updates?.title,
      ...params.updates,
    };
    console.log('Updating event with payload:', updatePayload, 'isGoogle:', isGoogleEvent);

    // Use appropriate API based on event source
    const endpoint = isGoogleEvent ? '/api/calendar/events' : '/api/events';
    const result = await apiCall(endpoint, 'PUT', updatePayload, userId);
    console.log('Update result:', result);

    return result?.success ? { success: true, event: result.event } : { success: false, error: result?.error || 'Failed to update event' };
  },

  async CREATE_PROJECT(params, userId) {
    // Validate required fields
    if (!params.name) {
      return { success: false, needsMoreInfo: "What's the name of this project?" };
    }

    const result = await apiCall('/api/projects', 'POST', {
      name: params.name,
      description: params.description,
      status: 'open',
      priority: params.priority || 'medium',
    }, userId);
    return result?.success ? { success: true, project: result.project } : { success: false };
  },

  async CREATE_CONTACT(params, userId) {
    // Validate required fields
    if (!params.firstName && !params.lastName && !params.email) {
      return { success: false, needsMoreInfo: "What's the contact's name and email?" };
    }

    const result = await apiCall('/api/contacts', 'POST', {
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      company: params.company,
    }, userId);
    return result?.success ? { success: true, contact: result.contact } : { success: false };
  },

  async CREATE_DEAL(params, userId) {
    // Validate required fields
    if (!params.name) {
      return { success: false, needsMoreInfo: "What's the name of this deal?" };
    }

    const result = await apiCall('/api/deals', 'POST', {
      name: params.name,
      value: params.value,
      stage: params.stage || 'lead',
      contactId: params.contactId,
    }, userId);
    return result?.success ? { success: true, deal: result.deal } : { success: false };
  },

  async QUERY_DATA(params, userId) {
    const endpoint = {
      tasks: '/api/tasks',
      events: '/api/events',
      projects: '/api/projects',
      contacts: '/api/contacts',
      deals: '/api/deals',
    }[params.dataType];

    if (!endpoint) return { success: false, data: [] };

    // Build query with default filters for common cases
    let query = '';
    if (params.filters) {
      query = `?${new URLSearchParams(params.filters)}`;
    } else if (params.dataType === 'tasks') {
      // Default to pending/open tasks
      query = '?status=pending&limit=20';
    } else if (params.dataType === 'events') {
      query = '?upcoming=true&limit=10';
    }

    const result = await apiCall(`${endpoint}${query}`, 'GET', null, userId);
    return { success: true, data: result?.[params.dataType] || result?.tasks || result?.events || [] };
  },

  // Team-related handlers
  async SCHEDULE_MEETING_WITH(params, userId, context) {
    // Find team member by name
    const teamMembers = context?.teamMembers || [];
    const attendeeNames = params.attendees || [params.attendeeName];

    if (!attendeeNames || attendeeNames.length === 0) {
      return { success: false, needsMoreInfo: "Who would you like to schedule the meeting with?" };
    }
    if (!params.title) {
      return { success: false, needsMoreInfo: "What would you like to call this meeting?" };
    }
    if (!params.startTime) {
      return { success: false, needsMoreInfo: "When should this meeting be scheduled?" };
    }

    // Match team member names to emails
    const attendeeEmails = [];
    const matchedMembers = [];

    for (const name of attendeeNames) {
      const searchName = name.toLowerCase();
      const member = teamMembers.find(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchName) ||
        m.firstName?.toLowerCase() === searchName ||
        m.lastName?.toLowerCase() === searchName
      );

      if (member) {
        attendeeEmails.push(member.email);
        matchedMembers.push(`${member.firstName} ${member.lastName}`);
      }
    }

    if (attendeeEmails.length === 0) {
      return { success: false, error: `Could not find team member(s): ${attendeeNames.join(', ')}` };
    }

    const eventData = {
      title: params.title,
      description: params.description || `Meeting with ${matchedMembers.join(', ')}`,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location || 'Google Meet',
      attendees: attendeeEmails,
    };

    // Try Google Calendar first
    let result = await apiCall('/api/calendar/events', 'POST', eventData, userId);
    if (!result?.success) {
      result = await apiCall('/api/events', 'POST', eventData, userId);
    }

    return result?.success
      ? { success: true, event: result.event, attendees: matchedMembers }
      : { success: false, error: 'Failed to create meeting' };
  },

  async CHECK_WORKLOAD(params, userId, context) {
    const teamMembers = context?.teamMembers || [];

    if (teamMembers.length === 0) {
      return { success: false, error: 'No team members found' };
    }

    // Sort by workload score (lower = less busy)
    const sortedMembers = [...teamMembers].sort((a, b) =>
      (a.workload?.score || 0) - (b.workload?.score || 0)
    );

    const workloadReport = sortedMembers.map(m => ({
      name: `${m.firstName} ${m.lastName}`,
      role: m.title || m.role,
      openTasks: m.workload?.openTasks || 0,
      highPriorityTasks: m.workload?.highPriorityTasks || 0,
      tasksDueToday: m.workload?.tasksDueToday || 0,
      workloadScore: m.workload?.score || 0,
    }));

    const leastBusy = workloadReport[0];
    const mostBusy = workloadReport[workloadReport.length - 1];

    return {
      success: true,
      workload: workloadReport,
      leastBusy,
      mostBusy,
      summary: `${leastBusy.name} has the lightest workload with ${leastBusy.openTasks} open tasks. ${mostBusy.name} is busiest with ${mostBusy.openTasks} open tasks.`,
    };
  },

  async ASSIGN_TASK(params, userId, context) {
    const teamMembers = context?.teamMembers || [];

    if (!params.title) {
      return { success: false, needsMoreInfo: "What's the task you want to assign?" };
    }
    if (!params.assigneeName) {
      return { success: false, needsMoreInfo: "Who should this task be assigned to?" };
    }

    // Find team member
    const searchName = params.assigneeName.toLowerCase();
    const assignee = teamMembers.find(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchName) ||
      m.firstName?.toLowerCase() === searchName ||
      m.lastName?.toLowerCase() === searchName
    );

    if (!assignee) {
      return { success: false, error: `Could not find team member: ${params.assigneeName}` };
    }

    // Create task in the assignee's task list
    const taskData = {
      title: params.title,
      description: params.description || '',
      priority: params.priority || 'medium',
      dueDate: params.dueDate,
      assignedTo: assignee.id,
      assignedBy: userId,
    };

    // Create in assignee's collection
    const result = await apiCall('/api/tasks', 'POST', taskData, assignee.id);

    return result?.success
      ? { success: true, task: result.task, assignedTo: `${assignee.firstName} ${assignee.lastName}` }
      : { success: false, error: 'Failed to create task' };
  },

  async GET_TEAM_TASKS(params, userId, context) {
    const teamMembers = context?.teamMembers || [];

    if (!params.memberName) {
      // Return all team tasks overview
      const teamTasksSummary = teamMembers.map(m => ({
        name: `${m.firstName} ${m.lastName}`,
        openTasks: m.workload?.openTasks || 0,
        highPriority: m.workload?.highPriorityTasks || 0,
      }));
      return { success: true, teamTasks: teamTasksSummary };
    }

    // Find specific team member
    const searchName = params.memberName.toLowerCase();
    const member = teamMembers.find(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchName) ||
      m.firstName?.toLowerCase() === searchName
    );

    if (!member) {
      return { success: false, error: `Could not find team member: ${params.memberName}` };
    }

    // Fetch their tasks
    const result = await apiCall('/api/tasks?limit=20', 'GET', null, member.id);
    const tasks = (result?.tasks || []).filter(t => t.status !== 'done' && t.status !== 'completed');

    return {
      success: true,
      memberName: `${member.firstName} ${member.lastName}`,
      tasks: tasks,
      taskCount: tasks.length,
    };
  },
};

// Detect intent with conversation context
async function detectIntent(message, context, conversationHistory) {
  const recentHistory = conversationHistory.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n');

  // Format events with times for matching
  const eventsWithTimes = context.events.slice(0, 10).map(e => {
    const time = e.startTime ? new Date(e.startTime).toLocaleString() : 'TBD';
    return `"${e.title}" at ${time}`;
  }).join('; ') || 'None';

  // Get today's date in ISO format for the prompt
  const todayDate = new Date();
  const todayISO = todayDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Format team members for context
  const teamMembersList = (context.teamMembers || []).map(m =>
    `${m.firstName} ${m.lastName} (${m.title || m.role})`
  ).join(', ') || 'None';

  const prompt = `You are analyzing a conversation with a CRM assistant. Determine the user's intent.

Current context:
- Today's date: ${todayISO} (${context.currentDate})
- Current time: ${context.currentTime}
- Pending tasks: ${context.tasks.slice(0, 5).map(t => `"${t.title}"`).join(', ') || 'None'}
- Calendar events today/upcoming: ${eventsWithTimes}
- Team members: ${teamMembersList}
- Projects: ${context.projects.length}, Contacts: ${context.contacts.length}, Deals: ${context.deals.length}

Recent conversation:
${recentHistory || '(Start of conversation)'}

User just said: "${message}"

Return JSON only:
{
  "intent": "QUERY|CREATE_TASK|UPDATE_TASK|COMPLETE_TASK|CREATE_EVENT|UPDATE_EVENT|CREATE_PROJECT|CREATE_CONTACT|CREATE_DEAL|SCHEDULE_MEETING_WITH|CHECK_WORKLOAD|ASSIGN_TASK|GET_TEAM_TASKS|GENERAL_CHAT|DAILY_SUMMARY|GREETING",
  "action": "same as intent for action intents",
  "params": { ... parameters for the action },
  "needsMoreInfo": false
}

PARAMETER FORMATS:
- COMPLETE_TASK: { "taskTitle": "task name to complete" }
- CREATE_TASK: { "title": "...", "description": "...", "priority": "high/medium/low", "dueDate": "ISO date" }
- CREATE_EVENT: { "title": "...", "startTime": "ISO datetime", "endTime": "ISO datetime", "location": "..." }
- UPDATE_EVENT: { "eventTitle": "current title", "eventTime": "ISO datetime", "newTitle": "new title" }

CRITICAL - ALWAYS ASK FOR MISSING REQUIRED INFO BEFORE ANY ACTION:
Before creating or updating anything, verify you have all required information. If missing, set needsMoreInfo.

REQUIRED FIELDS:
- CREATE_EVENT: title (REQUIRED), startTime (REQUIRED) - Ask: "What would you like to call this event?"
- CREATE_TASK: title (REQUIRED) - Ask: "What's the task you want to create?"
- CREATE_DEAL: name (REQUIRED), value (helpful) - Ask: "What's the name of this deal?"
- CREATE_CONTACT: firstName (REQUIRED), lastName (helpful) - Ask: "What's the contact's name?"
- CREATE_PROJECT: name (REQUIRED) - Ask: "What's the name of this project?"
- UPDATE_TASK: taskTitle (to identify) AND what to update - Ask if unclear
- UPDATE_EVENT: eventTitle OR eventTime (to identify) AND newTitle/updates - Ask if unclear
- COMPLETE_TASK: taskTitle (to identify which task) - Ask: "Which task should I mark as complete?"

EXAMPLES of asking for missing info:
- "create event today 5pm" -> { "intent": "CREATE_EVENT", "params": { "startTime": "..." }, "needsMoreInfo": "What would you like to call this event?" }
- "add a new task" -> { "intent": "CREATE_TASK", "params": {}, "needsMoreInfo": "What's the task you want to create?" }
- "create a deal" -> { "intent": "CREATE_DEAL", "params": {}, "needsMoreInfo": "What's the name of this deal and its value?" }
- "add contact" -> { "intent": "CREATE_CONTACT", "params": {}, "needsMoreInfo": "What's the contact's name and email?" }
- "update the meeting" -> { "intent": "UPDATE_EVENT", "params": {}, "needsMoreInfo": "Which meeting do you want to update, and what should I change?" }
- "complete task" -> { "intent": "COMPLETE_TASK", "params": {}, "needsMoreInfo": "Which task should I mark as complete?" }

CRITICAL RULES FOR UPDATE_EVENT:
When user wants to change/rename/update a meeting or event:
1. Set intent AND action to "UPDATE_EVENT"
2. In params, include:
   - eventTitle: the CURRENT name of the event (or partial match)
   - eventTime: the time of the event in ISO format (use today's date ${todayISO} if "today")
   - newTitle: the NEW name they want

EXAMPLES:
- "change today 6pm meeting to Product Review" ->
  { "intent": "UPDATE_EVENT", "action": "UPDATE_EVENT", "params": { "eventTime": "${todayISO}T18:00:00", "newTitle": "Product Review" } }
- "rename Team Sync to Sprint Planning" ->
  { "intent": "UPDATE_EVENT", "action": "UPDATE_EVENT", "params": { "eventTitle": "Team Sync", "newTitle": "Sprint Planning" } }
- "change the title of my 6pm meeting to Demo Call" ->
  { "intent": "UPDATE_EVENT", "action": "UPDATE_EVENT", "params": { "eventTime": "${todayISO}T18:00:00", "newTitle": "Demo Call" } }
- "New Meeting at 6pm title change to Product Review" ->
  { "intent": "UPDATE_EVENT", "action": "UPDATE_EVENT", "params": { "eventTitle": "New Meeting", "eventTime": "${todayISO}T18:00:00", "newTitle": "Product Review" } }
- "change meeting title of 6pm meeting to product review" ->
  { "intent": "UPDATE_EVENT", "action": "UPDATE_EVENT", "params": { "eventTime": "${todayISO}T18:00:00", "newTitle": "product review" } }

TEAM-RELATED INTENTS:
- SCHEDULE_MEETING_WITH: { "attendeeName": "John", "attendees": ["John", "Jane"], "title": "Meeting name", "startTime": "ISO datetime" }
- CHECK_WORKLOAD: {} (no params needed, returns all team workload)
- ASSIGN_TASK: { "title": "Task title", "assigneeName": "John", "priority": "high/medium/low", "dueDate": "ISO date" }
- GET_TEAM_TASKS: { "memberName": "John" } (optional - if empty, returns all team overview)

TEAM EXAMPLES:
- "schedule meeting with John Doe tomorrow at 2pm" ->
  { "intent": "SCHEDULE_MEETING_WITH", "action": "SCHEDULE_MEETING_WITH", "params": { "attendeeName": "John Doe", "startTime": "${new Date(todayDate.getTime() + 86400000).toISOString().split('T')[0]}T14:00:00" }, "needsMoreInfo": "What would you like to call this meeting?" }
- "set up a call with John and Jane tomorrow 3pm" ->
  { "intent": "SCHEDULE_MEETING_WITH", "action": "SCHEDULE_MEETING_WITH", "params": { "attendees": ["John", "Jane"], "startTime": "...", "needsMoreInfo": "What would you like to call this meeting?" } }
- "who has less workload" / "who is least busy" / "team workload" ->
  { "intent": "CHECK_WORKLOAD", "action": "CHECK_WORKLOAD", "params": {} }
- "assign task to Jane: Review the proposal" ->
  { "intent": "ASSIGN_TASK", "action": "ASSIGN_TASK", "params": { "title": "Review the proposal", "assigneeName": "Jane" } }
- "create task for John to update documentation" ->
  { "intent": "ASSIGN_TASK", "action": "ASSIGN_TASK", "params": { "title": "Update documentation", "assigneeName": "John" } }
- "create task for David" or "assign task to David" ->
  { "intent": "ASSIGN_TASK", "action": "ASSIGN_TASK", "params": { "assigneeName": "David" }, "needsMoreInfo": "What's the task you want to assign to David?" }
- "show John's tasks" / "what is John working on" ->
  { "intent": "GET_TEAM_TASKS", "action": "GET_TEAM_TASKS", "params": { "memberName": "John" } }
- "team tasks" / "show all tasks" ->
  { "intent": "GET_TEAM_TASKS", "action": "GET_TEAM_TASKS", "params": {} }

CRITICAL - FOLLOW-UP CONTEXT:
When the conversation history shows we asked for a task name for ASSIGN_TASK, and user provides a name:
- If previous assistant message asked "What's the task?" for ASSIGN_TASK to someone (e.g., David):
  User reply like "product review" should be: { "intent": "ASSIGN_TASK", "action": "ASSIGN_TASK", "params": { "title": "product review", "assigneeName": "David" } }
- ALWAYS check conversation history to maintain context about WHO the task is being assigned to

OTHER RULES:
- For "tomorrow", use date: ${new Date(todayDate.getTime() + 86400000).toISOString().split('T')[0]}
- For greetings (hi, hello, hey), use GREETING intent
- Don't ask for more info if you can infer it from context
- When scheduling meetings WITH team members, use SCHEDULE_MEETING_WITH not CREATE_EVENT`;

  try {
    return await generateJSON(prompt, 'Extract intent from natural speech.');
  } catch (e) {
    console.error('Intent detection failed:', e);
    return { intent: 'GENERAL_CHAT', action: null, params: {} };
  }
}

// Generate natural conversational response
async function generateResponse(message, context, intent, actionResult, conversationHistory) {
  const recentHistory = conversationHistory.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n');

  const systemPrompt = `You are Coworkr, a helpful AI assistant. Be direct and accurate.

CRITICAL RULES:
- ONLY state facts from the provided data - NEVER make up information
- When user asks for a LIST (tasks, deals, contacts, etc), provide the COMPLETE list from the data
- Include ALL relevant items, not just a summary or count
- For tasks: mention title, status, priority, and due date if available
- For deals: mention name, value, and stage
- For contacts: mention full name and company
- No markdown formatting, but you can use commas or "and" to separate items
- If data is empty, say "You don't have any [items]"

RESPONSE STYLE:
- Answer the question completely
- List ALL matching items when asked for lists
- Be thorough but not chatty
- Don't ask follow-up questions unless clarification is truly needed`;

  // Format ALL data with full details
  const formatTasksDetailed = (tasks) => {
    if (!tasks || tasks.length === 0) return 'No tasks';
    return tasks.map(t => {
      const dueDate = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'no due date';
      return `"${t.title}" (${t.status}, ${t.priority || 'medium'} priority, due: ${dueDate})`;
    }).join('; ');
  };

  const formatDealsDetailed = (deals) => {
    if (!deals || deals.length === 0) return 'No deals';
    return deals.map(d => `"${d.name}" ($${d.value || 0}, stage: ${d.stage})`).join('; ');
  };

  const formatContactsDetailed = (contacts) => {
    if (!contacts || contacts.length === 0) return 'No contacts';
    return contacts.map(c => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown';
      return `${name} (${c.company || 'no company'}, ${c.email || 'no email'})`;
    }).join('; ');
  };

  const formatProjectsDetailed = (projects) => {
    if (!projects || projects.length === 0) return 'No projects';
    return projects.map(p => `"${p.name}" (${p.status})`).join('; ');
  };

  const formatAccountsDetailed = (accounts) => {
    if (!accounts || accounts.length === 0) return 'No accounts';
    return accounts.map(a => `"${a.name}" (${a.industry || 'no industry'})`).join('; ');
  };

  const formatEventsDetailed = (events) => {
    if (!events || events.length === 0) return 'No upcoming events';
    return events.map(e => {
      const date = e.startTime ? new Date(e.startTime).toLocaleString() : 'TBD';
      return `"${e.title}" (${date})`;
    }).join('; ');
  };

  const allTasks = context.queryResults || context.tasks;
  const openTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'completed');
  const completedTasks = allTasks.filter(t => t.status === 'done' || t.status === 'completed');

  // Get today's date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tasksDueToday = openTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today.getTime();
  });

  const openDeals = (context.deals || []).filter(d => !['won', 'lost', 'closed'].includes(d.stage?.toLowerCase()));
  const wonDeals = (context.deals || []).filter(d => d.stage?.toLowerCase() === 'won');

  const userPrompt = `COMPLETE DATABASE FOR USER:
Today: ${context.currentDate}, ${context.currentTime}

TASKS:
- Open tasks (${openTasks.length}): ${formatTasksDetailed(openTasks)}
- Tasks due TODAY (${tasksDueToday.length}): ${formatTasksDetailed(tasksDueToday)}
- Completed tasks (${completedTasks.length}): ${completedTasks.length > 0 ? completedTasks.map(t => `"${t.title}"`).join(', ') : 'None'}

PROJECTS (${context.projects?.length || 0}): ${formatProjectsDetailed(context.projects)}

DEALS:
- Open deals (${openDeals.length}): ${formatDealsDetailed(openDeals)}
- Won deals (${wonDeals.length}): ${formatDealsDetailed(wonDeals)}

CONTACTS (${context.contacts?.length || 0}): ${formatContactsDetailed(context.contacts)}

ACCOUNTS (${context.accounts?.length || 0}): ${formatAccountsDetailed(context.accounts)}

EVENTS: ${formatEventsDetailed(context.events)}

TEAM MEMBERS (${context.teamMembers?.length || 0}): ${(context.teamMembers || []).map(m => {
    const workload = m.workload || {};
    return `${m.firstName} ${m.lastName} (${m.title || m.role}) - ${workload.openTasks || 0} open tasks, ${workload.highPriorityTasks || 0} high priority`;
  }).join('; ') || 'None'}

${recentHistory ? `Recent conversation:\n${recentHistory}` : ''}

User asked: "${message}"
${actionResult ? `Action result: ${actionResult.success ? 'SUCCESS - ' + JSON.stringify(actionResult.event || actionResult.task || actionResult) : 'FAILED - ' + (actionResult.error || 'Unknown error')}` : ''}

Provide a COMPLETE answer listing ALL relevant items. When user asks for tasks, deals, contacts, team members, or workload, list them ALL with details.`;

  try {
    const response = await chat(
      [{ role: 'user', content: userPrompt }],
      systemPrompt
    );
    // Clean up response for speech
    return response
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^["']|["']$/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    console.error('Response generation failed:', e);
    return "I'm here to help! What can I do for you?";
  }
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    let userId = cookieStore.get('coworkr_user_id')?.value;

    const body = await request.json();
    const { message, userId: bodyUserId, withVoice = false } = body;

    userId = userId || bodyUserId || 'demo-user';

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get conversation history
    const conversationHistory = getConversationHistory(userId);

    // Add user message to history
    addToHistory(userId, 'user', message);

    // Get current context
    const context = await getContext(userId);

    // Check for pending action context (from previous needsMoreInfo)
    const pendingContext = pendingActionContext.get(userId);

    // Detect intent with conversation context
    let intent = await detectIntent(message, context, conversationHistory);
    console.log('Intent detected:', intent);

    // If there's pending context and the new message seems like a follow-up (just a name/title)
    // merge the pending context
    if (pendingContext && pendingContext.intent) {
      const isSimpleFollowUp = !intent.intent || intent.intent === 'GENERAL_CHAT' || intent.intent === 'QUERY';
      const hasOnlyTitle = message.trim().split(/\s+/).length <= 6; // Simple response, not a new command

      if (isSimpleFollowUp || hasOnlyTitle) {
        console.log('Merging with pending context:', pendingContext);
        // Merge - user's message is likely the answer to what we asked
        if (pendingContext.intent === 'ASSIGN_TASK' && !pendingContext.params?.title) {
          intent = {
            intent: 'ASSIGN_TASK',
            action: 'ASSIGN_TASK',
            params: {
              ...pendingContext.params,
              title: message.trim(),
            }
          };
        } else if (pendingContext.intent === 'CREATE_TASK' && !pendingContext.params?.title) {
          intent = {
            intent: 'CREATE_TASK',
            action: 'CREATE_TASK',
            params: {
              ...pendingContext.params,
              title: message.trim(),
            }
          };
        } else if (pendingContext.intent === 'CREATE_EVENT' && !pendingContext.params?.title) {
          intent = {
            intent: 'CREATE_EVENT',
            action: 'CREATE_EVENT',
            params: {
              ...pendingContext.params,
              title: message.trim(),
            }
          };
        } else if (pendingContext.intent === 'SCHEDULE_MEETING_WITH' && !pendingContext.params?.title) {
          intent = {
            intent: 'SCHEDULE_MEETING_WITH',
            action: 'SCHEDULE_MEETING_WITH',
            params: {
              ...pendingContext.params,
              title: message.trim(),
            }
          };
        }
        // Clear pending context after using it
        pendingActionContext.delete(userId);
      }
    }

    // Execute action if needed
    let actionResult = null;
    const actions = [];

    // Use action if specified, otherwise use intent for action handlers
    const actionName = intent.action || intent.intent;
    if (actionName && actionHandlers[actionName]) {
      console.log('Executing action:', actionName, 'with params:', intent.params);
      // Pass context as third param for team-related handlers
      actionResult = await actionHandlers[actionName](intent.params || {}, userId, context);
      console.log('Action result:', actionResult);
      if (actionResult.success) {
        actions.push({ type: actionName, data: actionResult });
      }
    }

    // For query intents, refresh context to include latest data
    if (intent.intent === 'QUERY' && actionResult?.data?.length > 0) {
      // Add query results to context for response generation
      context.queryResults = actionResult.data;
    }

    // If more info needed from intent detection, ask for it
    if (intent.needsMoreInfo && typeof intent.needsMoreInfo === 'string') {
      // Save pending context for follow-up
      pendingActionContext.set(userId, {
        intent: intent.intent,
        action: intent.action,
        params: intent.params || {},
        timestamp: Date.now(),
      });
      console.log('Saved pending context:', pendingActionContext.get(userId));

      addToHistory(userId, 'assistant', intent.needsMoreInfo);
      return NextResponse.json({
        text: intent.needsMoreInfo,
        actions: [],
        audio: null,
      });
    }

    // If more info needed from action handler (validation failed), ask for it
    if (actionResult?.needsMoreInfo && typeof actionResult.needsMoreInfo === 'string') {
      // Save pending context for follow-up
      pendingActionContext.set(userId, {
        intent: intent.intent,
        action: intent.action,
        params: intent.params || {},
        timestamp: Date.now(),
      });
      console.log('Saved pending context from action:', pendingActionContext.get(userId));

      addToHistory(userId, 'assistant', actionResult.needsMoreInfo);
      return NextResponse.json({
        text: actionResult.needsMoreInfo,
        actions: [],
        audio: null,
      });
    }

    // Generate natural response
    const responseText = await generateResponse(message, context, intent, actionResult, conversationHistory);

    // Add assistant response to history
    addToHistory(userId, 'assistant', responseText);

    // Generate TTS if voice mode
    let audioBase64 = null;
    if (withVoice) {
      try {
        const ttsRes = await fetch(`${BASE_URL}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: responseText,
            voice: 'rachel', // Natural conversational voice
          }),
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          audioBase64 = ttsData.audio;
        }
      } catch (e) {
        console.error('TTS generation failed:', e);
      }
    }

    return NextResponse.json({
      messageId: uuidv4(),
      text: responseText,
      intent: intent.intent,
      actions,
      audio: audioBase64,
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', text: "Sorry, I didn't catch that. Could you try again?" },
      { status: 500 }
    );
  }
}
