// 适配器
export * from './adapters/index.js';

// 桥接器
export * from './bridges/index.js';

// 服务
export * from './services/index.js';

// 包装器
export * from './wrappers/index.js';

// 工具 - 暂时移除直到修复
// export * from './tools/index.js';

// 主要导出
export { CoreService as CLIIntegration } from './services/CoreService.js';
export { GeminiClientAdapter } from './adapters/GeminiClientAdapter.js';
export { ToolAdapter } from './adapters/ToolAdapter.js';
export { GeminiToolWrapper } from './wrappers/GeminiToolWrapper.js';
// export { EnhancedToolAdapter } from './adapters/EnhancedToolAdapter.js';
export { ApprovalBridge } from './bridges/ApprovalBridge.js';
// export { ToolRegistry } from './tools/ToolRegistry.js';

// 版本信息
export const VERSION = '0.2.0';
export const BUILD_DATE = new Date().toISOString();

// 默认配置
export const DEFAULT_CONFIG = {
  geminiClient: {
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 30000,
    sandboxEnabled: true,
    toolsEnabled: true,
    debugMode: false
  },
  toolAdapter: {
    defaultPermissionLevel: 'user_approval' as const,
    enableSandbox: true,
    maxConcurrentExecutions: 5,
    executionTimeout: 30000,
    approvalTimeout: 300000,
    debugMode: false
  },
  approvalBridge: {
    defaultTimeout: 300000,
    maxEscalationLevels: 3,
    enableNotifications: true,
    enableAuditLog: true,
    autoCleanupExpired: true,
    cleanupInterval: 60000,
    debugMode: false
  },
  coreService: {
    enableWebSocketNotifications: true,
    enableMetrics: true,
    maxConcurrentSessions: 10,
    sessionTimeout: 1800000,
    debugMode: false
  }
} as const;