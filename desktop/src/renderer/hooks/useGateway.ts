import { useState, useEffect, useCallback } from 'react';
import type { CloudPipeAPI, Tool, Pipeline } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function useGateway() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.getTools(),
        api.getPipelines(),
      ]);
      setTools((t as Tool[]) || []);
      setPipelines((p as Pipeline[]) || []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tools, pipelines, loading, refresh };
}
