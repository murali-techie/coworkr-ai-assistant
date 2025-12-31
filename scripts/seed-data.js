/**
 * Seed script for Coworkr - Populates Firestore with sample data
 * Run with: node scripts/seed-data.js
 */

require('dotenv').config({ path: '.env.local' });

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = getFirestore(app);

// Team configuration
const TEAM_ID = 'demo-team';

// Team Users - Admin and 5 team members
const TEAM_USERS = [
  {
    id: 'demo-user-001',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex@coworkr.com',
    role: 'admin',
    title: 'CEO & Founder',
    department: 'Executive',
    avatar: null,
    status: 'active',
  },
  {
    id: 'john-doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@coworkr.com',
    role: 'manager',
    title: 'Sales Manager',
    department: 'Sales',
    avatar: null,
    status: 'active',
  },
  {
    id: 'jane-smith',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@coworkr.com',
    role: 'member',
    title: 'Senior Developer',
    department: 'Engineering',
    avatar: null,
    status: 'active',
  },
  {
    id: 'mike-johnson',
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike@coworkr.com',
    role: 'member',
    title: 'Product Designer',
    department: 'Design',
    avatar: null,
    status: 'active',
  },
  {
    id: 'sarah-wilson',
    firstName: 'Sarah',
    lastName: 'Wilson',
    email: 'sarah@coworkr.com',
    role: 'member',
    title: 'Marketing Lead',
    department: 'Marketing',
    avatar: null,
    status: 'active',
  },
  {
    id: 'david-lee',
    firstName: 'David',
    lastName: 'Lee',
    email: 'david@coworkr.com',
    role: 'member',
    title: 'Account Executive',
    department: 'Sales',
    avatar: null,
    status: 'active',
  },
];

// Helper to add days to current date
const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Helper to subtract days from current date
const subDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// Sample Data
const ACCOUNTS = [
  {
    name: 'Acme Corporation',
    industry: 'Technology',
    website: 'https://acme.com',
    phone: '+1 (555) 123-4567',
    email: 'contact@acme.com',
    type: 'customer',
    size: '500-1000',
    revenue: '$50M-100M',
    tags: ['enterprise', 'tech'],
    notes: 'Key strategic partner for Q1 initiatives',
  },
  {
    name: 'TechStart Inc',
    industry: 'SaaS',
    website: 'https://techstart.io',
    phone: '+1 (555) 234-5678',
    email: 'hello@techstart.io',
    type: 'prospect',
    size: '50-100',
    revenue: '$5M-10M',
    tags: ['startup', 'saas'],
    notes: 'Fast-growing startup looking for AI solutions',
  },
  {
    name: 'Global Industries Ltd',
    industry: 'Manufacturing',
    website: 'https://globalind.com',
    phone: '+1 (555) 345-6789',
    email: 'info@globalind.com',
    type: 'customer',
    size: '1000+',
    revenue: '$100M+',
    tags: ['enterprise', 'manufacturing'],
    notes: 'Long-term customer, potential for upsell',
  },
  {
    name: 'Innovate Labs',
    industry: 'Research',
    website: 'https://innovatelabs.co',
    phone: '+1 (555) 456-7890',
    email: 'research@innovatelabs.co',
    type: 'lead',
    size: '10-50',
    revenue: '$1M-5M',
    tags: ['research', 'innovation'],
    notes: 'Interested in AI research collaboration',
  },
  {
    name: 'Metro Finance Group',
    industry: 'Financial Services',
    website: 'https://metrofinance.com',
    phone: '+1 (555) 567-8901',
    email: 'partners@metrofinance.com',
    type: 'prospect',
    size: '200-500',
    revenue: '$20M-50M',
    tags: ['finance', 'compliance'],
    notes: 'Needs compliance-ready AI solution',
  },
];

