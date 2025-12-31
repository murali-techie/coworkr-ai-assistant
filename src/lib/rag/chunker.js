/**
 * Document chunking utilities for RAG
 */

import { RAG_CONFIG } from '@/lib/constants';

const { CHUNK_SIZE, CHUNK_OVERLAP } = RAG_CONFIG;

/**
 * Split text into overlapping chunks
 */
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;

  // Clean and normalize text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  while (start < cleanText.length) {
    let end = start + chunkSize;

    // Try to end at a sentence boundary
    if (end < cleanText.length) {
      // Look for sentence endings within the last 20% of the chunk
      const searchStart = Math.floor(start + chunkSize * 0.8);
      const searchText = cleanText.slice(searchStart, end + 50);
      const sentenceEnd = searchText.search(/[.!?]\s+/);

      if (sentenceEnd !== -1) {
        end = searchStart + sentenceEnd + 1;
      } else {
        // Fallback to word boundary
        const lastSpace = cleanText.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }
    }

    const chunk = cleanText.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push({
        content: chunk,
        startOffset: start,
        endOffset: end,
        chunkIndex: chunks.length,
      });
    }

    // Move start with overlap
    start = end - overlap;
    if (start <= chunks[chunks.length - 1]?.startOffset) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Split markdown document preserving structure
 */
export function chunkMarkdown(text, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  const sections = text.split(/(?=^#{1,3}\s)/m);

  let currentChunk = '';
  let startOffset = 0;

  for (const section of sections) {
    if (currentChunk.length + section.length <= chunkSize) {
      currentChunk += section;
    } else {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          startOffset,
          endOffset: startOffset + currentChunk.length,
          chunkIndex: chunks.length,
        });
      }
      startOffset += currentChunk.length;

      // If section itself is too large, split it
      if (section.length > chunkSize) {
        const subChunks = chunkText(section, chunkSize);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            startOffset: startOffset + subChunk.startOffset,
            endOffset: startOffset + subChunk.endOffset,
            chunkIndex: chunks.length,
          });
        }
        currentChunk = '';
      } else {
        currentChunk = section;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      startOffset,
      endOffset: startOffset + currentChunk.length,
      chunkIndex: chunks.length,
    });
  }

  return chunks;
}

/**
 * Chunk PDF text (after extraction)
 */
export function chunkPDF(text, metadata = {}) {
  // PDF text often has awkward line breaks
  const cleanText = text
    .replace(/([a-z])-\n([a-z])/g, '$1$2') // Fix hyphenation
    .replace(/\n(?=[a-z])/g, ' ') // Join mid-sentence breaks
    .replace(/\s+/g, ' ');

  const chunks = chunkText(cleanText);

  return chunks.map(chunk => ({
    ...chunk,
    metadata: {
      ...metadata,
      type: 'pdf',
    },
  }));
}

/**
 * Estimate token count (rough)
 */
export function estimateTokens(text) {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export default {
  chunkText,
  chunkMarkdown,
  chunkPDF,
  estimateTokens,
};
