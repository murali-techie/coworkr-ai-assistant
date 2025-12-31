'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check auth and redirect
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (data.authenticated) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    }

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500 animate-pulse" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
