import { Request, Response } from 'express';
import { 
  approveToolRequestSchema,
  objectIdSchema
} from '@gemini-cli-webui/shared';
import { ToolService } from '../services/ToolService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parsePaginationParams } from '../utils/index.js';
import { logger } from '../utils/logger.js';

/**
 * 审批控制器
 * 处理工具执行审批相关的 API 请求
 */
export class ApprovalController {
  constructor(private toolService: ToolService) {}

  /**
   * 获取待审批的工具执行列表
   */
  async getPendingApprovals(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { page, limit } = parsePaginationParams(req.query);
      const { riskLevel, requester } = req.query;

      // 管理员可以查看所有待审批，普通用户只能查看自己的
      const userId = req.user.role === 'admin' ? undefined : req.user.id;
      let approvals = this.toolService.getPendingApprovals(userId);

      // 按风险级别过滤
      if (riskLevel && ['low', 'medium', 'high'].includes(riskLevel as string)) {
        approvals = approvals.filter(approval => approval.riskLevel === riskLevel);
      }

      // 按请求者过滤（仅管理员）
      if (requester && req.user.role === 'admin') {
        approvals = approvals.filter(approval => approval.requestedBy === requester);
      }

      // 按时间排序（最新的在前）
      approvals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

      // 分页
      const total = approvals.length;
      const offset = (page - 1) * limit;
      const paginatedApprovals = approvals.slice(offset, offset + limit);

      sendSuccess(res, 200, {
        approvals: paginatedApprovals,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + limit < total
        }
      }, '获取待审批列表成功');
    } catch (error) {
      logger.error('获取待审批列表失败:', error);
      sendError(res, 500, 'GET_PENDING_APPROVALS_ERROR', '获取待审批列表失败');
    }
  }

  /**
   * 获取特定审批请求详情
   */
  async getApprovalRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { approvalId } = req.params;

      // 验证审批 ID
      if (!objectIdSchema.safeParse(approvalId).success) {
        sendError(res, 400, 'INVALID_APPROVAL_ID', '审批 ID 无效');
        return;
      }

      const approvals = this.toolService.getPendingApprovals();
      const approval = approvals.find(a => a.id === approvalId);

      if (!approval) {
        sendError(res, 404, 'APPROVAL_NOT_FOUND', '审批请求不存在');
        return;
      }

      // 权限检查：只能查看自己的审批请求，除非是管理员
      if (approval.requestedBy !== req.user.id && req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
        return;
      }

      // 获取相关的执行记录
      const execution = this.toolService.getExecution(approval.toolExecutionId);

      sendSuccess(res, 200, {
        approval,
        execution
      }, '获取审批请求详情成功');
    } catch (error) {
      logger.error('获取审批请求详情失败:', error);
      sendError(res, 500, 'GET_APPROVAL_REQUEST_ERROR', '获取审批请求详情失败');
    }
  }

  /**
   * 批准工具执行
   */
  async approveExecution(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { executionId } = req.params;

      // 验证请求数据
      const validationResult = approveToolRequestSchema.safeParse({
        ...req.body,
        toolExecutionId: executionId
      });

      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request = validationResult.data;

      if (!request.approved) {
        sendError(res, 400, 'INVALID_APPROVAL_ACTION', '必须明确批准或拒绝');
        return;
      }

      // 验证执行 ID
      if (!objectIdSchema.safeParse(executionId).success) {
        sendError(res, 400, 'INVALID_EXECUTION_ID', '执行 ID 无效');
        return;
      }

      // 获取执行记录和相关审批请求
      const execution = this.toolService.getExecution(executionId);
      if (!execution) {
        sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
        return;
      }

      const approvals = this.toolService.getPendingApprovals();
      const approval = approvals.find(a => a.toolExecutionId === executionId);
      if (!approval) {
        sendError(res, 404, 'APPROVAL_NOT_FOUND', '审批请求不存在');
        return;
      }

      // 权限检查：需要相应的审批权限
      if (!this.hasApprovalPermission(req.user, approval)) {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足，无法审批此请求');
        return;
      }

      // 执行批准
      await this.toolService.approveExecution(
        executionId,
        req.user.id,
        request.reason
      );

      sendSuccess(res, 200, {
        executionId,
        approvedBy: req.user.id,
        approvedAt: new Date(),
        reason: request.reason
      }, '工具执行已批准');
    } catch (error) {
      logger.error('批准工具执行失败:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('状态无效')) {
          sendError(res, 400, 'INVALID_EXECUTION_STATUS', '执行状态无效，无法批准');
          return;
        }
        if (error.message.includes('未找到')) {
          sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
          return;
        }
      }
      
      sendError(res, 500, 'APPROVE_EXECUTION_ERROR', '批准工具执行失败');
    }
  }

  /**
   * 拒绝工具执行
   */
  async rejectExecution(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { executionId } = req.params;

      // 验证请求数据
      const validationResult = approveToolRequestSchema.safeParse({
        ...req.body,
        toolExecutionId: executionId
      });

      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request = validationResult.data;

      if (request.approved) {
        sendError(res, 400, 'INVALID_APPROVAL_ACTION', '此操作用于拒绝执行');
        return;
      }

      if (!request.reason || request.reason.trim().length === 0) {
        sendError(res, 400, 'MISSING_REJECTION_REASON', '拒绝执行必须提供原因');
        return;
      }

      // 验证执行 ID
      if (!objectIdSchema.safeParse(executionId).success) {
        sendError(res, 400, 'INVALID_EXECUTION_ID', '执行 ID 无效');
        return;
      }

      // 获取执行记录和相关审批请求
      const execution = this.toolService.getExecution(executionId);
      if (!execution) {
        sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
        return;
      }

      const approvals = this.toolService.getPendingApprovals();
      const approval = approvals.find(a => a.toolExecutionId === executionId);
      if (!approval) {
        sendError(res, 404, 'APPROVAL_NOT_FOUND', '审批请求不存在');
        return;
      }

      // 权限检查：需要相应的审批权限
      if (!this.hasApprovalPermission(req.user, approval)) {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足，无法审批此请求');
        return;
      }

      // 执行拒绝
      await this.toolService.rejectExecution(
        executionId,
        req.user.id,
        request.reason
      );

      sendSuccess(res, 200, {
        executionId,
        rejectedBy: req.user.id,
        rejectedAt: new Date(),
        reason: request.reason
      }, '工具执行已拒绝');
    } catch (error) {
      logger.error('拒绝工具执行失败:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('状态无效')) {
          sendError(res, 400, 'INVALID_EXECUTION_STATUS', '执行状态无效，无法拒绝');
          return;
        }
        if (error.message.includes('未找到')) {
          sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
          return;
        }
      }
      
      sendError(res, 500, 'REJECT_EXECUTION_ERROR', '拒绝工具执行失败');
    }
  }

  /**
   * 批量审批工具执行
   */
  async batchApproveExecutions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      if (req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '需要管理员权限');
        return;
      }

      const { executionIds, action, reason } = req.body;

      // 验证输入
      if (!Array.isArray(executionIds) || executionIds.length === 0) {
        sendError(res, 400, 'INVALID_EXECUTION_IDS', '执行 ID 列表无效');
        return;
      }

      if (!['approve', 'reject'].includes(action)) {
        sendError(res, 400, 'INVALID_ACTION', '操作类型无效');
        return;
      }

      if (action === 'reject' && (!reason || reason.trim().length === 0)) {
        sendError(res, 400, 'MISSING_REJECTION_REASON', '批量拒绝必须提供原因');
        return;
      }

      const results = {
        successful: [] as string[],
        failed: [] as { executionId: string; error: string }[]
      };

      // 并行处理所有执行
      await Promise.allSettled(
        executionIds.map(async (executionId: string) => {
          try {
            if (action === 'approve') {
              await this.toolService.approveExecution(executionId, req.user!.id, reason);
            } else {
              await this.toolService.rejectExecution(executionId, req.user!.id, reason);
            }
            results.successful.push(executionId);
          } catch (error) {
            results.failed.push({
              executionId,
              error: error instanceof Error ? error.message : '未知错误'
            });
          }
        })
      );

      sendSuccess(res, 200, {
        action,
        results,
        summary: {
          total: executionIds.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      }, `批量${action === 'approve' ? '批准' : '拒绝'}完成`);
    } catch (error) {
      logger.error('批量审批失败:', error);
      sendError(res, 500, 'BATCH_APPROVAL_ERROR', '批量审批失败');
    }
  }

  /**
   * 获取审批统计信息
   */
  async getApprovalStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const userId = req.user.role === 'admin' ? undefined : req.user.id;
      const approvals = this.toolService.getPendingApprovals(userId);

      // 按风险级别统计
      const byRiskLevel = approvals.reduce((acc, approval) => {
        acc[approval.riskLevel] = (acc[approval.riskLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 按工具类型统计
      const toolExecutions = approvals.map(approval => 
        this.toolService.getExecution(approval.toolExecutionId)
      ).filter(Boolean);

      const byToolCategory = toolExecutions.reduce((acc, execution) => {
        if (execution) {
          const tool = this.toolService.getTool(execution.toolId);
          if (tool) {
            acc[tool.category] = (acc[tool.category] || 0) + 1;
          }
        }
        return acc;
      }, {} as Record<string, number>);

      // 计算平均等待时间
      const now = Date.now();
      const waitTimes = approvals.map(approval => 
        now - approval.requestedAt.getTime()
      );
      const averageWaitTime = waitTimes.length > 0 
        ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
        : 0;

      sendSuccess(res, 200, {
        totalPending: approvals.length,
        byRiskLevel,
        byToolCategory,
        averageWaitTimeMs: averageWaitTime,
        oldestRequest: approvals.length > 0 
          ? Math.min(...waitTimes)
          : 0
      }, '获取审批统计信息成功');
    } catch (error) {
      logger.error('获取审批统计信息失败:', error);
      sendError(res, 500, 'GET_APPROVAL_STATS_ERROR', '获取审批统计信息失败');
    }
  }

  // 私有方法

  /**
   * 检查用户是否有审批权限
   */
  private hasApprovalPermission(user: any, approval: any): boolean {
    // 管理员可以审批所有请求
    if (user.role === 'admin') {
      return true;
    }

    // 用户审批：只能审批自己的请求
    if (approval.approvers.includes('user')) {
      return approval.requestedBy === user.id;
    }

    // 管理员审批：需要管理员权限
    if (approval.approvers.includes('admin')) {
      return user.role === 'admin';
    }

    return false;
  }
}

export default ApprovalController;