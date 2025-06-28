import { EventEmitter } from 'eventemitter3';
import type {
  Tool,
  ToolExecution,
  ToolResult,
  ToolExecutionStatus,
  ToolPermissionLevel,
  ToolApprovalRequest,
  ToolExecutionError,
  SandboxInfo,
  ResourceUsage
} from '@gemini-cli-webui/shared';

/**
 * 工具适配器配置
 */
export interface ToolAdapterConfig {
  defaultPermissionLevel: ToolPermissionLevel;
  enableSandbox: boolean;
  maxConcurrentExecutions: number;
  executionTimeout: number;
  approvalTimeout: number;
  debugMode: boolean;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
  messageId: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

/**
 * 工具适配器事件
 */
export interface ToolAdapterEvents {
  'tool-execution-requested': (execution: ToolExecution) => void;
  'tool-execution-approved': (execution: ToolExecution) => void;
  'tool-execution-rejected': (execution: ToolExecution, reason: string) => void;
  'tool-execution-started': (execution: ToolExecution) => void;
  'tool-execution-completed': (result: ToolResult) => void;
  'tool-execution-failed': (execution: ToolExecution, error: ToolExecutionError) => void;
  'approval-required': (request: ToolApprovalRequest) => void;
  'approval-timeout': (request: ToolApprovalRequest) => void;
  'error': (error: Error) => void;
  'debug': (message: string, data?: any) => void;
}

/**
 * ToolAdapter - 拦截和管理工具执行
 * 
 * 负责工具执行的拦截、审批工作流集成和状态管理
 */
export class ToolAdapter extends EventEmitter<ToolAdapterEvents> {
  private config: ToolAdapterConfig;
  private registeredTools = new Map<string, Tool>();
  private activeExecutions = new Map<string, ToolExecution>();
  private pendingApprovals = new Map<string, ToolApprovalRequest>();
  private executionQueue: ToolExecution[] = [];
  private isProcessing = false;

  constructor(config: Partial<ToolAdapterConfig> = {}) {
    super();
    this.config = this.validateConfig(config);
    this.debugLog('ToolAdapter 初始化', { config: this.config });
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.registeredTools.set(tool.id, tool);
    this.debugLog('工具已注册', { toolId: tool.id, toolName: tool.name });
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: Tool[]): void {
    tools.forEach(tool => this.registerTool(tool));
    this.debugLog('批量注册工具', { count: tools.length });
  }

  /**
   * 获取已注册的工具
   */
  getRegisteredTools(): Tool[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * 获取特定工具
   */
  getTool(toolId: string): Tool | undefined {
    return this.registeredTools.get(toolId);
  }

  /**
   * 拦截工具执行请求
   */
  async interceptToolExecution(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecution> {
    const tool = this.findToolByName(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    const execution: ToolExecution = {
      id: this.generateId(),
      toolId: tool.id,
      toolName: tool.name,
      messageId: context.messageId,
      conversationId: context.conversationId,
      userId: context.userId,
      input,
      status: 'pending',
      metadata: {
        ...context.metadata,
        interceptedAt: new Date().toISOString(),
        sessionId: context.sessionId
      }
    };

    this.debugLog('拦截工具执行请求', execution);
    this.emit('tool-execution-requested', execution);

    // 根据权限级别决定处理方式
    await this.handlePermissionCheck(execution, tool);

    return execution;
  }

  /**
   * 批准工具执行
   */
  async approveExecution(
    executionId: string,
    approvedBy: string,
    reason?: string
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`未找到执行记录: ${executionId}`);
    }

    if (execution.status !== 'pending') {
      throw new Error(`执行状态无效: ${execution.status}`);
    }

    execution.status = 'approved';
    execution.approvedBy = approvedBy;
    execution.approvedAt = new Date();

    // 移除待批准请求
    this.pendingApprovals.delete(executionId);

    this.debugLog('工具执行已批准', { executionId, approvedBy, reason });
    this.emit('tool-execution-approved', execution);

    // 将执行加入队列
    this.executionQueue.push(execution);
    this.processExecutionQueue();
  }

  /**
   * 拒绝工具执行
   */
  async rejectExecution(
    executionId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`未找到执行记录: ${executionId}`);
    }

    execution.status = 'rejected';
    execution.metadata = {
      ...execution.metadata,
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    };

    // 移除相关记录
    this.activeExecutions.delete(executionId);
    this.pendingApprovals.delete(executionId);

    this.debugLog('工具执行已拒绝', { executionId, rejectedBy, reason });
    this.emit('tool-execution-rejected', execution, reason);
  }

