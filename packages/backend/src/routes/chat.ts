import { Router } from 'express';
import { ChatController } from '../controllers/ChatController.js';
import { 
  authenticateToken, 
  requireUser,
  requireAdmin,
  userRateLimit,
  checkTokenExpiration 
} from '../middleware/auth.js';

/**
 * 创建聊天路由
 * 需要传入 ChatController 实例
 */
export const createChatRoutes = (chatController: ChatController): Router => {
  const router = Router();

  // 应用认证中间件到所有路由
  router.use(authenticateToken);
  router.use(checkTokenExpiration);
  router.use(requireUser); // 需要至少是普通用户权限

  /**
   * 对话管理路由
   */
  
  // 创建新对话
  router.post('/conversations', 
    userRateLimit(10), // 限制每分钟10次对话创建
    chatController.createConversation.bind(chatController)
  );

  // 获取用户的对话列表
  router.get('/conversations', 
    chatController.getConversations.bind(chatController)
  );

  // 获取指定对话详情
  router.get('/conversations/:conversationId', 
    chatController.getConversation.bind(chatController)
  );

  // 更新对话信息
  router.put('/conversations/:conversationId', 
    chatController.updateConversation.bind(chatController)
  );

  // 删除对话
  router.delete('/conversations/:conversationId', 
    chatController.deleteConversation.bind(chatController)
  );

  /**
   * 消息处理路由
   */

  // 发送消息（同步响应）
  router.post('/conversations/:conversationId/messages', 
    userRateLimit(30), // 限制每分钟30条消息
    chatController.sendMessage.bind(chatController)
  );

  // 发送消息（流式响应）
  router.post('/conversations/:conversationId/messages/stream', 
    userRateLimit(20), // 流式响应限制更严格
    chatController.sendMessageStream.bind(chatController)
  );

  // 获取对话中的消息
  router.get('/conversations/:conversationId/messages', 
    chatController.getMessages.bind(chatController)
  );

  /**
   * 搜索和统计路由
   */

  // 搜索所有消息
  router.get('/search', 
    userRateLimit(20),
    chatController.searchMessages.bind(chatController)
  );

  // 在指定对话中搜索消息
  router.get('/conversations/:conversationId/search', 
    userRateLimit(20),
    chatController.searchMessages.bind(chatController)
  );

  // 获取用户聊天统计信息
  router.get('/stats', 
    chatController.getStats.bind(chatController)
  );

  /**
   * 管理员路由
   */

  // 清理过期对话（管理员专用）
  router.post('/admin/cleanup', 
    requireAdmin,
    chatController.cleanupConversations.bind(chatController)
  );

  return router;
};

export default createChatRoutes;