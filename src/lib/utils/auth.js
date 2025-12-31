/**
 * Simple auth utilities for hackathon demo
 * Uses cookie-based sessions with in-memory storage
 */

import { cookies, headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE = 'coworkr_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory session store (demo only - use database in production)
const sessions = new Map();
const users = new Map();

/**
 * Simple hash function for passwords
 */
function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16) + '_' + Buffer.from(password).toString('base64');
}

/**
 * Verify password
 */
function verifyPassword(password, hash) {
  return simpleHash(password) === hash;
}

/**
 * Create a new user
 */
export async function createUser(email, password, name = null) {
  // Check if user exists
  for (const user of users.values()) {
    if (user.email === email) {
      throw new Error('User already exists');
    }
  }

  const userId = uuidv4();
  const now = new Date();

  const userData = {
    id: userId,
    email,
    passwordHash: simpleHash(password),
    name,
    hasCompletedOnboarding: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  users.set(userId, userData);

  // Create session
  const session = await createSession(userId, email, name);

  return { user: { id: userId, email, name }, session };
}

/**
 * Login user
 */
export async function loginUser(email, password) {
  let foundUser = null;

  for (const user of users.values()) {
    if (user.email === email) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser || !verifyPassword(password, foundUser.passwordHash)) {
    throw new Error('Invalid credentials');
  }

  foundUser.lastLoginAt = new Date();

  const session = await createSession(foundUser.id, foundUser.email, foundUser.name);

  return {
    user: {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      hasCompletedOnboarding: foundUser.hasCompletedOnboarding,
    },
    session,
  };
}

/**
 * Create session token
 */
async function createSession(userId, email, name) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  const sessionData = {
    sessionId,
    userId,
    email,
    name,
    expiresAt,
  };

  sessions.set(sessionId, sessionData);

  return sessionData;
}

/**
 * Get current session from cookies
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    const coworkrUserId = cookieStore.get('coworkr_user_id')?.value;

    // Prefer coworkr_user_id for consistency with calendar auth
    if (coworkrUserId) {
      return {
        sessionId: coworkrUserId,
        userId: coworkrUserId,
        email: 'user@coworkr.ai',
        name: 'User',
      };
    }

    if (!sessionId) {
      return null;
    }

    const session = sessions.get(sessionId);

    if (!session) {
      // For demo: create a dummy session if cookie exists
      return {
        sessionId,
        userId: sessionId.split('-')[0] || 'demo-user',
        email: 'demo@coworkr.ai',
        name: 'Demo User',
      };
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      sessions.delete(sessionId);
      return null;
    }

    return session;
  } catch (error) {
    // Cookies not available (internal server call)
    return null;
  }
}

/**
 * Set session cookie
 */
export async function setSessionCookie(sessionId) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE / 1000,
    path: '/',
  });
}

/**
 * Clear session
 */
export async function logout() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    sessions.delete(sessionId);
    cookieStore.delete(SESSION_COOKIE);
  }
}

/**
 * Require authentication (for API routes)
 * For hackathon demo: allows internal server calls
 */
export async function requireAuth() {
  try {
    // Check for internal server call header
    const headersList = await headers();
    const isInternal = headersList.get('x-internal-call') === 'true';

    if (isInternal) {
      // Try to get userId from coworkr_user_id header for internal calls
      const internalUserId = headersList.get('x-coworkr-user-id');
      return {
        userId: internalUserId || 'internal',
        email: 'internal@coworkr.ai',
        name: 'Internal',
      };
    }

    const session = await getSession();

    if (session) {
      return session;
    }

    // Try to get coworkr_user_id from cookies as fallback
    const cookieStore = await cookies();
    const coworkrUserId = cookieStore.get('coworkr_user_id')?.value;

    if (coworkrUserId) {
      return {
        userId: coworkrUserId,
        email: 'user@coworkr.ai',
        name: 'User',
      };
    }

    // For hackathon demo: allow unauthenticated access with demo user
    return {
      userId: 'demo-user',
      email: 'demo@coworkr.ai',
      name: 'Demo User',
    };
  } catch (error) {
    // For hackathon: return demo session on error
    return {
      userId: 'demo-user',
      email: 'demo@coworkr.ai',
      name: 'Demo User',
    };
  }
}

export default {
  createUser,
  loginUser,
  getSession,
  setSessionCookie,
  logout,
  requireAuth,
};
