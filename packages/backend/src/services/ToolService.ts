import { EventEmitter } from 'events';
import { ToolAdapter, ToolExecutionContext } from '@gemini-cli-webui/cli-integration';
import type {
  Tool,
  ToolExecution,
  ToolResult,
  ToolExecutionStatus,
  ToolApprovalRequest,
  ToolCategory,
  MCPServer,
  ToolRegistry,
  SandboxConfig
} from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';
import { createError } from '../utils/response.js';
import { BuiltinToolsService } from './BuiltinToolsService.js';
import { ReActEngine } from './ReActEngine.js';
import { MCPService } from './MCPService.js';

/**
 * 工具服务配置
 */
export interface ToolServiceConfig {
  defaultSandboxConfig: SandboxConfig;
  enableMCPIntegration: boolean;
  maxExecutionHistory: number;
  cleanupInterval: number;
  debugMode: boolean;
}

/**
 * 工具服务 - 集成 CLI Integration 的工具管理和执行
 */
export class ToolService extends EventEmitter {
  private toolAdapter: ToolAdapter;
  private config: ToolServiceConfig;
  private executionHistory: Map<string, ToolExecution> = new Map();
  private mcpServers: Map<string, MCPServer> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private builtinToolsService: BuiltinToolsService;
  private reactEngine: ReActEngine;
  private mcpService: MCPService;

  constructor(config: Partial<ToolServiceConfig> = {}) {
    super();
    
    this.config = this.validateConfig(config);
    this.toolAdapter = new ToolAdapter({
      enableSandbox: this.config.defaultSandboxConfig.enabled,
      maxConcurrentExecutions: this.config.defaultSandboxConfig.maxConcurrentExecutions,
      debugMode: this.config.debugMode
    });

    // 初始化内置工具服务
    this.builtinToolsService = new BuiltinToolsService();
    
    // 监听内置工具的日志事件
    this.builtinToolsService.on('tool:log', ({ executionId, logEntry }) => {
      this.emit('tool:log', { executionId, logEntry });
    });
    
    // 初始化 ReAct 引擎
    this.reactEngine = new ReActEngine(this);
    
    // 初始化 MCP 服务
    this.mcpService = new MCPService();
    this.setupMCPEventHandlers();
    
    // 注册所有内置工具
    this.registerBuiltinTools();

    this.setupEventHandlers();
    this.startCleanupTimer();
    
    logger.info('ToolService 初始化完成', { 
      config: this.config,
      builtinToolsCount: this.builtinToolsService.getBuiltinTools().length
    });
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    const builtinTools = this.builtinToolsService.getBuiltinTools();
    this.toolAdapter.registerTools(builtinTools);
    logger.info('内置工具已注册', { count: builtinTools.length });
  }

  /**
   * 获取已注册的工具列表
   */
  getTools(category?: ToolCategory): Tool[] {
    const tools = this.toolAdapter.getRegisteredTools();
    return category ? tools.filter(tool => tool.category === category) : tools;
  }

  /**
   * 获取特定工具信息
   */
  getTool(toolId: string): Tool | undefined {
    return this.toolAdapter.getTool(toolId);
  }

