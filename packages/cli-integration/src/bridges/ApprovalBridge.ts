import { EventEmitter } from 'eventemitter3';
import type {
  ToolApprovalRequest,
  ToolExecution,
  ToolPermissionLevel,
  User,
  WebSocketEvent
} from '@gemini-cli-webui/shared';

/**
 * 审批决策类型
 */
export type ApprovalDecision = 'approve' | 'reject' | 'escalate' | 'defer';

/**
 * 审批规则
 */
export interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  conditions: ApprovalCondition[];
  action: ApprovalAction;
  priority: number;
  isEnabled: boolean;
}

/**
 * 审批条件
 */
export interface ApprovalCondition {
  type: 'tool_category' | 'risk_level' | 'user_role' | 'time_window' | 'custom';
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range';
  value: string | number | string[] | number[];
  metadata?: Record<string, unknown>;
}

/**
 * 审批动作
 */
export interface ApprovalAction {
  decision: ApprovalDecision;
  requiredApprovers: string[];
  timeout: number;
  escalationPath?: string[];
  notificationChannels: string[];
  customHandler?: string;
}

/**
 * 审批流程状态
 */
export interface ApprovalWorkflow {
  id: string;
  requestId: string;
  toolExecutionId: string;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled' | 'expired';
  steps: ApprovalStep[];
  startedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 审批步骤
 */
export interface ApprovalStep {
  id: string;
  stepNumber: number;
  name: string;
  description: string;
  requiredApprovers: string[];
  approvedBy: string[];
  rejectedBy: string[];
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  startedAt: Date;
  completedAt?: Date;
  timeout: number;
  escalationPath?: string[];
  comments?: ApprovalComment[];
}

/**
 * 审批评论
 */
export interface ApprovalComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 审批桥接器配置
 */
export interface ApprovalBridgeConfig {
  defaultTimeout: number;
  maxEscalationLevels: number;
  enableNotifications: boolean;
  enableAuditLog: boolean;
  autoCleanupExpired: boolean;
  cleanupInterval: number;
  debugMode: boolean;
}

/**
 * 审批桥接器事件
 */
export interface ApprovalBridgeEvents {
  'approval-requested': (request: ToolApprovalRequest, workflow: ApprovalWorkflow) => void;
  'approval-granted': (request: ToolApprovalRequest, approvedBy: string) => void;
  'approval-rejected': (request: ToolApprovalRequest, rejectedBy: string, reason: string) => void;
  'approval-escalated': (request: ToolApprovalRequest, escalatedTo: string[]) => void;
  'approval-expired': (request: ToolApprovalRequest, workflow: ApprovalWorkflow) => void;
  'workflow-completed': (workflow: ApprovalWorkflow) => void;
  'workflow-failed': (workflow: ApprovalWorkflow, error: Error) => void;
  'notification-sent': (recipients: string[], message: string, channel: string) => void;
  'audit-logged': (event: string, data: Record<string, unknown>) => void;
  'error': (error: Error) => void;
  'debug': (message: string, data?: any) => void;
}

/**
 * ApprovalBridge - 实现审批工作流
 * 
 * 负责多层审批系统（auto/user/admin）、WebSocket实时通知、超时和错误处理
 */
export class ApprovalBridge extends EventEmitter<ApprovalBridgeEvents> {
  private config: ApprovalBridgeConfig;
  private approvalRules = new Map<string, ApprovalRule>();
  private activeWorkflows = new Map<string, ApprovalWorkflow>();
  private userRoles = new Map<string, string[]>();
  private cleanupTimer?: NodeJS.Timeout;
  private notificationHandlers = new Map<string, Function>();

  constructor(config: Partial<ApprovalBridgeConfig> = {}) {
    super();
    this.config = this.validateConfig(config);
    this.setupDefaultRules();
    this.startCleanupTimer();
    this.debugLog('ApprovalBridge 初始化', { config: this.config });
  }

