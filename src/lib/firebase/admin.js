import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let app = null;
let db = null;
let storage = null;

function getApp() {
  if (app) return app;

  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  // Skip initialization during build time
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.warn('Firebase Admin credentials not available - skipping initialization');
    return null;
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  app = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return app;
}

export function getAdminDb() {
  if (db) return db;
  const appInstance = getApp();
  if (!appInstance) return null;
  db = getFirestore(appInstance);
  return db;
}

export function getAdminStorage() {
  if (storage) return storage;
  const appInstance = getApp();
  if (!appInstance) return null;
  storage = getStorage(appInstance);
  return storage;
}

// Lazy-loaded adminDb for backward compatibility
export const adminDb = new Proxy({}, {
  get(target, prop) {
    const db = getAdminDb();
    if (!db) throw new Error('Firebase Admin not initialized');
    return db[prop];
  }
});

export const adminStorage = new Proxy({}, {
  get(target, prop) {
    const storage = getAdminStorage();
    if (!storage) throw new Error('Firebase Admin not initialized');
    return storage[prop];
  }
});

// Collection references (lazy-loaded)
export const collections = {
  users: () => getAdminDb()?.collection('users'),
  user: (userId) => getAdminDb()?.collection('users').doc(userId),
  sessions: (userId) => getAdminDb()?.collection('users').doc(userId).collection('sessions'),
  session: (userId, sessionId) =>
    getAdminDb()?.collection('users').doc(userId).collection('sessions').doc(sessionId),
  messages: (userId, sessionId) =>
    getAdminDb()?.collection('users').doc(userId).collection('sessions').doc(sessionId).collection('messages'),

  // Tasks
  tasks: (userId) => getAdminDb()?.collection('users').doc(userId).collection('tasks'),
  task: (userId, taskId) =>
    getAdminDb()?.collection('users').doc(userId).collection('tasks').doc(taskId),

  // Projects
  projects: (userId) => getAdminDb()?.collection('users').doc(userId).collection('projects'),
  project: (userId, projectId) =>
    getAdminDb()?.collection('users').doc(userId).collection('projects').doc(projectId),

  // Events
  events: (userId) => getAdminDb()?.collection('users').doc(userId).collection('events'),
  event: (userId, eventId) =>
    getAdminDb()?.collection('users').doc(userId).collection('events').doc(eventId),

  // Contacts
  contacts: (userId) => getAdminDb()?.collection('users').doc(userId).collection('contacts'),
  contact: (userId, contactId) =>
    getAdminDb()?.collection('users').doc(userId).collection('contacts').doc(contactId),

  // Deals
  deals: (userId) => getAdminDb()?.collection('users').doc(userId).collection('deals'),
  deal: (userId, dealId) =>
    getAdminDb()?.collection('users').doc(userId).collection('deals').doc(dealId),

  // Accounts/Companies
  accounts: (userId) => getAdminDb()?.collection('users').doc(userId).collection('accounts'),
  account: (userId, accountId) =>
    getAdminDb()?.collection('users').doc(userId).collection('accounts').doc(accountId),

  // Activities
  activities: (userId) => getAdminDb()?.collection('users').doc(userId).collection('activities'),
  activity: (userId, activityId) =>
    getAdminDb()?.collection('users').doc(userId).collection('activities').doc(activityId),

  // Documents for RAG
  documents: (userId) => getAdminDb()?.collection('users').doc(userId).collection('documents'),
  document: (userId, docId) =>
    getAdminDb()?.collection('users').doc(userId).collection('documents').doc(docId),
  chunks: (userId, docId) =>
    getAdminDb()?.collection('users').doc(userId).collection('documents').doc(docId).collection('chunks'),

  agents: () => getAdminDb()?.collection('agents'),
  agent: (userId) => getAdminDb()?.collection('agents').doc(userId),
};

export default { getApp, getAdminDb, getAdminStorage };
