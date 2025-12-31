/**
 * AI Orchestrator - Main control layer
 * Fetches real data from Calendar and Tasks, then responds with Gemini
 */

import { generateJSON, chat } from './gemini.js';
import {
  getSystemPrompt,
  getIntentPrompt,
  getGeneralChatPrompt,
  getDailySummaryPrompt,
} from './prompts.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory session store
const sessionMemory = new Map();

/**
 * Fetch calendar events for today
 */
async function fetchTodayEvents(userId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/events?days=1`, {
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.events || [];
    }
  } catch (e) {
    console.log('Could not fetch calendar:', e.message);
  }
  return [];
}

/**
 * Fetch tasks
 */
async function fetchTasks(userId, status = null) {
  try {
    const url = status
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks?status=${status}`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks`;
    const response = await fetch(url, {
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.tasks || [];
    }
  } catch (e) {
    console.log('Could not fetch tasks:', e.message);
  }
  return [];
}

/**
 * Create a new task
 */
async function createTask(userId, taskData) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
      body: JSON.stringify(taskData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Could not create task:', e.message);
  }
  return null;
}

/**
 * Create a calendar event
 */
async function createCalendarEvent(userId, eventData) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
      body: JSON.stringify(eventData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Could not create event:', e.message);
  }
  return null;
}

/**
 * Update a task
 */
async function updateTask(userId, taskId, updates) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
      body: JSON.stringify({ id: taskId, ...updates }),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Could not update task:', e.message);
  }
  return null;
}

/**
 * Delete a task
 */
async function deleteTask(userId, taskId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tasks?id=${taskId}`, {
      method: 'DELETE',
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Could not delete task:', e.message);
  }
  return null;
}

/**
 * Fetch projects
 */
async function fetchProjects(userId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/projects`, {
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.projects || [];
    }
  } catch (e) {
    console.log('Could not fetch projects:', e.message);
  }
  return [];
}

/**
 * Fetch contacts
 */
async function fetchContacts(userId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contacts`, {
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.contacts || [];
    }
  } catch (e) {
    console.log('Could not fetch contacts:', e.message);
  }
  return [];
}

/**
 * Fetch deals
 */
async function fetchDeals(userId) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/deals`, {
      headers: {
        Cookie: `coworkr_user_id=${userId}`,
        'x-internal-call': 'true',
        'x-coworkr-user-id': userId,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.deals || [];
    }
  } catch (e) {
    console.log('Could not fetch deals:', e.message);
  }
  return [];
}

/**
 * Format events for prompt
 */
function formatEventsForPrompt(events) {
  if (!events || events.length === 0) return 'No meetings scheduled';

  return events.map(e => {
    const start = new Date(e.startTime);
    const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `- ${e.title} at ${time}`;
  }).join('\n');
}

/**
 * Format tasks for prompt
 */
function formatTasksForPrompt(tasks) {
  if (!tasks || tasks.length === 0) return 'No tasks';

  return tasks.map(t => {
    const status = t.status === 'done' ? '✓' : '○';
    const due = t.dueDate ? ` (due: ${new Date(t.dueDate).toLocaleDateString()})` : '';
    return `${status} ${t.title}${due}`;
  }).join('\n');
}

/**
 * Extract action details from user message using AI
 */
async function extractActionDetails(userMessage, actionType, recentContext) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const prompts = {
    CREATE_TASK: `Extract task details from this conversation. Return JSON only.

Recent conversation:
${recentContext || 'None'}

User said: "${userMessage}"

Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.

Return this exact JSON format:
{
  "title": "task title (infer from context if user says 'create one' after discussing tasks)",
  "description": "",
  "priority": "medium",
  "dueDate": null
}

If user just says "create one" or "add a task" without details, use title "New task" or infer from recent conversation.`,

    CREATE_EVENT: `Extract calendar event details from this conversation. Return JSON only.

Recent conversation:
${recentContext || 'None'}