const CONTACTS = [
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@acme.com',
    phone: '+1 (555) 111-2222',
    company: 'Acme Corporation',
    position: 'VP of Engineering',
    tags: ['decision-maker', 'technical'],
    notes: 'Primary technical contact, prefers email',
  },
  {
    firstName: 'Michael',
    lastName: 'Rodriguez',
    email: 'michael@techstart.io',
    phone: '+1 (555) 222-3333',
    company: 'TechStart Inc',
    position: 'CEO',
    tags: ['decision-maker', 'executive'],
    notes: 'Founder, very interested in AI automation',
  },
  {
    firstName: 'Emily',
    lastName: 'Thompson',
    email: 'ethompson@globalind.com',
    phone: '+1 (555) 333-4444',
    company: 'Global Industries Ltd',
    position: 'Director of Operations',
    tags: ['operations', 'procurement'],
    notes: 'Handles vendor relationships',
  },
  {
    firstName: 'David',
    lastName: 'Kim',
    email: 'david.kim@innovatelabs.co',
    phone: '+1 (555) 444-5555',
    company: 'Innovate Labs',
    position: 'Research Director',
    tags: ['technical', 'research'],
    notes: 'PhD in Machine Learning, strong technical background',
  },
  {
    firstName: 'Jessica',
    lastName: 'Martinez',
    email: 'jmartinez@metrofinance.com',
    phone: '+1 (555) 555-6666',
    company: 'Metro Finance Group',
    position: 'Chief Technology Officer',
    tags: ['decision-maker', 'technical', 'finance'],
    notes: 'Looking for secure AI solutions',
  },
  {
    firstName: 'James',
    lastName: 'Wilson',
    email: 'jwilson@acme.com',
    phone: '+1 (555) 666-7777',
    company: 'Acme Corporation',
    position: 'Product Manager',
    tags: ['product', 'technical'],
    notes: 'Secondary contact for implementation',
  },
];

// Deals with assignedTo
const DEALS = [
  {
    name: 'Acme Enterprise License',
    value: 150000,
    currency: 'USD',
    stage: 'negotiation',
    probability: 75,
    expectedCloseDate: addDays(30),
    notes: 'Annual enterprise license with premium support',
    tags: ['enterprise', 'high-value'],
    assignedTo: 'john-doe',
  },
  {
    name: 'TechStart Pilot Program',
    value: 25000,
    currency: 'USD',
    stage: 'proposal',
    probability: 50,
    expectedCloseDate: addDays(14),
    notes: '3-month pilot with potential for expansion',
    tags: ['pilot', 'startup'],
    assignedTo: 'david-lee',
  },
  {
    name: 'Global Industries Expansion',
    value: 200000,
    currency: 'USD',
    stage: 'won',
    probability: 100,
    expectedCloseDate: subDays(5),
    notes: 'Expanded from 5 to 20 seats',
    tags: ['expansion', 'enterprise'],
    assignedTo: 'john-doe',
  },
  {
    name: 'Metro Finance Security Package',
    value: 80000,
    currency: 'USD',
    stage: 'lead',
    probability: 20,
    expectedCloseDate: addDays(60),
    notes: 'Interested in compliance-ready solution',
    tags: ['security', 'finance'],
    assignedTo: 'david-lee',
  },
  {
    name: 'Innovate Labs Research Partnership',
    value: 50000,
    currency: 'USD',
    stage: 'qualification',
    probability: 30,
    expectedCloseDate: addDays(45),
    notes: 'Joint research initiative proposal',
    tags: ['research', 'partnership'],
    assignedTo: 'demo-user-001',
  },
];

const PROJECTS = [
  {
    name: 'Q1 Product Launch',
    description: 'Launch new AI assistant features',
    status: 'in-progress',
    priority: 'high',
    startDate: subDays(30),
    endDate: addDays(30),
    budget: 50000,
    tags: ['product', 'launch'],
  },
  {
    name: 'Customer Portal Redesign',
    description: 'Modernize the customer dashboard UI',
    status: 'in-progress',
    priority: 'medium',
    startDate: subDays(14),
    endDate: addDays(45),
    budget: 25000,
    tags: ['design', 'frontend'],
  },
  {
    name: 'API v2 Development',
    description: 'Build next generation REST API',
    status: 'open',
    priority: 'high',
    startDate: addDays(7),
    endDate: addDays(90),
    budget: 75000,
    tags: ['backend', 'api'],
  },
  {
    name: 'Security Audit 2025',
    description: 'Annual security compliance review',
    status: 'completed',
    priority: 'high',
    startDate: subDays(60),
    endDate: subDays(10),
    budget: 15000,
    tags: ['security', 'compliance'],
  },
  {
    name: 'Mobile App Beta',
    description: 'iOS and Android mobile app development',
    status: 'open',
    priority: 'medium',
    startDate: addDays(14),
    endDate: addDays(120),
    budget: 100000,
    tags: ['mobile', 'app'],
  },
];

