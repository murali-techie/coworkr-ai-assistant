/**
 * Embedding generation placeholder
 * Note: RAG/embeddings feature not enabled in current build
 */

/**
 * Generate embedding for text (placeholder)
 */
export async function generateEmbedding(text) {
  console.warn('Embeddings not configured - RAG features disabled');
  return [];
}

/**
 * Generate embeddings for multiple texts (placeholder)
 */
export async function generateEmbeddings(texts) {
  console.warn('Embeddings not configured - RAG features disabled');
  return texts.map(() => []);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) {
    return 0;
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
  return [];
}

export default {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  findSimilar,
};
