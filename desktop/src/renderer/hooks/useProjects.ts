import { useCallback } from 'react';
import { useProjectsStore } from '../stores/projects-store';
import { usePolling } from './usePolling';
import { POLL_INTERVALS } from '@shared/constants';
import type { CloudPipeAPI, ProjectWithStatus } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function useProjects(enabled = true) {
  const projects = useProjectsStore((s) => s.projects);
  const setProjects = useProjectsStore((s) => s.setProjects);

  const fetch = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data as ProjectWithStatus[]);
    } catch {
      // Connection failed — keep stale data
    }
  }, [setProjects]);

  usePolling(fetch, POLL_INTERVALS.PROJECTS, enabled);

  return projects;
}
