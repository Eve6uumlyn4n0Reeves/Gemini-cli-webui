import { Request, Response } from 'express';
import { 
  CreateConversationRequest,
  CreateMessageRequest,
  createConversationRequestSchema,
  createMessageRequestSchema,
  updateConversationRequestSchema
} from '@gemini-cli-webui/shared';
import { ConversationService } from '../services/ConversationService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parsePaginationParams } from '../utils/index.js';
import logger from '../utils/logger.js';

/**
 * 聊天控制器
 * 处理聊天相关的 API 请求
 */
export class ChatController {
  constructor(private conversationService: ConversationService) {}

  /**
   * 创建新对话
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      // 验证请求数据
      const validationResult = createConversationRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request: CreateConversationRequest = validationResult.data;

      // 创建对话
      const conversation = await this.conversationService.createConversation(
        req.user.id,
        request
      );

      sendSuccess(res, 201, conversation, '对话创建成功');
    } catch (error) {
      logger.error('创建对话失败:', error);
      sendError(res, 500, 'CREATE_CONVERSATION_ERROR', '创建对话失败');
    }
  }

  /**
   * 获取用户的对话列表
   */
  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { page, limit } = parsePaginationParams(req.query);
      const includeInactive = req.query.includeInactive === 'true';

      const result = await this.conversationService.getUserConversations(
        req.user.id,
        { page, limit, includeInactive }
      );