  /**
   * 按名称搜索工具
   */
  searchTools(query: string): Tool[] {
    const tools = this.toolAdapter.getRegisteredTools();
    const lowerQuery = query.toLowerCase();
    
    return tools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.toolAdapter.registerTool(tool);
    logger.info('工具已注册', { toolId: tool.id, toolName: tool.name });
    this.emit('tool-registered', tool);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: Tool[]): void {
    this.toolAdapter.registerTools(tools);
    logger.info('批量注册工具', { count: tools.length });
    this.emit('tools-registered', tools);
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecution> {
    try {
      logger.info('请求执行工具', { toolName, context });
      
      // 检查是否是内置工具
      const builtinTool = this.builtinToolsService.getTool(toolName);
      if (builtinTool) {
        // 创建执行记录
        const execution: ToolExecution = {
          id: this.generateExecutionId(),
          toolId: builtinTool.id,
          toolName: builtinTool.name,
          messageId: context.messageId || '',
          conversationId: context.conversationId,
          userId: context.userId,
          input,
          status: 'pending',
          createdAt: new Date()
        };
        
        // 保存执行记录
        this.executionHistory.set(execution.id, execution);
        
        // 检查是否需要审批
        if (builtinTool.permissionLevel !== 'auto') {
          this.emit('tool-execution-requested', execution);
          return execution;
        }
        
        // 自动执行
        execution.status = 'approved';
        execution.approvedAt = new Date();
        const result = await this.executeToolDirectly(toolName, input, context);
        return execution;
      }
      
      // 否则使用 ToolAdapter
      const execution = await this.toolAdapter.interceptToolExecution(
        toolName,
        input,
        context
      );

      // 保存执行记录
      this.executionHistory.set(execution.id, execution);
      
      this.emit('tool-execution-requested', execution);
      return execution;
      
    } catch (error) {
      logger.error('工具执行请求失败', { toolName, error });
      throw createError(400, '工具执行请求失败', { originalError: error });
    }
  }

  /**
   * 直接执行工具（跳过审批）
   */
  async executeToolDirectly(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      logger.info('直接执行工具', { toolName, context });
      
      // 检查是否是内置工具
      const builtinTool = this.builtinToolsService.getTool(toolName);
      if (builtinTool) {
        // 使用内置工具服务执行
        const execution: ToolExecution = {
          id: this.generateExecutionId(),
          toolId: builtinTool.id,
          toolName: builtinTool.name,
          messageId: context.messageId || '',
          conversationId: context.conversationId,
          userId: context.userId,
          input,
          status: 'executing',
          executedAt: new Date()
        };
        
        // 保存执行记录
        this.executionHistory.set(execution.id, execution);
        
        // 执行工具
        const result = await this.builtinToolsService.executeTool(execution, {
          abortSignal: context.abortSignal,
          onProgress: context.onProgress
        });
        
        // 更新执行记录
        execution.status = result.success ? 'completed' : 'error';
        execution.completedAt = new Date();
        execution.output = result.output;
        execution.error = result.error;
        execution.executionTime = result.executionTime;
        
        this.emit('tool-execution-completed', result);
        return result;
      }
      
      // 否则使用 ToolAdapter
      const result = await this.toolAdapter.executeToolDirectly(
        toolName,
        input,
        context
      );

      this.emit('tool-execution-completed', result);
      return result;
      
    } catch (error) {
      logger.error('工具直接执行失败', { toolName, error });
      throw createError(500, '工具执行失败', { originalError: error });
    }
  }

