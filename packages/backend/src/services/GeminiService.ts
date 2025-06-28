import { CoreService, type CoreServiceConfig } from '@gemini-cli-webui/cli-integration';
import type { 
  Message, 
  Tool, 
  ToolExecution, 
  ToolResult,
  ToolApprovalRequest,
  User
} from '@gemini-cli-webui/shared';

import logger, { logBusinessEvent, logPerformance, logError } from '../utils/logger.js';
import { geminiConfig } from '../config/index.js';
import { ReActEngine } from './ReActEngine.js';
import { ToolService } from './ToolService.js';

/**
 * Gemini 服务配置
 */
export interface GeminiServiceConfig extends CoreServiceConfig {
  maxConcurrentSessions: number;
  sessionTimeout: number;
  enableMetrics: boolean;
  enableWebSocketEvents: boolean;
  enableReActEngine?: boolean;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string;
  userId: string;
  conversationId: string;
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'idle' | 'terminated';
  messageCount: number;
  toolExecutionCount: number;
}

/**
 * GeminiService - 集成 CLI Integration 包的核心服务
 * 
 * 负责管理 Gemini CLI 的所有功能，包括会话管理、消息处理、工具执行和审批流程
 */
export class GeminiService {
  private coreService: CoreService;
  private config: GeminiServiceConfig;
  private activeSessions = new Map<string, SessionInfo>();
  private webSocketEventHandlers = new Map<string, Function>();
  private isInitialized = false;
  private reactEngine?: ReActEngine;
  private toolService?: ToolService;

  constructor(config: Partial<GeminiServiceConfig> = {}, toolService?: ToolService) {
    this.config = this.validateConfig(config);
    
    // 创建 CoreService 实例
    this.coreService = new CoreService(this.config);
    
    // 如果启用了 ReAct 引擎，创建实例
    if (this.config.enableReActEngine && toolService) {
      this.toolService = toolService;
      this.reactEngine = new ReActEngine(toolService, this);
      this.setupReActEventHandlers();
    }
    
    // 设置事件监听器
    this.setupEventHandlers();
    
    logger.info('GeminiService 实例已创建', { 
      config: this.config,
      reactEnabled: !!this.reactEngine 
    });
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('GeminiService 已初始化，跳过重复初始化');
      return;
    }

