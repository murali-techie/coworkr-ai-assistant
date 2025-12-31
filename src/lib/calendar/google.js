/**
 * Google Calendar API Integration
 */

import { google } from 'googleapis';
import { collections } from '@/lib/firebase/admin';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
}

/**
 * Generate authorization URL
 */
export function getAuthUrl(userId) {
  const oauth2Client = createOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId,
    prompt: 'consent',
  });

  return url;
}

/**
 * Exchange code for tokens
 */
export async function exchangeCodeForTokens(code) {
  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
  };
}

/**
 * Save tokens for user
 */
export async function saveTokens(userId, tokens) {
  await collections.user(userId).set({
    googleCalendarTokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    },
    googleCalendarConnected: true,
    updatedAt: new Date(),
  }, { merge: true });
}

/**
 * Get authenticated calendar client
 */
async function getCalendarClient(userId) {
  const userDoc = await collections.user(userId).get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  const tokens = userData.googleCalendarTokens;

  if (!tokens) {
    throw new Error('Calendar not connected');
  }

  const oauth2Client = createOAuth2Client();

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiresAt?.toDate?.()?.getTime() || tokens.expiresAt,
  });

  // Handle token refresh
  oauth2Client.on('tokens', async newTokens => {
    try {
      await saveTokens(userId, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken,
        expiresAt: new Date(newTokens.expiry_date),
      });
    } catch (e) {
      console.log('Failed to save refreshed tokens:', e.message);
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(userId, startDate, endDate) {
  try {
    const calendar = await getCalendarClient(userId);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    return (response.data.items || []).map(event => ({
      id: event.id,
      googleEventId: event.id,
      title: event.summary || 'Untitled',
      description: event.description || null,
      startTime: event.start.dateTime || event.start.date,
      endTime: event.end.dateTime || event.end.date,
      location: event.location || null,
      attendees: event.attendees?.map(a => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })) || [],
      isAllDay: !event.start.dateTime,
      status: event.status,
    }));
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(userId, eventData) {
  const calendar = await getCalendarClient(userId);

  const event = {
    summary: eventData.summary || eventData.title,
    description: eventData.description,
    start: eventData.start?.dateTime
      ? { dateTime: eventData.start.dateTime, timeZone: 'UTC' }
      : { date: eventData.start?.date },
    end: eventData.end?.dateTime
      ? { dateTime: eventData.end.dateTime, timeZone: 'UTC' }
      : { date: eventData.end?.date },
    location: eventData.location,
    attendees: eventData.attendees,
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all',
  });

  return {
    id: response.data.id,
    googleEventId: response.data.id,
    title: response.data.summary,
    startTime: response.data.start.dateTime || response.data.start.date,
    endTime: response.data.end.dateTime || response.data.end.date,
    status: response.data.status,
  };
}

/**
 * Update calendar event
 */
export async function updateCalendarEvent(userId, eventId, updates) {
  const calendar = await getCalendarClient(userId);

  const updateData = {};

  if (updates.title) updateData.summary = updates.title;
  if (updates.description) updateData.description = updates.description;
  if (updates.location) updateData.location = updates.location;
  if (updates.startTime) {
    updateData.start = { dateTime: updates.startTime, timeZone: 'UTC' };
  }
  if (updates.endTime) {
    updateData.end = { dateTime: updates.endTime, timeZone: 'UTC' };
  }

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: updateData,
    sendUpdates: 'all',
  });

  return {
    id: response.data.id,
    googleEventId: response.data.id,
    title: response.data.summary,
    startTime: response.data.start.dateTime || response.data.start.date,
    endTime: response.data.end.dateTime || response.data.end.date,
    status: response.data.status,
  };
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(userId, eventId) {
  const calendar = await getCalendarClient(userId);

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
    sendUpdates: 'all',
  });

  return { success: true, deletedId: eventId };
}

/**
 * Check if calendar is connected
 */
export async function isCalendarConnected(userId) {
  const userDoc = await collections.user(userId).get();

  if (!userDoc.exists) return false;

  const userData = userDoc.data();
  return !!userData.googleCalendarConnected && !!userData.googleCalendarTokens;
}

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  saveTokens,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  isCalendarConnected,
};
