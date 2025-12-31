import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { searchDocuments, getRelevantContext } from '@/lib/rag/retriever';

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { query, topK, documentIds, getContext } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (getContext) {
      // Return formatted context for AI
      const result = await getRelevantContext(session.userId, query);

      if (!result) {
        return NextResponse.json({
          success: true,
          context: null,
          sources: [],
        });
      }

      return NextResponse.json({
        success: true,
        context: result.context,
        sources: result.sources,
      });
    }

    // Return raw search results
    const results = await searchDocuments(session.userId, query, {
      topK: topK || 5,
      documentIds,
    });

    return NextResponse.json({
      success: true,
      chunks: results.chunks.map(c => ({
        content: c.content,
        documentId: c.documentId,
        filename: c.filename,
        score: c.score,
      })),
      sources: results.sources,
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Document search error:', error);
    return NextResponse.json({ error: 'Failed to search documents' }, { status: 500 });
  }
}
