/**
 * Document upload placeholder
 * Note: RAG/document upload feature not enabled in current build
 */

/**
 * Upload and process a document (placeholder)
 */
export async function uploadDocument(userId, file, originalName) {
  console.warn('Document upload not configured - RAG features disabled');
  throw new Error('Document upload feature is not enabled');
}

/**
 * Delete a document and its chunks (placeholder)
 */
export async function deleteDocument(userId, documentId) {
  console.warn('Document deletion not configured - RAG features disabled');
  throw new Error('Document deletion feature is not enabled');
}

/**
 * List documents for a user (placeholder)
 */
export async function listDocuments(userId) {
  console.warn('Document listing not configured - RAG features disabled');
  return [];
}

export default {
  uploadDocument,
  deleteDocument,
  listDocuments,
};
