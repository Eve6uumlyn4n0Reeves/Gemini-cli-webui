import { Server as SocketIOServer, Socket } from 'socket.io';
import { ConversationService } from './ConversationService.js';
import { 
  CreateMessageRequest,
  createMessageRequestSchema,
  WebSocketEvent,
  MessageRole 
} from '@gemini-cli-webui/shared';
import logger from '../utils/logger.js';

/**
 * 聊天 WebSocket 服务
 * 处理实时聊天相关的 WebSocket 事件
 */
export class ChatWebSocketService {
  constructor(
    private io: SocketIOServer,
    private conversationService: ConversationService
  ) {
    this.setupEventHandlers();
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * 处理新的 WebSocket 连接
   */
  private handleConnection(socket: Socket): void {
    const user = (socket as any).user;
    
    if (!user) {
      logger.warn('WebSocket 连接缺少用户信息', { socketId: socket.id });
      return;
    }

    logger.info('聊天 WebSocket 连接建立', { 
      socketId: socket.id,
      userId: user.id,
      username: user.username 
    });

    // 加入用户专用房间
    socket.join(`user:${user.id}`);

    // 设置聊天相关事件处理器
    this.setupChatEventHandlers(socket, user);
  }

  /**
   * 设置聊天相关的事件处理器
   */
  private setupChatEventHandlers(socket: Socket, user: any): void {
    
    // 加入对话房间
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        
        // 验证用户是否有权限访问对话
        const conversation = await this.conversationService.getConversation(
          conversationId, 
          user.id
        );
        
        if (!conversation) {
          socket.emit('error', {
            type: 'join_conversation_error',
            message: '对话不存在或权限不足',
            conversationId,
          });
          return;
        }

        // 加入对话房间
        socket.join(`conversation:${conversationId}`);
        
        // 发送确认
        socket.emit('conversation_joined', {
          conversationId,
          conversation,
          timestamp: new Date().toISOString(),
        });

        logger.info('用户加入对话房间', {
          userId: user.id,
          conversationId,
          socketId: socket.id,
        });
      } catch (error) {
        logger.error('加入对话房间失败:', error);
        socket.emit('error', {
          type: 'join_conversation_error',
          message: '加入对话失败',
          conversationId: data.conversationId,
        });
      }
    });

    // 离开对话房间
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
      
      socket.emit('conversation_left', {
        conversationId,
        timestamp: new Date().toISOString(),
      });

      logger.info('用户离开对话房间', {
        userId: user.id,
        conversationId,
        socketId: socket.id,
      });
    });

    // 实时发送消息
    socket.on('send_message', async (data: CreateMessageRequest) => {
      try {
        // 验证消息数据
        const validationResult = createMessageRequestSchema.safeParse(data);
        if (!validationResult.success) {
          socket.emit('message_error', {
            type: 'validation_error',
            errors: validationResult.error.errors,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const request = validationResult.data;
        const { conversationId } = request;

        // 发送正在输入状态
        socket.to(`conversation:${conversationId}`).emit('typing_start', {
          conversationId,
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString(),
        });

        // 添加用户消息
        const userMessage = await this.conversationService.addMessage(
          conversationId,
          request,
          user.id
        );

        // 广播用户消息到对话房间
        this.io.to(`conversation:${conversationId}`).emit('message_received', {
          type: 'user_message',
          message: userMessage,
          timestamp: new Date().toISOString(),
        });

        // 停止输入状态
        socket.to(`conversation:${conversationId}`).emit('typing_stop', {
          conversationId,
          userId: user.id,
          timestamp: new Date().toISOString(),
        });

        // 生成 AI 响应（流式）
        const aiMessage = await this.conversationService.generateAIResponse(
          conversationId,
          user.id,
          (chunk: string) => {
            // 实时发送 AI 响应片段
            this.io.to(`conversation:${conversationId}`).emit('ai_response_chunk', {
              conversationId,
              messageId: aiMessage.id,
              chunk,
              timestamp: new Date().toISOString(),
            });
          }
        );

        // 发送完整的 AI 响应
        this.io.to(`conversation:${conversationId}`).emit('message_received', {
          type: 'ai_message',
          message: aiMessage,
          timestamp: new Date().toISOString(),
        });

        logger.info('实时消息处理完成', {
          userId: user.id,
          conversationId,
          userMessageId: userMessage.id,
          aiMessageId: aiMessage.id,
        });

      } catch (error) {
        logger.error('实时发送消息失败:', error);
        
        socket.emit('message_error', {
          type: 'send_error',
          message: error instanceof Error ? error.message : '发送消息失败',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 开始输入
    socket.on('typing_start', (data: { conversationId: string }) => {
      const { conversationId } = data;
      
      socket.to(`conversation:${conversationId}`).emit('typing_start', {
        conversationId,
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString(),
      });
    });

    // 停止输入
    socket.on('typing_stop', (data: { conversationId: string }) => {
      const { conversationId } = data;
      
      socket.to(`conversation:${conversationId}`).emit('typing_stop', {
        conversationId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    });

    // 获取对话列表
    socket.on('get_conversations', async (data: { page?: number; limit?: number }) => {
      try {
        const { page = 1, limit = 20 } = data;
        
        const result = await this.conversationService.getUserConversations(
          user.id,
          { page, limit }
        );

        socket.emit('conversations_list', {
          ...result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('获取对话列表失败:', error);
        socket.emit('error', {
          type: 'get_conversations_error',
          message: '获取对话列表失败',
        });
      }
    });

    // 创建新对话
    socket.on('create_conversation', async (data: { title: string; settings?: any }) => {
      try {
        const conversation = await this.conversationService.createConversation(
          user.id,
          data
        );

        socket.emit('conversation_created', {
          conversation,
          timestamp: new Date().toISOString(),
        });

        // 自动加入新创建的对话房间
        socket.join(`conversation:${conversation.id}`);

        logger.info('通过 WebSocket 创建对话', {
          userId: user.id,
          conversationId: conversation.id,
          title: data.title,
        });
      } catch (error) {
        logger.error('创建对话失败:', error);
        socket.emit('error', {
          type: 'create_conversation_error',
          message: '创建对话失败',
        });
      }
    });

    // 处理断开连接
    socket.on('disconnect', (reason) => {
      logger.info('聊天 WebSocket 连接断开', {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        reason,
      });

      // 通知相关对话房间用户离线
      const rooms = Array.from(socket.rooms).filter(room => 
        room.startsWith('conversation:')
      );

      rooms.forEach(room => {
        socket.to(room).emit('user_offline', {
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  /**
   * 向用户发送通知
   */
  async notifyUser(userId: string, event: WebSocketEvent): Promise<void> {
    this.io.to(`user:${userId}`).emit(event.type, {
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 向对话房间广播消息
   */
  async broadcastToConversation(
    conversationId: string, 
    event: WebSocketEvent
  ): Promise<void> {
    this.io.to(`conversation:${conversationId}`).emit(event.type, {
      ...event,
      conversationId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 向所有用户广播系统消息
   */
  async broadcastSystemMessage(message: string, type: string = 'system_message'): Promise<void> {
    this.io.emit(type, {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取在线用户统计
   */
  getOnlineStats(): {
    totalConnections: number;
    uniqueUsers: number;
    activeConversations: number;
  } {
    const sockets = this.io.sockets.sockets;
    const uniqueUsers = new Set();
    const activeConversations = new Set();

    for (const socket of sockets.values()) {
      const user = (socket as any).user;
      if (user) {
        uniqueUsers.add(user.id);
      }

      // 统计活跃对话
      for (const room of socket.rooms) {
        if (room.startsWith('conversation:')) {
          activeConversations.add(room);
        }
      }
    }

    return {
      totalConnections: sockets.size,
      uniqueUsers: uniqueUsers.size,
      activeConversations: activeConversations.size,
    };
  }

  /**
   * 强制用户下线（管理员功能）
   */
  async disconnectUser(userId: string, reason: string = '管理员操作'): Promise<boolean> {
    const userSockets = Array.from(this.io.sockets.sockets.values())
      .filter(socket => (socket as any).user?.id === userId);

    if (userSockets.length === 0) {
      return false;
    }

    userSockets.forEach(socket => {
      socket.emit('force_disconnect', {
        reason,
        timestamp: new Date().toISOString(),
      });
      socket.disconnect(true);
    });

    logger.info('用户被强制下线', { userId, reason, socketsCount: userSockets.length });

    return true;
  }
}