      sendSuccess(res, 200, result, '获取对话列表成功');
    } catch (error) {
      logger.error('获取对话列表失败:', error);
      sendError(res, 500, 'GET_CONVERSATIONS_ERROR', '获取对话列表失败');
    }
  }

  /**
   * 获取指定对话详情
   */
  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;

      const conversation = await this.conversationService.getConversation(
        conversationId,
        req.user.id
      );

      if (!conversation) {
        sendError(res, 404, 'CONVERSATION_NOT_FOUND', '对话不存在');
        return;
      }

      sendSuccess(res, 200, conversation, '获取对话详情成功');
    } catch (error) {
      logger.error('获取对话详情失败:', error);
      sendError(res, 500, 'GET_CONVERSATION_ERROR', '获取对话详情失败');
    }
  }

  /**
   * 更新对话信息
   */
  async updateConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;

      // 验证请求数据
      const validationResult = updateConversationRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const updates = validationResult.data;

      const conversation = await this.conversationService.updateConversation(
        conversationId,
        req.user.id,
        updates
      );

      if (!conversation) {
        sendError(res, 404, 'CONVERSATION_NOT_FOUND', '对话不存在');
        return;
      }

      sendSuccess(res, 200, conversation, '对话更新成功');
    } catch (error) {
      logger.error('更新对话失败:', error);
      sendError(res, 500, 'UPDATE_CONVERSATION_ERROR', '更新对话失败');
    }
  }

  /**
   * 删除对话
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;

      const success = await this.conversationService.deleteConversation(
        conversationId,
        req.user.id
      );

      if (!success) {
        sendError(res, 404, 'CONVERSATION_NOT_FOUND', '对话不存在');
        return;
      }

      sendSuccess(res, 200, null, '对话删除成功');
    } catch (error) {
      logger.error('删除对话失败:', error);
      sendError(res, 500, 'DELETE_CONVERSATION_ERROR', '删除对话失败');
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;

      // 验证请求数据
      const validationResult = createMessageRequestSchema.safeParse({
        ...req.body,
        conversationId
      });
      
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request: CreateMessageRequest = validationResult.data;

      // 添加用户消息
      const userMessage = await this.conversationService.addMessage(
        conversationId,
        request,
        req.user.id
      );

      // 生成 AI 响应
      const aiMessage = await this.conversationService.generateAIResponse(
        conversationId,
        req.user.id
      );

      sendSuccess(res, 201, {
        userMessage,
        aiMessage,
      }, '消息发送成功');
    } catch (error) {
      logger.error('发送消息失败:', error);
      
      if (error instanceof Error) {
        if (error.message === '对话不存在') {
          sendError(res, 404, 'CONVERSATION_NOT_FOUND', '对话不存在');
          return;
        }
        if (error.message === '权限不足') {
          sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
          return;
        }
      }
      
      sendError(res, 500, 'SEND_MESSAGE_ERROR', '发送消息失败');
    }
  }

  /**
   * 流式发送消息（Server-Sent Events）
   */
  async sendMessageStream(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;

      // 验证请求数据
      const validationResult = createMessageRequestSchema.safeParse({
        ...req.body,
        conversationId
      });
      
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const request: CreateMessageRequest = validationResult.data;

      // 设置 SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 发送连接确认
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      try {
        // 添加用户消息
        const userMessage = await this.conversationService.addMessage(
          conversationId,
          request,
          req.user.id
        );

        // 发送用户消息确认
        res.write(`data: ${JSON.stringify({ 
          type: 'user_message', 
          data: userMessage 
        })}\n\n`);

        // 生成 AI 响应（流式）
        const aiMessage = await this.conversationService.generateAIResponse(
          conversationId,
          req.user.id,
          (chunk: string) => {
            // 发送流式内容
            res.write(`data: ${JSON.stringify({ 
              type: 'ai_chunk', 
              data: { chunk } 
            })}\n\n`);
          }
        );

        // 发送完成消息
        res.write(`data: ${JSON.stringify({ 
          type: 'ai_complete', 
          data: aiMessage 
        })}\n\n`);

        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      } catch (streamError) {
        logger.error('流式消息处理失败:', streamError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: '消息处理失败' 
        })}\n\n`);
        res.end();
      }
    } catch (error) {
      logger.error('流式发送消息失败:', error);
      sendError(res, 500, 'SEND_MESSAGE_STREAM_ERROR', '流式发送消息失败');
    }
  }

  /**
   * 获取对话消息
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { conversationId } = req.params;
      const { page, limit } = parsePaginationParams(req.query);
      const { before, after } = req.query;

      const result = await this.conversationService.getConversationMessages(
        conversationId,
        req.user.id,
        { 
          page, 
          limit, 
          before: before as string, 
          after: after as string 
        }
      );

      sendSuccess(res, 200, result, '获取消息列表成功');
    } catch (error) {
      logger.error('获取消息列表失败:', error);
      
      if (error instanceof Error && error.message === '对话不存在或权限不足') {
        sendError(res, 404, 'CONVERSATION_NOT_FOUND', '对话不存在或权限不足');
        return;
      }
      
      sendError(res, 500, 'GET_MESSAGES_ERROR', '获取消息列表失败');
    }
  }

  /**
   * 搜索消息
   */
  async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { query } = req.query;
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!query || typeof query !== 'string') {
        sendError(res, 400, 'MISSING_SEARCH_QUERY', '缺少搜索关键词');
        return;
      }

      const messages = await this.conversationService.searchMessages(
        req.user.id,
        query,
        { conversationId, limit }
      );

      sendSuccess(res, 200, {
        messages,
        query,
        total: messages.length,
      }, '搜索消息成功');
    } catch (error) {
      logger.error('搜索消息失败:', error);
      sendError(res, 500, 'SEARCH_MESSAGES_ERROR', '搜索消息失败');
    }
  }

  /**
   * 获取聊天统计信息
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const stats = this.conversationService.getStats(req.user.id);

      sendSuccess(res, 200, stats, '获取统计信息成功');
    } catch (error) {
      logger.error('获取统计信息失败:', error);
      sendError(res, 500, 'GET_STATS_ERROR', '获取统计信息失败');
    }
  }

  /**
   * 清理过期对话（管理员）
   */
  async cleanupConversations(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'admin') {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
        return;
      }

      const daysInactive = parseInt(req.query.days as string) || 30;
      const cleanedCount = await this.conversationService.cleanupInactiveConversations(daysInactive);

      sendSuccess(res, 200, {
        cleanedCount,
        daysInactive,
      }, '对话清理完成');
    } catch (error) {
      logger.error('清理对话失败:', error);
      sendError(res, 500, 'CLEANUP_ERROR', '清理对话失败');
    }
  }
}