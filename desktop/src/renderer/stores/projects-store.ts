import { create } from 'zustand';
import type { ProjectWithStatus } from '@shared/types';

interface ProjectsStore {
  projects: ProjectWithStatus[];
  setProjects: (projects: ProjectWithStatus[]) => void;
  deployingIds: Set<string>;
  addDeploying: (id: string) => void;
  removeDeploying: (id: string) => void;
}

export const useProjectsStore = create<ProjectsStore>()((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  deployingIds: new Set(),
  addDeploying: (id) => set((s) => ({
    deployingIds: new Set([...s.deployingIds, id]),
  })),
  removeDeploying: (id) => set((s) => {
    const next = new Set(s.deployingIds);
    next.delete(id);
    return { deployingIds: next };
  }),
}));