  /**
   * 处理审批请求
   */
  async processApprovalRequest(request: ToolApprovalRequest): Promise<ApprovalWorkflow> {
    this.debugLog('处理审批请求', request);

    // 评估审批规则
    const applicableRules = this.evaluateApprovalRules(request);
    
    // 创建审批工作流
    const workflow = this.createApprovalWorkflow(request, applicableRules);
    
    this.activeWorkflows.set(workflow.id, workflow);
    this.auditLog('approval-workflow-created', { workflowId: workflow.id, requestId: request.id });
    
    this.emit('approval-requested', request, workflow);
    
    // 开始执行工作流
    await this.executeWorkflow(workflow);
    
    return workflow;
  }

  /**
   * 批准审批请求
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    comment?: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const workflow = this.findWorkflowByRequestId(requestId);
    if (!workflow) {
      throw new Error(`未找到审批工作流: ${requestId}`);
    }

    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep) {
      throw new Error(`无效的工作流步骤: ${workflow.currentStep}`);
    }

    // 验证审批权限
    if (!this.canUserApprove(approverId, currentStep)) {
      throw new Error(`用户 ${approverId} 没有审批权限`);
    }

    // 添加评论
    if (comment) {
      this.addComment(currentStep, approverId, comment, metadata);
    }

    // 记录批准
    currentStep.approvedBy.push(approverId);
    this.auditLog('approval-granted', {
      workflowId: workflow.id,
      requestId,
      approverId,
      stepNumber: currentStep.stepNumber
    });

    this.debugLog('审批已批准', { requestId, approverId, stepNumber: currentStep.stepNumber });

    // 检查是否满足批准条件
    if (this.isStepApproved(currentStep)) {
      currentStep.status = 'approved';
      currentStep.completedAt = new Date();
      
      // 进入下一步或完成工作流
      const isCompleted = await this.advanceWorkflow(workflow);
      
      if (isCompleted) {
        const request = this.findRequestById(requestId);
        if (request) {
          this.emit('approval-granted', request, approverId);
        }
      }
      
      return true;
    }

    return false;
  }

  /**
   * 拒绝审批请求
   */
  async rejectRequest(
    requestId: string,
    rejectedBy: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const workflow = this.findWorkflowByRequestId(requestId);
    if (!workflow) {
      throw new Error(`未找到审批工作流: ${requestId}`);
    }

    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep) {
      throw new Error(`无效的工作流步骤: ${workflow.currentStep}`);
    }

    // 验证拒绝权限
    if (!this.canUserApprove(rejectedBy, currentStep)) {
      throw new Error(`用户 ${rejectedBy} 没有拒绝权限`);
    }

    // 添加拒绝评论
    this.addComment(currentStep, rejectedBy, `拒绝原因: ${reason}`, metadata);

    // 记录拒绝
    currentStep.rejectedBy.push(rejectedBy);
    currentStep.status = 'rejected';
    currentStep.completedAt = new Date();

    // 标记工作流为失败
    workflow.status = 'failed';
    workflow.completedAt = new Date();

    this.auditLog('approval-rejected', {
      workflowId: workflow.id,
      requestId,
      rejectedBy,
      reason,
      stepNumber: currentStep.stepNumber
    });

    this.debugLog('审批已拒绝', { requestId, rejectedBy, reason });

    // 清理工作流
    this.activeWorkflows.delete(workflow.id);

    const request = this.findRequestById(requestId);
    if (request) {
      this.emit('approval-rejected', request, rejectedBy, reason);
    }

    this.emit('workflow-failed', workflow, new Error(`审批被拒绝: ${reason}`));
  }

  /**
   * 升级审批请求
   */
  async escalateRequest(
    requestId: string,
    escalatedBy: string,
    reason: string
  ): Promise<void> {
    const workflow = this.findWorkflowByRequestId(requestId);
    if (!workflow) {
      throw new Error(`未找到审批工作流: ${requestId}`);
    }

    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep || !currentStep.escalationPath) {
      throw new Error(`当前步骤不支持升级`);
    }