// Tasks distributed among team members with assignedTo
const TASKS_BY_USER = {
  'demo-user-001': [
    {
      title: 'Review Q1 strategy document',
      description: 'Final review of company Q1 strategy',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(2),
      tags: ['strategy', 'review'],
    },
    {
      title: 'Board meeting preparation',
      description: 'Prepare slides for board meeting',
      status: 'in-progress',
      priority: 'high',
      dueDate: addDays(5),
      tags: ['board', 'presentation'],
    },
    {
      title: 'Approve marketing budget',
      description: 'Review and approve Q2 marketing budget',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(3),
      tags: ['budget', 'approval'],
    },
  ],
  'john-doe': [
    {
      title: 'Close Acme deal',
      description: 'Final negotiation with Acme Corporation',
      status: 'in-progress',
      priority: 'high',
      dueDate: addDays(1),
      tags: ['sales', 'closing'],
    },
    {
      title: 'Prepare sales forecast',
      description: 'Q2 sales forecast for leadership',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(4),
      tags: ['sales', 'forecast'],
    },
    {
      title: 'Train new sales rep',
      description: 'Onboard David on sales process',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(7),
      tags: ['training', 'onboarding'],
    },
    {
      title: 'Update CRM records',
      description: 'Clean up outdated contacts',
      status: 'pending',
      priority: 'low',
      dueDate: addDays(10),
      tags: ['admin', 'crm'],
    },
  ],
  'jane-smith': [
    {
      title: 'Fix authentication bug',
      description: 'Users getting logged out unexpectedly',
      status: 'in-progress',
      priority: 'high',
      dueDate: addDays(0),
      tags: ['bug', 'critical'],
    },
    {
      title: 'Code review - API endpoints',
      description: 'Review PR #234 for new API endpoints',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(1),
      tags: ['code-review', 'api'],
    },
    {
      title: 'Write unit tests',
      description: 'Add test coverage for auth module',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(3),
      tags: ['testing', 'code'],
    },
    {
      title: 'Documentation update',
      description: 'Update API docs for v2',
      status: 'pending',
      priority: 'low',
      dueDate: addDays(7),
      tags: ['docs', 'api'],
    },
    {
      title: 'Implement real-time notifications',
      description: 'WebSocket integration for live updates',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(5),
      tags: ['feature', 'backend'],
    },
  ],
  'mike-johnson': [
    {
      title: 'Design new dashboard',
      description: 'Create mockups for analytics dashboard',
      status: 'in-progress',
      priority: 'high',
      dueDate: addDays(2),
      tags: ['design', 'ui'],
    },
    {
      title: 'Mobile app icons',
      description: 'Create app icons for iOS and Android',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(4),
      tags: ['design', 'mobile'],
    },
    {
      title: 'User research interviews',
      description: 'Conduct 5 user interviews',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(6),
      tags: ['research', 'ux'],
    },
  ],
  'sarah-wilson': [
    {
      title: 'Launch email campaign',
      description: 'Q1 product announcement email',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(1),
      tags: ['marketing', 'email'],
    },
    {
      title: 'Social media content',
      description: 'Create content calendar for January',
      status: 'in-progress',
      priority: 'medium',
      dueDate: addDays(3),
      tags: ['social', 'content'],
    },
    {
      title: 'Blog post - AI trends',
      description: 'Write thought leadership article',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(5),
      tags: ['content', 'blog'],
    },
    {
      title: 'Event planning - webinar',
      description: 'Organize Q1 product webinar',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(8),
      tags: ['events', 'webinar'],
    },
  ],
  'david-lee': [
    {
      title: 'Follow up with TechStart',
      description: 'Send proposal follow-up email',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(0),
      tags: ['sales', 'followup'],
    },
    {
      title: 'Demo preparation',
      description: 'Prepare demo for Metro Finance',
      status: 'pending',
      priority: 'high',
      dueDate: addDays(2),
      tags: ['demo', 'sales'],
    },
    {
      title: 'Update sales deck',
      description: 'Add new case studies to sales deck',
      status: 'pending',
      priority: 'medium',
      dueDate: addDays(4),
      tags: ['sales', 'content'],
    },
  ],
};