  /**
   * 获取工具执行历史
   */
  getExecutionHistory(
    userId?: string,
    conversationId?: string,
    limit: number = 50,
    offset: number = 0
  ): {
    executions: ToolExecution[];
    total: number;
    hasMore: boolean;
  } {
    let executions = Array.from(this.executionHistory.values());

    // 过滤条件
    if (userId) {
      executions = executions.filter(exec => exec.userId === userId);
    }
    if (conversationId) {
      executions = executions.filter(exec => exec.conversationId === conversationId);
    }

    // 按时间排序（最新的在前）
    executions.sort((a, b) => {
      const timeA = a.executedAt?.getTime() || a.metadata?.interceptedAt || 0;
      const timeB = b.executedAt?.getTime() || b.metadata?.interceptedAt || 0;
      return timeB - timeA;
    });

    const total = executions.length;
    const paginatedExecutions = executions.slice(offset, offset + limit);

    return {
      executions: paginatedExecutions,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * 获取特定执行记录
   */
  getExecution(executionId: string): ToolExecution | undefined {
    return this.executionHistory.get(executionId) || 
           this.toolAdapter.getActiveExecutions().find(exec => exec.id === executionId);
  }

  /**
   * 获取活动执行列表
   */
  getActiveExecutions(userId?: string): ToolExecution[] {
    const activeExecutions = this.toolAdapter.getActiveExecutions();
    return userId 
      ? activeExecutions.filter(exec => exec.userId === userId)
      : activeExecutions;
  }

  /**
   * 取消工具执行
   */
  async cancelExecution(executionId: string, reason: string): Promise<void> {
    try {
      await this.toolAdapter.cancelExecution(executionId, reason);
      logger.info('工具执行已取消', { executionId, reason });
      this.emit('tool-execution-cancelled', executionId, reason);
    } catch (error) {
      logger.error('取消工具执行失败', { executionId, error });
      throw createError(400, '取消执行失败', { originalError: error });
    }
  }

  /**
   * 获取待批准的工具执行列表
   */
  getPendingApprovals(userId?: string): ToolApprovalRequest[] {
    const approvals = this.toolAdapter.getPendingApprovals();
    return userId 
      ? approvals.filter(approval => approval.requestedBy === userId)
      : approvals;
  }

  /**
   * 批准工具执行
   */
  async approveExecution(
    executionId: string,
    approvedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.toolAdapter.approveExecution(executionId, approvedBy, reason);
      logger.info('工具执行已批准', { executionId, approvedBy, reason });
      this.emit('tool-execution-approved', executionId, approvedBy);
    } catch (error) {
      logger.error('批准工具执行失败', { executionId, error });
      throw createError(400, '批准执行失败', { originalError: error });
    }
  }

  /**
   * 拒绝工具执行
   */
  async rejectExecution(
    executionId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    try {
      await this.toolAdapter.rejectExecution(executionId, rejectedBy, reason);
      logger.info('工具执行已拒绝', { executionId, rejectedBy, reason });
      this.emit('tool-execution-rejected', executionId, rejectedBy, reason);
    } catch (error) {
      logger.error('拒绝工具执行失败', { executionId, error });
      throw createError(400, '拒绝执行失败', { originalError: error });
    }
  }

  /**
   * 获取工具注册表
   */
  getToolRegistry(): ToolRegistry {
    return {
      tools: this.toolAdapter.getRegisteredTools(),
      categories: ['filesystem', 'network', 'system', 'development', 'database', 'mcp', 'custom'],
      defaultPermissions: {
        filesystem: 'user_approval',
        network: 'user_approval',
        system: 'admin_approval',
        development: 'user_approval',
        database: 'admin_approval',
        mcp: 'user_approval',
        custom: 'user_approval'
      },
      sandboxConfig: this.config.defaultSandboxConfig
    };
  }

  /**
   * 获取 MCP 服务器列表
   */
  getMCPServers(): MCPServer[] {
    return Array.from(this.mcpServers.values());
  }

  /**
   * 注册 MCP 服务器
   */
  registerMCPServer(server: MCPServer): void {
    this.mcpServers.set(server.id, server);
    
    // 注册服务器提供的工具
    this.registerTools(server.tools);
    
    logger.info('MCP 服务器已注册', { serverId: server.id, serverName: server.name });
    this.emit('mcp-server-registered', server);
  }

  /**
   * 移除 MCP 服务器
   */
  removeMCPServer(serverId: string): void {
    const server = this.mcpServers.get(serverId);
    if (server) {
      this.mcpServers.delete(serverId);
      
      // TODO: 移除相关工具
      
      logger.info('MCP 服务器已移除', { serverId });
      this.emit('mcp-server-removed', serverId);
    }
  }

  /**
   * 获取工具统计信息
   */
  getToolStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<ToolCategory, number>;
    executionStats: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      total: number;
    };
  } {
    const tools = this.toolAdapter.getRegisteredTools();
    const executions = Array.from(this.executionHistory.values());

    // 按类别统计工具
    const byCategory = tools.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<ToolCategory, number>);

    // 执行时间统计
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const executionStats = {
      today: executions.filter(e => {
        const execDate = e.executedAt || new Date(e.metadata?.interceptedAt || 0);
        return execDate >= todayStart;
      }).length,
      thisWeek: executions.filter(e => {
        const execDate = e.executedAt || new Date(e.metadata?.interceptedAt || 0);
        return execDate >= weekStart;
      }).length,
      thisMonth: executions.filter(e => {
        const execDate = e.executedAt || new Date(e.metadata?.interceptedAt || 0);
        return execDate >= monthStart;
      }).length,
      total: executions.length
    };

    // 假设所有工具都是启用的（后续可以添加 enabled 字段）
    const enabledCount = tools.length;
    const disabledCount = 0;

    return {
      total: tools.length,
      enabled: enabledCount,
      disabled: disabledCount,
      byCategory,
      executionStats
    };
  }

  /**
   * 清理过期的执行记录
   */
  cleanupExpiredRecords(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    let cleanedCount = 0;
    
    for (const [id, execution] of this.executionHistory) {
      const executionTime = execution.executedAt?.getTime() || 
                           new Date(execution.metadata?.interceptedAt || 0).getTime();
      
      if (now - executionTime > maxAge) {
        this.executionHistory.delete(id);
        cleanedCount++;
      }
    }

    // 清理过期的审批请求
    this.toolAdapter.cleanupExpiredApprovals();

    if (cleanedCount > 0) {
      logger.info('清理过期执行记录', { cleanedCount });
    }
  }

  /**
   * 停止服务
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // 断开所有 MCP 服务器
    await this.mcpService.disconnectAll();
    
    // 取消所有活动执行
    const activeExecutions = this.toolAdapter.getActiveExecutions();
    for (const execution of activeExecutions) {
      try {
        await this.toolAdapter.cancelExecution(execution.id, '服务关闭');
      } catch (error) {
        logger.error('关闭时取消执行失败', { executionId: execution.id, error });
      }
    }
    
    logger.info('ToolService 已关闭');
  }

  // 私有方法

  /**
   * 生成执行 ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateConfig(config: Partial<ToolServiceConfig>): ToolServiceConfig {
    const defaultConfig: ToolServiceConfig = {
      defaultSandboxConfig: {
        enabled: true,
        defaultLimits: {
          maxMemory: 512 * 1024 * 1024, // 512MB
          maxCpu: 50, // 50%
          maxExecutionTime: 30000, // 30秒
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxNetworkRequests: 50
        },
        allowedNetworkHosts: [],
        blockedCommands: ['rm', 'sudo', 'dd', 'format'],
        allowedFileExtensions: ['.txt', '.json', '.md', '.log'],
        maxConcurrentExecutions: 5
      },
      enableMCPIntegration: true,
      maxExecutionHistory: 1000,
      cleanupInterval: 60 * 60 * 1000, // 1小时
      debugMode: false
    };

    return { ...defaultConfig, ...config };
  }

  private setupEventHandlers(): void {
    // 监听工具适配器事件
    this.toolAdapter.on('tool-execution-completed', (result: ToolResult) => {
      const execution = this.executionHistory.get(result.toolExecutionId);
      if (execution) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.executionTime = result.executionTime;
        execution.output = result.output;
        this.executionHistory.set(execution.id, execution);
      }
      this.emit('tool-execution-completed', result);
    });

    this.toolAdapter.on('tool-execution-failed', (execution: ToolExecution, error: any) => {
      this.executionHistory.set(execution.id, execution);
      this.emit('tool-execution-failed', execution, error);
    });

    this.toolAdapter.on('approval-required', (request: ToolApprovalRequest) => {
      this.emit('approval-required', request);
    });

    this.toolAdapter.on('approval-timeout', (request: ToolApprovalRequest) => {
      this.emit('approval-timeout', request);
    });

    this.toolAdapter.on('debug', (message: string, data?: any) => {
      logger.debug('ToolAdapter Debug', { message, data });
    });
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredRecords();
    }, this.config.cleanupInterval);
  }

  /**
   * 执行 ReAct 推理
   */
  async executeReAct(
    userMessage: string,
    context: {
      conversationId: string;
      userId: string;
      maxSteps?: number;
    },
    llmFunction: (prompt: string) => Promise<string>
  ): Promise<any> {
    const availableTools = await this.getTools();
    
    const reactContext = {
      conversationId: context.conversationId,
      executionId: this.generateExecutionId(),
      userId: context.userId,
      maxSteps: context.maxSteps,
      availableTools
    };

    // 监听 ReAct 步骤事件
    this.reactEngine.on('react:step', ({ executionId, step }) => {
      this.emit('react:step', { executionId, step });
    });

    return this.reactEngine.execute(userMessage, reactContext, llmFunction);
  }

  /**
   * 获取 ReAct 引擎实例
   */
  getReActEngine(): ReActEngine {
    return this.reactEngine;
  }

  /**
   * 添加 MCP 服务器
   */
  async addMCPServer(server: Omit<MCPServer, 'isConnected' | 'tools' | 'error'>): Promise<void> {
    await this.mcpService.addServer(server);
    
    // 注册 MCP 工具到工具适配器
    const mcpTools = this.mcpService.getAllTools();
    this.toolAdapter.registerTools(mcpTools);
  }

  /**
   * 获取 MCP 服务器状态
   */
  getMCPServerStatus(): MCPServer[] {
    return this.mcpService.getServerStatus();
  }

  /**
   * 设置 MCP 事件处理器
   */
  private setupMCPEventHandlers(): void {
    // 服务器连接事件
    this.mcpService.on('server:connected', ({ serverId, server }) => {
      logger.info(`MCP server connected: ${serverId}`);
      this.emit('mcp:server:connected', { serverId, server });
    });

    // 服务器断开事件
    this.mcpService.on('server:disconnected', ({ serverId, code }) => {
      logger.warn(`MCP server disconnected: ${serverId}`, { code });
      this.emit('mcp:server:disconnected', { serverId, code });
    });

    // 工具发现事件
    this.mcpService.on('tools:discovered', ({ serverId, tools }) => {
      logger.info(`Discovered ${tools.length} tools from MCP server ${serverId}`);
      
      // 注册新发现的工具
      const standardTools = this.mcpService.getAllTools();
      this.toolAdapter.registerTools(standardTools);
      
      this.emit('mcp:tools:discovered', { serverId, tools });
    });

    // 服务器错误事件
    this.mcpService.on('server:error', ({ serverId, error }) => {
      logger.error(`MCP server error: ${serverId}`, { error });
      this.emit('mcp:server:error', { serverId, error });
    });
  }

  /**
   * 执行直接工具调用（供 ReAct 引擎使用）
   */
  async executeDirectly(execution: ToolExecution): Promise<ToolResult> {
    // 检查是否是内置工具
    const builtinTool = this.builtinToolsService.getTool(execution.toolName);
    if (builtinTool) {
      return this.builtinToolsService.executeTool(execution);
    }

    // 检查是否是 MCP 工具
    if (execution.toolName.startsWith('mcp_')) {
      const parts = execution.toolName.split('_');
      if (parts.length >= 3) {
        const serverId = parts[1];
        const toolName = parts.slice(2).join('_');
        
        const result = await this.mcpService.executeTool(serverId, toolName, execution.input);
        return {
          toolExecutionId: execution.id,
          success: true,
          output: result,
          executionTime: 0
        };
      }
    }

    // 使用工具适配器执行
    const context: ToolExecutionContext = {
      conversationId: execution.conversationId || 'direct',
      userId: execution.userId,
      executionId: execution.id,
      permissions: ['execute_tools']
    };

    return this.toolAdapter.executeTool(execution.toolName, execution.input, context);
  }
}

// 创建单例实例
export const createToolService = (config?: Partial<ToolServiceConfig>): ToolService => {
  return new ToolService(config);
};

// 默认实例
export const toolService = createToolService();

export default ToolService;