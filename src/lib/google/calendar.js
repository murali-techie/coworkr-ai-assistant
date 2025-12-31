/**
 * Google Calendar API integration
 */

import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

// Create OAuth2 client
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
}

// Generate auth URL
export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

// Exchange code for tokens
export async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Get authenticated calendar client
export function getCalendarClient(tokens) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Refresh tokens if needed
export async function refreshTokensIfNeeded(tokens) {
  if (!tokens.expiry_date || tokens.expiry_date > Date.now() + 60000) {
    return tokens; // Still valid
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

// Get today's events
export async function getTodayEvents(tokens) {
  const calendar = getCalendarClient(tokens);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

// Get events for a date range
export async function getEvents(tokens, startDate, endDate) {
  const calendar = getCalendarClient(tokens);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return response.data.items || [];
}

// Get upcoming events
export async function getUpcomingEvents(tokens, maxResults = 10) {
  const calendar = getCalendarClient(tokens);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults,
  });

  return response.data.items || [];
}

// Create a new event
export async function createEvent(tokens, eventData) {
  const calendar = getCalendarClient(tokens);

  const event = {
    summary: eventData.title,
    description: eventData.description || '',
    start: {
      dateTime: eventData.startTime,
      timeZone: eventData.timeZone || 'Asia/Kolkata',
    },
    end: {
      dateTime: eventData.endTime,
      timeZone: eventData.timeZone || 'Asia/Kolkata',
    },
    location: eventData.location || '',
    attendees: eventData.attendees?.map(email => ({ email })) || [],
    reminders: {
      useDefault: true,
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    sendUpdates: 'all',
  });

  return response.data;
}

// Update an event
export async function updateEvent(tokens, eventId, updates) {
  const calendar = getCalendarClient(tokens);

  const event = {};
  if (updates.title) event.summary = updates.title;
  if (updates.description) event.description = updates.description;
  if (updates.startTime) {
    event.start = {
      dateTime: updates.startTime,
      timeZone: updates.timeZone || 'Asia/Kolkata',
    };
  }
  if (updates.endTime) {
    event.end = {
      dateTime: updates.endTime,
      timeZone: updates.timeZone || 'Asia/Kolkata',
    };
  }
  if (updates.location) event.location = updates.location;

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    resource: event,
  });

  return response.data;
}

// Delete an event
export async function deleteEvent(tokens, eventId) {
  const calendar = getCalendarClient(tokens);

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });

  return { success: true };
}

// Format event for display
export function formatEvent(event) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;

  return {
    id: event.id,
    title: event.summary || 'No title',
    description: event.description || '',
    startTime: start,
    endTime: end,
    location: event.location || '',
    attendees: event.attendees?.map(a => a.email) || [],
    isAllDay: !event.start?.dateTime,
    link: event.htmlLink,
  };
}

export default {
  getOAuth2Client,
  getAuthUrl,
  getTokensFromCode,
  getCalendarClient,
  refreshTokensIfNeeded,
  getTodayEvents,
  getEvents,
  getUpcomingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  formatEvent,
};
