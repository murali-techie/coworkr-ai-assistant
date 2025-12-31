/**
 * RAG Retrieval - Search and retrieve relevant document chunks
 */

import { collections } from '@/lib/firebase/admin';
import { generateEmbedding, cosineSimilarity } from './embeddings';
import { RAG_CONFIG } from '@/lib/constants';

const { TOP_K, SIMILARITY_THRESHOLD } = RAG_CONFIG;

/**
 * Search documents for relevant chunks
 */
export async function searchDocuments(userId, query, options = {}) {
  const {
    topK = TOP_K,
    threshold = SIMILARITY_THRESHOLD,
    documentIds = null,
  } = options;

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Get all documents for user
  let documentsQuery = collections.documents(userId).where('status', '==', 'ready');
  const documentsSnapshot = await documentsQuery.get();

  if (documentsSnapshot.empty) {
    return { chunks: [], scores: [], answer: null, sources: [] };
  }

  // Collect all chunks with scores
  const allChunks = [];

  for (const docSnap of documentsSnapshot.docs) {
    const docData = docSnap.data();

    // Skip if filtering by documentIds
    if (documentIds && !documentIds.includes(docSnap.id)) {
      continue;
    }

    // Get chunks for this document
    const chunksSnapshot = await collections.chunks(userId, docSnap.id).get();

    for (const chunkSnap of chunksSnapshot.docs) {
      const chunkData = chunkSnap.data();

      // Calculate similarity
      const score = cosineSimilarity(queryEmbedding, chunkData.embedding);

      if (score >= threshold) {
        allChunks.push({
          ...chunkData,
          id: chunkSnap.id,
          documentId: docSnap.id,
          filename: docData.originalName,
          score,
        });
      }
    }
  }

  // Sort by score and take top K
  allChunks.sort((a, b) => b.score - a.score);
  const topChunks = allChunks.slice(0, topK);

  // Build sources list
  const sources = topChunks.map(chunk => ({
    documentId: chunk.documentId,
    filename: chunk.filename,
    excerpt: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
  }));

  return {
    chunks: topChunks,
    scores: topChunks.map(c => c.score),
    sources,
  };
}

/**
 * Get document context for a query
 */
export async function getRelevantContext(userId, query, maxTokens = 2000) {
  const results = await searchDocuments(userId, query);

  if (results.chunks.length === 0) {
    return null;
  }

  // Build context string, respecting token limit
  let context = '';
  let estimatedTokens = 0;

  for (const chunk of results.chunks) {
    const chunkTokens = Math.ceil(chunk.content.length / 4);

    if (estimatedTokens + chunkTokens > maxTokens) {
      break;
    }

    context += `\n\n[From: ${chunk.filename}]\n${chunk.content}`;
    estimatedTokens += chunkTokens;
  }

  return {
    context: context.trim(),
    sources: results.sources,
  };
}

/**
 * Hybrid search - combine keyword and semantic search
 */
export async function hybridSearch(userId, query, options = {}) {
  const { topK = TOP_K } = options;

  // Semantic search
  const semanticResults = await searchDocuments(userId, query, options);

  // Simple keyword matching as supplement
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (keywords.length === 0) {
    return semanticResults;
  }

  // Score boost for keyword matches
  const boostedChunks = semanticResults.chunks.map(chunk => {
    const content = chunk.content.toLowerCase();
    const keywordMatches = keywords.filter(kw => content.includes(kw)).length;
    const boost = keywordMatches * 0.1; // 10% boost per keyword

    return {
      ...chunk,
      score: Math.min(1, chunk.score + boost),
      keywordMatches,
    };
  });

  // Re-sort with boosted scores
  boostedChunks.sort((a, b) => b.score - a.score);

  return {
    chunks: boostedChunks.slice(0, topK),
    scores: boostedChunks.slice(0, topK).map(c => c.score),
    sources: boostedChunks.slice(0, topK).map(c => ({
      documentId: c.documentId,
      filename: c.filename,
      excerpt: c.content.slice(0, 200) + '...',
    })),
  };
}

export default {
  searchDocuments,
  getRelevantContext,
  hybridSearch,
};
