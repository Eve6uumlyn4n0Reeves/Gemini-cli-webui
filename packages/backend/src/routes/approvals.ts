import { Router } from 'express';
import { ApprovalController } from '../controllers/ApprovalController.js';
import { 
  authenticateToken, 
  requireUser,
  requireAdmin,
  userRateLimit,
  checkTokenExpiration 
} from '../middleware/auth.js';

/**
 * 创建审批路由
 * 需要传入 ApprovalController 实例
 */
export const createApprovalRoutes = (approvalController: ApprovalController): Router => {
  const router = Router();

  // 应用认证中间件到所有路由
  router.use(authenticateToken);
  router.use(checkTokenExpiration);
  router.use(requireUser); // 需要至少是普通用户权限

  /**
   * 审批管理路由
   */
  
  // 获取待审批的工具执行列表
  router.get('/pending', 
    approvalController.getPendingApprovals.bind(approvalController)
  );

  // 获取特定审批请求详情
  router.get('/:approvalId', 
    approvalController.getApprovalRequest.bind(approvalController)
  );

  /**
   * 审批操作路由
   */

  // 批准工具执行
  router.post('/executions/:executionId/approve', 
    userRateLimit(100), // 限制审批操作频率
    approvalController.approveExecution.bind(approvalController)
  );

  // 拒绝工具执行
  router.post('/executions/:executionId/reject', 
    userRateLimit(100), // 限制审批操作频率
    approvalController.rejectExecution.bind(approvalController)
  );

  /**
   * 批量操作路由（管理员专用）
   */

  // 批量审批工具执行
  router.post('/batch', 
    requireAdmin,
    userRateLimit(10), // 批量操作限制更严格
    approvalController.batchApproveExecutions.bind(approvalController)
  );

  /**
   * 统计和监控路由
   */

  // 获取审批统计信息
  router.get('/stats', 
    approvalController.getApprovalStats.bind(approvalController)
  );

  return router;
};

export default createApprovalRoutes;