'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { DEFAULT_AVATARS, VOICE_OPTIONS } from '@/lib/constants';

const STEPS = ['name', 'avatar', 'voice'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState('Coworkr');
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [voiceGender, setVoiceGender] = useState('female');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { user, loading: authLoading } = useAuth({ requireAuth: true });
  const router = useRouter();

  // Redirect if already onboarded
  useEffect(() => {
    if (!authLoading && user?.hasCompletedOnboarding) {
      router.push('/chat');
    }
  }, [user, authLoading, router]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          avatarUrl: selectedAvatar,
          voiceGender,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      router.push('/chat');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="flex justify-center mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full transition-colors ${
                    i <= step ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                />
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 transition-colors ${
                      i < step ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Name */}
          {step === 0 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Name your AI colleague
              </h2>
              <p className="text-gray-600 mb-8">
                This is also the wake word for voice commands
              </p>

              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g., Coworkr, Max, Aria"
                className="text-center text-lg"
              />

              <div className="mt-6 flex gap-2 justify-center flex-wrap">
                {['Coworkr', 'Max', 'Nova', 'Echo'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setAgentName(name)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      agentName === name
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Avatar */}
          {step === 1 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Choose an avatar
              </h2>
              <p className="text-gray-600 mb-8">
                Give {agentName} a face
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
                {DEFAULT_AVATARS.map((avatar, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedAvatar === avatar
                        ? 'border-primary-500 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                      <span className="text-3xl">
                        {['😊', '🤖', '🧠', '✨', '💫', '🌟'][i]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Voice */}
          {step === 2 && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select a voice
              </h2>
              <p className="text-gray-600 mb-8">
                How should {agentName} sound?
              </p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setVoiceGender('female')}
                  className={`flex-1 max-w-[150px] p-6 rounded-xl border-2 transition-all ${
                    voiceGender === 'female'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-4xl mb-2">👩</div>
                  <div className="font-medium text-gray-900">Rachel</div>
                  <div className="text-xs text-gray-500">Female voice</div>
                </button>

                <button
                  onClick={() => setVoiceGender('male')}
                  className={`flex-1 max-w-[150px] p-6 rounded-xl border-2 transition-all ${
                    voiceGender === 'male'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-4xl mb-2">👨</div>
                  <div className="font-medium text-gray-900">Adam</div>
                  <div className="text-xs text-gray-500">Male voice</div>
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mt-6 text-center">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={handleNext} className="flex-1" disabled={!agentName.trim()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleComplete} className="flex-1" loading={loading}>
                Get Started
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
