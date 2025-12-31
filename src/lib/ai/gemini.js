import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_AI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

let genAI = null;
let generativeModel = null;

/**
 * Initialize Google Generative AI client
 */
function getGenAI() {
  if (!genAI) {
    if (!API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY is not configured. Get one at https://aistudio.google.com/app/apikey');
    }
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

/**
 * Get generative model instance
 */
function getModel() {
  if (!generativeModel) {
    const ai = getGenAI();
    generativeModel = ai.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
    });
  }
  return generativeModel;
}

/**
 * Generate content with Gemini
 */
export async function generateContent(prompt, options = {}) {
  console.log('Generating content with Gemini...');
  const model = getModel();

  let fullPrompt = prompt;
  if (options.systemInstruction) {
    fullPrompt = `${options.systemInstruction}\n\n${prompt}`;
  }

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();
    console.log('Gemini response received, length:', text.length);
    return text;
  } catch (err) {
    console.error('Gemini generateContent error:', err);
    throw err;
  }
}

/**
 * Generate structured JSON response
 */
export async function generateJSON(prompt, systemInstruction) {
  const fullPrompt = `${prompt}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, just the JSON object.`;

  const response = await generateContent(fullPrompt, { systemInstruction });

  // Clean up response - remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  try {
    return JSON.parse(cleaned.trim());
  } catch (parseError) {
    console.error('JSON parse error, raw response:', cleaned);
    // Return a default fallback
    return { intent: 'GENERAL_CHAT', confidence: 0.5, entities: {} };
  }
}

/**
 * Generate embeddings (placeholder)
 */
export async function generateEmbedding(text) {
  // Placeholder - would need embedding model for production
  console.warn('generateEmbedding: Using placeholder');
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Array(768).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
}

/**
 * Chat with context
 */
export async function chat(messages, systemInstruction) {
  const model = getModel();

  // Build chat history
  const history = messages.slice(0, -1).map(msg => ({
    role: msg.role === 'agent' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Start chat with history
  const chatSession = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  // Get the last message
  const lastMessage = messages[messages.length - 1];
  let prompt = lastMessage.content;

  if (systemInstruction) {
    prompt = `[System: ${systemInstruction}]\n\n${prompt}`;
  }

  const result = await chatSession.sendMessage(prompt);
  const response = await result.response;
  return response.text();
}

export default {
  generateContent,
  generateJSON,
  generateEmbedding,
  chat,
};
