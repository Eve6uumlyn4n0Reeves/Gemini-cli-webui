import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config, corsConfig, rateLimitConfig, securityConfig, wsConfig } from './config/index.js';
import logger, { requestLogger } from './utils/logger.js';
import { requestIdMiddleware, responseTimeMiddleware } from './utils/response.js';
import { GeminiService, createToolService } from './services/index.js';
import { createConversationService } from './services/ConversationService.js';
import { ChatWebSocketService } from './services/ChatWebSocketService.js';
import { ChatController, ToolController, ApprovalController } from './controllers/index.js';
import { authRoutes, createChatRoutes, createToolRoutes, createApprovalRoutes, memoryRoutes } from './routes/index.js';
import { authenticateSocket } from './middleware/auth.js';

/**
 * Express 应用程序类
 */
export class App {
  public app: express.Application;
  public server: any;
  public io: SocketIOServer;
  public geminiService: GeminiService;
  public toolService: any;
  public conversationService: any;
  public chatController: ChatController;
  public toolController: ToolController;
  public approvalController: ApprovalController;
  public chatWebSocketService: ChatWebSocketService;
  private isInitialized = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, wsConfig);
    
    // 初始化 Gemini 服务
    this.geminiService = new GeminiService({
      enableWebSocketNotifications: true,
      enableMetrics: true,
      maxConcurrentSessions: 20,
      debugMode: config.NODE_ENV === 'development'
    });
    
    // 初始化工具服务
    this.toolService = createToolService({
      debugMode: config.NODE_ENV === 'development'
    });
    
    // 初始化对话服务
    this.conversationService = createConversationService(this.geminiService);
    
    // 初始化控制器
    this.chatController = new ChatController(this.conversationService);
    this.toolController = new ToolController(this.toolService);
    this.approvalController = new ApprovalController(this.toolService);
    
    // 初始化聊天 WebSocket 服务
    this.chatWebSocketService = new ChatWebSocketService(this.io, this.conversationService);
    
    logger.info('应用程序实例已创建');
  }

  /**
   * 初始化应用程序
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('应用程序已初始化，跳过重复初始化');
      return;
    }

    try {
      // 初始化 Gemini 服务
      await this.geminiService.initialize();
      
      // 设置中间件
      this.setupMiddleware();
      
      // 设置路由
      this.setupRoutes();
      
      // 设置 WebSocket
      this.setupWebSocket();
      
      // 设置工具服务事件监听
      this.setupToolServiceEvents();
      
      // 设置错误处理
      this.setupErrorHandling();
      
      this.isInitialized = true;
      logger.info('应用程序初始化完成');
    } catch (error) {
      logger.error('应用程序初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // 安全中间件
    this.app.use(helmet(securityConfig.helmet));
    
    // CORS 中间件
    this.app.use(cors(corsConfig));
    
    // 压缩中间件
    this.app.use(compression());
    
    // 速率限制
    this.app.use(rateLimit(rateLimitConfig));
    
    // 解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // 自定义中间件
    this.app.use(requestIdMiddleware);
    this.app.use(responseTimeMiddleware);
    this.app.use(requestLogger);
    
    logger.info('中间件配置完成');
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查路由
    this.app.get('/health', (req, res) => {
      const geminiStatus = this.geminiService.getStatus();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.2.0',
        services: {
          gemini: geminiStatus.initialized ? 'up' : 'down',
          sessions: geminiStatus.activeSessions,
          coreService: geminiStatus.coreServiceStatus
        }
      });
    });

    // API 基础路由
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Gemini CLI WebUI Backend',
        version: '0.2.0',
        description: 'Express + Socket.IO backend server for Gemini CLI WebUI',
        endpoints: {
          health: '/health',
          api: '/api',
          auth: '/api/auth',
          chat: '/api/chat',
          tools: '/api/tools',
          approvals: '/api/approvals',
          memory: '/api/memory'
        }
      });
    });

    // 认证路由
    this.app.use('/api/auth', authRoutes);

    // 聊天路由
    this.app.use('/api/chat', createChatRoutes(this.chatController));

    // 工具路由
    this.app.use('/api/tools', createToolRoutes(this.toolController));

    // 审批路由
    this.app.use('/api/approvals', createApprovalRoutes(this.approvalController));

    // 记忆管理路由
    this.app.use('/api/memory', memoryRoutes);

    // 404 处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: '路由未找到',
        path: req.originalUrl,
        method: req.method
      });
    });

    logger.info('路由配置完成');
  }

  /**
   * 设置 WebSocket
   */
  private setupWebSocket(): void {
    // 添加 Socket.IO 认证中间件
    this.io.use(authenticateSocket);

    this.io.on('connection', (socket) => {
      logger.info(`WebSocket 连接建立: ${socket.id}`, {
        userId: socket.user?.id,
        username: socket.user?.username
      });
      
      // 用户加入房间（基于用户ID）
      if (socket.user) {
        socket.join(`user:${socket.user.id}`);
        socket.join(`role:${socket.user.role}`);
      }

      // 发送连接确认
      socket.emit('authenticated', {
        success: true,
        user: socket.user,
        timestamp: new Date().toISOString()
      });
      
      // 断开连接处理
      socket.on('disconnect', (reason) => {
        logger.info(`WebSocket 连接断开: ${socket.id}, 原因: ${reason}`, {
          userId: socket.user?.id,
          username: socket.user?.username
        });
      });
      
      // 错误处理
      socket.on('error', (error) => {
        logger.error(`WebSocket 错误 (${socket.id}):`, error, {
          userId: socket.user?.id,
          username: socket.user?.username
        });
      });

      // 心跳检测
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // 工具相关事件
      socket.on('tool:list', () => {
        const tools = this.toolService.getTools();
        socket.emit('tool:list_response', { tools });
      });

      socket.on('tool:executions', () => {
        const executions = this.toolService.getActiveExecutions(socket.user?.id);
        socket.emit('tool:executions_response', { executions });
      });

      // 审批相关事件
      socket.on('approval:pending', () => {
        const userId = socket.user?.role === 'admin' ? undefined : socket.user?.id;
        const approvals = this.toolService.getPendingApprovals(userId);
        socket.emit('approval:pending_response', { approvals });
      });
    });

    logger.info('WebSocket 配置完成');
  }

  /**
   * 设置工具服务事件监听
   */
  private setupToolServiceEvents(): void {
    // 工具执行请求事件
    this.toolService.on('tool-execution-requested', (execution: any) => {
      // 通知相关用户
      this.io.to(`user:${execution.userId}`).emit('tool:execution_requested', {
        type: 'tool_execution_requested',
        data: execution,
        timestamp: new Date().toISOString()
      });

      // 通知管理员
      this.io.to('role:admin').emit('tool:execution_requested', {
        type: 'tool_execution_requested', 
        data: execution,
        timestamp: new Date().toISOString()
      });
    });

    // 工具执行完成事件
    this.toolService.on('tool-execution-completed', (result: any) => {
      const execution = this.toolService.getExecution(result.toolExecutionId);
      if (execution) {
        this.io.to(`user:${execution.userId}`).emit('tool:execution_completed', {
          type: 'tool_execution_completed',
          data: { execution, result },
          timestamp: new Date().toISOString()
        });
      }
    });

    // 工具执行失败事件
    this.toolService.on('tool-execution-failed', (execution: any, error: any) => {
      this.io.to(`user:${execution.userId}`).emit('tool:execution_failed', {
        type: 'tool_execution_failed',
        data: { execution, error },
        timestamp: new Date().toISOString()
      });
    });

    // 审批请求事件
    this.toolService.on('approval-required', (request: any) => {
      // 通知管理员（管理员审批）或用户本人（用户审批）
      if (request.approvers.includes('admin')) {
        this.io.to('role:admin').emit('approval:required', {
          type: 'approval_required',
          data: request,
          timestamp: new Date().toISOString()
        });
      }
      
      if (request.approvers.includes('user')) {
        this.io.to(`user:${request.requestedBy}`).emit('approval:required', {
          type: 'approval_required',
          data: request,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 工具执行批准事件
    this.toolService.on('tool-execution-approved', (executionId: string, approvedBy: string) => {
      const execution = this.toolService.getExecution(executionId);
      if (execution) {
        this.io.to(`user:${execution.userId}`).emit('tool:execution_approved', {
          type: 'tool_execution_approved',
          data: { executionId, approvedBy, execution },
          timestamp: new Date().toISOString()
        });
      }
    });

    // 工具执行拒绝事件
    this.toolService.on('tool-execution-rejected', (executionId: string, rejectedBy: string, reason: string) => {
      const execution = this.toolService.getExecution(executionId);
      if (execution) {
        this.io.to(`user:${execution.userId}`).emit('tool:execution_rejected', {
          type: 'tool_execution_rejected',
          data: { executionId, rejectedBy, reason, execution },
          timestamp: new Date().toISOString()
        });
      }
    });

    // 审批超时事件
    this.toolService.on('approval-timeout', (request: any) => {
      this.io.to(`user:${request.requestedBy}`).emit('approval:timeout', {
        type: 'approval_timeout',
        data: request,
        timestamp: new Date().toISOString()
      });

      this.io.to('role:admin').emit('approval:timeout', {
        type: 'approval_timeout',
        data: request,
        timestamp: new Date().toISOString()
      });
    });

    logger.info('工具服务事件监听配置完成');
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 全局错误处理中间件
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('未捕获的应用错误:', err);
      
      // 不在生产环境泄露错误堆栈
      const isDevelopment = config.NODE_ENV === 'development';
      
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || '服务器内部错误',
        ...(isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId
      });
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的 Promise 拒绝:', { reason, promise });
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // 处理进程信号
    process.on('SIGTERM', () => {
      logger.info('收到 SIGTERM 信号');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('收到 SIGINT 信号');
      this.gracefulShutdown('SIGINT');
    });

    logger.info('错误处理配置完成');
  }

  /**
   * 优雅关闭
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`开始优雅关闭 (${signal})`);

    try {
      // 关闭工具服务
      if (this.toolService) {
        await this.toolService.shutdown();
        logger.info('工具服务已关闭');
      }

      // 关闭服务器
      this.server.close((err: any) => {
        if (err) {
          logger.error('服务器关闭时出错:', err);
          process.exit(1);
        }

        logger.info('服务器已关闭');
        process.exit(0);
      });
    } catch (error) {
      logger.error('优雅关闭失败:', error);
      process.exit(1);
    }

    // 强制关闭超时
    setTimeout(() => {
      logger.error('强制关闭超时，强制退出');
      process.exit(1);
    }, 10000);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.server.listen(config.PORT, config.HOST, (err?: Error) => {
        if (err) {
          logger.error('服务器启动失败:', err);
          reject(err);
          return;
        }

        logger.info(`🚀 服务器运行在 http://${config.HOST}:${config.PORT}`);
        logger.info(`📱 WebSocket 服务器运行在 ws://${config.HOST}:${config.PORT}`);
        logger.info(`🌍 环境: ${config.NODE_ENV}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('服务器已停止');
        resolve();
      });
    });
  }

  /**
   * 获取应用状态
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '0.2.0',
      environment: config.NODE_ENV,
      connections: this.io.engine.clientsCount,
      services: {
        gemini: this.geminiService.getStatus(),
        tools: {
          totalTools: this.toolService.getTools().length,
          activeExecutions: this.toolService.getActiveExecutions().length,
          pendingApprovals: this.toolService.getPendingApprovals().length,
          stats: this.toolService.getToolStats()
        }
      }
    };
  }
}

export default App;