User said: "${userMessage}"

Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
Tomorrow is ${tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.

Return this exact JSON format:
{
  "title": "event title (infer from context, use 'New meeting' if unclear)",
  "description": "",
  "date": "YYYY-MM-DD format (use tomorrow's date if user says 'tomorrow')",
  "startTime": "HH:MM in 24h format (default to 10:00 if not specified)",
  "duration": 60
}

Calculate the actual date if user says "tomorrow", "next Monday", etc.`
  };

  try {
    const result = await generateJSON(prompts[actionType], 'You are a helpful assistant that extracts structured data from natural language.');
    return result;
  } catch (error) {
    console.error('Failed to extract action details:', error);
    return null;
  }
}

/**
 * Process a user message through the orchestrator
 */
export async function processMessage(userId, sessionId, userMessage, options = {}) {
  const { voiceMode = false } = options;
  const agent = { name: 'Coworkr' };
  const user = { name: 'User' };

  // Get session memory
  const memoryKey = `${userId}:${sessionId}`;
  let memory = sessionMemory.get(memoryKey) || { recentMessages: [] };

  // Fetch real data
  const [todayEvents, pendingTasks] = await Promise.all([
    fetchTodayEvents(userId),
    fetchTasks(userId, 'pending'),
  ]);

  // Build context with real data
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';

  const contextInfo = `
Current time: ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (${timeOfDay})
Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

TODAY'S CALENDAR:
${formatEventsForPrompt(todayEvents)}

PENDING TASKS:
${formatTasksForPrompt(pendingTasks)}
`.trim();

  const recentContext = memory.recentMessages
    ?.slice(-5)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  // Step 1: Detect intent and action
  let intent = { intent: 'GENERAL_CHAT', confidence: 0.8, action: null, params: {} };
  try {
    const intentPrompt = `Analyze this user message and determine their intent. Return JSON only.

Recent conversation:
${recentContext || 'None'}

User said: "${userMessage}"

Possible intents:
- GENERAL_CHAT: casual conversation, greetings
- DAILY_SUMMARY: asking for overview of day, "how's my day", "what do I have today"
- CALENDAR_REQUEST: asking about calendar/meetings/schedule
- TASK_REQUEST: asking about tasks, to-do items
- CREATE_TASK: wants to create/add a new task (includes "create one", "add a task", "remind me to")
- UPDATE_TASK: wants to update/modify an existing task
- COMPLETE_TASK: wants to mark a task as done/complete ("mark as done", "complete task", "finished")
- DELETE_TASK: wants to delete/remove a task
- CREATE_EVENT: wants to create/schedule a meeting or event
- QUERY_PROJECTS: asking about projects
- QUERY_CONTACTS: asking about contacts or people
- QUERY_DEALS: asking about deals or sales pipeline

Return this exact JSON format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.9,
  "action": null or action name if applicable,
  "params": {
    "taskTitle": "if mentioned - the task title to find/update",
    "newStatus": "if updating status",
    "query": "search term if looking for something specific"
  }
}