    try {
      const startTime = Date.now();
      logger.info('开始初始化 GeminiService');

      // 启动核心服务
      await this.coreService.start();

      // 设置 WebSocket 事件处理器
      this.coreService.setWebSocketHandler((event) => {
        this.handleWebSocketEvent(event);
      });

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      
      logPerformance('GeminiService.initialize', duration);
      logger.info('GeminiService 初始化完成', { duration: `${duration}ms` });

    } catch (error) {
      logError(error as Error, { context: 'GeminiService.initialize' });
      throw new Error(`GeminiService 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建新的对话会话
   */
  async createSession(userId: string, conversationId: string): Promise<SessionInfo> {
    this.ensureInitialized();

    try {
      const startTime = Date.now();
      
      // 检查会话数量限制
      if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
        throw new Error(`已达到最大并发会话数: ${this.config.maxConcurrentSessions}`);
      }

      // 通过 CoreService 创建会话
      const geminiSession = await this.coreService.createSession(userId, conversationId);

      // 创建本地会话信息
      const sessionInfo: SessionInfo = {
        id: geminiSession.id,
        userId,
        conversationId,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'active',
        messageCount: 0,
        toolExecutionCount: 0
      };

      this.activeSessions.set(sessionInfo.id, sessionInfo);

      const duration = Date.now() - startTime;
      logPerformance('GeminiService.createSession', duration, { 
        sessionId: sessionInfo.id,
        userId 
      });

      logBusinessEvent('session_created', userId, {
        sessionId: sessionInfo.id,
        conversationId
      });

      logger.info('会话创建成功', { 
        sessionId: sessionInfo.id,
        userId,
        totalSessions: this.activeSessions.size 
      });

      return sessionInfo;

    } catch (error) {
      logError(error as Error, { 
        context: 'GeminiService.createSession',
        userId,
        conversationId 
      });
      throw error;
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options?: {
      streaming?: boolean;
      enableTools?: boolean;
      context?: Record<string, unknown>;
      useReAct?: boolean;
    }
  ): Promise<Message | AsyncIterable<any>> {
    this.ensureInitialized();

    const sessionInfo = this.getSessionInfo(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      const startTime = Date.now();

      // 如果启用了 ReAct 且请求使用 ReAct
      if (this.reactEngine && options?.useReAct) {
        const result = await this.reactEngine.execute(
          content,
          sessionInfo.conversationId,
          sessionInfo.userId
        );
        
        // 返回 ReAct 执行结果作为消息
        return {
          id: `msg_${Date.now()}`,
          conversationId: sessionInfo.conversationId,
          role: 'assistant',
          content: result.thoughts[result.thoughts.length - 1]?.content || '任务完成',
          timestamp: new Date(),
          metadata: {
            reactContext: result
          }
        } as Message;
      }

      // 通过 CoreService 发送消息
      const result = await this.coreService.sendMessage(sessionId, content, options);

      // 更新会话信息
      sessionInfo.messageCount++;
      sessionInfo.lastActivity = new Date();
      sessionInfo.status = 'active';

      const duration = Date.now() - startTime;
      logPerformance('GeminiService.sendMessage', duration, {
        sessionId,
        userId: sessionInfo.userId,
        contentLength: content.length,
        streaming: options?.streaming || false
      });

      logBusinessEvent('message_sent', sessionInfo.userId, {
        sessionId,
        conversationId: sessionInfo.conversationId,
        messageLength: content.length,
        enableTools: options?.enableTools || false
      });

      logger.info('消息发送成功', {
        sessionId,
        userId: sessionInfo.userId,
        messageCount: sessionInfo.messageCount,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      logError(error as Error, {
        context: 'GeminiService.sendMessage',
        sessionId,
        userId: sessionInfo.userId
      });
      throw error;
    }
  }

  /**
   * 执行工具
   */
  async executeTool(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    this.ensureInitialized();

    const sessionInfo = this.getSessionInfo(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      const startTime = Date.now();

      // 通过 CoreService 执行工具
      const result = await this.coreService.executeTool(sessionId, toolName, input);

      // 更新会话信息
      sessionInfo.toolExecutionCount++;
      sessionInfo.lastActivity = new Date();

      const duration = Date.now() - startTime;
      logPerformance('GeminiService.executeTool', duration, {
        sessionId,
        toolName,
        userId: sessionInfo.userId,
        success: result.success
      });

      logBusinessEvent('tool_executed', sessionInfo.userId, {
        sessionId,
        toolName,
        toolExecutionId: result.toolExecutionId,
        success: result.success,
        duration
      });

      logger.info('工具执行完成', {
        sessionId,
        toolName,
        success: result.success,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      logError(error as Error, {
        context: 'GeminiService.executeTool',
        sessionId,
        toolName,
        userId: sessionInfo.userId
      });
      throw error;
    }
  }

  /**
   * 批准工具执行
   */
  async approveToolExecution(
    requestId: string,
    approverId: string,
    comment?: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const startTime = Date.now();

      await this.coreService.approveToolExecution(requestId, approverId, comment);

      const duration = Date.now() - startTime;
      logPerformance('GeminiService.approveToolExecution', duration, {
        requestId,
        approverId
      });

      logBusinessEvent('tool_execution_approved', approverId, {
        requestId,
        comment: comment || 'no comment'
      });

      logger.info('工具执行已批准', { requestId, approverId });

    } catch (error) {
      logError(error as Error, {
        context: 'GeminiService.approveToolExecution',
        requestId,
        approverId
      });
      throw error;
    }
  }

  /**
   * 拒绝工具执行
   */
  async rejectToolExecution(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const startTime = Date.now();

      await this.coreService.rejectToolExecution(requestId, rejectedBy, reason);

      const duration = Date.now() - startTime;
      logPerformance('GeminiService.rejectToolExecution', duration, {
        requestId,
        rejectedBy
      });

      logBusinessEvent('tool_execution_rejected', rejectedBy, {
        requestId,
        reason
      });

      logger.info('工具执行已拒绝', { requestId, rejectedBy, reason });

    } catch (error) {
      logError(error as Error, {
        context: 'GeminiService.rejectToolExecution',
        requestId,
        rejectedBy
      });
      throw error;
    }
  }

  /**
   * 获取活动会话列表
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 获取会话信息
   */
  getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 终止会话
   */
  async terminateSession(sessionId: string): Promise<void> {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    try {
      // 通过 CoreService 终止会话
      await this.coreService.terminateSession(sessionId);

      // 更新本地会话状态
      sessionInfo.status = 'terminated';
      this.activeSessions.delete(sessionId);

      logBusinessEvent('session_terminated', sessionInfo.userId, {
        sessionId,
        duration: Date.now() - sessionInfo.createdAt.getTime(),
        messageCount: sessionInfo.messageCount,
        toolExecutionCount: sessionInfo.toolExecutionCount
      });

      logger.info('会话已终止', {
        sessionId,
        userId: sessionInfo.userId,
        duration: Date.now() - sessionInfo.createdAt.getTime(),
        totalSessions: this.activeSessions.size
      });

    } catch (error) {
      logError(error as Error, {
        context: 'GeminiService.terminateSession',
        sessionId,
        userId: sessionInfo.userId
      });
      throw error;
    }
  }

  /**
   * 注册工具
   */
  async registerTools(tools: Tool[]): Promise<void> {
    this.ensureInitialized();

    try {
      this.coreService.registerTools(tools);

      logger.info('工具注册成功', {
        toolCount: tools.length,
        tools: tools.map(t => ({ id: t.id, name: t.name, category: t.category }))
      });

    } catch (error) {
      logError(error as Error, { context: 'GeminiService.registerTools' });
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      coreServiceStatus: this.coreService.getStatus(),
      activeSessions: this.activeSessions.size,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
      metrics: this.coreService.getMetrics(),
      uptime: process.uptime()
    };
  }

  /**
   * 注册 WebSocket 事件处理器
   */
  onWebSocketEvent(eventType: string, handler: Function): void {
    this.webSocketEventHandlers.set(eventType, handler);
    logger.debug('WebSocket 事件处理器已注册', { eventType });
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('开始停止 GeminiService');

      // 终止所有活动会话
      const sessionIds = Array.from(this.activeSessions.keys());
      await Promise.all(sessionIds.map(id => this.terminateSession(id)));

      // 停止核心服务
      await this.coreService.stop();

      this.isInitialized = false;
      logger.info('GeminiService 已停止');

    } catch (error) {
      logError(error as Error, { context: 'GeminiService.stop' });
      throw error;
    }
  }

  // 私有方法

  private validateConfig(config: Partial<GeminiServiceConfig>): GeminiServiceConfig {
    const defaultConfig: GeminiServiceConfig = {
      geminiClient: {
        ...geminiConfig,
        debugMode: false
      },
      toolAdapter: {
        defaultPermissionLevel: 'user_approval',
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
      enableWebSocketNotifications: true,
      enableMetrics: true,
      maxConcurrentSessions: 10,
      sessionTimeout: 1800000, // 30分钟
      debugMode: false
    };

    return { ...defaultConfig, ...config };
  }

  private setupEventHandlers(): void {
    // 核心服务事件监听
    this.coreService.on('session-created', (session) => {
      logger.debug('CoreService 会话创建事件', session);
    });

    this.coreService.on('message-received', (message) => {
      logger.debug('CoreService 消息接收事件', message);
    });

    this.coreService.on('tool-execution-requested', (execution) => {
      logger.debug('CoreService 工具执行请求事件', execution);
    });

    this.coreService.on('approval-required', (request) => {
      logger.debug('CoreService 审批请求事件', request);
    });

    this.coreService.on('error', (error) => {
      logError(error, { context: 'CoreService' });
    });

    logger.debug('GeminiService 事件处理器设置完成');
  }

  private handleWebSocketEvent(event: any): void {
    const handler = this.webSocketEventHandlers.get(event.type);
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        logError(error as Error, {
          context: 'GeminiService.handleWebSocketEvent',
          eventType: event.type
        });
      }
    }

    logger.debug('WebSocket 事件处理', { type: event.type });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('GeminiService 未初始化，请先调用 initialize()');
    }
  }

  /**
   * 设置 ReAct 事件处理器
   */
  private setupReActEventHandlers(): void {
    if (!this.reactEngine) return;

    // 监听 ReAct 事件并通过 WebSocket 推送
    this.reactEngine.on('react:start', (data) => {
      this.emitWebSocketEvent('react:start', data);
    });

    this.reactEngine.on('react:thought', (data) => {
      this.emitWebSocketEvent('react:thought', data);
    });

    this.reactEngine.on('react:action', (data) => {
      this.emitWebSocketEvent('react:action', data);
    });

    this.reactEngine.on('react:observation', (data) => {
      this.emitWebSocketEvent('react:observation', data);
    });

    this.reactEngine.on('react:complete', (data) => {
      this.emitWebSocketEvent('react:complete', data);
    });

    this.reactEngine.on('react:error', (data) => {
      this.emitWebSocketEvent('react:error', data);
    });

    logger.info('ReAct 事件处理器设置完成');
  }

  /**
   * 发送 WebSocket 事件
   */
  private emitWebSocketEvent(type: string, data: any): void {
    if (this.config.enableWebSocketEvents) {
      const event = { type, data, timestamp: new Date() };
      this.handleWebSocketEvent(event);
    }
  }

  /**
   * 生成响应（简化的方法，用于 ReAct 引擎）
   */
  async generateResponse(
    prompt: string,
    conversationId: string,
    options?: { systemPrompt?: string }
  ): Promise<{ content: string }> {
    // 查找对应的会话
    const sessionInfo = Array.from(this.activeSessions.values())
      .find(s => s.conversationId === conversationId);
    
    if (!sessionInfo) {
      throw new Error(`会话不存在: conversationId=${conversationId}`);
    }

    // 使用 sendMessage 但不启用 ReAct（避免循环）
    const result = await this.sendMessage(sessionInfo.id, prompt, {
      enableTools: false,
      context: options?.systemPrompt ? { systemPrompt: options.systemPrompt } : undefined
    });

    // 如果是流式响应，收集所有内容
    if (Symbol.asyncIterator in result) {
      let content = '';
      for await (const chunk of result as AsyncIterable<any>) {
        content += chunk.content || '';
      }
      return { content };
    }

    return { content: (result as Message).content };
  }
}

export default GeminiService;