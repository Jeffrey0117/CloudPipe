import { t } from '../i18n';
import type { Pipeline } from '@shared/types';
import type { Locale } from '../i18n';

interface PipelineCardProps {
  pipeline: Pipeline;
  onRun: (pipeline: Pipeline) => void;
  locale: Locale;
}

export function PipelineCard({ pipeline, onRun, locale }: PipelineCardProps) {
  return (
    <div className="card flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-cp-text truncate">{pipeline.name}</div>
        <div className="text-xs text-cp-muted truncate">{pipeline.description}</div>
        <div className="text-xs text-cp-muted mt-1">{pipeline.steps.length} {t('gw.steps', locale)}</div>
      </div>
      <button
        onClick={() => onRun(pipeline)}
        className="px-3 py-1.5 bg-cp-primary text-white rounded-lg text-xs font-medium hover:opacity-90 opacity-0 group-hover:opacity-100 ml-3 shrink-0 transition-opacity"
      >
        {t('gw.run', locale)}
      </button>
    </div>
  );
}
