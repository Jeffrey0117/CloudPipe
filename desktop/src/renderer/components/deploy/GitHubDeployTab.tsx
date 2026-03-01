import { useState, useEffect, useRef } from 'react';
import { DeployForm } from './DeployForm';
import { t } from '../../i18n';
import type { Locale } from '../../i18n';
import type { CloudPipeAPI, GitHubUser, GitHubRepo, RegisterProjectData } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

type GhTab = 'search' | 'mine' | 'starred';

interface GitHubDeployTabProps {
  locale: Locale;
}

function RepoCard({ repo, selected, deployed, onSelect }: {
  repo: GitHubRepo; selected: boolean; deployed: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
        selected
          ? 'border-cp-primary bg-cp-primary/10'
          : deployed
          ? 'border-cp-border/30 opacity-40'
          : 'border-transparent hover:bg-cp-surface/80'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-cp-text font-medium">{repo.full_name}</span>
        {repo.private && (
          <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px]">private</span>
        )}
        {repo.language && (
          <span className="px-1.5 py-0.5 rounded bg-cp-border/50 text-cp-muted text-[10px]">{repo.language}</span>
        )}
        {deployed && (
          <span className="px-1.5 py-0.5 rounded bg-cp-border/50 text-cp-muted text-[10px]">Deployed</span>
        )}
        <span className="ml-auto text-[10px] text-cp-muted">{repo.default_branch}</span>
      </div>
      {repo.description && (
        <div className="text-[11px] text-cp-muted mt-0.5 truncate">{repo.description}</div>
      )}
    </button>
  );
}

