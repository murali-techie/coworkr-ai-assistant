import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const stage = searchParams.get('stage');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const teamView = searchParams.get('team') === 'true';

    let deals = [];

    if (teamView) {
      // Fetch deals from all team members
      const currentUser = await collections.user(session.userId).get();
      const currentUserData = currentUser.data() || {};
      const teamId = currentUserData.teamId || 'demo-team';

      // Get all users in the team
      const usersSnapshot = await collections.users()
        .where('teamId', '==', teamId)
        .get();

      const userIds = usersSnapshot.docs.map(doc => doc.id);

      // Fetch deals for all team members
      const allDealsPromises = userIds.map(async (userId) => {
        let query = collections.deals(userId);
        if (stage) {
          query = query.where('stage', '==', stage);
        }
        const snapshot = await query.limit(limit).get();
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            userId: userId,
            assignedTo: data.assignedTo || userId,
            expectedCloseDate: data.expectedCloseDate?.toDate?.() || data.expectedCloseDate,
            actualCloseDate: data.actualCloseDate?.toDate?.() || data.actualCloseDate,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          };
        });
      });

      const allDealsArrays = await Promise.all(allDealsPromises);
      deals = allDealsArrays.flat();
    } else {
      // Original behavior - fetch only current user's deals
      let query = collections.deals(session.userId);

      if (stage) {
        query = query.where('stage', '==', stage).limit(limit);
      } else {
        query = query.limit(limit);
      }

      const snapshot = await query.get();
      deals = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          assignedTo: data.assignedTo || session.userId,
          expectedCloseDate: data.expectedCloseDate?.toDate?.() || data.expectedCloseDate,
          actualCloseDate: data.actualCloseDate?.toDate?.() || data.actualCloseDate,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        };
      });
    }

    deals.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return NextResponse.json({ deals });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Deals fetch error:', error);
    return NextResponse.json({ deals: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { name, value, currency, stage, probability, contactId, accountId, expectedCloseDate, notes, tags } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const dealId = uuidv4();
    const now = new Date();

    const deal = {
      id: dealId,
      userId: session.userId,
      name,
      value: value || 0,
      currency: currency || 'USD',
      stage: stage || 'lead',
      probability: probability || 10,
      contactId: contactId || null,
      accountId: accountId || null,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      actualCloseDate: null,
      notes: notes || null,
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
    };

    await collections.deal(session.userId, dealId).set(deal);

    return NextResponse.json({
      success: true,
      deal: {
        ...deal,
        expectedCloseDate: deal.expectedCloseDate?.toISOString(),
        createdAt: deal.createdAt.toISOString(),
        updatedAt: deal.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Deal create error:', error);
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const dealRef = collections.deal(session.userId, id);
    const dealDoc = await dealRef.get();

    if (!dealDoc.exists) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    if (updates.expectedCloseDate) updateData.expectedCloseDate = new Date(updates.expectedCloseDate);
    if (updates.actualCloseDate) updateData.actualCloseDate = new Date(updates.actualCloseDate);

    // Auto-set close date when marking as won/lost
    if (updates.stage === 'won' || updates.stage === 'lost') {
      updateData.actualCloseDate = new Date();
    }

    await dealRef.update(updateData);

    const updated = await dealRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      deal: {
        ...data,
        expectedCloseDate: data.expectedCloseDate?.toDate?.()?.toISOString(),
        actualCloseDate: data.actualCloseDate?.toDate?.()?.toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const dealRef = collections.deal(session.userId, id);
    const dealDoc = await dealRef.get();

    if (!dealDoc.exists) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await dealRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}
