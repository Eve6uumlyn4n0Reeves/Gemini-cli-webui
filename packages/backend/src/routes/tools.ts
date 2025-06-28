import { Router } from 'express';
import { ToolController } from '../controllers/ToolController.js';
import { 
  authenticateToken, 
  requireUser,
  requireAdmin,
  userRateLimit,
  checkTokenExpiration 
} from '../middleware/auth.js';

/**
 * 创建工具路由
 * 需要传入 ToolController 实例
 */
export const createToolRoutes = (toolController: ToolController): Router => {
  const router = Router();

  // 应用认证中间件到所有路由
  router.use(authenticateToken);
  router.use(checkTokenExpiration);
  router.use(requireUser); // 需要至少是普通用户权限

  /**
   * 工具管理路由
   */
  
  // 获取工具列表
  router.get('/', 
    toolController.getTools.bind(toolController)
  );

  // 获取工具注册表
  router.get('/registry', 
    toolController.getToolRegistry.bind(toolController)
  );

  // 获取特定工具详情
  router.get('/:toolId', 
    toolController.getTool.bind(toolController)
  );

  // 注册新工具（管理员专用）
  router.post('/', 
    requireAdmin,
    userRateLimit(10), // 限制工具注册频率
    toolController.registerTool.bind(toolController)
  );

  /**
   * 工具执行路由
   */

  // 执行工具（需要审批）
  router.post('/:toolId/execute', 
    userRateLimit(60), // 限制每分钟60次工具执行
    toolController.executeTool.bind(toolController)
  );

  // 直接执行工具（跳过审批，管理员专用）
  router.post('/:toolId/execute-direct', 
    requireAdmin,
    userRateLimit(30), // 管理员直接执行限制更严格
    toolController.executeToolDirectly.bind(toolController)
  );

  /**
   * 执行历史和状态路由
   */

  // 获取工具执行历史
  router.get('/executions/history', 
    toolController.getExecutionHistory.bind(toolController)
  );

  // 获取活动执行列表
  router.get('/executions/active', 
    toolController.getActiveExecutions.bind(toolController)
  );

  // 获取特定执行记录
  router.get('/executions/:executionId', 
    toolController.getExecution.bind(toolController)
  );

  // 取消工具执行
  router.post('/executions/:executionId/cancel', 
    userRateLimit(20),
    toolController.cancelExecution.bind(toolController)
  );

  /**
   * MCP 服务器管理路由
   */

  // 获取 MCP 服务器列表
  router.get('/mcp/servers', 
    toolController.getMCPServers.bind(toolController)
  );

  /**
   * 统计和监控路由
   */

  // 获取工具统计信息
  router.get('/stats', 
    toolController.getToolStats.bind(toolController)
  );

  /**
   * 管理员路由
   */

  // 清理过期记录（管理员专用）
  router.post('/admin/cleanup', 
    requireAdmin,
    toolController.cleanupExpiredRecords.bind(toolController)
  );

  return router;
};

export default createToolRoutes;