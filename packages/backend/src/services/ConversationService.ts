import { 
  Conversation, 
  Message, 
  User,
  CreateConversationRequest,
  CreateMessageRequest,
  MessageRole,
  MessageStatus,
  MessageType,
  ConversationSettings 
} from '@gemini-cli-webui/shared';
import { generateId } from '../utils/index.js';
import { GeminiService } from './GeminiService.js';
import logger from '../utils/logger.js';

/**
 * 对话管理服务
 * 处理对话的创建、管理和消息处理
 */
export class ConversationService {
  private conversations: Map<string, Conversation> = new Map();
  private userConversations: Map<string, Set<string>> = new Map(); // userId -> conversationIds
  private messages: Map<string, Message> = new Map();
  private conversationMessages: Map<string, string[]> = new Map(); // conversationId -> messageIds

  constructor(private geminiService: GeminiService) {}

  /**
   * 创建新对话
   */
  async createConversation(
    userId: string, 
    request: CreateConversationRequest
  ): Promise<Conversation> {
    try {
      const conversationId = generateId();
      const now = new Date();

      // 默认对话设置
      const defaultSettings: ConversationSettings = {
        model: 'gemini-pro',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '你是一个有用的AI助手。请用中文回答问题。',
        tools: [],
        mcpServers: [],
      };

      const conversation: Conversation = {
        id: conversationId,
        title: request.title,
        userId,
        messages: [],
        createdAt: now,
        updatedAt: now,
        isActive: true,
        metadata: request.metadata || {},
        settings: { ...defaultSettings, ...request.settings },
      };

      // 存储对话
      this.conversations.set(conversationId, conversation);
      
      // 更新用户对话索引
      if (!this.userConversations.has(userId)) {
        this.userConversations.set(userId, new Set());
      }
      this.userConversations.get(userId)!.add(conversationId);

      // 初始化对话消息列表
      this.conversationMessages.set(conversationId, []);

      logger.info('对话已创建', { 
        conversationId, 
        userId, 
        title: request.title 
      });

      return conversation;
    } catch (error) {
      logger.error('创建对话失败:', error);
      throw new Error('创建对话失败');
    }
  }

