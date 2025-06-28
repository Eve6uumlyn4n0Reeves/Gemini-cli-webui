import { EventEmitter } from 'eventemitter3';
import type {
  Message,
  Conversation,
  Tool,
  ToolExecution,
  ToolResult,
  ToolApprovalRequest,
  User,
  WebSocketEvent
} from '@gemini-cli-webui/shared';

import { GeminiClientAdapter, type GeminiClientConfig } from '../adapters/GeminiClientAdapter.js';
import { ToolAdapter, type ToolAdapterConfig, type ToolExecutionContext } from '../adapters/ToolAdapter.js';
import { ApprovalBridge, type ApprovalBridgeConfig, type ApprovalWorkflow } from '../bridges/ApprovalBridge.js';
import { AdapterType, AdapterConfig, createAdapter, getDefaultAdapterConfig } from '../config/adapterConfig.js';

/**
 * 核心服务配置
 */
export interface CoreServiceConfig {
  adapterConfig?: AdapterConfig;
  geminiClient: Partial<GeminiClientConfig>;
  toolAdapter: Partial<ToolAdapterConfig>;
  approvalBridge: Partial<ApprovalBridgeConfig>;
  enableWebSocketNotifications: boolean;
  enableMetrics: boolean;
  maxConcurrentSessions: number;
  sessionTimeout: number;
  debugMode: boolean;
}

/**
 * 核心服务状态
 */
export type CoreServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * 服务统计信息
 */
export interface ServiceMetrics {
  activeSessions: number;
  totalMessages: number;
  totalToolExecutions: number;
  pendingApprovals: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
}

/**
 * 核心服务事件
 */
export interface CoreServiceEvents {
  'status-changed': (status: CoreServiceStatus) => void;
  'session-created': (session: Conversation) => void;
  'session-terminated': (sessionId: string) => void;
  'message-received': (message: Message) => void;
  'message-sent': (message: Message) => void;
  'tool-execution-requested': (execution: ToolExecution) => void;
  'tool-execution-completed': (result: ToolResult) => void;
  'approval-required': (request: ToolApprovalRequest) => void;
  'approval-granted': (request: ToolApprovalRequest) => void;
  'approval-rejected': (request: ToolApprovalRequest) => void;
  'websocket-event': (event: WebSocketEvent) => void;
  'metrics-updated': (metrics: ServiceMetrics) => void;
  'error': (error: Error) => void;
  'debug': (message: string, data?: any) => void;
}

/**
 * CoreService - 统一的服务入口
 * 
 * 整合 GeminiClientAdapter、ToolAdapter 和 ApprovalBridge，
 * 提供事件发射器集成和配置管理
 */
export class CoreService extends EventEmitter<CoreServiceEvents> {
  private config: CoreServiceConfig;
  private status: CoreServiceStatus = 'stopped';
  
  // 核心组件
  private geminiClient: GeminiClientAdapter | any; // 支持多种适配器类型
  private toolAdapter: ToolAdapter;
  private approvalBridge: ApprovalBridge;
  private adapterType: AdapterType;
  
  // 会话管理
  private activeSessions = new Map<string, Conversation>();
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  
  // 统计信息
  private metrics: ServiceMetrics;
  private metricsTimer?: NodeJS.Timeout;
  private startTime: number;
  
  // WebSocket 事件队列
  private webSocketEventQueue: WebSocketEvent[] = [];
  private webSocketHandler?: (event: WebSocketEvent) => void;

  constructor(config: Partial<CoreServiceConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.startTime = Date.now();
    
    // 初始化统计信息
    this.metrics = {
      activeSessions: 0,
      totalMessages: 0,
      totalToolExecutions: 0,
      pendingApprovals: 0,
      averageResponseTime: 0,
      errorRate: 0,
      uptime: 0,
      memoryUsage: process.memoryUsage()
    };
    
    // 初始化核心组件
    this.adapterType = this.config.adapterConfig?.type || AdapterType.MOCK;
    // Gemini 客户端将在 start() 方法中根据配置创建
    this.toolAdapter = new ToolAdapter(this.config.toolAdapter);
    this.approvalBridge = new ApprovalBridge(this.config.approvalBridge);
    
    this.setupEventHandlers();
    this.debugLog('CoreService 初始化完成', { config: this.config });
  }