  /**
   * 执行工具
   */
  async executeToolDirectly(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
    sandboxInfo?: SandboxInfo
  ): Promise<ToolResult> {
    const tool = this.findToolByName(toolName);
    if (!tool) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    const execution: ToolExecution = {
      id: this.generateId(),
      toolId: tool.id,
      toolName: tool.name,
      messageId: context.messageId,
      conversationId: context.conversationId,
      userId: context.userId,
      input,
      status: 'executing',
      executedAt: new Date(),
      sandboxInfo
    };

    this.activeExecutions.set(execution.id, execution);
    this.debugLog('开始直接执行工具', execution);
    this.emit('tool-execution-started', execution);

    try {
      const result = await this.performExecution(execution, tool);
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.executionTime = result.executionTime;
      execution.output = result.output;

      this.activeExecutions.delete(execution.id);
      this.debugLog('工具执行完成', result);
      this.emit('tool-execution-completed', result);

      return result;
    } catch (error) {
      execution.status = 'error';
      execution.error = this.createExecutionError(error);
      
      this.activeExecutions.delete(execution.id);
      this.debugLog('工具执行失败', execution.error);
      this.emit('tool-execution-failed', execution, execution.error);
      
      throw error;
    }
  }

  /**
   * 获取活动执行列表
   */
  getActiveExecutions(): ToolExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 获取待批准请求列表
   */
  getPendingApprovals(): ToolApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * 取消工具执行
   */
  async cancelExecution(executionId: string, reason: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`未找到执行记录: ${executionId}`);
    }

    execution.status = 'error';
    execution.error = {
      code: 'EXECUTION_CANCELLED',
      message: `执行已取消: ${reason}`,
      details: { reason, cancelledAt: new Date().toISOString() }
    };

    this.activeExecutions.delete(executionId);
    this.pendingApprovals.delete(executionId);

    this.debugLog('工具执行已取消', { executionId, reason });
    this.emit('tool-execution-failed', execution, execution.error);
  }

  /**
   * 清理过期的待批准请求
   */
  cleanupExpiredApprovals(): void {
    const now = Date.now();
    const expiredRequests: string[] = [];

    for (const [id, request] of this.pendingApprovals) {
      if (now - request.requestedAt.getTime() > this.config.approvalTimeout) {
        expiredRequests.push(id);
      }
    }

    expiredRequests.forEach(id => {
      const request = this.pendingApprovals.get(id);
      if (request) {
        request.status = 'expired';
        this.pendingApprovals.delete(id);
        this.activeExecutions.delete(request.toolExecutionId);
        
        this.debugLog('批准请求已过期', request);
        this.emit('approval-timeout', request);
      }
    });
  }

  // 私有方法

  private validateConfig(config: Partial<ToolAdapterConfig>): ToolAdapterConfig {
    const defaultConfig: ToolAdapterConfig = {
      defaultPermissionLevel: 'user_approval',
      enableSandbox: true,
      maxConcurrentExecutions: 5,
      executionTimeout: 30000,
      approvalTimeout: 300000, // 5分钟
      debugMode: false
    };

    return { ...defaultConfig, ...config };
  }

  private findToolByName(toolName: string): Tool | undefined {
    return Array.from(this.registeredTools.values()).find(tool => tool.name === toolName);
  }

  private async handlePermissionCheck(execution: ToolExecution, tool: Tool): Promise<void> {
    this.activeExecutions.set(execution.id, execution);

    switch (tool.permissionLevel) {
      case 'auto':
        // 自动批准并执行
        execution.status = 'approved';
        execution.approvedBy = 'system';
        execution.approvedAt = new Date();
        this.emit('tool-execution-approved', execution);
        this.executionQueue.push(execution);
        this.processExecutionQueue();
        break;

      case 'user_approval':
      case 'admin_approval':
        // 需要人工批准
        await this.createApprovalRequest(execution, tool);
        break;

      case 'denied':
        // 拒绝执行
        execution.status = 'rejected';
        execution.metadata = {
          ...execution.metadata,
          rejectedBy: 'system',
          rejectedAt: new Date().toISOString(),
          rejectionReason: '工具被系统拒绝'
        };
        this.activeExecutions.delete(execution.id);
        this.emit('tool-execution-rejected', execution, '工具被系统拒绝');
        break;
    }
  }

  private async createApprovalRequest(execution: ToolExecution, tool: Tool): Promise<void> {
    const request: ToolApprovalRequest = {
      id: this.generateId(),
      toolExecutionId: execution.id,
      toolName: tool.name,
      input: execution.input,
      requiredBy: new Date(Date.now() + this.config.approvalTimeout),
      riskLevel: this.assessRiskLevel(tool, execution.input),
      requestedBy: execution.userId,
      requestedAt: new Date(),
      approvers: this.getRequiredApprovers(tool.permissionLevel),
      status: 'pending'
    };

    this.pendingApprovals.set(request.id, request);
    this.debugLog('创建批准请求', request);
    this.emit('approval-required', request);
  }

  private assessRiskLevel(tool: Tool, input: Record<string, unknown>): 'low' | 'medium' | 'high' {
    // 简化的风险评估逻辑
    const riskFactors = {
      filesystem: ['high', 'medium', 'low'],
      network: ['high', 'medium'],
      system: ['high', 'high'],
      database: ['medium', 'high'],
      development: ['low', 'medium'],
      mcp: ['low', 'medium'],
      custom: ['medium']
    };

    const categoryRisk = riskFactors[tool.category] || ['low'];
    
    // 检查输入参数中的风险指标
    const inputStr = JSON.stringify(input).toLowerCase();
    const highRiskPatterns = ['delete', 'drop', 'rm', 'remove', 'sudo', 'admin'];
    const hasHighRiskPattern = highRiskPatterns.some(pattern => inputStr.includes(pattern));

    if (hasHighRiskPattern || categoryRisk.includes('high')) {
      return 'high';
    } else if (categoryRisk.includes('medium')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private getRequiredApprovers(permissionLevel: ToolPermissionLevel): string[] {
    switch (permissionLevel) {
      case 'user_approval':
        return ['user'];
      case 'admin_approval':
        return ['admin'];
      default:
        return [];
    }
  }

  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      this.debugLog('达到最大并发执行数，等待执行完成');
      return;
    }

    this.isProcessing = true;

    try {
      const execution = this.executionQueue.shift();
      if (execution) {
        await this.processExecution(execution);
      }
    } finally {
      this.isProcessing = false;
      // 递归处理剩余队列
      setImmediate(() => this.processExecutionQueue());
    }
  }

  private async processExecution(execution: ToolExecution): Promise<void> {
    const tool = this.registeredTools.get(execution.toolId);
    if (!tool) {
      const error = this.createExecutionError(new Error(`工具不存在: ${execution.toolId}`));
      execution.status = 'error';
      execution.error = error;
      this.activeExecutions.delete(execution.id);
      this.emit('tool-execution-failed', execution, error);
      return;
    }

    execution.status = 'executing';
    execution.executedAt = new Date();
    
    this.debugLog('开始执行工具', execution);
    this.emit('tool-execution-started', execution);

    try {
      const result = await this.performExecution(execution, tool);
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.executionTime = result.executionTime;
      execution.output = result.output;

      this.activeExecutions.delete(execution.id);
      this.debugLog('工具执行完成', result);
      this.emit('tool-execution-completed', result);

    } catch (error) {
      execution.status = 'error';
      execution.error = this.createExecutionError(error);
      
      this.activeExecutions.delete(execution.id);
      this.debugLog('工具执行失败', execution.error);
      this.emit('tool-execution-failed', execution, execution.error);
    }
  }

  private async performExecution(execution: ToolExecution, tool: Tool): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // 这里应该调用实际的工具执行逻辑
      // 暂时使用模拟实现
      const output = await this.simulateToolExecution(tool, execution.input);
      const executionTime = Date.now() - startTime;

      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: true,
        output,
        executionTime,
        resourceUsage: {
          memoryUsed: 0,
          cpuTime: executionTime,
          networkRequests: 0,
          filesAccessed: []
        }
      };

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const result: ToolResult = {
        toolExecutionId: execution.id,
        success: false,
        error: this.createExecutionError(error),
        executionTime
      };

      return result;
    }
  }

  private async simulateToolExecution(tool: Tool, input: Record<string, unknown>): Promise<string> {
    // 模拟执行延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 100));
    
    return `工具 ${tool.name} 执行完成。输入参数: ${JSON.stringify(input)}`;
  }

  private createExecutionError(error: unknown): ToolExecutionError {
    if (error instanceof Error) {
      return {
        code: 'EXECUTION_ERROR',
        message: error.message,
        stack: error.stack,
        details: { originalError: error }
      };
    } else {
      return {
        code: 'UNKNOWN_ERROR',
        message: String(error),
        details: { originalError: error }
      };
    }
  }

  private generateId(): string {
    return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      this.emit('debug', message, data);
    }
  }
}

export default ToolAdapter;