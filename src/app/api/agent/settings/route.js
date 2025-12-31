import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Try to import Firebase
let collections = null;
try {
  const firebase = await import('@/lib/firebase/admin');
  collections = firebase.collections;
} catch (e) {
  console.log('Firebase not available for agent settings');
}

// In-memory fallback
const agentStore = new Map();

const VOICE_OPTIONS = {
  female: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  male: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
};

async function getUserId() {
  const cookieStore = await cookies();
  return cookieStore.get('coworkr_user_id')?.value || 'demo-user';
}

export async function GET() {
  try {
    const userId = await getUserId();

    // Try Firebase first
    if (collections) {
      try {
        const agentDoc = await collections.agent(userId).get();
        if (agentDoc.exists) {
          return NextResponse.json({ agent: agentDoc.data() });
        }
      } catch (e) {
        console.log('Firebase agent read error:', e.message);
      }
    }

    // Fallback to in-memory
    const agent = agentStore.get(userId);
    if (agent) {
      return NextResponse.json({ agent });
    }

    // Return default
    return NextResponse.json({
      agent: {
        id: userId,
        name: 'Coworkr',
        voiceGender: 'female',
        voiceId: VOICE_OPTIONS.female.id,
        wakeWord: 'ally',
      }
    });
  } catch (error) {
    console.error('Get agent error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { name, avatarUrl, voiceGender } = body;

    if (!name) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    const voiceId = voiceGender === 'male' ? VOICE_OPTIONS.male.id : VOICE_OPTIONS.female.id;

    const agentData = {
      id: userId,
      userId: userId,
      name,
      avatarUrl: avatarUrl || '/avatars/avatar-1.svg',
      voiceGender: voiceGender || 'female',
      voiceId,
      wakeWord: name.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Try to save to Firebase
    if (collections) {
      try {
        await collections.agent(userId).set(agentData);
        await collections.user(userId).set({
          hasCompletedOnboarding: true,
          updatedAt: new Date(),
        }, { merge: true });
      } catch (e) {
        console.log('Firebase agent save error:', e.message);
      }
    }

    // Also save to in-memory
    agentStore.set(userId, agentData);

    return NextResponse.json({ success: true, agent: agentData });
  } catch (error) {
    console.error('Agent settings error:', error);
    return NextResponse.json({ error: 'Failed to save agent settings' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userId = await getUserId();
    const body = await request.json();

    let agent = agentStore.get(userId) || {
      id: userId,
      name: 'Coworkr',
      voiceGender: 'female',
      voiceId: VOICE_OPTIONS.female.id,
    };

    if (body.name) agent.name = body.name;
    if (body.avatarUrl) agent.avatarUrl = body.avatarUrl;
    if (body.voiceGender) {
      agent.voiceGender = body.voiceGender;
      agent.voiceId = body.voiceGender === 'male' ? VOICE_OPTIONS.male.id : VOICE_OPTIONS.female.id;
    }
    if (body.name) agent.wakeWord = body.name.toLowerCase();
    agent.updatedAt = new Date();

    // Try to save to Firebase
    if (collections) {
      try {
        await collections.agent(userId).set(agent, { merge: true });
      } catch (e) {
        console.log('Firebase agent update error:', e.message);
      }
    }

    agentStore.set(userId, agent);

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Agent update error:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}