export function GitHubDeployTab({ locale }: GitHubDeployTabProps) {
  const [tab, setTab] = useState<GhTab>('search');

  // Token
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [tokenConnecting, setTokenConnecting] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // My repos / starred — separate loading flags
  const [myRepos, setMyRepos] = useState<GitHubRepo[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [starred, setStarred] = useState<GitHubRepo[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);

  // Selected
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [nextPort, setNextPort] = useState(0);
  const [error, setError] = useState('');
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  // Load saved token + existing projects
  useEffect(() => {
    api.getConfig().then((config) => {
      if (config.githubPat) {
        setToken(config.githubPat);
        setTokenInput(config.githubPat);
        api.githubValidateToken(config.githubPat)
          .then((ghUser) => setUser(ghUser))
          .catch(() => { /* expired */ });
      }
    });
    api.getProjects().then((projects) => {
      setExistingIds(new Set(projects.map((p) => p.id)));
    }).catch(() => {});
  }, []);

  // --- Token connect ---
  const connectToken = async (inputToken: string) => {
    if (!inputToken.trim()) return;
    setTokenConnecting(true);
    setError('');
    try {
      const ghUser = await api.githubValidateToken(inputToken);
      setUser(ghUser);
      setToken(inputToken);
      await api.setConfig({ githubPat: inputToken });
      setShowTokenPrompt(false);
      // tab 已經在對的位置，直接用新 token 載入
      if (tab === 'mine') loadMyRepos(inputToken);
      if (tab === 'starred') loadStarred(inputToken);
    } catch {
      setError(locale === 'zh' ? 'Token 無效，請確認後重試' : 'Invalid token, please check and retry');
    } finally {
      setTokenConnecting(false);
    }
  };

  // --- Tab click: 永遠切 tab，沒 token 就顯示提示 ---
  const handleTabClick = (target: GhTab) => {
    setTab(target);
    if ((target === 'mine' || target === 'starred') && !user) {
      setShowTokenPrompt(true);
    } else {
      setShowTokenPrompt(false);
    }
  };

  // Load data when switching tabs
  useEffect(() => {
    if (tab === 'mine' && myRepos.length === 0 && token) loadMyRepos();
    if (tab === 'starred' && starred.length === 0 && token) loadStarred();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Search ---
  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => doSearch(q), 400);
  };

  const doSearch = async (q: string) => {
    setSearching(true);
    setError('');
    try {
      const results = await api.githubSearchRepos(q, token || undefined);
      setSearchResults(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const loadMyRepos = async (pat?: string) => {
    const usePat = pat || token;
    if (!usePat) return;
    setLoadingMine(true);
    try {
      const repos = await api.githubGetRepos(usePat);
      setMyRepos(repos);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMine(false);
    }
  };

  const loadStarred = async (pat?: string) => {
    const usePat = pat || token;
    if (!usePat) return;
    setLoadingStarred(true);
    try {
      const repos = await api.githubGetStarred(usePat);
      setStarred(repos);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingStarred(false);
    }
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    try {
      const port = await api.getNextPort();
      setNextPort(port);
    } catch { /* ignore */ }
  };

  const isLoading = (tab === 'mine' && loadingMine) || (tab === 'starred' && loadingStarred);

  const currentRepos = tab === 'search' ? searchResults
    : tab === 'mine' ? myRepos
    : starred;

  const formData: Partial<RegisterProjectData> | null = selectedRepo
    ? {
        id: selectedRepo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        port: nextPort,
        entryFile: 'index.js',
        buildCommand: '',
        repoUrl: selectedRepo.clone_url,
        branch: selectedRepo.default_branch,
        deployMethod: 'github',
      }
    : null;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-1">
        {(['search', 'mine', 'starred'] as GhTab[]).map((id) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === id ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t(`deploy.ghTab_${id}` as 'deploy.ghTab_search', locale)}
          </button>
        ))}
        {user && (
          <span className="ml-auto text-[11px] text-cp-muted">{user.login}</span>
        )}
      </div>

      {/* Token prompt */}
      {showTokenPrompt && (
        <div className="bg-cp-bg rounded-lg border border-cp-border p-4 space-y-3">
          <div className="text-xs text-cp-text">{t('deploy.ghTokenTitle', locale)}</div>
          <div className="text-[11px] text-cp-muted">{t('deploy.ghTokenDesc', locale)}</div>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); api.openUrl('https://github.com/settings/tokens/new?scopes=repo&description=CloudPipe'); }}
            className="text-[11px] text-cp-primary hover:underline block"
          >
            {t('deploy.ghTokenCreate', locale)}
          </a>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 px-3 py-1.5 bg-cp-surface border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              onKeyDown={(e) => e.key === 'Enter' && connectToken(tokenInput)}
            />
            <button
              onClick={() => connectToken(tokenInput)}
              disabled={tokenConnecting || !tokenInput.trim()}
              className="btn-primary text-xs"
            >
              {tokenConnecting ? '...' : t('deploy.ghConnect', locale)}
            </button>
            <button
              onClick={() => { setShowTokenPrompt(false); setTab('search'); }}
              className="px-3 py-1.5 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
            >
              {t('gw.cancel', locale)}
            </button>
          </div>
        </div>
      )}

      {/* Search bar */}
      {tab === 'search' && !showTokenPrompt && (
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder={t('deploy.ghSearchPlaceholder', locale)}
            className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
            autoFocus
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cp-muted animate-pulse">
              {t('deploy.ghSearching', locale)}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {isLoading && (
        <div className="text-xs text-cp-muted animate-pulse py-4 text-center">{t('gw.loading', locale)}</div>
      )}

      {currentRepos.length > 0 && (
        <div className="overflow-y-auto space-y-1" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {currentRepos.map((repo) => {
            const id = repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            return (
              <RepoCard
                key={repo.full_name}
                repo={repo}
                selected={selectedRepo?.full_name === repo.full_name}
                deployed={existingIds.has(id)}
                onSelect={() => handleSelectRepo(repo)}
              />
            );
          })}
        </div>
      )}

      {tab === 'search' && searchQuery && !searching && searchResults.length === 0 && (
        <div className="text-xs text-cp-muted text-center py-4">{t('deploy.ghNoResults', locale)}</div>
      )}

      {/* Modal */}
      {formData && selectedRepo && (
        <DeployForm
          key={selectedRepo.full_name}
          locale={locale}
          initialData={formData}
          onSuccess={() => {
            const id = selectedRepo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            setExistingIds((prev) => new Set([...prev, id]));
            setSelectedRepo(null);
          }}
          onClose={() => setSelectedRepo(null)}
        />
      )}
    </div>
  );
}
