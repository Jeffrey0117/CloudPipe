export interface Project {
  id: string;
  name: string;
  repo: string;
  branch: string;
  port: number;
  entryFile: string;
  buildCommand: string;
  healthEndpoint: string;
  pm2Name: string;
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

export interface AppConfig {
  serverUrl: string;
  token: string;
  theme: 'dark' | 'light';
  pollIntervals: {
    projects: number;
    logs: number;
    system: number;
  };
}

export type Page = 'dashboard' | 'projects' | 'logs' | 'gateway' | 'settings';

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
}