// Events with attendees (team member IDs)
const EVENTS_BY_USER = {
  'demo-user-001': [
    {
      title: 'Leadership Team Sync',
      description: 'Weekly leadership alignment',
      type: 'meeting',
      startTime: (() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; })(),
      endTime: (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d; })(),
      location: 'Board Room',
      attendees: ['john-doe', 'jane-smith', 'mike-johnson', 'sarah-wilson'],
    },
    {
      title: 'Investor Update Call',
      description: 'Monthly investor update',
      type: 'meeting',
      startTime: (() => { const d = addDays(3); d.setHours(14, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(3); d.setHours(15, 0, 0, 0); return d; })(),
      location: 'Zoom',
      attendees: [],
    },
  ],
  'john-doe': [
    {
      title: 'Sales Team Standup',
      description: 'Daily sales team sync',
      type: 'meeting',
      startTime: (() => { const d = new Date(); d.setHours(9, 30, 0, 0); return d; })(),
      endTime: (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d; })(),
      location: 'Sales Floor',
      attendees: ['david-lee'],
    },
    {
      title: 'Acme Negotiation Call',
      description: 'Final contract discussion',
      type: 'meeting',
      startTime: (() => { const d = addDays(1); d.setHours(11, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(1); d.setHours(12, 0, 0, 0); return d; })(),
      location: 'Google Meet',
      attendees: ['demo-user-001'],
    },
  ],
  'jane-smith': [
    {
      title: 'Engineering Standup',
      description: 'Daily dev team sync',
      type: 'meeting',
      startTime: (() => { const d = new Date(); d.setHours(10, 0, 0, 0); return d; })(),
      endTime: (() => { const d = new Date(); d.setHours(10, 30, 0, 0); return d; })(),
      location: 'Engineering Area',
      attendees: [],
    },
    {
      title: 'Sprint Planning',
      description: 'Plan next sprint',
      type: 'meeting',
      startTime: (() => { const d = addDays(2); d.setHours(13, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(2); d.setHours(15, 0, 0, 0); return d; })(),
      location: 'Conference Room A',
      attendees: ['mike-johnson'],
    },
  ],
  'mike-johnson': [
    {
      title: 'Design Review',
      description: 'Review new dashboard designs',
      type: 'meeting',
      startTime: (() => { const d = addDays(1); d.setHours(14, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(1); d.setHours(15, 0, 0, 0); return d; })(),
      location: 'Design Studio',
      attendees: ['jane-smith', 'demo-user-001'],
    },
  ],
  'sarah-wilson': [
    {
      title: 'Marketing Sync',
      description: 'Weekly marketing team sync',
      type: 'meeting',
      startTime: (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })(),
      endTime: (() => { const d = new Date(); d.setHours(11, 30, 0, 0); return d; })(),
      location: 'Marketing Corner',
      attendees: [],
    },
    {
      title: 'Content Planning',
      description: 'Plan Q1 content calendar',
      type: 'meeting',
      startTime: (() => { const d = addDays(2); d.setHours(10, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(2); d.setHours(11, 0, 0, 0); return d; })(),
      location: 'Conference Room B',
      attendees: ['demo-user-001'],
    },
  ],
  'david-lee': [
    {
      title: 'TechStart Demo',
      description: 'Product demo for TechStart',
      type: 'meeting',
      startTime: (() => { const d = addDays(1); d.setHours(15, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(1); d.setHours(16, 0, 0, 0); return d; })(),
      location: 'Zoom',
      attendees: ['john-doe'],
    },
    {
      title: 'Metro Finance Discovery',
      description: 'Initial discovery call',
      type: 'meeting',
      startTime: (() => { const d = addDays(3); d.setHours(10, 0, 0, 0); return d; })(),
      endTime: (() => { const d = addDays(3); d.setHours(11, 0, 0, 0); return d; })(),
      location: 'Google Meet',
      attendees: [],
    },
  ],
};

// Timesheets by user
const TIMESHEETS_BY_USER = {
  'demo-user-001': [
    { description: 'Strategy planning', duration: 2, date: subDays(1) },
    { description: 'Team 1:1s', duration: 3, date: subDays(2) },
  ],
  'john-doe': [
    { description: 'Acme negotiations', duration: 4, date: subDays(1) },
    { description: 'Sales calls', duration: 3, date: subDays(1) },
    { description: 'Team training', duration: 2, date: subDays(2) },
  ],
  'jane-smith': [
    { description: 'Bug fixes', duration: 5, date: subDays(1) },
    { description: 'Code review', duration: 2, date: subDays(1) },
    { description: 'Feature development', duration: 6, date: subDays(2) },
  ],
  'mike-johnson': [
    { description: 'Dashboard design', duration: 4, date: subDays(1) },
    { description: 'User research', duration: 3, date: subDays(2) },
  ],
  'sarah-wilson': [
    { description: 'Content creation', duration: 4, date: subDays(1) },
    { description: 'Campaign planning', duration: 2, date: subDays(1) },
  ],
  'david-lee': [
    { description: 'Prospect calls', duration: 5, date: subDays(1) },
    { description: 'Demo preparation', duration: 2, date: subDays(2) },
  ],
};

// Seed functions
async function seedTeamUsers() {
  console.log('Seeding team users...');

  for (const user of TEAM_USERS) {
    const now = new Date();
    await db.collection('users').doc(user.id).set({
      ...user,
      teamId: TEAM_ID,
      hasCompletedOnboarding: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  console.log(`  Created ${TEAM_USERS.length} team users`);
}

async function seedAccounts(userId) {
  console.log(`Seeding accounts for ${userId}...`);
  const accountIds = [];

  for (const account of ACCOUNTS) {
    const id = uuidv4();
    const now = new Date();

    await db.collection('users').doc(userId).collection('accounts').doc(id).set({
      id,
      userId,
      ...account,
      createdAt: now,
      updatedAt: now,
    });

    accountIds.push({ id, name: account.name });
  }

  return accountIds;
}

async function seedContacts(userId, accounts) {
  console.log(`Seeding contacts for ${userId}...`);
  const contactIds = [];

  for (const contact of CONTACTS) {
    const id = uuidv4();
    const now = new Date();
    const account = accounts.find(a => a.name === contact.company);

    await db.collection('users').doc(userId).collection('contacts').doc(id).set({
      id,
      userId,
      ...contact,
      accountId: account?.id || null,
      avatar: null,
      socialLinks: {},
      createdAt: now,
      updatedAt: now,
    });

    contactIds.push({ id, name: `${contact.firstName} ${contact.lastName}` });
  }

  return contactIds;
}

async function seedDeals(contacts) {
  console.log('Seeding deals distributed among team members...');

  for (let i = 0; i < DEALS.length; i++) {
    const deal = DEALS[i];
    const id = uuidv4();
    const now = new Date();

    // Store deal in the assigned user's collection
    const ownerId = deal.assignedTo || 'demo-user-001';

    await db.collection('users').doc(ownerId).collection('deals').doc(id).set({
      id,
      userId: ownerId,
      ...deal,
      contactId: contacts[i]?.id || null,
      actualCloseDate: deal.stage === 'won' ? subDays(5) : null,
      createdAt: now,
      updatedAt: now,
    });

    const assignee = TEAM_USERS.find(u => u.id === ownerId);
    console.log(`  - ${deal.name} assigned to ${assignee?.firstName || ownerId}`);
  }
}

async function seedProjects(userId) {
  console.log(`Seeding projects for ${userId}...`);
  const projectIds = [];

  for (const project of PROJECTS) {
    const id = uuidv4();
    const now = new Date();

    await db.collection('users').doc(userId).collection('projects').doc(id).set({
      id,
      userId,
      ...project,
      clientId: null,
      createdAt: now,
      updatedAt: now,
    });

    projectIds.push({ id, name: project.name });
  }

  return projectIds;
}

async function seedTasks(userId) {
  console.log(`Seeding tasks for ${userId}...`);
  const tasks = TASKS_BY_USER[userId] || [];

  for (const task of tasks) {
    const id = uuidv4();
    const now = new Date();

    await db.collection('users').doc(userId).collection('tasks').doc(id).set({
      id,
      userId,
      ...task,
      assignedTo: userId,
      assignedBy: 'demo-user-001',
      projectId: null,
      completedAt: task.status === 'done' ? subDays(1) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return tasks.length;
}

async function seedEvents(userId) {
  console.log(`Seeding events for ${userId}...`);
  const events = EVENTS_BY_USER[userId] || [];

  for (const event of events) {
    const id = uuidv4();
    const now = new Date();

    // Map team member IDs to their emails for attendees
    const attendeeEmails = event.attendees.map(memberId => {
      const member = TEAM_USERS.find(u => u.id === memberId);
      return member?.email || memberId;
    });

    await db.collection('users').doc(userId).collection('events').doc(id).set({
      id,
      userId,
      ...event,
      attendees: attendeeEmails,
      attendeeIds: event.attendees, // Also store member IDs for easy lookup
      allDay: false,
      googleEventId: null,
      recurring: false,
      recurrenceRule: null,
      reminders: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  return events.length;
}

async function seedTimesheets(userId) {
  console.log(`Seeding timesheets for ${userId}...`);
  const entries = TIMESHEETS_BY_USER[userId] || [];

  for (const entry of entries) {
    const id = uuidv4();
    const now = new Date();

    await db.collection('users').doc(userId).collection('timesheets').doc(id).set({
      id,
      userId,
      description: entry.description,
      duration: entry.duration,
      date: entry.date,
      projectId: null,
      taskId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return entries.length;
}

async function clearExistingData(userId) {
  const collections = ['accounts', 'contacts', 'deals', 'projects', 'tasks', 'events', 'timesheets'];

  for (const collectionName of collections) {
    const snapshot = await db.collection('users').doc(userId).collection(collectionName).get();
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    if (snapshot.docs.length > 0) {
      await batch.commit();
    }
  }
}

async function main() {
  console.log('\n=== Coworkr Team Data Seeding ===\n');

  try {
    // Create all team users first
    await seedTeamUsers();

    // Admin user gets full data (accounts, contacts, projects)
    const adminUserId = 'demo-user-001';
    console.log(`\nSeeding admin user data (${adminUserId})...`);
    await clearExistingData(adminUserId);
    const accounts = await seedAccounts(adminUserId);
    const contacts = await seedContacts(adminUserId, accounts);
    await seedProjects(adminUserId);

    // Clear and seed deals for all users who have assigned deals
    const usersWithDeals = [...new Set(DEALS.map(d => d.assignedTo || 'demo-user-001'))];
    for (const userId of usersWithDeals) {
      const dealsSnapshot = await db.collection('users').doc(userId).collection('deals').get();
      const batch = db.batch();
      dealsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      if (dealsSnapshot.docs.length > 0) await batch.commit();
    }
    await seedDeals(contacts);

    // Seed tasks, events, timesheets for all users
    let totalTasks = 0;
    let totalEvents = 0;
    let totalTimesheets = 0;

    for (const user of TEAM_USERS) {
      console.log(`\nSeeding data for ${user.firstName} ${user.lastName}...`);

      // Clear existing tasks/events for this user
      const snapshot1 = await db.collection('users').doc(user.id).collection('tasks').get();
      const snapshot2 = await db.collection('users').doc(user.id).collection('events').get();
      const snapshot3 = await db.collection('users').doc(user.id).collection('timesheets').get();

      const batch = db.batch();
      snapshot1.docs.forEach(doc => batch.delete(doc.ref));
      snapshot2.docs.forEach(doc => batch.delete(doc.ref));
      snapshot3.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      const taskCount = await seedTasks(user.id);
      const eventCount = await seedEvents(user.id);
      const timesheetCount = await seedTimesheets(user.id);

      totalTasks += taskCount;
      totalEvents += eventCount;
      totalTimesheets += timesheetCount;
    }

    console.log('\n=== Seeding Complete! ===\n');
    console.log('Summary:');
    console.log(`  - ${TEAM_USERS.length} team users`);
    console.log(`  - ${ACCOUNTS.length} accounts`);
    console.log(`  - ${CONTACTS.length} contacts`);
    console.log(`  - ${DEALS.length} deals`);
    console.log(`  - ${PROJECTS.length} projects`);
    console.log(`  - ${totalTasks} tasks (distributed among team)`);
    console.log(`  - ${totalEvents} events (distributed among team)`);
    console.log(`  - ${totalTimesheets} timesheet entries`);
    console.log('\nTeam Members:');
    TEAM_USERS.forEach(u => {
      console.log(`  - ${u.firstName} ${u.lastName} (${u.role}) - ${u.email}`);
    });
    console.log('\nYou can login with demo mode as admin, or switch to any team member.\n');

    process.exit(0);
  } catch (error) {
    console.error('\nSeeding failed:', error);
    process.exit(1);
  }
}

main();
