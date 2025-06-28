/**
 * 适配器配置
 * 用于配置和选择不同的 Gemini CLI 集成方式
 */

export enum AdapterType {
  MOCK = 'mock',           // 模拟适配器（用于开发和测试）
  SUBPROCESS = 'subprocess', // 子进程适配器（通过命令行调用）
  CORE = 'core',           // 核心适配器（直接集成核心模块）
  API = 'api'              // API 适配器（通过 HTTP API）
}

export interface AdapterConfig {
  type: AdapterType;
  apiKey?: string;
  model?: string;
  geminiExecutablePath?: string;
  apiEndpoint?: string;
  debugMode?: boolean;
  timeout?: number;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

/**
 * 获取默认的适配器配置
 */
export function getDefaultAdapterConfig(): AdapterConfig {
  // 根据环境变量决定默认适配器
  const adapterType = process.env.GEMINI_ADAPTER_TYPE || AdapterType.MOCK;
  
  return {
    type: adapterType as AdapterType,
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-pro',
    geminiExecutablePath: process.env.GEMINI_EXECUTABLE_PATH,
    apiEndpoint: process.env.GEMINI_API_ENDPOINT,
    debugMode: process.env.NODE_ENV === 'development',
    timeout: 60000,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000
    }
  };
}

/**
 * 创建适配器工厂函数
 */
export async function createAdapter(config: AdapterConfig) {
  const { 
    GeminiClientAdapter, 
    RealGeminiAdapter, 
    GeminiCoreAdapter 
  } = await import('../adapters/index.js');

  switch (config.type) {
    case AdapterType.MOCK:
      // 使用模拟适配器
      return new GeminiClientAdapter({
        apiKey: config.apiKey,
        model: config.model,
        debugMode: config.debugMode,
        timeout: config.timeout,
        retryConfig: config.retryConfig
      });

    case AdapterType.SUBPROCESS:
      // 使用子进程适配器
      return new RealGeminiAdapter({
        geminiExecutablePath: config.geminiExecutablePath,
        apiKey: config.apiKey,
        model: config.model,
        debugMode: config.debugMode
      });

    case AdapterType.CORE:
      // 使用核心适配器
      return new GeminiCoreAdapter({
        apiKey: config.apiKey,
        model: config.model
      });

    case AdapterType.API:
      // TODO: 实现 API 适配器
      throw new Error('API adapter not implemented yet');

    default:
      throw new Error(`Unknown adapter type: ${config.type}`);
  }
}

/**
 * 验证适配器配置
 */
export function validateAdapterConfig(config: AdapterConfig): string[] {
  const errors: string[] = [];

  // 验证必需的配置
  switch (config.type) {
    case AdapterType.SUBPROCESS:
      if (!config.geminiExecutablePath) {
        // 尝试使用默认路径
        config.geminiExecutablePath = 'gemini';
      }
      break;

    case AdapterType.CORE:
    case AdapterType.API:
      if (!config.apiKey && !process.env.GEMINI_API_KEY) {
        errors.push('API key is required for core and API adapters');
      }
      break;
  }

  // 验证模型
  const validModels = [
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-ultra',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];

  if (config.model && !validModels.includes(config.model)) {
    errors.push(`Invalid model: ${config.model}. Valid models: ${validModels.join(', ')}`);
  }

  return errors;
}

/**
 * 适配器功能检测
 */
export interface AdapterCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  codeExecution: boolean;
  memorySupport: boolean;
  mcpSupport: boolean;
  sandboxing: boolean;
}

/**
 * 获取适配器功能
 */
export function getAdapterCapabilities(type: AdapterType): AdapterCapabilities {
  switch (type) {
    case AdapterType.MOCK:
      return {
        streaming: true,
        tools: true,
        vision: false,
        codeExecution: false,
        memorySupport: true,
        mcpSupport: false,
        sandboxing: false
      };

    case AdapterType.SUBPROCESS:
      return {
        streaming: true,
        tools: true,
        vision: true,
        codeExecution: true,
        memorySupport: true,
        mcpSupport: true,
        sandboxing: true
      };

    case AdapterType.CORE:
      return {
        streaming: true,
        tools: true,
        vision: true,
        codeExecution: true,
        memorySupport: true,
        mcpSupport: true,
        sandboxing: false
      };

    case AdapterType.API:
      return {
        streaming: true,
        tools: true,
        vision: true,
        codeExecution: false,
        memorySupport: false,
        mcpSupport: false,
        sandboxing: false
      };

    default:
      return {
        streaming: false,
        tools: false,
        vision: false,
        codeExecution: false,
        memorySupport: false,
        mcpSupport: false,
        sandboxing: false
      };
  }
}