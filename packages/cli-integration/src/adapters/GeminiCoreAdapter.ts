import { EventEmitter } from 'eventemitter3';
import type { 
  Message, 
  MessageContent,
  MessageRole,
  MessageStatus,
  Conversation,
  Tool as WebUITool,
  ToolExecution,
  ToolResult,
  ToolExecutionStatus,
  ToolParameter
} from '@gemini-cli-webui/shared';

// 导入类型定义（这些应该从实际的 gemini-cli 包中导入）
interface GeminiTool {
  name: string;
  displayName: string;
  description: string;
  schema: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  isOutputMarkdown: boolean;
  canUpdateOutput: boolean;
  shouldConfirmExecute(params: any, signal: AbortSignal): Promise<any>;
  execute(params: any, signal: AbortSignal, updateOutput?: (output: string) => void): Promise<any>;
}

interface GeminiClient {
  sendMessage(content: string, options?: any): Promise<any>;
  getTools(): GeminiTool[];
  setApiKey(key: string): void;
  setModel(model: string): void;
}

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Gemini Core 适配器 - 直接集成 gemini-cli 核心模块
 */
export class GeminiCoreAdapter extends EventEmitter {
  private client: GeminiClient | null = null;
  private initialized = false;
  private currentConversation: Conversation | null = null;
  private abortController: AbortController | null = null;
  