    // 添加升级评论
    this.addComment(currentStep, escalatedBy, `升级原因: ${reason}`);

    // 更新审批人员
    currentStep.requiredApprovers = [...currentStep.escalationPath];
    currentStep.status = 'escalated';

    this.auditLog('approval-escalated', {
      workflowId: workflow.id,
      requestId,
      escalatedBy,
      reason,
      newApprovers: currentStep.requiredApprovers
    });

    this.debugLog('审批已升级', { requestId, escalatedBy, reason });

    // 发送通知
    await this.sendNotifications(
      currentStep.requiredApprovers,
      `审批请求已升级: ${reason}`,
      'escalation'
    );

    const request = this.findRequestById(requestId);
    if (request) {
      this.emit('approval-escalated', request, currentStep.requiredApprovers);
    }
  }

  /**
   * 添加审批规则
   */
  addApprovalRule(rule: ApprovalRule): void {
    this.approvalRules.set(rule.id, rule);
    this.debugLog('添加审批规则', rule);
  }

  /**
   * 移除审批规则
   */
  removeApprovalRule(ruleId: string): void {
    this.approvalRules.delete(ruleId);
    this.debugLog('移除审批规则', { ruleId });
  }

  /**
   * 设置用户角色
   */
  setUserRoles(userId: string, roles: string[]): void {
    this.userRoles.set(userId, roles);
    this.debugLog('设置用户角色', { userId, roles });
  }

  /**
   * 注册通知处理器
   */
  registerNotificationHandler(channel: string, handler: Function): void {
    this.notificationHandlers.set(channel, handler);
    this.debugLog('注册通知处理器', { channel });
  }

  /**
   * 获取活动工作流
   */
  getActiveWorkflows(): ApprovalWorkflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * 获取工作流详情
   */
  getWorkflow(workflowId: string): ApprovalWorkflow | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.activeWorkflows.clear();
    this.approvalRules.clear();
    this.userRoles.clear();
    this.notificationHandlers.clear();
    this.removeAllListeners();
    
    this.debugLog('ApprovalBridge 资源清理完成');
  }

  // 私有方法

  private validateConfig(config: Partial<ApprovalBridgeConfig>): ApprovalBridgeConfig {
    const defaultConfig: ApprovalBridgeConfig = {
      defaultTimeout: 300000, // 5分钟
      maxEscalationLevels: 3,
      enableNotifications: true,
      enableAuditLog: true,
      autoCleanupExpired: true,
      cleanupInterval: 60000, // 1分钟
      debugMode: false
    };

    return { ...defaultConfig, ...config };
  }

  private setupDefaultRules(): void {
    // 默认自动批准规则
    this.addApprovalRule({
      id: 'auto-approve-low-risk',
      name: '自动批准低风险操作',
      description: '自动批准低风险的工具执行',
      conditions: [
        { type: 'risk_level', operator: 'equals', value: 'low' }
      ],
      action: {
        decision: 'approve',
        requiredApprovers: ['system'],
        timeout: 0,
        notificationChannels: []
      },
      priority: 1,
      isEnabled: true
    });

    // 用户批准规则
    this.addApprovalRule({
      id: 'user-approve-medium-risk',
      name: '用户批准中等风险操作',
      description: '需要用户批准的中等风险操作',
      conditions: [
        { type: 'risk_level', operator: 'equals', value: 'medium' }
      ],
      action: {
        decision: 'approve',
        requiredApprovers: ['user'],
        timeout: 300000,
        escalationPath: ['admin'],
        notificationChannels: ['websocket', 'email']
      },
      priority: 2,
      isEnabled: true
    });

    // 管理员批准规则
    this.addApprovalRule({
      id: 'admin-approve-high-risk',
      name: '管理员批准高风险操作',
      description: '需要管理员批准的高风险操作',
      conditions: [
        { type: 'risk_level', operator: 'equals', value: 'high' }
      ],
      action: {
        decision: 'approve',
        requiredApprovers: ['admin'],
        timeout: 600000,
        notificationChannels: ['websocket', 'email', 'sms']
      },
      priority: 3,
      isEnabled: true
    });
  }

  private evaluateApprovalRules(request: ToolApprovalRequest): ApprovalRule[] {
    const applicableRules: ApprovalRule[] = [];

    for (const rule of this.approvalRules.values()) {
      if (!rule.isEnabled) continue;

      const matchesAllConditions = rule.conditions.every(condition => 
        this.evaluateCondition(condition, request)
      );

      if (matchesAllConditions) {
        applicableRules.push(rule);
      }
    }

    // 按优先级排序
    return applicableRules.sort((a, b) => a.priority - b.priority);
  }

  private evaluateCondition(condition: ApprovalCondition, request: ToolApprovalRequest): boolean {
    switch (condition.type) {
      case 'risk_level':
        return this.evaluateOperator(request.riskLevel, condition.operator, condition.value);
      case 'tool_category':
        // 需要从工具信息中获取分类
        return true; // 简化实现
      case 'user_role':
        const userRoles = this.userRoles.get(request.requestedBy) || [];
        return userRoles.some(role => 
          this.evaluateOperator(role, condition.operator, condition.value)
        );
      default:
        return false;
    }
  }

  private evaluateOperator(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'in_range':
        if (Array.isArray(expected) && expected.length === 2) {
          return Number(actual) >= expected[0] && Number(actual) <= expected[1];
        }
        return false;
      default:
        return false;
    }
  }

  private createApprovalWorkflow(request: ToolApprovalRequest, rules: ApprovalRule[]): ApprovalWorkflow {
    const workflow: ApprovalWorkflow = {
      id: this.generateId(),
      requestId: request.id,
      toolExecutionId: request.toolExecutionId,
      currentStep: 0,
      totalSteps: rules.length || 1,
      status: 'active',
      steps: [],
      startedAt: new Date()
    };

    // 创建审批步骤
    if (rules.length > 0) {
      rules.forEach((rule, index) => {
        const step: ApprovalStep = {
          id: this.generateId(),
          stepNumber: index,
          name: rule.name,
          description: rule.description,
          requiredApprovers: rule.action.requiredApprovers.slice(),
          approvedBy: [],
          rejectedBy: [],
          status: 'pending',
          startedAt: new Date(),
          timeout: rule.action.timeout || this.config.defaultTimeout,
          escalationPath: rule.action.escalationPath,
          comments: []
        };
        workflow.steps.push(step);
      });
    } else {
      // 默认用户批准步骤
      const step: ApprovalStep = {
        id: this.generateId(),
        stepNumber: 0,
        name: '用户批准',
        description: '需要用户批准此操作',
        requiredApprovers: ['user'],
        approvedBy: [],
        rejectedBy: [],
        status: 'pending',
        startedAt: new Date(),
        timeout: this.config.defaultTimeout,
        comments: []
      };
      workflow.steps.push(step);
    }

    return workflow;
  }

  private async executeWorkflow(workflow: ApprovalWorkflow): Promise<void> {
    const currentStep = workflow.steps[workflow.currentStep];
    if (!currentStep) {
      workflow.status = 'failed';
      this.emit('workflow-failed', workflow, new Error('没有可执行的步骤'));
      return;
    }

    // 设置超时
    if (currentStep.timeout > 0) {
      setTimeout(() => {
        this.handleStepTimeout(workflow, currentStep);
      }, currentStep.timeout);
    }

    // 发送通知
    if (this.config.enableNotifications) {
      await this.sendNotifications(
        currentStep.requiredApprovers,
        `需要您的审批: ${currentStep.description}`,
        'approval'
      );
    }
  }

  private async advanceWorkflow(workflow: ApprovalWorkflow): Promise<boolean> {
    workflow.currentStep++;
    
    if (workflow.currentStep >= workflow.totalSteps) {
      // 工作流完成
      workflow.status = 'completed';
      workflow.completedAt = new Date();
      this.activeWorkflows.delete(workflow.id);
      
      this.auditLog('workflow-completed', { workflowId: workflow.id });
      this.emit('workflow-completed', workflow);
      
      return true;
    } else {
      // 执行下一步
      await this.executeWorkflow(workflow);
      return false;
    }
  }

  private isStepApproved(step: ApprovalStep): boolean {
    // 简化实现：需要至少一个审批人批准
    return step.approvedBy.length > 0;
  }

  private canUserApprove(userId: string, step: ApprovalStep): boolean {
    // 检查用户是否在要求的审批人列表中
    if (step.requiredApprovers.includes(userId)) {
      return true;
    }

    // 检查用户角色
    const userRoles = this.userRoles.get(userId) || [];
    return step.requiredApprovers.some(required => userRoles.includes(required));
  }

  private addComment(
    step: ApprovalStep,
    authorId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const comment: ApprovalComment = {
      id: this.generateId(),
      authorId,
      authorName: authorId, // 简化实现
      content,
      timestamp: new Date(),
      metadata
    };

    step.comments = step.comments || [];
    step.comments.push(comment);
  }

  private async sendNotifications(
    recipients: string[],
    message: string,
    channel: string
  ): Promise<void> {
    const handler = this.notificationHandlers.get(channel);
    if (handler) {
      try {
        await handler(recipients, message);
        this.emit('notification-sent', recipients, message, channel);
      } catch (error) {
        this.debugLog('通知发送失败', { recipients, message, channel, error });
      }
    }
  }

  private handleStepTimeout(workflow: ApprovalWorkflow, step: ApprovalStep): void {
    if (step.status === 'pending') {
      step.status = 'expired';
      step.completedAt = new Date();
      
      workflow.status = 'expired';
      workflow.completedAt = new Date();
      
      this.activeWorkflows.delete(workflow.id);
      
      this.auditLog('approval-expired', { workflowId: workflow.id, stepNumber: step.stepNumber });
      this.debugLog('审批步骤超时', { workflowId: workflow.id, stepNumber: step.stepNumber });
      
      const request = this.findRequestById(workflow.requestId);
      if (request) {
        this.emit('approval-expired', request, workflow);
      }
    }
  }

  private findWorkflowByRequestId(requestId: string): ApprovalWorkflow | undefined {
    return Array.from(this.activeWorkflows.values()).find(w => w.requestId === requestId);
  }

  private findRequestById(requestId: string): ToolApprovalRequest | undefined {
    // 简化实现：需要外部提供请求查找逻辑
    return undefined;
  }

  private startCleanupTimer(): void {
    if (this.config.autoCleanupExpired) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredWorkflows();
      }, this.config.cleanupInterval);
    }
  }

  private cleanupExpiredWorkflows(): void {
    const now = Date.now();
    const expiredWorkflows: string[] = [];

    for (const [id, workflow] of this.activeWorkflows) {
      const currentStep = workflow.steps[workflow.currentStep];
      if (currentStep && currentStep.status === 'pending') {
        const elapsed = now - currentStep.startedAt.getTime();
        if (elapsed > currentStep.timeout) {
          this.handleStepTimeout(workflow, currentStep);
          expiredWorkflows.push(id);
        }
      }
    }

    if (expiredWorkflows.length > 0) {
      this.debugLog('清理过期工作流', { count: expiredWorkflows.length });
    }
  }

  private auditLog(event: string, data: Record<string, unknown>): void {
    if (this.config.enableAuditLog) {
      const auditData = {
        event,
        timestamp: new Date().toISOString(),
        ...data
      };
      this.emit('audit-logged', event, auditData);
    }
  }

  private generateId(): string {
    return `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private debugLog(message: string, data?: any): void {
    if (this.config.debugMode) {
      this.emit('debug', message, data);
    }
  }
}

export default ApprovalBridge;