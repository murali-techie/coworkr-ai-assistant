/**
 * Session-based memory management
 */

import { collections } from '@/lib/firebase/admin';

// In-memory cache for active sessions
const memoryCache = new Map();

/**
 * Get memory for a session
 */
export async function getMemory(userId, sessionId) {
  const cacheKey = `${userId}:${sessionId}`;

  // Check cache first
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // Load from Firestore
  const sessionRef = collections.session(userId, sessionId);
  const sessionDoc = await sessionRef.get();

  if (sessionDoc.exists) {
    const data = sessionDoc.data();
    const memory = {
      sessionId,
      userId,
      recentMessages: data.recentMessages || [],
      pendingTasks: data.pendingTasks || 0,
      upcomingMeetings: data.upcomingMeetings || 0,
      context: data.context || {},
      lastUpdated: data.lastUpdated || new Date(),
    };

    memoryCache.set(cacheKey, memory);
    return memory;
  }

  // Create new session
  const newMemory = {
    sessionId,
    userId,
    recentMessages: [],
    pendingTasks: 0,
    upcomingMeetings: 0,
    context: {},
    lastUpdated: new Date(),
    createdAt: new Date(),
  };

  await sessionRef.set(newMemory);
  memoryCache.set(cacheKey, newMemory);

  return newMemory;
}

/**
 * Update memory for a session
 */
export async function updateMemory(userId, sessionId, updates) {
  const cacheKey = `${userId}:${sessionId}`;

  // Update Firestore
  const sessionRef = collections.session(userId, sessionId);
  await sessionRef.update({
    ...updates,
    lastUpdated: new Date(),
  });

  // Update cache
  const currentMemory = memoryCache.get(cacheKey) || {};
  memoryCache.set(cacheKey, {
    ...currentMemory,
    ...updates,
    lastUpdated: new Date(),
  });
}

/**
 * Clear memory for a session
 */
export async function clearMemory(userId, sessionId) {
  const cacheKey = `${userId}:${sessionId}`;

  // Clear from Firestore
  const sessionRef = collections.session(userId, sessionId);
  await sessionRef.update({
    recentMessages: [],
    context: {},
    lastUpdated: new Date(),
  });

  // Clear from cache
  memoryCache.delete(cacheKey);
}

/**
 * Add context to memory
 */
export async function addContext(userId, sessionId, key, value) {
  const memory = await getMemory(userId, sessionId);
  const context = { ...memory.context, [key]: value };

  await updateMemory(userId, sessionId, { context });
}

/**
 * Get context from memory
 */
export async function getContext(userId, sessionId, key) {
  const memory = await getMemory(userId, sessionId);
  return key ? memory.context?.[key] : memory.context;
}

/**
 * Update task and meeting counts (call after task/calendar changes)
 */
export async function updateCounts(userId, sessionId) {
  // Count pending tasks
  const tasksSnapshot = await collections
    .tasks(userId)
    .where('status', 'in', ['pending', 'in_progress'])
    .get();

  const pendingTasks = tasksSnapshot.size;

  // For meetings, we'd need to integrate with calendar
  // For now, just update tasks count
  await updateMemory(userId, sessionId, { pendingTasks });
}

/**
 * Cleanup old sessions
 */
export async function cleanupOldSessions(userId, maxAge = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxAge);

  const sessionsSnapshot = await collections
    .sessions(userId)
    .where('lastUpdated', '<', cutoff)
    .get();

  const batch = collections.users().firestore.batch();

  sessionsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    memoryCache.delete(`${userId}:${doc.id}`);
  });

  await batch.commit();
}

export default {
  getMemory,
  updateMemory,
  clearMemory,
  addContext,
  getContext,
  updateCounts,
  cleanupOldSessions,
};