  /**
   * 启动核心服务
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      this.debugLog('服务已在运行');
      return;
    }

    try {
      this.setStatus('starting');
      this.debugLog('开始启动核心服务');

      // 初始化 Gemini 客户端
      await this.initializeGeminiClient();
      
      // 启动统计信息收集
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }
      
      this.setStatus('running');
      this.debugLog('核心服务启动完成');

    } catch (error) {
      this.setStatus('error');
      const errorMessage = `服务启动失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 停止核心服务
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      this.debugLog('服务已停止');
      return;
    }

    try {
      this.setStatus('stopping');
      this.debugLog('开始停止核心服务');

      // 停止统计信息收集
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
      }

      // 终止所有会话
      await this.terminateAllSessions();

      // 清理核心组件
      await this.geminiClient.disconnect();
      await this.approvalBridge.cleanup();

      this.setStatus('stopped');
      this.debugLog('核心服务停止完成');

    } catch (error) {
      this.setStatus('error');
      const errorMessage = `服务停止失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 创建新的对话会话
   */
  async createSession(userId: string, conversationId: string): Promise<Conversation> {
    this.ensureRunning();

    if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
      throw new Error(`已达到最大并发会话数: ${this.config.maxConcurrentSessions}`);
    }

    const session = await this.geminiClient.createConversation(conversationId, userId);
    this.activeSessions.set(session.id, session);

    // 设置会话超时
    this.setSessionTimeout(session.id);

    this.metrics.activeSessions = this.activeSessions.size;
    this.debugLog('创建新会话', session);
    this.emit('session-created', session);

