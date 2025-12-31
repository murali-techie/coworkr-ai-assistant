import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { collections } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');

    let query = collections.contacts(session.userId).limit(limit);

    const snapshot = await query.get();
    let contacts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      };
    });

    // Client-side search if search term provided
    if (search) {
      const searchLower = search.toLowerCase();
      contacts = contacts.filter(c =>
        c.firstName?.toLowerCase().includes(searchLower) ||
        c.lastName?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.company?.toLowerCase().includes(searchLower)
      );
    }

    contacts.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Contacts fetch error:', error);
    return NextResponse.json({ contacts: [] });
  }
}

export async function POST(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { firstName, lastName, email, phone, company, accountId, position, tags, notes } = body;

    if (!firstName && !lastName && !email) {
      return NextResponse.json({ error: 'At least firstName, lastName, or email is required' }, { status: 400 });
    }

    const contactId = uuidv4();
    const now = new Date();

    const contact = {
      id: contactId,
      userId: session.userId,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      accountId: accountId || null,
      position: position || null,
      avatar: null,
      tags: tags || [],
      notes: notes || null,
      socialLinks: {},
      createdAt: now,
      updatedAt: now,
    };

    await collections.contact(session.userId, contactId).set(contact);

    return NextResponse.json({
      success: true,
      contact: {
        ...contact,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Contact create error:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const contactRef = collections.contact(session.userId, id);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const updateData = { ...updates, updatedAt: new Date() };

    await contactRef.update(updateData);

    const updated = await contactRef.get();
    const data = updated.data();

    return NextResponse.json({
      success: true,
      contact: {
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }

    const contactRef = collections.contact(session.userId, id);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await contactRef.delete();

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
