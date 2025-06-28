import { Request, Response } from 'express';
import { 
  executeToolRequestSchema,
  approveToolRequestSchema,
  toolCategorySchema,
  toolSchema,
  objectIdSchema
} from '@gemini-cli-webui/shared';
import { ToolService } from '../services/ToolService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parsePaginationParams } from '../utils/index.js';
import { logger } from '../utils/logger.js';
import type { ToolExecutionContext } from '@gemini-cli-webui/cli-integration';

/**
 * 工具控制器
 * 处理工具相关的 API 请求
 */
export class ToolController {
  constructor(private toolService: ToolService) {}

  /**
   * 获取工具列表
   */
  async getTools(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { category, search, enabled } = req.query;
      
      // 验证类别参数
      if (category && !toolCategorySchema.safeParse(category).success) {
        sendError(res, 400, 'INVALID_CATEGORY', '工具类别无效');
        return;
      }

      let tools = this.toolService.getTools(category as any);

      // 搜索过滤
      if (search && typeof search === 'string') {
        tools = this.toolService.searchTools(search);
      }

      // 启用状态过滤
      if (enabled !== undefined) {
        const isEnabled = enabled === 'true';
        tools = tools.filter(tool => tool.isEnabled === isEnabled);
      }

      sendSuccess(res, 200, {
        tools,
        total: tools.length,
        categories: ['filesystem', 'network', 'system', 'development', 'database', 'mcp', 'custom']
      }, '获取工具列表成功');
    } catch (error) {
      logger.error('获取工具列表失败:', error);
      sendError(res, 500, 'GET_TOOLS_ERROR', '获取工具列表失败');
    }
  }

  /**
   * 获取特定工具详情
   */
  async getTool(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { toolId } = req.params;

      // 验证工具 ID
      if (!objectIdSchema.safeParse(toolId).success) {
        sendError(res, 400, 'INVALID_TOOL_ID', '工具 ID 无效');
        return;
      }

      const tool = this.toolService.getTool(toolId);

      if (!tool) {
        sendError(res, 404, 'TOOL_NOT_FOUND', '工具不存在');
        return;
      }

      sendSuccess(res, 200, tool, '获取工具详情成功');
    } catch (error) {
      logger.error('获取工具详情失败:', error);
      sendError(res, 500, 'GET_TOOL_ERROR', '获取工具详情失败');
    }
  }

  /**
   * 执行工具
   */
  async executeTool(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { toolId } = req.params;

      // 验证请求数据
      const validationResult = executeToolRequestSchema.safeParse({
        ...req.body,
        toolId
      });

      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request = validationResult.data;

      // 获取工具信息
      const tool = this.toolService.getTool(request.toolId);
      if (!tool) {
        sendError(res, 404, 'TOOL_NOT_FOUND', '工具不存在');
        return;
      }

      if (!tool.isEnabled) {
        sendError(res, 403, 'TOOL_DISABLED', '工具已禁用');
        return;
      }

      // 构建执行上下文
      const context: ToolExecutionContext = {
        userId: req.user.id,
        conversationId: request.conversationId,
        messageId: request.messageId,
        sessionId: req.session?.id || 'default',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date().toISOString()
        }
      };

      // 执行工具
      const execution = await this.toolService.executeTool(
        tool.name,
        request.input,
        context
      );

      sendSuccess(res, 202, execution, '工具执行请求已提交');
    } catch (error) {
      logger.error('执行工具失败:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('权限不足')) {
          sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
          return;
        }
        if (error.message.includes('参数无效')) {
          sendError(res, 400, 'INVALID_PARAMETERS', '工具参数无效');
          return;
        }
      }
      
      sendError(res, 500, 'EXECUTE_TOOL_ERROR', '执行工具失败');
    }
  }

  /**
   * 直接执行工具（跳过审批，需要管理员权限）
   */
  async executeToolDirectly(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      if (req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '需要管理员权限');
        return;
      }

      const { toolId } = req.params;

      // 验证请求数据
      const validationResult = executeToolRequestSchema.safeParse({
        ...req.body,
        toolId
      });

      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request = validationResult.data;

      // 获取工具信息
      const tool = this.toolService.getTool(request.toolId);
      if (!tool) {
        sendError(res, 404, 'TOOL_NOT_FOUND', '工具不存在');
        return;
      }

      // 构建执行上下文
      const context: ToolExecutionContext = {
        userId: req.user.id,
        conversationId: request.conversationId,
        messageId: request.messageId,
        sessionId: req.session?.id || 'default',
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date().toISOString(),
          directExecution: true
        }
      };

      // 直接执行工具
      const result = await this.toolService.executeToolDirectly(
        tool.name,
        request.input,
        context
      );

      sendSuccess(res, 200, result, '工具执行完成');
    } catch (error) {
      logger.error('直接执行工具失败:', error);
      sendError(res, 500, 'EXECUTE_TOOL_DIRECT_ERROR', '直接执行工具失败');
    }
  }

  /**
   * 获取工具执行历史
   */
  async getExecutionHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { page, limit } = parsePaginationParams(req.query);
      const { conversationId } = req.query;

      // 验证会话 ID
      if (conversationId && !objectIdSchema.safeParse(conversationId).success) {
        sendError(res, 400, 'INVALID_CONVERSATION_ID', '会话 ID 无效');
        return;
      }

      const result = this.toolService.getExecutionHistory(
        req.user.id,
        conversationId as string,
        limit,
        (page - 1) * limit
      );

      sendSuccess(res, 200, {
        executions: result.executions,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasMore: result.hasMore
        }
      }, '获取执行历史成功');
    } catch (error) {
      logger.error('获取执行历史失败:', error);
      sendError(res, 500, 'GET_EXECUTION_HISTORY_ERROR', '获取执行历史失败');
    }
  }

  /**
   * 获取特定执行记录
   */
  async getExecution(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { executionId } = req.params;

      // 验证执行 ID
      if (!objectIdSchema.safeParse(executionId).success) {
        sendError(res, 400, 'INVALID_EXECUTION_ID', '执行 ID 无效');
        return;
      }

      const execution = this.toolService.getExecution(executionId);

      if (!execution) {
        sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
        return;
      }

      // 权限检查：只能查看自己的执行记录，除非是管理员
      if (execution.userId !== req.user.id && req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
        return;
      }

      sendSuccess(res, 200, execution, '获取执行记录成功');
    } catch (error) {
      logger.error('获取执行记录失败:', error);
      sendError(res, 500, 'GET_EXECUTION_ERROR', '获取执行记录失败');
    }
  }

  /**
   * 获取活动执行列表
   */
  async getActiveExecutions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      // 管理员可以查看所有活动执行，普通用户只能查看自己的
      const userId = req.user.role === 'admin' ? undefined : req.user.id;
      const executions = this.toolService.getActiveExecutions(userId);

      sendSuccess(res, 200, {
        executions,
        total: executions.length
      }, '获取活动执行列表成功');
    } catch (error) {
      logger.error('获取活动执行列表失败:', error);
      sendError(res, 500, 'GET_ACTIVE_EXECUTIONS_ERROR', '获取活动执行列表失败');
    }
  }

  /**
   * 取消工具执行
   */
  async cancelExecution(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { executionId } = req.params;
      const { reason = '用户取消' } = req.body;

      // 验证执行 ID
      if (!objectIdSchema.safeParse(executionId).success) {
        sendError(res, 400, 'INVALID_EXECUTION_ID', '执行 ID 无效');
        return;
      }

      // 获取执行记录进行权限检查
      const execution = this.toolService.getExecution(executionId);
      if (!execution) {
        sendError(res, 404, 'EXECUTION_NOT_FOUND', '执行记录不存在');
        return;
      }

      // 权限检查：只能取消自己的执行，除非是管理员
      if (execution.userId !== req.user.id && req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
        return;
      }

      await this.toolService.cancelExecution(executionId, reason);

      sendSuccess(res, 200, null, '执行已取消');
    } catch (error) {
      logger.error('取消执行失败:', error);
      
      if (error instanceof Error && error.message.includes('状态无效')) {
        sendError(res, 400, 'INVALID_EXECUTION_STATUS', '执行状态无效，无法取消');
        return;
      }
      
      sendError(res, 500, 'CANCEL_EXECUTION_ERROR', '取消执行失败');
    }
  }

  /**
   * 获取工具注册表
   */
  async getToolRegistry(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const registry = this.toolService.getToolRegistry();

      sendSuccess(res, 200, registry, '获取工具注册表成功');
    } catch (error) {
      logger.error('获取工具注册表失败:', error);
      sendError(res, 500, 'GET_TOOL_REGISTRY_ERROR', '获取工具注册表失败');
    }
  }

  /**
   * 注册新工具（管理员）
   */
  async registerTool(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      if (req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '需要管理员权限');
        return;
      }

      // 验证工具数据
      const validationResult = toolSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '工具数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const tool = validationResult.data;

      // 检查工具是否已存在
      const existingTool = this.toolService.getTool(tool.id);
      if (existingTool) {
        sendError(res, 409, 'TOOL_ALREADY_EXISTS', '工具已存在');
        return;
      }

      this.toolService.registerTool(tool);

      sendSuccess(res, 201, tool, '工具注册成功');
    } catch (error) {
      logger.error('注册工具失败:', error);
      sendError(res, 500, 'REGISTER_TOOL_ERROR', '注册工具失败');
    }
  }

  /**
   * 获取 MCP 服务器列表
   */
  async getMCPServers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const servers = this.toolService.getMCPServers();

      sendSuccess(res, 200, {
        servers,
        total: servers.length
      }, '获取 MCP 服务器列表成功');
    } catch (error) {
      logger.error('获取 MCP 服务器列表失败:', error);
      sendError(res, 500, 'GET_MCP_SERVERS_ERROR', '获取 MCP 服务器列表失败');
    }
  }

  /**
   * 获取工具统计信息
   */
  async getToolStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const stats = this.toolService.getToolStats();

      sendSuccess(res, 200, stats, '获取工具统计信息成功');
    } catch (error) {
      logger.error('获取工具统计信息失败:', error);
      sendError(res, 500, 'GET_TOOL_STATS_ERROR', '获取工具统计信息失败');
    }
  }

  /**
   * 清理过期记录（管理员）
   */
  async cleanupExpiredRecords(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      if (req.user.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '需要管理员权限');
        return;
      }

      this.toolService.cleanupExpiredRecords();

      sendSuccess(res, 200, null, '过期记录清理完成');
    } catch (error) {
      logger.error('清理过期记录失败:', error);
      sendError(res, 500, 'CLEANUP_ERROR', '清理过期记录失败');
    }
  }
}

export default ToolController;