    return session;
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
    }
  ): Promise<Message | AsyncIterable<any>> {
    this.ensureRunning();
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      // 获取可用工具
      let availableTools: Tool[] = [];
      if (options?.enableTools) {
        availableTools = await this.geminiClient.getAvailableTools();
      }

      // 获取会话
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // 发送消息
      const result = await this.geminiClient.sendMessage(session as any, content, {
        stream: options?.streaming,
        tools: availableTools
      });

      // 更新统计
      this.metrics.totalMessages++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      // 更新会话活动时间
      this.updateSessionActivity(sessionId);

      this.debugLog('消息发送完成', { sessionId, responseTime });
      
      if (!options?.streaming && typeof result === 'object' && 'id' in result) {
        this.emit('message-sent', result as Message);
      }

      return result;

    } catch (error) {
      this.metrics.errorRate = this.calculateErrorRate();
      const errorMessage = `消息发送失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
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
    this.ensureRunning();
    
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    const context: ToolExecutionContext = {
      userId: session.userId,
      conversationId: session.id,
      messageId: this.generateId(),
      sessionId: session.id
    };

    try {
      // 拦截工具执行请求
      const execution = await this.toolAdapter.interceptToolExecution(toolName, input, context);
      
      this.metrics.totalToolExecutions++;
      this.updateSessionActivity(sessionId);
      
      this.debugLog('工具执行请求', execution);
      this.emit('tool-execution-requested', execution);

      // 等待执行完成（通过事件监听器处理）
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('工具执行超时'));
        }, 30000);

        const onCompleted = (result: ToolResult) => {
          if (result.toolExecutionId === execution.id) {
            clearTimeout(timeout);
            this.off('tool-execution-completed', onCompleted);
            this.off('error', onError);
            resolve(result);
          }
        };

        const onError = (error: Error) => {
          clearTimeout(timeout);
          this.off('tool-execution-completed', onCompleted);
          this.off('error', onError);
          reject(error);
        };

        this.on('tool-execution-completed', onCompleted);
        this.on('error', onError);
      });

    } catch (error) {
      this.metrics.errorRate = this.calculateErrorRate();
      const errorMessage = `工具执行失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
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
    this.ensureRunning();

    try {
      await this.approvalBridge.approveRequest(requestId, approverId, comment);
      this.debugLog('工具执行已批准', { requestId, approverId });
    } catch (error) {
      const errorMessage = `批准失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
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
    this.ensureRunning();

    try {
      await this.approvalBridge.rejectRequest(requestId, rejectedBy, reason);
      this.debugLog('工具执行已拒绝', { requestId, rejectedBy, reason });
    } catch (error) {
      const errorMessage = `拒绝失败: ${error instanceof Error ? error.message : String(error)}`;
      this.debugLog(errorMessage, error);
      this.emit('error', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 获取活动会话
   */
  getActiveSessions(): Conversation[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * 获取会话详情
   */
  getSession(sessionId: string): Conversation | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * 终止会话
   */
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    // 清理会话定时器
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }

    // 移除会话
    this.activeSessions.delete(sessionId);
    this.metrics.activeSessions = this.activeSessions.size;

    this.debugLog('会话已终止', { sessionId });
    this.emit('session-terminated', sessionId);
  }

  /**
   * 获取服务状态
   */
  getStatus(): CoreServiceStatus {
    return this.status;
  }

  /**
   * 获取服务统计信息
   */
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * 注册工具
   */
  registerTools(tools: Tool[]): void {
    this.toolAdapter.registerTools(tools);
    this.debugLog('工具已注册', { count: tools.length });
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  setWebSocketHandler(handler: (event: WebSocketEvent) => void): void {
    this.webSocketHandler = handler;
    
    // 处理队列中的事件
    while (this.webSocketEventQueue.length > 0) {
      const event = this.webSocketEventQueue.shift();
      if (event) {
        handler(event);
      }
    }
    
    this.debugLog('WebSocket 处理器已设置');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CoreServiceConfig>): void {
    this.config = this.validateConfig({ ...this.config, ...newConfig });
    
    // 更新组件配置
    // Update config if needed
    // this.geminiClient.updateConfig(this.config.geminiClient);
    
    this.debugLog('配置已更新', this.config);
  }

  // 私有方法

  private validateConfig(config: Partial<CoreServiceConfig>): CoreServiceConfig {
    const defaultConfig: CoreServiceConfig = {
      geminiClient: {},
      toolAdapter: {},
      approvalBridge: {},
      enableWebSocketNotifications: true,
      enableMetrics: true,
      maxConcurrentSessions: 10,
      sessionTimeout: 1800000, // 30分钟
      debugMode: false
    };

    return { ...defaultConfig, ...config };
  }

  private setStatus(status: CoreServiceStatus): void {
    if (this.status !== status) {
      const oldStatus = this.status;
      this.status = status;
      this.emit('status-changed', status);
      this.debugLog('服务状态变更', { from: oldStatus, to: status });
    }
  }

  private setupEventHandlers(): void {
    // Gemini 客户端事件
    this.geminiClient.on('message-received', (message) => {
      this.emit('message-received', message);
    });

    this.geminiClient.on('tool-execution-requested', (execution) => {
      this.emit('tool-execution-requested', execution);
    });

    this.geminiClient.on('tool-execution-completed', (result) => {
      this.emit('tool-execution-completed', result);
    });

    this.geminiClient.on('error', (error) => {
      this.emit('error', error);
    });

    // 工具适配器事件
    this.toolAdapter.on('tool-execution-completed', (result) => {
      this.emit('tool-execution-completed', result);
    });

    this.toolAdapter.on('approval-required', (request) => {
      this.metrics.pendingApprovals++;
      this.emit('approval-required', request);
      this.emitWebSocketEvent({
        type: 'approval-request',
        data: request,
        timestamp: new Date(),
        id: request.id
      });
    });

    // 审批桥接器事件
    this.approvalBridge.on('approval-granted', (request, approvedBy) => {
      this.metrics.pendingApprovals = Math.max(0, this.metrics.pendingApprovals - 1);
      this.emit('approval-granted', request);
      this.emitWebSocketEvent({
        type: 'approval-granted',
        data: { request, approvedBy },
        timestamp: new Date(),
        id: request.id
      });
    });

    this.approvalBridge.on('approval-rejected', (request, rejectedBy, reason) => {
      this.metrics.pendingApprovals = Math.max(0, this.metrics.pendingApprovals - 1);
      this.emit('approval-rejected', request);
      this.emitWebSocketEvent({
        type: 'approval-rejected',
        data: { request, rejectedBy, reason },
        timestamp: new Date(),
        id: request.id
      });
    });

    this.approvalBridge.on('error', (error) => {
      this.emit('error', error);
    });

    // 调试事件
    if (this.config.debugMode) {
      this.geminiClient.on('debug', (message, data) => {
        this.emit('debug', `[GeminiClient] ${message}`, data);
      });

      this.toolAdapter.on('debug', (message, data) => {
        this.emit('debug', `[ToolAdapter] ${message}`, data);
      });

      this.approvalBridge.on('debug', (message, data) => {
        this.emit('debug', `[ApprovalBridge] ${message}`, data);
      });
    }
  }

  private setSessionTimeout(sessionId: string): void {
    const timer = setTimeout(() => {
      this.terminateSession(sessionId).catch(error => {
        this.debugLog('会话超时清理失败', { sessionId, error });
      });
    }, this.config.sessionTimeout);

    this.sessionTimers.set(sessionId, timer);
  }

  private updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.updatedAt = new Date();
      
      // 重置超时定时器
      const oldTimer = this.sessionTimers.get(sessionId);
      if (oldTimer) {
        clearTimeout(oldTimer);
      }
      this.setSessionTimeout(sessionId);
    }
  }

  private async terminateAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.activeSessions.keys());
    await Promise.all(sessionIds.map(id => this.terminateSession(id)));
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, 60000); // 每分钟更新一次
  }

  private updateMetrics(): void {
    this.metrics.uptime = Date.now() - this.startTime;
    this.metrics.memoryUsage = process.memoryUsage();
    this.metrics.pendingApprovals = this.toolAdapter.getPendingApprovals().length;
    
    this.emit('metrics-updated', this.metrics);
  }

  private updateAverageResponseTime(responseTime: number): void {
    // 简化的移动平均算法
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
  }

  private calculateErrorRate(): number {
    // 简化实现
    return this.metrics.errorRate * 0.95 + 0.05;
  }

  private emitWebSocketEvent(event: WebSocketEvent): void {
    if (this.config.enableWebSocketNotifications) {
      if (this.webSocketHandler) {
        this.webSocketHandler(event);
      } else {
        this.webSocketEventQueue.push(event);
      }
      this.emit('websocket-event', event);
    }
  }

  private ensureRunning(): void {
    if (this.status !== 'running') {
      throw new Error(`服务未运行，当前状态: ${this.status}`);
    }
  }

  private generateId(): string {
    return `core-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      this.emit('debug', `[CoreService] ${message}`, data);
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config: Partial<CoreServiceConfig>): CoreServiceConfig {
    const adapterConfig = config.adapterConfig || getDefaultAdapterConfig();
    
    return {
      adapterConfig,
      geminiClient: config.geminiClient || {},
      toolAdapter: config.toolAdapter || {},
      approvalBridge: config.approvalBridge || {},
      enableWebSocketNotifications: config.enableWebSocketNotifications ?? true,
      enableMetrics: config.enableMetrics ?? true,
      maxConcurrentSessions: config.maxConcurrentSessions ?? 10,
      sessionTimeout: config.sessionTimeout ?? 3600000, // 1小时
      debugMode: config.debugMode ?? false
    };
  }

  /**
   * 初始化 Gemini 客户端
   */
  private async initializeGeminiClient(): Promise<void> {
    const adapterConfig = this.config.adapterConfig || getDefaultAdapterConfig();
    
    try {
      // 创建适配器
      this.geminiClient = await createAdapter(adapterConfig);
      
      // 设置事件监听
      this.geminiClient.on('error', (error: Error) => {
        this.emit('error', error);
      });
      
      this.geminiClient.on('message:received', (message: Message) => {
        this.emit('message-received', message);
        this.updateMetrics({ totalMessages: this.metrics.totalMessages + 1 });
      });
      
      this.geminiClient.on('tool:execution:started', (execution: ToolExecution) => {
        this.emit('tool-execution-requested', execution);
        this.updateMetrics({ totalToolExecutions: this.metrics.totalToolExecutions + 1 });
      });
      
      // 初始化适配器
      await this.geminiClient.initialize();
      
      this.debugLog(`Gemini 客户端初始化成功 (类型: ${adapterConfig.type})`);
    } catch (error) {
      throw new Error(`Gemini 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default CoreService;