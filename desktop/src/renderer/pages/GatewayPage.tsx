import { useState } from 'react';
import { useGateway } from '../hooks/useGateway';
import { useAppStore } from '../stores/app-store';
import { ToolCard } from '../components/ToolCard';
import { PipelineCard } from '../components/PipelineCard';
import { t } from '../i18n';
import type { CloudPipeAPI, Tool, Pipeline } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function GatewayPage() {
  const { tools, pipelines, loading, refresh } = useGateway();
  const locale = useAppStore((s) => s.locale);
  const [tab, setTab] = useState<'tools' | 'pipelines'>('tools');
  const [modal, setModal] = useState<{ type: 'tool' | 'pipeline'; item: Tool | Pipeline } | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string>('');
  const [running, setRunning] = useState(false);

  const grouped = tools.reduce<Record<string, Tool[]>>((acc, tool) => {
    const group = tool.projectId || 'unknown';
    return { ...acc, [group]: [...(acc[group] || []), tool] };
  }, {});

  const handleTryTool = (tool: Tool) => {
    setModal({ type: 'tool', item: tool });
    setParams({});
    setResult('');
  };

  const handleRunPipeline = (pipeline: Pipeline) => {
    setModal({ type: 'pipeline', item: pipeline });
    setParams({});
    setResult('');
  };

  const handleExecute = async () => {
    if (!modal) return;
    setRunning(true);
    setResult('');
    try {
      let data: unknown;
      if (modal.type === 'tool') {
        data = await api.callTool((modal.item as Tool).name, params);
      } else {
        data = await api.runPipeline((modal.item as Pipeline).id, params);
      }
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('gw.title', locale)}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('tools')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'tools' ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('gw.tools', locale)} ({tools.length})
          </button>
          <button
            onClick={() => setTab('pipelines')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'pipelines' ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('gw.pipelines', locale)} ({pipelines.length})
          </button>
        </div>
        <button
          onClick={refresh}
          className="ml-auto px-3 py-1 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
          disabled={loading}
        >
          {loading ? t('gw.loading', locale) : t('gw.refresh', locale)}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {tab === 'tools' && Object.entries(grouped).map(([projectId, projectTools]) => (
          <div key={projectId}>
            <h3 className="text-xs font-bold text-cp-muted uppercase mb-2">{projectId}</h3>
            <div className="space-y-1">
              {projectTools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} onTryIt={handleTryTool} locale={locale} />
              ))}
            </div>
          </div>
        ))}
        {tab === 'pipelines' && pipelines.map((p) => (
          <PipelineCard key={p.id} pipeline={p} onRun={handleRunPipeline} locale={locale} />
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-cp-surface border border-cp-border rounded-xl p-5 w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-1">
              {modal.type === 'tool' ? (modal.item as Tool).name : (modal.item as Pipeline).name}
            </h3>
            <p className="text-xs text-cp-muted mb-4">
              {modal.type === 'tool' ? (modal.item as Tool).description : (modal.item as Pipeline).description}
            </p>
            <div className="space-y-2 mb-4">
              <label className="block text-xs text-cp-muted">{t('gw.params', locale)}</label>
              <textarea
                value={JSON.stringify(params, null, 2)}
                onChange={(e) => {
                  try { setParams(JSON.parse(e.target.value)); } catch { /* ignore */ }
                }}
                className="w-full h-24 px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-xs font-mono text-cp-text focus:outline-none focus:border-cp-primary resize-none"
              />
            </div>
            <div className="flex gap-2 mb-4">
              <button onClick={handleExecute} disabled={running} className="btn-primary text-xs">
                {running ? t('gw.running', locale) : t('gw.execute', locale)}
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors">
                {t('gw.cancel', locale)}
              </button>
            </div>
            {result && (
              <pre className="bg-cp-bg border border-cp-border p-3 rounded-lg text-xs font-mono text-cp-text overflow-x-auto max-h-60 whitespace-pre-wrap">
                {result}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
