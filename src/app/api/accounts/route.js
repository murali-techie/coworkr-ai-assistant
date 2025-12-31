import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let query = collections.accounts(session.userId);

    if (type) {
      query = query.where('type', '==', type).limit(limit);
    } else {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const accounts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    accounts.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Accounts fetch error:', error);
    return NextResponse.json({ accounts: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { name, industry, website, phone, email, address, size, revenue, type, tags, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const accountId = uuidv4();
    const now = new Date();

    const account = {
      id: accountId,
      userId: session.userId,
      name,
      industry: industry || null,
      website: website || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      size: size || null,
      revenue: revenue || null,
      type: type || 'prospect',
      tags: tags || [],
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
    };

    await collections.account(session.userId, accountId).set(account);

    return NextResponse.json({
      success: true,
      account: {
        ...account,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Account create error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const accountRef = collections.account(session.userId, id);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    await accountRef.update(updateData);

    const updated = await accountRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      account: {
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const accountRef = collections.account(session.userId, id);
    const accountDoc = await accountRef.get();

    if (!accountDoc.exists) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await accountRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