  /**
   * 获取对话信息
   */
  async getConversation(conversationId: string, userId?: string): Promise<Conversation | null> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      return null;
    }

    // 检查用户权限
    if (userId && conversation.userId !== userId) {
      return null;
    }

    // 加载对话中的消息
    const messageIds = this.conversationMessages.get(conversationId) || [];
    const messages = messageIds
      .map(id => this.messages.get(id))
      .filter(Boolean) as Message[];

    return {
      ...conversation,
      messages: messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    };
  }

  /**
   * 获取用户的所有对话
   */
  async getUserConversations(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<{
    conversations: Conversation[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, includeInactive = false } = options;
    
    const userConvIds = this.userConversations.get(userId) || new Set();
    
    let conversations = Array.from(userConvIds)
      .map(id => this.conversations.get(id))
      .filter(Boolean) as Conversation[];

    // 过滤非活跃对话
    if (!includeInactive) {
      conversations = conversations.filter(conv => conv.isActive);
    }

    // 按更新时间排序
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // 分页
    const total = conversations.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedConversations = conversations.slice(offset, offset + limit);

    // 加载每个对话的最新消息（用于预览）
    const conversationsWithMessages = await Promise.all(
      paginatedConversations.map(async (conv) => {
        const messageIds = this.conversationMessages.get(conv.id) || [];
        const lastMessageId = messageIds[messageIds.length - 1];
        const lastMessage = lastMessageId ? this.messages.get(lastMessageId) : null;
        
        return {
          ...conv,
          messages: lastMessage ? [lastMessage] : [],
        };
      })
    );

    return {
      conversations: conversationsWithMessages,
      total,
      page,
      totalPages,
    };
  }

  /**
   * 更新对话信息
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    updates: Partial<Pick<Conversation, 'title' | 'settings' | 'metadata'>>
  ): Promise<Conversation | null> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    // 更新字段
    if (updates.title !== undefined) {
      conversation.title = updates.title;
    }
    if (updates.settings !== undefined) {
      conversation.settings = { ...conversation.settings, ...updates.settings };
    }
    if (updates.metadata !== undefined) {
      conversation.metadata = { ...conversation.metadata, ...updates.metadata };
    }

    conversation.updatedAt = new Date();

    logger.info('对话已更新', { 
      conversationId, 
      userId, 
      updates: Object.keys(updates) 
    });

    return await this.getConversation(conversationId, userId);
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation || conversation.userId !== userId) {
      return false;
    }

    // 删除对话中的所有消息
    const messageIds = this.conversationMessages.get(conversationId) || [];
    messageIds.forEach(messageId => {
      this.messages.delete(messageId);
    });

    // 删除对话
    this.conversations.delete(conversationId);
    this.conversationMessages.delete(conversationId);

    // 从用户对话索引中移除
    const userConvs = this.userConversations.get(userId);
    if (userConvs) {
      userConvs.delete(conversationId);
      if (userConvs.size === 0) {
        this.userConversations.delete(userId);
      }
    }

    logger.info('对话已删除', { conversationId, userId });

    return true;
  }

  /**
   * 添加消息到对话
   */
  async addMessage(
    conversationId: string,
    request: CreateMessageRequest,
    userId: string
  ): Promise<Message> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error('对话不存在');
    }

    if (conversation.userId !== userId) {
      throw new Error('权限不足');
    }

    const messageId = generateId();
    const now = new Date();

    const message: Message = {
      id: messageId,
      conversationId,
      role: MessageRole.USER,
      content: request.content,
      status: MessageStatus.SENT,
      timestamp: now,
      userId,
      parentMessageId: request.parentMessageId,
      metadata: request.metadata || {},
    };

    // 存储消息
    this.messages.set(messageId, message);
    
    // 添加到对话消息列表
    const messageIds = this.conversationMessages.get(conversationId) || [];
    messageIds.push(messageId);
    this.conversationMessages.set(conversationId, messageIds);

    // 更新对话时间戳
    conversation.updatedAt = now;

    logger.info('消息已添加', { 
      messageId, 
      conversationId, 
      userId,
      contentType: request.content[0]?.type 
    });

    return message;
  }

  /**
   * 处理 AI 响应生成
   */
  async generateAIResponse(
    conversationId: string,
    userId: string,
    onProgress?: (chunk: string) => void
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId, userId);
    
    if (!conversation) {
      throw new Error('对话不存在');
    }

    if (conversation.userId !== userId) {
      throw new Error('权限不足');
    }

    try {
      // 创建 AI 响应消息
      const responseId = generateId();
      const now = new Date();

      const aiMessage: Message = {
        id: responseId,
        conversationId,
        role: MessageRole.ASSISTANT,
        content: [{ type: MessageType.TEXT, text: '' }],
        status: MessageStatus.SENDING,
        timestamp: now,
        metadata: {},
      };

      // 存储初始消息
      this.messages.set(responseId, aiMessage);
      const messageIds = this.conversationMessages.get(conversationId) || [];
      messageIds.push(responseId);
      this.conversationMessages.set(conversationId, messageIds);

      // 准备消息历史
      const messageHistory = conversation.messages.map(msg => ({
        role: msg.role === MessageRole.USER ? 'user' : 'assistant',
        content: msg.content.map(c => c.text || '').join('\n'),
      }));

      // 获取最新用户消息
      const lastUserMessage = conversation.messages
        .filter(msg => msg.role === MessageRole.USER)
        .pop();

      if (!lastUserMessage) {
        throw new Error('没有找到用户消息');
      }

      const userInput = lastUserMessage.content
        .map(c => c.text || '')
        .join('\n');

      // 调用 Gemini 服务生成响应
      let fullResponse = '';
      
      // 这里应该调用 GeminiService 的流式响应方法
      // 由于当前实现，我们模拟一个响应
      const response = await this.simulateAIResponse(userInput, messageHistory);
      
      if (onProgress) {
        // 模拟流式输出
        for (let i = 0; i < response.length; i += 10) {
          const chunk = response.slice(i, i + 10);
          fullResponse += chunk;
          
          // 更新消息内容
          aiMessage.content = [{ type: MessageType.TEXT, text: fullResponse }];
          aiMessage.status = MessageStatus.SENDING;
          this.messages.set(responseId, { ...aiMessage });
          
          onProgress(chunk);
          
          // 模拟延迟
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else {
        fullResponse = response;
      }

      // 完成响应
      aiMessage.content = [{ type: MessageType.TEXT, text: fullResponse }];
      aiMessage.status = MessageStatus.SENT;
      this.messages.set(responseId, { ...aiMessage });

      // 更新对话时间戳
      conversation.updatedAt = new Date();
      this.conversations.set(conversationId, conversation);

      logger.info('AI 响应已生成', { 
        messageId: responseId, 
        conversationId, 
        responseLength: fullResponse.length 
      });

      return aiMessage;
    } catch (error) {
      logger.error('生成 AI 响应失败:', error);
      throw new Error('生成 AI 响应失败');
    }
  }

  /**
   * 模拟 AI 响应（临时实现）
   */
  private async simulateAIResponse(
    userInput: string, 
    messageHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    // 这是一个临时的模拟实现
    // 在实际应用中，这里应该调用真实的 Gemini API
    
    const responses = [
      '我理解您的问题。让我来帮助您解决这个问题。',
      '这是一个很好的问题。根据您提供的信息，我建议...',
      '感谢您的提问。基于我的分析，我认为...',
      '我已经处理了您的请求。以下是详细的回答：',
      '很高兴为您提供帮助。关于您的问题，我的建议是...',
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return `${randomResponse}\n\n针对您的输入"${userInput}"，我会尽力提供准确和有用的回答。`;
  }

  /**
   * 获取对话中的消息
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      before?: string; // messageId
      after?: string; // messageId
    } = {}
  ): Promise<{
    messages: Message[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation || conversation.userId !== userId) {
      throw new Error('对话不存在或权限不足');
    }

    const { page = 1, limit = 50, before, after } = options;
    
    const messageIds = this.conversationMessages.get(conversationId) || [];
    let messages = messageIds
      .map(id => this.messages.get(id))
      .filter(Boolean) as Message[];

    // 按时间排序
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 应用 before/after 过滤
    if (before) {
      const beforeIndex = messages.findIndex(msg => msg.id === before);
      if (beforeIndex > 0) {
        messages = messages.slice(0, beforeIndex);
      }
    }

    if (after) {
      const afterIndex = messages.findIndex(msg => msg.id === after);
      if (afterIndex >= 0) {
        messages = messages.slice(afterIndex + 1);
      }
    }

    // 分页
    const total = messages.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedMessages = messages.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      messages: paginatedMessages,
      total,
      page,
      totalPages,
      hasMore,
    };
  }

  /**
   * 搜索消息
   */
  async searchMessages(
    userId: string,
    query: string,
    options: {
      conversationId?: string;
      limit?: number;
    } = {}
  ): Promise<Message[]> {
    const { conversationId, limit = 100 } = options;
    
    const searchResults: Message[] = [];
    const searchTerm = query.toLowerCase();

    // 确定搜索范围
    const conversationIds = conversationId 
      ? [conversationId]
      : Array.from(this.userConversations.get(userId) || []);

    for (const convId of conversationIds) {
      const conversation = this.conversations.get(convId);
      if (!conversation || conversation.userId !== userId) {
        continue;
      }

      const messageIds = this.conversationMessages.get(convId) || [];
      
      for (const messageId of messageIds) {
        const message = this.messages.get(messageId);
        if (!message) continue;

        // 搜索消息内容
        const messageText = message.content
          .map(c => c.text || '')
          .join(' ')
          .toLowerCase();

        if (messageText.includes(searchTerm)) {
          searchResults.push(message);
        }

        if (searchResults.length >= limit) {
          break;
        }
      }

      if (searchResults.length >= limit) {
        break;
      }
    }

    // 按时间倒序排列
    return searchResults
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 获取统计信息
   */
  getStats(userId?: string) {
    if (userId) {
      const userConvs = this.userConversations.get(userId) || new Set();
      const conversations = Array.from(userConvs)
        .map(id => this.conversations.get(id))
        .filter(Boolean) as Conversation[];

      const totalMessages = conversations.reduce((sum, conv) => {
        const messageIds = this.conversationMessages.get(conv.id) || [];
        return sum + messageIds.length;
      }, 0);

      return {
        totalConversations: conversations.length,
        activeConversations: conversations.filter(c => c.isActive).length,
        totalMessages,
        averageMessagesPerConversation: conversations.length > 0 
          ? Math.round(totalMessages / conversations.length) 
          : 0,
      };
    }

    // 全局统计
    const allConversations = Array.from(this.conversations.values());
    const totalMessages = this.messages.size;

    return {
      totalConversations: allConversations.length,
      activeConversations: allConversations.filter(c => c.isActive).length,
      totalMessages,
      uniqueUsers: this.userConversations.size,
      averageConversationsPerUser: this.userConversations.size > 0
        ? Math.round(allConversations.length / this.userConversations.size)
        : 0,
    };
  }

  /**
   * 清理过期对话
   */
  async cleanupInactiveConversations(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    let cleanedCount = 0;
    
    for (const [convId, conversation] of this.conversations.entries()) {
      if (!conversation.isActive && conversation.updatedAt < cutoffDate) {
        await this.deleteConversation(convId, conversation.userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('过期对话清理完成', { cleanedCount });
    }

    return cleanedCount;
  }
}

// 导出单例实例（需要 GeminiService 实例）
export const createConversationService = (geminiService: GeminiService) => {
  return new ConversationService(geminiService);
};