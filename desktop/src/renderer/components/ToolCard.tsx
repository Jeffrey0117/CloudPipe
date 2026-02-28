import { t } from '../i18n';
import type { Tool } from '@shared/types';
import type { Locale } from '../i18n';

interface ToolCardProps {
  tool: Tool;
  onTryIt: (tool: Tool) => void;
  locale: Locale;
}

export function ToolCard({ tool, onTryIt, locale }: ToolCardProps) {
  return (
    <div className="card flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-cp-text truncate">{tool.name}</div>
        <div className="text-xs text-cp-muted truncate">{tool.description}</div>
      </div>
      <button
        onClick={() => onTryIt(tool)}
        className="px-3 py-1.5 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors opacity-0 group-hover:opacity-100 ml-3 shrink-0"
      >
        {t('gw.tryIt', locale)}
      </button>
    </div>
  );
}
