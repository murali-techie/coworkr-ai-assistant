/**
 * Prompt templates for Gemini AI
 */

/**
 * System prompt for the AI orchestrator
 */
export function getSystemPrompt(agentName, userName) {
  return `You are ${agentName}, a friendly AI voice assistant.

IMPORTANT RULES:
- Give SHORT, conversational responses (1-2 sentences max)
- Your responses will be spoken aloud via TTS, so keep them natural and brief
- NEVER use placeholders like [Name], [Date], [Number] - only use real information
- NEVER pretend to have data you don't have
- If asked about calendar/tasks, say you're being set up and offer to help with something else
- Be warm, helpful, and conversational

You are a voice-first assistant - responses should sound natural when spoken aloud.`;
}

/**
 * Intent detection prompt - returns structured action
 */
export function getIntentPrompt(userMessage, context) {
  return `Analyze this message and determine intent.

Message: "${userMessage}"

Return JSON:
{
  "intent": "GREETING" | "QUESTION" | "TASK_REQUEST" | "CALENDAR_REQUEST" | "GENERAL_CHAT",
  "confidence": 0.0-1.0,
  "entities": {}
}`;
}

/**
 * General chat response prompt
 */
export function getGeneralChatPrompt(message, agentName, recentContext) {
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';

  return `You are ${agentName}, a friendly voice assistant. Respond naturally in 1-2 short sentences.

Current time: ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${timeOfDay})
Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

User said: "${message}"

${recentContext ? `Recent chat:\n${recentContext}` : ''}

RULES:
- Keep response SHORT (1-2 sentences) - this will be spoken aloud
- Be conversational and friendly
- If asked about tasks/calendar/meetings, say "I'm still being set up for that! Is there something else I can help with?"
- NEVER use brackets or placeholders
- Sound natural for voice`;
}

/**
 * Task creation prompt
 */
export function getTaskCreationPrompt(entities, currentDate) {
  return `Create a task from: ${JSON.stringify(entities)}
Current Date: ${currentDate}

Return JSON:
{
  "title": "string",
  "description": "string or null",
  "dueDate": "ISO date string or null",
  "priority": "low" | "medium" | "high"
}`;
}

/**
 * Calendar event creation prompt
 */
export function getCalendarPrompt(entities, currentDate) {
  return `Create event from: ${JSON.stringify(entities)}
Current: ${currentDate}

Return JSON:
{
  "title": "string",
  "startTime": "ISO datetime",
  "endTime": "ISO datetime",
  "location": "string or null"
}`;
}

/**
 * Daily summary prompt
 */
export function getDailySummaryPrompt(tasks, events, agentName) {
  if ((!tasks || tasks.length === 0) && (!events || events.length === 0)) {
    return `As ${agentName}, give a brief friendly greeting. Say you don't have any tasks or meetings to show yet, but you're happy to chat. Keep it to 1-2 sentences.`;
  }

  return `As ${agentName}, briefly summarize:
Tasks: ${tasks?.map(t => t.title).join(', ') || 'None'}
Events: ${events?.map(e => e.title).join(', ') || 'None'}

Keep to 1-2 sentences, natural for voice.`;
}

/**
 * RAG answer prompt
 */
export function getRAGPrompt(query, relevantChunks) {
  return `Answer briefly using this context:

Question: "${query}"

Context:
${relevantChunks.map((chunk, i) => chunk.content).join('\n\n')}

Give a short, direct answer (1-2 sentences).`;
}

/**
 * Voice response optimization prompt
 */
export function getVoiceOptimizedPrompt(response) {
  return `Make this natural for speech (keep same meaning, similar length):

"${response}"

Remove markdown, spell out abbreviations, keep conversational.`;
}

export default {
  getSystemPrompt,
  getIntentPrompt,
  getTaskCreationPrompt,
  getCalendarPrompt,
  getDailySummaryPrompt,
  getRAGPrompt,
  getGeneralChatPrompt,
  getVoiceOptimizedPrompt,
};
