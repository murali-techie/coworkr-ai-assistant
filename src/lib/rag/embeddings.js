/**
 * Embedding generation for RAG using Vertex AI
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';

/**
 * Generate embedding for text using Vertex AI
 */
export async function generateEmbedding(text) {
  const { PredictionServiceClient } = await import('@google-cloud/aiplatform');

  const client = new PredictionServiceClient({
    apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
  });

  const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/text-embedding-004`;

  const instance = {
    content: text,
  };

  const [response] = await client.predict({
    endpoint,
    instances: [{ structValue: { fields: { content: { stringValue: text } } } }],
  });

  // Extract embedding values
  const prediction = response.predictions[0];
  const embedding = prediction.structValue.fields.embeddings.structValue.fields.values.listValue.values.map(
    v => v.numberValue
  );

  return embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts) {
  const embeddings = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(batch.map(text => generateEmbedding(text)));
    embeddings.push(...batchEmbeddings);

    // Small delay between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar embeddings
 */
export function findSimilar(queryEmbedding, embeddings, topK = 5) {
  const similarities = embeddings.map((embedding, index) => ({
    index,
    score: cosineSimilarity(queryEmbedding, embedding),
  }));

  return similarities.sort((a, b) => b.score - a.score).slice(0, topK);
}

export default {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  findSimilar,
};