  constructor(private config: GeminiConfig) {
    super();
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 动态导入 gemini-cli 核心模块
      const geminiModule = await this.loadGeminiModule();
      
      if (!geminiModule) {
        throw new Error('Failed to load gemini-cli core module');
      }

      // 创建客户端实例
      this.client = this.createGeminiClient(geminiModule);
      
      // 配置客户端
      if (this.config.apiKey) {
        this.client.setApiKey(this.config.apiKey);
      }
      if (this.config.model) {
        this.client.setModel(this.config.model);
      }

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      const errorMessage = `Failed to initialize Gemini Core: ${error instanceof Error ? error.message : String(error)}`;
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 动态加载 gemini-cli 模块
   */
  private async loadGeminiModule(): Promise<any> {
    try {
      // 尝试多种导入路径
      const paths = [
        '@google/gemini-cli/core',
        '../../../../../gemini-cli/packages/core/dist/index.js',
        'gemini-cli-core'
      ];

      for (const modulePath of paths) {
        try {
          const module = await import(modulePath);
          return module;
        } catch (e) {
          continue;
        }
      }

      // 如果都失败了，尝试使用全局安装的版本
      const { execSync } = await import('child_process');
      const globalPath = execSync('npm root -g').toString().trim();
      const globalModule = await import(`${globalPath}/@google/gemini-cli/bundle/gemini.js`);
      return globalModule;

    } catch (error) {
      console.error('Failed to load gemini-cli module:', error);
      return null;
    }
  }

  /**
   * 创建 Gemini 客户端实例
   */
  private createGeminiClient(module: any): GeminiClient {
    // 这里应该根据实际的 gemini-cli API 创建客户端
    // 以下是基于分析的推测实现
    const { GeminiChat, ToolRegistry, Config } = module;
    
    const config = new Config();
    const toolRegistry = new ToolRegistry();
    const client = new GeminiChat(config, toolRegistry);

    return {
      sendMessage: async (content: string, options?: any) => {
        return client.sendMessage(content, options);
      },
      getTools: () => {
        return toolRegistry.getAllTools();
      },
      setApiKey: (key: string) => {
        config.setApiKey(key);
      },
      setModel: (model: string) => {
        config.setModel(model);
      }
    };
  }

  /**
   * 发送消息
   */
  async sendMessage(
    conversation: Conversation,
    content: string | MessageContent,
    options?: {
      stream?: boolean;
      onStream?: (chunk: string) => void;
      tools?: WebUITool[];
    }
  ): Promise<Message> {
    if (!this.initialized || !this.client) {
      throw new Error('Adapter not initialized');
    }

    // 创建用户消息
    const userMessage: Message = {
      id: this.generateId('msg'),
      conversationId: conversation.id,
      role: 'user' as MessageRole,
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : [content as MessageContent],
      status: 'completed' as MessageStatus,
      timestamp: new Date()
    };

    conversation.messages.push(userMessage);
    this.emit('message:sent', userMessage);

    try {
      // 创建新的 AbortController
      this.abortController = new AbortController();

      // 准备选项
      const geminiOptions = {
        stream: options?.stream,
        signal: this.abortController.signal,
        history: this.buildHistory(conversation),
        tools: options?.tools ? this.convertTools(options.tools) : undefined
      };

      // 处理流式响应
      if (options?.stream && options.onStream) {
        const response = await this.handleStreamResponse(
          content,
          geminiOptions,
          options.onStream
        );
        
        return this.createAssistantMessage(conversation, response);
      }

      // 非流式响应
      const response = await this.client.sendMessage(
        typeof content === 'string' ? content : content.text,
        geminiOptions
      );

      return this.createAssistantMessage(conversation, response.text);

    } catch (error) {
      const errorMessage = `Failed to send message: ${error instanceof Error ? error.message : String(error)}`;
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamResponse(
    content: string | MessageContent,
    options: any,
    onStream: (chunk: string) => void
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let fullResponse = '';
      
      try {
        const stream = await this.client!.sendMessage(
          typeof content === 'string' ? content : content.text,
          { ...options, stream: true }
        );

        for await (const chunk of stream) {
          fullResponse += chunk;
          onStream(chunk);
          this.emit('stream:chunk', chunk);
        }

        resolve(fullResponse);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 创建助手消息
   */
  private createAssistantMessage(conversation: Conversation, content: string): Message {
    const assistantMessage: Message = {
      id: this.generateId('msg'),
      conversationId: conversation.id,
      role: 'assistant' as MessageRole,
      content: [{ type: 'text', text: content }],
      status: 'completed' as MessageStatus,
      timestamp: new Date()
    };

    conversation.messages.push(assistantMessage);
    conversation.updatedAt = new Date();
    this.emit('message:received', assistantMessage);

    return assistantMessage;
  }

  /**
   * 执行工具
   */
  async executeTool(
    tool: WebUITool,
    input: any,
    context?: {
      conversationId?: string;
      userId?: string;
    }
  ): Promise<ToolResult> {
    if (!this.initialized || !this.client) {
      throw new Error('Adapter not initialized');
    }

    const execution: ToolExecution = {
      id: this.generateId('exec'),
      toolId: tool.id,
      toolName: tool.name,
      messageId: this.generateId('msg'),
      conversationId: context?.conversationId || '',
      userId: context?.userId || 'user',
      input,
      status: 'pending' as ToolExecutionStatus
    };

    this.emit('tool:execution:started', execution);

    try {
      // 找到对应的 Gemini 工具
      const geminiTools = this.client.getTools();
      const geminiTool = geminiTools.find(t => t.name === tool.name);

      if (!geminiTool) {
        throw new Error(`Tool ${tool.name} not found`);
      }

      // 创建 AbortController
      const abortController = new AbortController();

      // 检查是否需要确认
      const confirmDetails = await geminiTool.shouldConfirmExecute(input, abortController.signal);
      if (confirmDetails) {
        // 发出需要确认的事件
        this.emit('tool:confirmation:required', execution, confirmDetails);
        
        // 等待确认（这里简化处理，实际应该有确认机制）
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 执行工具
      const startTime = Date.now();
      const output = await geminiTool.execute(
        input,
        abortController.signal,
        (update: string) => {
          this.emit('tool:execution:update', execution, update);
        }
      );

      const executionTime = Date.now() - startTime;

      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.output = output;

      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: true,
        output,
        executionTime
      };

      this.emit('tool:execution:completed', execution, result);
      return result;

    } catch (error) {
      execution.status = 'error';
      execution.error = { 
        code: 'EXECUTION_ERROR', 
        message: error instanceof Error ? error.message : String(error) 
      };

      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: false,
        error: execution.error,
        executionTime: 0
      };

      this.emit('tool:execution:failed', execution, error);
      return result;
    }
  }

  /**
   * 获取可用工具
   */
  async getAvailableTools(): Promise<WebUITool[]> {
    if (!this.initialized || !this.client) {
      throw new Error('Adapter not initialized');
    }

    const geminiTools = this.client.getTools();
    return geminiTools.map(this.convertGeminiTool);
  }

  /**
   * 转换 Gemini 工具到 WebUI 工具格式
   */
  private convertGeminiTool(tool: GeminiTool): WebUITool {
    // 解析参数 schema
    const parameters: ToolParameter[] = [];
    if (tool.schema.parameters && typeof tool.schema.parameters === 'object') {
      const props = (tool.schema.parameters as any).properties || {};
      const required = (tool.schema.parameters as any).required || [];

      for (const [name, schema] of Object.entries(props)) {
        const param = schema as any;
        parameters.push({
          name,
          type: param.type || 'string',
          description: param.description || '',
          required: required.includes(name),
          defaultValue: param.default,
          enum: param.enum
        });
      }
    }

    return {
      id: tool.name,
      name: tool.name,
      description: tool.description,
      category: 'general', // 需要更好的分类逻辑
      parameters,
      permissionLevel: 'user', // 需要实际的权限映射
      isEnabled: true,
      isSandboxed: false, // 需要检查实际的沙箱状态
      timeout: 30000, // 默认超时
      source: 'gemini-cli',
      metadata: {
        displayName: tool.displayName,
        isOutputMarkdown: tool.isOutputMarkdown,
        canUpdateOutput: tool.canUpdateOutput
      }
    };
  }

  /**
   * 转换 WebUI 工具到 Gemini 工具格式
   */
  private convertTools(tools: WebUITool[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.buildParameterSchema(tool.parameters)
    }));
  }

  /**
   * 构建参数 schema
   */
  private buildParameterSchema(parameters: ToolParameter[]): Record<string, unknown> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        default: param.defaultValue,
        enum: param.enum
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * 构建历史消息
   */
  private buildHistory(conversation: Conversation): any[] {
    return conversation.messages.map(msg => ({
      role: msg.role,
      parts: msg.content.map(c => {
        if (c.type === 'text') {
          return { text: c.text };
        }
        // 处理其他内容类型
        return { text: '' };
      })
    }));
  }

  /**
   * 创建新对话
   */
  async createConversation(title?: string, userId?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateId('conv'),
      title: title || 'New Conversation',
      userId: userId || 'user',
      messages: [],
      isActive: true,
      metadata: {
        model: this.config.model,
        temperature: this.config.temperature,
        adapter: 'gemini-core'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentConversation = conversation;
    this.emit('conversation:created', conversation);
    
    return conversation;
  }

  /**
   * 中止当前操作
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.abort();
    this.client = null;
    this.initialized = false;
    this.currentConversation = null;
    this.emit('disconnected');
  }

  /**
   * 生成唯一 ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 创建 Gemini Core 适配器实例
 */
export function createGeminiCoreAdapter(config: GeminiConfig): GeminiCoreAdapter {
  return new GeminiCoreAdapter(config);
}