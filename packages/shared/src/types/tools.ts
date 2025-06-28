export type ToolPermissionLevel = 'auto' | 'user_approval' | 'admin_approval' | 'denied';

export type ToolExecutionStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'executing' 
  | 'completed' 
  | 'error' 
  | 'timeout';

export type ToolCategory = 
  | 'filesystem' 
  | 'network' 
  | 'system' 
  | 'development' 
  | 'database' 
  | 'mcp'
  | 'custom';

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  permissionLevel: ToolPermissionLevel;
  isEnabled: boolean;
  isSandboxed: boolean;
  timeout: number; // in milliseconds
  metadata?: Record<string, unknown>;
  source?: 'builtin' | 'mcp' | 'plugin';
  mcpServerId?: string;
}

export interface ToolExecution {
  id: string;
  toolId: string;
  toolName: string;
  messageId: string;
  conversationId: string;
  userId: string;
  input: Record<string, unknown>;
  output?: string | Record<string, unknown>;
  status: ToolExecutionStatus;
  approvedBy?: string;
  approvedAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  executionTime?: number;
  error?: ToolExecutionError;
  metadata?: Record<string, unknown>;
  sandboxInfo?: SandboxInfo;
}

export interface ToolExecutionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface SandboxInfo {
  containerId?: string;
  workingDirectory: string;
  environment: Record<string, string>;
  resourceLimits: ResourceLimits;
  networkAccess: boolean;
  filesystemAccess: 'none' | 'readonly' | 'readwrite';
}

export interface ResourceLimits {
  maxMemory: number; // in bytes
  maxCpu: number; // as percentage 
  maxExecutionTime: number; // in milliseconds
  maxFileSize: number; // in bytes
  maxNetworkRequests?: number;
}

export interface ToolResult {
  toolExecutionId: string;
  success: boolean;
  output?: string | Record<string, unknown>;
  error?: ToolExecutionError;
  executionTime: number;
  resourceUsage?: ResourceUsage;
  artifacts?: ToolArtifact[];
}

export interface ResourceUsage {
  memoryUsed: number;
  cpuTime: number;
  networkRequests: number;
  filesAccessed: string[];
}

export interface ToolArtifact {
  id: string;
  name: string;
  type: 'file' | 'image' | 'data';
  content: string; // base64 encoded for binary data
  mimeType: string;
  size: number;
  metadata?: Record<string, unknown>;
}

export interface ToolApprovalRequest {
  id: string;
  toolExecutionId: string;
  toolName: string;
  input: Record<string, unknown>;
  requiredBy: Date;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
  requestedBy: string;
  requestedAt: Date;
  approvers: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export interface ToolRegistry {
  tools: Tool[];
  categories: ToolCategory[];
  defaultPermissions: Record<ToolCategory, ToolPermissionLevel>;
  sandboxConfig: SandboxConfig;
}

export interface SandboxConfig {
  enabled: boolean;
  defaultLimits: ResourceLimits;
  allowedNetworkHosts: string[];
  blockedCommands: string[];
  allowedFileExtensions: string[];
  maxConcurrentExecutions: number;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  version: string;
  isEnabled: boolean;
  tools: Tool[];
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked?: Date;
  metadata?: Record<string, unknown>;
}