Important: If user says "create one" or "add one" after talking about tasks, the intent is CREATE_TASK.
If user says "mark X as done" or "complete X", the intent is COMPLETE_TASK with taskTitle in params.
If user says "create" or "schedule" with event/meeting context, the intent is CREATE_EVENT.`;

    intent = await generateJSON(intentPrompt, getSystemPrompt(agent.name, user.name));
  } catch (error) {
    console.error('Intent detection failed:', error);
  }

  let responseText = '';
  let actions = [];

  // Step 2: Handle actions based on intent
  const intentType = intent.intent || intent.action;

  if (intentType === 'CREATE_TASK') {
    const taskDetails = await extractActionDetails(userMessage, 'CREATE_TASK', recentContext);
    if (taskDetails && taskDetails.title) {
      const result = await createTask(userId, taskDetails);
      if (result && result.success) {
        responseText = `Done! I've created a task: "${taskDetails.title}".`;
        actions.push({ type: 'TASK_CREATED', data: result.task });
      } else {
        responseText = `I tried to create the task but something went wrong. Please try again.`;
      }
    } else {
      responseText = `What would you like the task to be called?`;
    }
  } else if (intentType === 'COMPLETE_TASK') {
    // Find task by title and mark as done
    const taskTitle = intent.params?.taskTitle;
    if (taskTitle) {
      const matchedTask = pendingTasks.find(t =>
        t.title.toLowerCase().includes(taskTitle.toLowerCase())
      );
      if (matchedTask) {
        const result = await updateTask(userId, matchedTask.id, { status: 'done' });
        if (result && result.success) {
          responseText = `Done! I've marked "${matchedTask.title}" as complete.`;
          actions.push({ type: 'TASK_COMPLETED', data: matchedTask });
        } else {
          responseText = `I couldn't complete that task. Please try again.`;
        }
      } else {
        responseText = `I couldn't find a task matching "${taskTitle}". Can you be more specific?`;
      }
    } else {
      responseText = `Which task would you like me to mark as complete?`;
    }
  } else if (intentType === 'DELETE_TASK') {
    const taskTitle = intent.params?.taskTitle;
    if (taskTitle) {
      const allTasks = await fetchTasks(userId);
      const matchedTask = allTasks.find(t =>
        t.title.toLowerCase().includes(taskTitle.toLowerCase())
      );
      if (matchedTask) {
        const result = await deleteTask(userId, matchedTask.id);
        if (result && result.success) {
          responseText = `Done! I've deleted the task "${matchedTask.title}".`;
          actions.push({ type: 'TASK_DELETED', data: matchedTask });
        } else {
          responseText = `I couldn't delete that task. Please try again.`;
        }
      } else {
        responseText = `I couldn't find a task matching "${taskTitle}".`;
      }
    } else {
      responseText = `Which task would you like me to delete?`;
    }
  } else if (intentType === 'CREATE_EVENT') {
    const eventDetails = await extractActionDetails(userMessage, 'CREATE_EVENT', recentContext);
    if (eventDetails && eventDetails.title && eventDetails.date) {
      // Build the start and end times
      const startTime = eventDetails.startTime || '10:00';
      const duration = eventDetails.duration || 60;
      const startDateTime = new Date(`${eventDetails.date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      const result = await createCalendarEvent(userId, {
        title: eventDetails.title,
        description: eventDetails.description || '',
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      if (result && result.success) {
        const dateStr = startDateTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const timeStr = startDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        responseText = `Done! I've scheduled "${eventDetails.title}" for ${dateStr} at ${timeStr}.`;
        actions.push({ type: 'EVENT_CREATED', data: result.event });
      } else {
        responseText = `I couldn't create the event. Make sure your Google Calendar is connected.`;
      }
    } else {
      responseText = `What would you like to schedule? Please tell me the event name and when.`;
    }
  } else if (intentType === 'QUERY_PROJECTS') {
    const projects = await fetchProjects(userId);
    if (projects.length > 0) {
      const projectList = projects.slice(0, 5).map(p => `- ${p.name} (${p.status})`).join('\n');
      responseText = `You have ${projects.length} project${projects.length > 1 ? 's' : ''}:\n${projectList}`;
    } else {
      responseText = `You don't have any projects yet.`;
    }
  } else if (intentType === 'QUERY_CONTACTS') {
    const contacts = await fetchContacts(userId);
    if (contacts.length > 0) {
      const contactList = contacts.slice(0, 5).map(c => `- ${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ''}`).join('\n');
      responseText = `You have ${contacts.length} contact${contacts.length > 1 ? 's' : ''}:\n${contactList}`;
    } else {
      responseText = `You don't have any contacts yet.`;
    }
  } else if (intentType === 'QUERY_DEALS') {
    const deals = await fetchDeals(userId);
    if (deals.length > 0) {
      const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
      const dealList = deals.slice(0, 5).map(d => `- ${d.name}: $${d.value?.toLocaleString() || 0} (${d.stage})`).join('\n');
      responseText = `You have ${deals.length} deal${deals.length > 1 ? 's' : ''} worth $${totalValue.toLocaleString()} total:\n${dealList}`;
    } else {
      responseText = `You don't have any deals yet.`;
    }
  } else if (intentType === 'DAILY_SUMMARY') {
    const meetingCount = todayEvents.length;
    const taskCount = pendingTasks.length;

    let summary = `Good ${timeOfDay}! Here's your day at a glance:\n\n`;

    if (meetingCount > 0) {
      summary += `📅 ${meetingCount} meeting${meetingCount > 1 ? 's' : ''} today:\n${formatEventsForPrompt(todayEvents)}\n\n`;
    } else {
      summary += `📅 No meetings scheduled today.\n\n`;
    }

    if (taskCount > 0) {
      summary += `✅ ${taskCount} pending task${taskCount > 1 ? 's' : ''}:\n${formatTasksForPrompt(pendingTasks.slice(0, 5))}`;
    } else {
      summary += `✅ No pending tasks. You're all caught up!`;
    }

    responseText = summary;
  } else {
    // Step 3: Generate conversational response
    const fullPrompt = `You are ${agent.name}, a friendly voice assistant.

${contextInfo}

Recent conversation:
${recentContext || 'None'}

User said: "${userMessage}"

INSTRUCTIONS:
- Keep response SHORT (1-2 sentences) - this will be spoken aloud
- Use the REAL data above when answering about meetings or tasks
- If they ask about meetings/calendar, use TODAY'S CALENDAR data
- If they ask about tasks, use PENDING TASKS data
- Be conversational and friendly
- NEVER say you are "still getting set up" or "not able to access" data
- If calendar shows "No meetings scheduled", say "You don't have any meetings scheduled today"
- If tasks shows "No tasks", say "You don't have any pending tasks"
- You CAN create tasks and events - if user wants to create something, confirm you can help

Respond naturally:`;

    try {
      responseText = await chat(
        [{ role: 'user', content: fullPrompt }],
        getSystemPrompt(agent.name, user.name)
      );
    } catch (error) {
      console.error('Chat error:', error);
      responseText = "Sorry, I had a brief issue. Could you try again?";
    }
  }

  // Clean up response
  responseText = responseText
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();

  // Step 4: Update session memory
  memory.recentMessages = [
    ...(memory.recentMessages || []).slice(-9),
    { role: 'user', content: userMessage },
    { role: 'agent', content: responseText },
  ];
  sessionMemory.set(memoryKey, memory);

  const messageId = uuidv4();

  return {
    messageId,
    text: responseText,
    voiceText: responseText,
    intent: intent.intent,
    confidence: intent.confidence,
    actions,
    context: {
      eventsCount: todayEvents.length,
      tasksCount: pendingTasks.length,
    },
  };
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(userId, sessionId, limit = 20) {
  const memoryKey = `${userId}:${sessionId}`;
  const memory = sessionMemory.get(memoryKey) || { recentMessages: [] };
  return memory.recentMessages.slice(-limit);
}

export default {
  processMessage,
  getConversationHistory,
};
