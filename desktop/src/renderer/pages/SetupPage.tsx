import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { CloudPipeAPI, SetupStep, SetupProgress } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

const PROGRESS_STEPS: SetupStep[] = [
  'login',
  'bundle',
  'cloudflared',
  'credentials',
  'config',
  'tunnel_yml',
  'projects',
  'env',
];

interface SetupPageProps {
  onComplete: () => void;
}

export function SetupPage({ onComplete }: SetupPageProps) {
  const locale = useAppStore((s) => s.locale);
  const [serverUrl, setServerUrl] = useState('https://');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<'input' | 'progress'>('input');
  const [currentStep, setCurrentStep] = useState<SetupStep>('input');
  const [error, setError] = useState('');
  const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());

  useEffect(() => {
    const unsub = api.onSetupProgress((data: unknown) => {
      const progress = data as SetupProgress;
      setCurrentStep(progress.step);

      if (progress.step === 'failed') {
        setError(progress.error || progress.message);
      } else if (progress.step === 'complete') {
        setCompletedSteps((prev) => new Set([...prev, ...PROGRESS_STEPS]));
      } else {
        // Mark previous steps as completed
        const idx = PROGRESS_STEPS.indexOf(progress.step);
        if (idx > 0) {
          setCompletedSteps((prev) => {
            const next = new Set(prev);
            for (let i = 0; i < idx; i++) {
              next.add(PROGRESS_STEPS[i]);
            }
            return next;
          });
        }
      }
    });
    return unsub;
  }, []);

  const handleConnect = async () => {
    setPhase('progress');
    setError('');
    setCompletedSteps(new Set());
    setCurrentStep('login');
    await api.setup(serverUrl, password);
  };

  const handleRetry = () => {
    setPhase('input');
    setError('');
    setCurrentStep('input');
    setCompletedSteps(new Set());
  };

  const handleStart = async () => {
    await api.startupSequence();
    onComplete();
  };

  const getStepIcon = (step: SetupStep): string => {
    if (completedSteps.has(step)) return '\u2713';
    if (step === currentStep && currentStep !== 'complete' && currentStep !== 'failed') return '\u25CF';
    return '\u25CB';
  };

  const getStepColor = (step: SetupStep): string => {
    if (completedSteps.has(step)) return 'text-cp-success';
    if (step === currentStep && currentStep !== 'failed') return 'text-cp-primary';
    return 'text-cp-muted';
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-96 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-cp-primary">{t('setup.title', locale)}</h1>
          <p className="text-xs text-cp-muted mt-1">{t('setup.subtitle', locale)}</p>
        </div>

        {phase === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-cp-muted mb-1">{t('setup.serverUrl', locale)}</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
                placeholder="https://epi.yourdomain.com"
              />
            </div>
            <div>
              <label className="block text-xs text-cp-muted mb-1">{t('setup.password', locale)}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                className="w-full px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
              />
            </div>
            {error && (
              <div className="text-xs text-cp-danger bg-cp-danger/10 border border-cp-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <button
              onClick={handleConnect}
              disabled={!serverUrl || !password}
              className="btn-primary w-full"
            >
              {t('setup.connect', locale)}
            </button>
          </div>
        )}

        {phase === 'progress' && (
          <div className="space-y-3">
            <div className="card">
              {PROGRESS_STEPS.map((step) => {
                const stepKey = `setup.${step}` as Parameters<typeof t>[0];
                const isActive = step === currentStep && currentStep !== 'complete' && currentStep !== 'failed';
                return (
                  <div key={step} className="flex items-center gap-3 py-1.5">
                    {isActive ? (
                      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                        <div className="w-3 h-3 border-2 border-cp-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <span className={`w-4 text-center text-xs flex-shrink-0 ${getStepColor(step)}`}>
                        {getStepIcon(step)}
                      </span>
                    )}
                    <span className={`text-xs ${getStepColor(step)}`}>
                      {t(stepKey, locale)}
                    </span>
                  </div>
                );
              })}
            </div>

            {currentStep === 'complete' && (
              <div className="space-y-3">
                <div className="text-center text-sm text-cp-success font-medium">
                  {t('setup.complete', locale)}
                </div>
                <button onClick={handleStart} className="btn-primary w-full">
                  {t('setup.start', locale)}
                </button>
              </div>
            )}

            {currentStep === 'failed' && (
              <div className="space-y-3">
                <div className="text-xs text-cp-danger bg-cp-danger/10 border border-cp-danger/20 rounded-lg px-3 py-2">
                  {error}
                </div>
                <button onClick={handleRetry} className="btn-primary w-full">
                  {t('setup.retry', locale)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
