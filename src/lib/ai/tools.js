/**
 * Tool definitions and execution for AI orchestrator
 */

import { collections, adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { startOfDay, endOfDay, addDays, parseISO, format } from 'date-fns';
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent } from '@/lib/calendar/google';
import { searchDocuments } from '@/lib/rag/retriever';

/**
 * Tool definitions for Gemini function calling
 */
export const TOOL_DEFINITIONS = {
  QUERY_DAY: {
    name: 'query_day',
    description: 'Get a summary of tasks and calendar events for today',
    parameters: {},
  },
  CREATE_TASK: {
    name: 'create_task',
    description: 'Create a new task',
    parameters: {
      title: { type: 'string', required: true },
      description: { type: 'string', required: false },
      dueDate: { type: 'string', required: false },
      dueTime: { type: 'string', required: false },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], required: false },
    },
  },
  UPDATE_TASK: {
    name: 'update_task',
    description: 'Update an existing task',
    parameters: {
      taskId: { type: 'string', required: true },
      updates: { type: 'object', required: true },
    },
  },
  DELETE_TASK: {
    name: 'delete_task',
    description: 'Delete a task',
    parameters: {
      taskId: { type: 'string', required: true },
    },
  },
  LIST_TASKS: {
    name: 'list_tasks',
    description: 'List all tasks or filter by status',
    parameters: {
      status: { type: 'string', enum: ['pending', 'in_progress', 'done'], required: false },
      limit: { type: 'number', required: false },
    },
  },
  CREATE_MEETING: {
    name: 'create_meeting',
    description: 'Create a calendar event',
    parameters: {
      title: { type: 'string', required: true },
      startTime: { type: 'string', required: true },
      endTime: { type: 'string', required: false },
      description: { type: 'string', required: false },
      attendees: { type: 'array', required: false },
    },
  },
  UPDATE_MEETING: {
    name: 'update_meeting',
    description: 'Update a calendar event',
    parameters: {
      eventId: { type: 'string', required: true },
      updates: { type: 'object', required: true },
    },
  },
  LIST_MEETINGS: {
    name: 'list_meetings',
    description: 'List calendar events',
    parameters: {
      date: { type: 'string', required: false },
      days: { type: 'number', required: false },
    },
  },
  QUERY_RAG: {
    name: 'query_rag',
    description: 'Search uploaded documents for information',
    parameters: {
      query: { type: 'string', required: true },
    },
  },
};

/**
 * Execute a tool based on intent
 */
export async function executeTool(intent, entities, userId) {
  const now = new Date();

  switch (intent) {
    case 'QUERY_DAY':
      return await queryDay(userId);

    case 'CREATE_TASK':
      return await createTask(userId, entities);

    case 'UPDATE_TASK':
      return await updateTask(userId, entities.taskId, entities.updates);

    case 'DELETE_TASK':
      return await deleteTask(userId, entities.taskId);

    case 'LIST_TASKS':
      return await listTasks(userId, entities.status, entities.limit);

    case 'CREATE_MEETING':
      return await createMeeting(userId, entities);

    case 'UPDATE_MEETING':
      return await updateMeeting(userId, entities.eventId, entities.updates);

    case 'LIST_MEETINGS':
      return await listMeetings(userId, entities.date, entities.days);

    case 'QUERY_RAG':
      return await queryRAG(userId, entities.query);

    default:
      return { success: false, error: 'Unknown intent' };
  }
}

/**
 * Query day - get tasks and calendar summary
 */
async function queryDay(userId) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  // Get today's tasks
  const tasksSnapshot = await collections.tasks(userId)
    .where('status', 'in', ['pending', 'in_progress'])
    .get();

  const tasks = tasksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Get today's events
  const events = await getCalendarEvents(userId, dayStart, dayEnd);

  // Get task summary
  const allTasksSnapshot = await collections.tasks(userId).get();
  const allTasks = allTasksSnapshot.docs.map(doc => doc.data());

  const summary = {
    tasks: {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      done: allTasks.filter(t => t.status === 'done').length,
    },
    todaysTasks: tasks.filter(t => {
      if (!t.dueDate) return false;
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due >= dayStart && due <= dayEnd;
    }),
    todaysEvents: events,
    nextEvent: events.length > 0 ? events[0] : null,
  };

  return {
    success: true,
    data: summary,
  };
}

/**
 * Create a new task
 */
async function createTask(userId, data) {
  const taskId = uuidv4();
  const now = new Date();

  const task = {
    id: taskId,
    userId,
    title: data.title,
    description: data.description || null,
    status: 'pending',
    priority: data.priority || 'medium',
    dueDate: data.dueDate ? parseISO(data.dueDate) : null,
    dueTime: data.dueTime || null,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  await collections.task(userId, taskId).set(task);

  return {
    success: true,
    data: task,
    message: `Task "${task.title}" created successfully`,
  };
}

/**
 * Update a task
 */
async function updateTask(userId, taskId, updates) {
  const taskRef = collections.task(userId, taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    return { success: false, error: 'Task not found' };
  }

  const updateData = {
    ...updates,
    updatedAt: new Date(),
  };

  if (updates.status === 'done') {
    updateData.completedAt = new Date();
  }

  if (updates.dueDate) {
    updateData.dueDate = parseISO(updates.dueDate);
  }

  await taskRef.update(updateData);

  return {
    success: true,
    data: { id: taskId, ...taskDoc.data(), ...updateData },
    message: 'Task updated successfully',
  };
}

/**
 * Delete a task
 */
async function deleteTask(userId, taskId) {
  const taskRef = collections.task(userId, taskId);
  const taskDoc = await taskRef.get();

  if (!taskDoc.exists) {
    return { success: false, error: 'Task not found' };
  }

  const taskData = taskDoc.data();
  await taskRef.delete();

  return {
    success: true,
    data: { id: taskId },
    message: `Task "${taskData.title}" deleted`,
  };
}

/**
 * List tasks
 */
async function listTasks(userId, status = null, limit = 20) {
  let query = collections.tasks(userId);

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snapshot = await query.get();
  const tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    success: true,
    data: tasks,
  };
}

/**
 * Create a calendar meeting
 */
async function createMeeting(userId, data) {
  const event = await createCalendarEvent(userId, {
    summary: data.title,
    description: data.description,
    start: { dateTime: data.startTime },
    end: { dateTime: data.endTime || addHours(data.startTime, 1) },
    attendees: data.attendees?.map(email => ({ email })),
  });

  return {
    success: true,
    data: event,
    message: `Meeting "${data.title}" scheduled`,
  };
}

function addHours(dateString, hours) {
  const date = new Date(dateString);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * Update a calendar meeting
 */
async function updateMeeting(userId, eventId, updates) {
  const event = await updateCalendarEvent(userId, eventId, updates);

  return {
    success: true,
    data: event,
    message: 'Meeting updated',
  };
}

/**
 * List calendar meetings
 */
async function listMeetings(userId, date = null, days = 1) {
  const start = date ? startOfDay(parseISO(date)) : startOfDay(new Date());
  const end = endOfDay(addDays(start, days - 1));

  const events = await getCalendarEvents(userId, start, end);

  return {
    success: true,
    data: events,
  };
}

/**
 * Query RAG (knowledge base)
 */
async function queryRAG(userId, query) {
  const results = await searchDocuments(userId, query);

  return {
    success: true,
    data: results,
  };
}

export default {
  TOOL_DEFINITIONS,
  executeTool,
};
