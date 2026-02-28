import { useProjects } from '../hooks/useProjects';
import { useProjectsStore } from '../stores/projects-store';
import { useAppStore } from '../stores/app-store';
import { ProjectCard } from '../components/ProjectCard';
import { t } from '../i18n';

export function ProjectsPage() {
  const projects = useProjects();
  const deployingIds = useProjectsStore((s) => s.deployingIds);
  const addDeploying = useProjectsStore((s) => s.addDeploying);
  const removeDeploying = useProjectsStore((s) => s.removeDeploying);
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('proj.title', locale)}</h2>
        <span className="text-xs text-cp-muted">{projects.length} {t('proj.count', locale)}</span>
      </div>
      <div className="space-y-2">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            deploying={deployingIds.has(project.id)}
            onDeployStart={() => addDeploying(project.id)}
            onDeployEnd={() => removeDeploying(project.id)}
            locale={locale}
          />
        ))}
        {projects.length === 0 && (
          <div className="text-sm text-cp-muted text-center py-12">
            {t('proj.noProjects', locale)}
          </div>
        )}
      </div>
    </div>
  );
}
