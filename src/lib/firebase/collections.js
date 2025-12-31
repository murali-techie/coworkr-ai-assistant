/**
 * Firebase Collections Schema
 * Complete data model for CRM/Productivity app
 */

import { adminDb } from './admin';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  EVENTS: 'events',
  CONTACTS: 'contacts',
  DEALS: 'deals',
  ACCOUNTS: 'accounts',
  ACTIVITIES: 'activities',
  TIME_ENTRIES: 'timeEntries',
  DOCUMENTS: 'documents',
  NOTES: 'notes',
};

// Helper to get user-scoped collections
export const getUserCollection = (userId, collection) => {
  return adminDb.collection(COLLECTIONS.USERS).doc(userId).collection(collection);
};

// Collection references
export const db = {
  // Users
  users: () => adminDb.collection(COLLECTIONS.USERS),
  user: (userId) => adminDb.collection(COLLECTIONS.USERS).doc(userId),

  // Projects (user-scoped)
  projects: (userId) => getUserCollection(userId, COLLECTIONS.PROJECTS),
  project: (userId, projectId) => getUserCollection(userId, COLLECTIONS.PROJECTS).doc(projectId),

  // Tasks (user-scoped)
  tasks: (userId) => getUserCollection(userId, COLLECTIONS.TASKS),
  task: (userId, taskId) => getUserCollection(userId, COLLECTIONS.TASKS).doc(taskId),

  // Calendar Events (user-scoped)
  events: (userId) => getUserCollection(userId, COLLECTIONS.EVENTS),
  event: (userId, eventId) => getUserCollection(userId, COLLECTIONS.EVENTS).doc(eventId),

  // Contacts (user-scoped)
  contacts: (userId) => getUserCollection(userId, COLLECTIONS.CONTACTS),
  contact: (userId, contactId) => getUserCollection(userId, COLLECTIONS.CONTACTS).doc(contactId),

  // Deals (user-scoped)
  deals: (userId) => getUserCollection(userId, COLLECTIONS.DEALS),
  deal: (userId, dealId) => getUserCollection(userId, COLLECTIONS.DEALS).doc(dealId),

  // Accounts/Companies (user-scoped)
  accounts: (userId) => getUserCollection(userId, COLLECTIONS.ACCOUNTS),
  account: (userId, accountId) => getUserCollection(userId, COLLECTIONS.ACCOUNTS).doc(accountId),

  // Activities (user-scoped)
  activities: (userId) => getUserCollection(userId, COLLECTIONS.ACTIVITIES),
  activity: (userId, activityId) => getUserCollection(userId, COLLECTIONS.ACTIVITIES).doc(activityId),

  // Time Entries (user-scoped)
  timeEntries: (userId) => getUserCollection(userId, COLLECTIONS.TIME_ENTRIES),
  timeEntry: (userId, entryId) => getUserCollection(userId, COLLECTIONS.TIME_ENTRIES).doc(entryId),

  // Documents for RAG (user-scoped)
  documents: (userId) => getUserCollection(userId, COLLECTIONS.DOCUMENTS),
  document: (userId, docId) => getUserCollection(userId, COLLECTIONS.DOCUMENTS).doc(docId),

  // Notes (user-scoped)
  notes: (userId) => getUserCollection(userId, COLLECTIONS.NOTES),
  note: (userId, noteId) => getUserCollection(userId, COLLECTIONS.NOTES).doc(noteId),
};

// Data schemas (for reference)
export const SCHEMAS = {
  user: {
    id: 'string',
    email: 'string',
    name: 'string',
    avatar: 'string',
    phone: 'string',
    company: 'string',
    role: 'string',
    timezone: 'string',
    googleCalendarConnected: 'boolean',
    googleCalendarTokens: 'object',
    preferences: {
      theme: 'light|dark',
      voiceGender: 'male|female',
      notifications: 'boolean',
    },
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  project: {
    id: 'string',
    name: 'string',
    description: 'string',
    status: 'open|in_progress|completed|on_hold',
    priority: 'low|medium|high|urgent',
    startDate: 'timestamp',
    endDate: 'timestamp',
    budget: 'number',
    clientId: 'string', // reference to account
    teamMembers: 'array',
    tags: 'array',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  task: {
    id: 'string',
    title: 'string',
    description: 'string',
    status: 'todo|in_progress|done|cancelled',
    priority: 'low|medium|high|urgent',
    projectId: 'string',
    assignedTo: 'string',
    dueDate: 'timestamp',
    dueTime: 'string',
    estimatedHours: 'number',
    actualHours: 'number',
    tags: 'array',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
    completedAt: 'timestamp',
  },

  event: {
    id: 'string',
    title: 'string',
    description: 'string',
    type: 'meeting|call|reminder|deadline|other',
    startTime: 'timestamp',
    endTime: 'timestamp',
    allDay: 'boolean',
    location: 'string',
    attendees: 'array',
    googleEventId: 'string',
    recurring: 'boolean',
    recurrenceRule: 'string',
    reminders: 'array',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  contact: {
    id: 'string',
    firstName: 'string',
    lastName: 'string',
    email: 'string',
    phone: 'string',
    company: 'string',
    accountId: 'string',
    position: 'string',
    avatar: 'string',
    tags: 'array',
    notes: 'string',
    socialLinks: 'object',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  deal: {
    id: 'string',
    name: 'string',
    value: 'number',
    currency: 'string',
    stage: 'lead|qualified|proposal|negotiation|won|lost',
    probability: 'number',
    contactId: 'string',
    accountId: 'string',
    expectedCloseDate: 'timestamp',
    actualCloseDate: 'timestamp',
    notes: 'string',
    tags: 'array',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  account: {
    id: 'string',
    name: 'string',
    industry: 'string',
    website: 'string',
    phone: 'string',
    email: 'string',
    address: 'object',
    size: 'string',
    revenue: 'number',
    type: 'prospect|customer|partner|vendor',
    tags: 'array',
    notes: 'string',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
  },

  activity: {
    id: 'string',
    type: 'call|email|meeting|note|task_completed|deal_update',
    title: 'string',
    description: 'string',
    relatedTo: 'object', // { type: 'contact|deal|project', id: 'string' }
    duration: 'number', // minutes
    outcome: 'string',
    createdAt: 'timestamp',
  },

  timeEntry: {
    id: 'string',
    taskId: 'string',
    projectId: 'string',
    description: 'string',
    startTime: 'timestamp',
    endTime: 'timestamp',
    duration: 'number', // minutes
    billable: 'boolean',
    hourlyRate: 'number',
    createdAt: 'timestamp',
  },
};

export default db;
