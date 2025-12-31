import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const app = initAdmin();
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);

// Collection references
export const collections = {
  users: () => adminDb.collection('users'),
  user: (userId) => adminDb.collection('users').doc(userId),
  sessions: (userId) => adminDb.collection('users').doc(userId).collection('sessions'),
  session: (userId, sessionId) =>
    adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId),
  messages: (userId, sessionId) =>
    adminDb.collection('users').doc(userId).collection('sessions').doc(sessionId).collection('messages'),

  // Tasks
  tasks: (userId) => adminDb.collection('users').doc(userId).collection('tasks'),
  task: (userId, taskId) =>
    adminDb.collection('users').doc(userId).collection('tasks').doc(taskId),

  // Projects
  projects: (userId) => adminDb.collection('users').doc(userId).collection('projects'),
  project: (userId, projectId) =>
    adminDb.collection('users').doc(userId).collection('projects').doc(projectId),

  // Events
  events: (userId) => adminDb.collection('users').doc(userId).collection('events'),
  event: (userId, eventId) =>
    adminDb.collection('users').doc(userId).collection('events').doc(eventId),

  // Contacts
  contacts: (userId) => adminDb.collection('users').doc(userId).collection('contacts'),
  contact: (userId, contactId) =>
    adminDb.collection('users').doc(userId).collection('contacts').doc(contactId),

  // Deals
  deals: (userId) => adminDb.collection('users').doc(userId).collection('deals'),
  deal: (userId, dealId) =>
    adminDb.collection('users').doc(userId).collection('deals').doc(dealId),

  // Accounts/Companies
  accounts: (userId) => adminDb.collection('users').doc(userId).collection('accounts'),
  account: (userId, accountId) =>
    adminDb.collection('users').doc(userId).collection('accounts').doc(accountId),

  // Activities
  activities: (userId) => adminDb.collection('users').doc(userId).collection('activities'),
  activity: (userId, activityId) =>
    adminDb.collection('users').doc(userId).collection('activities').doc(activityId),

  // Documents for RAG
  documents: (userId) => adminDb.collection('users').doc(userId).collection('documents'),
  document: (userId, docId) =>
    adminDb.collection('users').doc(userId).collection('documents').doc(docId),
  chunks: (userId, docId) =>
    adminDb.collection('users').doc(userId).collection('documents').doc(docId).collection('chunks'),

  agents: () => adminDb.collection('agents'),
  agent: (userId) => adminDb.collection('agents').doc(userId),
};

export default app;
