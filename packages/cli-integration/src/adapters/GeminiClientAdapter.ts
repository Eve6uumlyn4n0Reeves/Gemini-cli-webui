import { EventEmitter } from 'eventemitter3';
import type { 
  Message, 
  MessageContent,
  MessageRole,
  MessageStatus,
  Conversation, 
  User,
  Tool,
  ToolExecution,
  ToolResult,
  ToolExecutionStatus
} from '@gemini-cli-webui/shared';

/**
 * Gemini CLI 客户端配置
 */
export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  debugMode?: boolean;
  customSystemPrompt?: string;
  enableStreaming?: boolean;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

/**
 * Gemini CLI 客户端适配器
 * 
 * 这个类是 WebUI 和 Gemini CLI Core 之间的桥梁
 * 提供了统一的接口来处理对话、消息和工具执行
 * 
 * @example
 * ```typescript
 * const adapter = new GeminiClientAdapter({
 *   apiKey: 'your-api-key',
 *   model: 'gemini-pro'
 * });
 * 
 * await adapter.initialize();
 * const response = await adapter.sendMessage(conversation, 'Hello!');
 * ```
 */
export class GeminiClientAdapter extends EventEmitter {
  private config: GeminiClientConfig;
  private initialized = false;
  private currentConversation: Conversation | null = null;
  private status: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';
  private errorMessage?: string;
  
