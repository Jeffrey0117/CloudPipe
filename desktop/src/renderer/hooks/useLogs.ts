import { useState, useCallback } from 'react';
import { usePolling } from './usePolling';
import { POLL_INTERVALS } from '@shared/constants';
import type { CloudPipeAPI } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function useLogs(pm2Name: string | null) {
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');

  const fetch = useCallback(async () => {
    if (!pm2Name) return;
    try {
      const data = await api.getLogs(pm2Name);
      setStdout(data.stdout || '');
      setStderr(data.stderr || '');
    } catch {
      // keep stale
    }
  }, [pm2Name]);

  usePolling(fetch, POLL_INTERVALS.LOGS, !!pm2Name);

  return { stdout, stderr };
}
