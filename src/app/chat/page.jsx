'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { v4 as uuidv4 } from 'uuid';

function ChatContent() {
  const { user, agent, loading } = useAuth({ requireAuth: true, redirectTo: '/login' });
  const [sessionId, setSessionId] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for calendar connection status from redirect
  useEffect(() => {
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');

    if (calendarConnected) {
      // Show success notification (could use a toast library)
      console.log('Calendar connected successfully!');
    } else if (calendarError) {
      console.error('Calendar connection error:', calendarError);
    }
  }, [searchParams]);

  // Create or restore session
  useEffect(() => {
    if (user) {
      // Try to restore session from localStorage
      const storedSessionId = localStorage.getItem(`coworkr_session_${user.id}`);

      if (storedSessionId) {
        setSessionId(storedSessionId);
      } else {
        // Create new session
        const newSessionId = uuidv4();
        localStorage.setItem(`coworkr_session_${user.id}`, newSessionId);
        setSessionId(newSessionId);
      }
    }
  }, [user]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!loading && user && !user.hasCompletedOnboarding) {
      router.push('/onboarding');
    }
  }, [user, loading, router]);

  if (loading || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-100 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Sidebar for larger screens (optional - could add later) */}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatContainer
          userId={user.id}
          sessionId={sessionId}
          agent={agent || { name: 'Coworkr' }}
        />
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-200 animate-pulse" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