  constructor(config: GeminiClientConfig) {
    super();
    this.config = {
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 2048,
      timeout: 30000,
      debugMode: false,
      enableStreaming: true,
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000
      },
      ...config
    };
  }

  /**
   * 获取当前状态
   */
  getStatus(): { status: string; error?: string } {
    return {
      status: this.status,
      error: this.errorMessage
    };
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.debugLog('适配器已经初始化');
      return;
    }

    try {
      this.setStatus('connecting');
      this.debugLog('开始初始化 Gemini CLI 适配器');

      // 模拟初始化过程
      await new Promise(resolve => setTimeout(resolve, 100));

      this.initialized = true;
      this.setStatus('connected');
      this.debugLog('Gemini CLI 适配器初始化完成');

    } catch (error) {
      this.setStatus('error');
      const errorMessage = `初始化失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 创建新对话
   */
  async createConversation(title?: string, userId?: string): Promise<Conversation> {
    this.ensureInitialized();
    
    const conversation: Conversation = {
      id: this.generateId('conv'),
      title: title || 'New Conversation',
      userId: userId || 'anonymous',
      messages: [],
      isActive: true,
      metadata: {
        model: this.config.model,
        temperature: this.config.temperature
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentConversation = conversation;
    this.emit('conversation:created', conversation);
    
    return conversation;
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
      tools?: Tool[];
    }
  ): Promise<Message> {
    this.ensureInitialized();
    
    // 创建用户消息
    const userMessage: Message = {
      id: this.generateId('msg'),
      conversationId: conversation.id,
      role: 'user' as MessageRole,
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : [content as MessageContent],
      status: 'completed' as MessageStatus,
      timestamp: new Date()
    };

    // 添加到对话历史
    conversation.messages.push(userMessage);
    this.emit('message:sent', userMessage);

    try {
      // 模拟 AI 响应
      const responseText = await this.generateResponse(conversation, userMessage, options);
      
      const assistantMessage: Message = {
        id: this.generateId('msg'),
        conversationId: conversation.id,
        role: 'assistant' as MessageRole,
        content: [{ type: 'text', text: responseText }],
        status: 'completed' as MessageStatus,
        timestamp: new Date()
      };

      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date();
      
      this.emit('message:received', assistantMessage);
      
      return assistantMessage;
    } catch (error) {
      const errorMessage = `发送消息失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 执行工具
   */
  async executeTool(
    tool: Tool,
    input: any,
    context?: {
      conversationId?: string;
      userId?: string;
    }
  ): Promise<ToolResult> {
    this.ensureInitialized();
    
    const execution: ToolExecution = {
      id: this.generateId('exec'),
      toolId: tool.id,
      toolName: tool.name,
      messageId: this.generateId('msg'),
      conversationId: context?.conversationId || '',
      userId: context?.userId || 'anonymous',
      input,
      status: 'pending' as ToolExecutionStatus
    };

    this.emit('tool:execution:started', execution);

    try {
      // 模拟工具执行
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: true,
        output: `Tool ${tool.name} executed successfully with input: ${JSON.stringify(input)}`,
        executionTime: 500
      };

      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.output = result.output;
      
      this.emit('tool:execution:completed', execution, result);
      
      return result;
    } catch (error) {
      execution.status = 'error';
      execution.error = { code: 'EXECUTION_ERROR', message: error instanceof Error ? error.message : String(error) };
      
      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: execution.error.message
        },
        executionTime: 500
      };
      
      this.emit('tool:execution:failed', execution, error);
      
      return result;
    }
  }

  /**
   * 流式发送消息
   */
  async *streamMessage(
    conversation: Conversation,
    content: string | MessageContent,
    options?: {
      tools?: Tool[];
    }
  ): AsyncGenerator<string, Message, unknown> {
    this.ensureInitialized();
    
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

    // 创建助手消息
    const assistantMessage: Message = {
      id: this.generateId('msg'),
      conversationId: conversation.id,
      role: 'assistant' as MessageRole,
      content: [{ type: 'text', text: '' }],
      status: 'sending' as MessageStatus,
      timestamp: new Date()
    };

    conversation.messages.push(assistantMessage);
    this.emit('message:streaming:started', assistantMessage);

    try {
      // 模拟流式响应
      const response = "这是一个模拟的流式响应。我正在逐字输出内容...";
      let accumulated = '';
      
      for (const char of response) {
        accumulated += char;
        if (assistantMessage.content[0]) {
          assistantMessage.content[0].text = accumulated;
        }
        yield char;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      assistantMessage.status = 'sent';
      conversation.updatedAt = new Date();
      
      this.emit('message:streaming:completed', assistantMessage);
      
      return assistantMessage;
    } catch (error) {
      assistantMessage.status = 'error';
      this.emit('message:streaming:failed', assistantMessage, error);
      throw error;
    }
  }

  /**
   * 获取可用工具
   */
  async getAvailableTools(): Promise<Tool[]> {
    this.ensureInitialized();
    
    // 返回一些模拟工具
    return [
      {
        id: 'mock_tool_1',
        name: 'calculator',
        description: 'Perform mathematical calculations',
        category: 'development',
        parameters: [
          {
            name: 'expression',
            type: 'string',
            description: 'Mathematical expression to evaluate',
            required: true
          }
        ],
        permissionLevel: 'auto',
        isEnabled: true,
        isSandboxed: false,
        timeout: 5000,
        source: 'builtin'
      }
    ];
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.debugLog('断开 Gemini CLI 连接');
      
      // 清理资源
      this.currentConversation = null;
      this.initialized = false;
      this.setStatus('idle');
      
      this.emit('disconnected');
    } catch (error) {
      this.debugLog('断开连接时出错', error);
    }
  }

  // 私有方法

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('适配器未初始化，请先调用 initialize()');
    }
  }

  private setStatus(status: 'idle' | 'connecting' | 'connected' | 'error'): void {
    this.status = status;
    this.emit('status:changed', status);
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[GeminiClientAdapter] ${message}`, data || '');
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateResponse(
    conversation: Conversation,
    userMessage: Message,
    options?: {
      stream?: boolean;
      onStream?: (chunk: string) => void;
      tools?: Tool[];
    }
  ): Promise<string> {
    // 模拟生成响应
    const userText = userMessage.content[0]?.text || '';
    
    // 简单的模拟响应
    const responses = [
      `我理解您说的"${userText}"。这是一个模拟响应。`,
      `关于"${userText}"，我可以提供以下帮助...`,
      `您提到了"${userText}"，让我为您详细解释一下...`
    ];
    
    const selectedResponse = responses[Math.floor(Math.random() * responses.length)];
    const response = selectedResponse || '我理解您的请求。';
    
    if (options?.stream && options.onStream) {
      // 模拟流式输出
      for (const char of response) {
        options.onStream(char);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }
    
    return response;
  }
}

// 导出默认实例创建函数
export function createGeminiClientAdapter(config: GeminiClientConfig): GeminiClientAdapter {
  return new GeminiClientAdapter(config);
}