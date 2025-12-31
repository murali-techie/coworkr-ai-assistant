/**
 * Document upload and processing for RAG
 */

import { Storage } from '@google-cloud/storage';
import { collections } from '@/lib/firebase/admin';
import { chunkText, chunkPDF, chunkMarkdown } from './chunker';
import { generateEmbeddings } from './embeddings';
import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * Upload and process a document
 */
export async function uploadDocument(userId, file, originalName) {
  const documentId = uuidv4();
  const filename = `${userId}/${documentId}/${originalName}`;

  // Determine file type
  const extension = originalName.split('.').pop().toLowerCase();
  const type = getDocumentType(extension);

  // Create document record
  const documentData = {
    id: documentId,
    userId,
    filename,
    originalName,
    mimeType: file.type || getMimeType(extension),
    size: file.size,
    storageUrl: `gs://${process.env.GCS_BUCKET_NAME}/${filename}`,
    type,
    chunkCount: 0,
    status: 'processing',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await collections.document(userId, documentId).set(documentData);

  try {
    // Upload file to Cloud Storage
    const blob = bucket.file(filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    await blob.save(buffer, {
      metadata: {
        contentType: documentData.mimeType,
      },
    });

    // Extract text and chunk
    const text = await extractText(buffer, type);
    const chunks = await chunkDocument(text, type);

    // Generate embeddings
    const contents = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(contents);

    // Save chunks to Firestore
    const batch = collections.documents(userId).firestore.batch();

    chunks.forEach((chunk, index) => {
      const chunkId = uuidv4();
      const chunkRef = collections.chunks(userId, documentId).doc(chunkId);

      batch.set(chunkRef, {
        id: chunkId,
        documentId,
        userId,
        content: chunk.content,
        embedding: embeddings[index],
        chunkIndex: chunk.chunkIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        createdAt: new Date(),
      });
    });

    await batch.commit();

    // Update document status
    await collections.document(userId, documentId).update({
      status: 'ready',
      chunkCount: chunks.length,
      updatedAt: new Date(),
    });

    return {
      documentId,
      filename: originalName,
      chunkCount: chunks.length,
    };
  } catch (error) {
    // Update document with error status
    await collections.document(userId, documentId).update({
      status: 'error',
      error: error.message,
      updatedAt: new Date(),
    });

    throw error;
  }
}

/**
 * Extract text from document
 */
async function extractText(buffer, type) {
  switch (type) {
    case 'pdf':
      const pdfData = await pdf(buffer);
      return pdfData.text;

    case 'txt':
    case 'md':
      return buffer.toString('utf-8');

    default:
      return buffer.toString('utf-8');
  }
}

/**
 * Chunk document based on type
 */
async function chunkDocument(text, type) {
  switch (type) {
    case 'md':
      return chunkMarkdown(text);

    case 'pdf':
      return chunkPDF(text);

    default:
      return chunkText(text);
  }
}

/**
 * Get document type from extension
 */
function getDocumentType(extension) {
  const typeMap = {
    pdf: 'pdf',
    txt: 'txt',
    md: 'md',
    markdown: 'md',
  };

  return typeMap[extension] || 'txt';
}

/**
 * Get MIME type from extension
 */
function getMimeType(extension) {
  const mimeMap = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
  };

  return mimeMap[extension] || 'text/plain';
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(userId, documentId) {
  const docRef = collections.document(userId, documentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new Error('Document not found');
  }

  const docData = docSnap.data();

  // Delete from Cloud Storage
  try {
    await bucket.file(docData.filename).delete();
  } catch (e) {
    console.error('Failed to delete file from storage:', e);
  }

  // Delete chunks
  const chunksSnapshot = await collections.chunks(userId, documentId).get();
  const batch = collections.documents(userId).firestore.batch();

  chunksSnapshot.docs.forEach(chunk => {
    batch.delete(chunk.ref);
  });

  // Delete document
  batch.delete(docRef);

  await batch.commit();

  return { success: true };
}

/**
 * List documents for a user
 */
export async function listDocuments(userId) {
  const snapshot = await collections
    .documents(userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export default {
  uploadDocument,
  deleteDocument,
  listDocuments,
};
