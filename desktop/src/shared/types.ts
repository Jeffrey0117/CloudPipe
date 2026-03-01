export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  port: number;
  directory: string;
  entryFile: string;
  buildCommand: string;
  healthEndpoint: string;
  pm2Name: string;
  runner?: 'node' | 'next' | 'tsx';
  domain?: string;
  webhookSecret?: string;
}

export interface Pm2Process {
  name: string;
  pid: number;
  status: 'online' | 'stopped' | 'errored' | 'launching';
  cpu: number;
  memory: number;
  uptime: number;
  restarts: number;
}

export interface ProjectWithStatus extends Project {
  pm2?: Pm2Process;
  lastDeploy?: Deployment;
  localPath?: string;
  webUrl?: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed';
  commit?: string;
  branch?: string;
  timestamp: number;
  duration?: number;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  projectId: string;
  method: string;
  path: string;
  parameters?: Record<string, unknown>;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  input: Record<string, PipelineInput>;
  steps: PipelineStep[];
}

export interface PipelineInput {
  type: string;
  required?: boolean;
  description?: string;
}

export interface PipelineStep {
  id: string;
  tool: string;
  params: Record<string, string>;
  continueOnError?: boolean;
}

export interface SystemInfo {
  uptime: number;
  nodeVersion: string;
  platform: string;
  hostname: string;
  memory: { total: number; free: number; used: number };
  cpu: { model: string; cores: number; usage: number };
}

export interface Machine {
  id: string;
  name: string;
  serverUrl: string;
  token: string;
}

export interface AppConfig {
  serverUrl: string;
  token: string;
  theme: 'dark' | 'light';
  locale: 'en' | 'zh';
  pollIntervals: {
    projects: number;
    logs: number;
    system: number;
  };
  machines: Machine[];
  activeMachineId: string;
  githubPat?: string;
}

export type Page = 'dashboard' | 'projects' | 'logs' | 'gateway' | 'deploy' | 'settings';

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'errored';

export interface TunnelInfo {
  status: TunnelStatus;
  pid?: number;
  uptime?: number;
  error?: string;
}

export type SetupStep =
  | 'input'
  | 'login'
  | 'bundle'
  | 'cloudflared'
  | 'credentials'
  | 'config'
  | 'tunnel_yml'
  | 'projects'
  | 'env'
  | 'complete'
  | 'failed';

export interface SetupProgress {
  step: SetupStep;
  message: string;
  error?: string;
}

export type StartupStep =
  | 'deleting'
  | 'starting_core'
  | 'health_check'
  | 'deploying'
  | 'starting_tunnel'
  | 'complete'
  | 'failed';

export interface StartupProgress {
  step: StartupStep;
  message: string;
  error?: string;
  currentProject?: string;
  totalProjects?: number;
  deployedCount?: number;
}

export interface FolderScanResult {
  name: string;
  entryFile: string;
  buildCommand: string;
  repoUrl: string;
  branch: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  hasGit: boolean;
  folderPath?: string;
}

export interface GitHubUser {
  login: string;
  name: string;
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  description: string;
  private: boolean;
  default_branch: string;
  language: string;
  clone_url: string;
  html_url: string;
  updated_at: string;
}

export interface RegisterProjectData {
  id: string;
  repoUrl: string;
  branch: string;
  port: number;
  entryFile: string;
  buildCommand: string;
  deployMethod: 'github' | 'manual';
}

export interface CloudPipeAPI {
  // Auth
  login: (serverUrl: string, password: string) => Promise<{ token: string }>;
  verifyToken: () => Promise<{ valid: boolean }>;
  logout: () => Promise<void>;

  // Projects
  getProjects: () => Promise<ProjectWithStatus[]>;
  deployProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  restartProject: (id: string) => Promise<{ success: boolean; error?: string }>;
  getDeployHistory: (id?: string) => Promise<Deployment[]>;

  // Logs
  getLogs: (pm2Name: string) => Promise<{ stdout: string; stderr: string }>;
  onLogUpdate: (callback: (data: { pm2Name: string; stdout: string; stderr: string }) => void) => () => void;

  // System
  getSystemInfo: () => Promise<SystemInfo>;

  // Gateway
  getTools: () => Promise<Tool[]>;
  getPipelines: () => Promise<Pipeline[]>;
  callTool: (tool: string, params: Record<string, unknown>) => Promise<unknown>;
  runPipeline: (pipeline: string, input: Record<string, unknown>) => Promise<unknown>;

  // PM2 local
  pm2StartAll: () => Promise<{ success: boolean; output?: string; error?: string }>;
  pm2StopAll: () => Promise<{ success: boolean; output?: string; error?: string }>;
  pm2Status: () => Promise<Pm2Process[]>;
  openUrl: (url: string) => Promise<void>;

  // Deploy All
  deployAll: () => Promise<{ results: Array<{ id: string; success: boolean; error?: string }> }>;

  // Machines
  getMachines: () => Promise<Machine[]>;
  addMachine: (machine: Machine) => Promise<void>;
  removeMachine: (id: string) => Promise<void>;
  switchMachine: (id: string) => Promise<AppConfig>;

  // Deploy (new project)
  browseFolder: () => Promise<string | null>;
  scanFolder: (folderPath: string) => Promise<FolderScanResult>;
  scanWorkspace: (folderPath: string) => Promise<FolderScanResult[]>;
  registerProject: (data: RegisterProjectData) => Promise<{ success: boolean; error?: string }>;
  getNextPort: () => Promise<number>;
  githubValidateToken: (pat: string) => Promise<GitHubUser>;
  githubGetRepos: (pat: string) => Promise<GitHubRepo[]>;
  githubSearchRepos: (query: string, pat?: string) => Promise<GitHubRepo[]>;
  githubGetStarred: (pat: string) => Promise<GitHubRepo[]>;

  // Config
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: Partial<AppConfig>) => Promise<void>;

  // Window
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;

  // Push events
  onDeployStatus: (callback: (data: { projectId: string; status: string }) => void) => () => void;
  onConnectionStatus: (callback: (data: { connected: boolean }) => void) => () => void;
  onNavigatePage: (callback: (page: Page) => void) => () => void;

  // Tunnel
  tunnelStart: () => Promise<{ success: boolean; error?: string }>;
  tunnelStop: () => Promise<{ success: boolean; error?: string }>;
  tunnelStatus: () => Promise<TunnelInfo>;

  // Startup sequence
  startupSequence: () => Promise<{ success: boolean; error?: string }>;

  // Push events
  onStartupProgress: (callback: (data: StartupProgress) => void) => () => void;
  onTunnelStatus: (callback: (data: TunnelInfo) => void) => () => void;

  // Setup
  setup: (serverUrl: string, password: string) => Promise<{ success: boolean; error?: string }>;
  checkNeedsSetup: () => Promise<boolean>;
  onSetupProgress: (callback: (data: SetupProgress) => void) => () => void;

  // Triggered by main (shortcuts / tray)
  onTriggerDeployAll: (callback: () => void) => () => void;
  onTriggerStartAll: (callback: () => void) => () => void;
  onTriggerStopAll: (callback: () => void) => () => void;
}
