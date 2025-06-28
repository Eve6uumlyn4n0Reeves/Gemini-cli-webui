import { EventEmitter } from 'eventemitter3';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { 
  Message, 
  MessageContent,
  MessageRole,
  MessageStatus,
  Conversation, 
  Tool,
  ToolExecution,
  ToolResult,
  ToolExecutionStatus
} from '@gemini-cli-webui/shared';

/**
 * 真实的 Gemini CLI 集成适配器
 * 通过子进程方式调用 gemini-cli
 */
export class RealGeminiAdapter extends EventEmitter {
  private geminiProcess: ChildProcess | null = null;
  private geminiPath: string;
  private initialized = false;
  private currentConversation: Conversation | null = null;
  private messageBuffer = '';
  private streamCallbacks = new Map<string, (chunk: string) => void>();
  
  constructor(private config: {
    geminiExecutablePath?: string;
    apiKey?: string;
    model?: string;
    debugMode?: boolean;
  }) {
    super();
    // 尝试找到 gemini 可执行文件
    this.geminiPath = config.geminiExecutablePath || 'gemini';
  }

  /**
   * 初始化适配器，启动 gemini-cli 进程
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查 gemini-cli 是否可用
      await this.checkGeminiAvailable();

      // 设置环境变量
      const env = { ...process.env };
      if (this.config.apiKey) {
        env.GEMINI_API_KEY = this.config.apiKey;
      }
      if (this.config.model) {
        env.GEMINI_MODEL = this.config.model;
      }

      // 启动 gemini-cli 进程
      this.geminiProcess = spawn(this.geminiPath, ['--json-mode'], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 监听输出
      this.geminiProcess.stdout?.on('data', (data) => {
        this.handleGeminiOutput(data.toString());
      });

      this.geminiProcess.stderr?.on('data', (data) => {
        if (this.config.debugMode) {
          console.error('[Gemini CLI Error]:', data.toString());
        }
      });

      this.geminiProcess.on('error', (error) => {
        this.emit('error', new Error(`Gemini CLI process error: ${error.message}`));
      });

      this.geminiProcess.on('close', (code) => {
        if (code !== 0) {
          this.emit('error', new Error(`Gemini CLI exited with code ${code}`));
        }
        this.initialized = false;
      });

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      const errorMessage = `Failed to initialize Gemini CLI: ${error instanceof Error ? error.message : String(error)}`;
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 检查 gemini-cli 是否可用
   */
  private async checkGeminiAvailable(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn(this.geminiPath, ['--version']);
      
      checkProcess.on('error', () => {
        reject(new Error('Gemini CLI not found. Please install @google/gemini-cli'));
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Gemini CLI check failed'));
        }
      });
    });
  }

  /**
   * 处理 gemini-cli 的输出
   */
  private handleGeminiOutput(data: string) {
    this.messageBuffer += data;
    
    // 尝试解析 JSON 输出
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        this.processGeminiMessage(message);
      } catch (error) {
        // 非 JSON 输出，可能是普通文本
        if (this.config.debugMode) {
          console.log('[Gemini Output]:', line);
        }
      }
    }
  }

  /**
   * 处理解析后的 Gemini 消息
   */
  private processGeminiMessage(message: any) {
    switch (message.type) {
      case 'response':
        this.handleResponseMessage(message);
        break;
      case 'tool_call':
        this.handleToolCall(message);
        break;
      case 'stream_chunk':
        this.handleStreamChunk(message);
        break;
      case 'error':
        this.emit('error', new Error(message.error));
        break;
      default:
        if (this.config.debugMode) {
          console.log('[Unknown Message]:', message);
        }
    }
  }

  /**
   * 发送消息到 gemini-cli
   */
  async sendMessage(
    conversation: Conversation,
    content: string | MessageContent,
    options?: {
      stream?: boolean;
      onStream?: (chunk: string) => void;
    }
  ): Promise<Message> {
    if (!this.initialized || !this.geminiProcess) {
      throw new Error('Adapter not initialized');
    }

    const messageId = this.generateId('msg');
    const userMessage: Message = {
      id: messageId,
      conversationId: conversation.id,
      role: 'user' as MessageRole,
      content: typeof content === 'string' ? [{ type: 'text', text: content }] : [content as MessageContent],
      status: 'completed' as MessageStatus,
      timestamp: new Date()
    };

    // 添加到对话历史
    conversation.messages.push(userMessage);
    this.emit('message:sent', userMessage);

    // 如果需要流式响应，注册回调
    if (options?.stream && options.onStream) {
      this.streamCallbacks.set(messageId, options.onStream);
    }

    // 构建发送给 gemini-cli 的命令
    const command = {
      type: 'message',
      id: messageId,
      content: typeof content === 'string' ? content : content.text,
      stream: options?.stream || false,
      history: this.buildHistory(conversation)
    };

    // 发送到 gemini-cli
    this.geminiProcess.stdin?.write(JSON.stringify(command) + '\n');

    // 等待响应
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 60000); // 60秒超时

      const responseHandler = (response: Message) => {
        if (response.conversationId === conversation.id) {
          clearTimeout(timeout);
          this.off('response:received', responseHandler);
          resolve(response);
        }
      };

      this.on('response:received', responseHandler);
    });
  }

  /**
   * 处理响应消息
   */
  private handleResponseMessage(message: any) {
    const assistantMessage: Message = {
      id: this.generateId('msg'),
      conversationId: message.conversationId || this.currentConversation?.id || '',
      role: 'assistant' as MessageRole,
      content: [{ type: 'text', text: message.content }],
      status: 'completed' as MessageStatus,
      timestamp: new Date()
    };

    if (this.currentConversation) {
      this.currentConversation.messages.push(assistantMessage);
      this.currentConversation.updatedAt = new Date();
    }

    this.emit('message:received', assistantMessage);
    this.emit('response:received', assistantMessage);
  }

  /**
   * 处理工具调用
   */
  private handleToolCall(message: any) {
    const execution: ToolExecution = {
      id: this.generateId('exec'),
      toolId: message.toolId,
      toolName: message.toolName,
      messageId: message.messageId,
      conversationId: this.currentConversation?.id || '',
      userId: 'user',
      input: message.input,
      status: 'pending' as ToolExecutionStatus
    };

    this.emit('tool:execution:started', execution);

    // 工具执行应该由 gemini-cli 处理
    // 这里只是通知 UI
  }

  /**
   * 处理流式块
   */
  private handleStreamChunk(message: any) {
    const callback = this.streamCallbacks.get(message.messageId);
    if (callback) {
      callback(message.chunk);
    }
    this.emit('stream:chunk', message);
  }

  /**
   * 构建历史消息
   */
  private buildHistory(conversation: Conversation): any[] {
    return conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content[0]?.text || ''
    }));
  }

  /**
   * 获取可用工具
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (!this.initialized || !this.geminiProcess) {
      throw new Error('Adapter not initialized');
    }

    // 发送获取工具的命令
    this.geminiProcess.stdin?.write(JSON.stringify({ type: 'list_tools' }) + '\n');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tools list timeout'));
      }, 10000);

      const toolsHandler = (tools: Tool[]) => {
        clearTimeout(timeout);
        this.off('tools:listed', toolsHandler);
        resolve(tools);
      };

      this.on('tools:listed', toolsHandler);
    });
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
        adapter: 'real-gemini-cli'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentConversation = conversation;
    this.emit('conversation:created', conversation);
    
    return conversation;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.geminiProcess) {
      this.geminiProcess.kill();
      this.geminiProcess = null;
    }
    this.initialized = false;
    this.streamCallbacks.clear();
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
 * 创建真实的 Gemini 适配器实例
 */
export function createRealGeminiAdapter(config: {
  geminiExecutablePath?: string;
  apiKey?: string;
  model?: string;
  debugMode?: boolean;
}): RealGeminiAdapter {
  return new RealGeminiAdapter(config);
}