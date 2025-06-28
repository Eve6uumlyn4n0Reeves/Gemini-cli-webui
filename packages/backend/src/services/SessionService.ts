import { UserSession, User } from '@gemini-cli-webui/shared';
import { AuthUtils } from '../utils/auth.js';
import { generateId } from '../utils/index.js';
import logger from '../utils/logger.js';

/**
 * 会话管理服务
 * 处理用户会话的创建、验证、更新和清理
 */
export class SessionService {
  private sessions: Map<string, UserSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startSessionCleanup();
  }

  /**
   * 创建新的用户会话
   */
  async createSession(
    user: User, 
    rememberMe: boolean = false,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    const sessionId = AuthUtils.generateSessionId();
    const now = new Date();
    
    // 生成访问令牌和刷新令牌
    const accessToken = AuthUtils.generateAccessToken(user, sessionId);
    const refreshToken = AuthUtils.generateRefreshToken(user, sessionId);
    
    // 计算过期时间
    const expiresAt = new Date();
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + 30); // 30天
    } else {
      expiresAt.setHours(expiresAt.getHours() + 24); // 24小时
    }

    const session: UserSession = {
      id: sessionId,
      userId: user.id,
      accessToken,
      refreshToken,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress,
      userAgent,
      isActive: true,
    };

    // 存储会话
    this.sessions.set(sessionId, session);
    
    // 更新用户会话索引
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(sessionId);

    logger.info('用户会话已创建', { 
      userId: user.id,
      sessionId,
      expiresAt: expiresAt.toISOString(),
      rememberMe 
    });

    return session;
  }

  /**
   * 获取会话信息
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // 检查会话是否过期
    if (new Date() > session.expiresAt || !session.isActive) {
      await this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  } | null> {
    try {
      // 验证刷新令牌
      const payload = AuthUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        return null;
      }

      const session = await this.getSession(payload.sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        return null;
      }

      // 从用户模型获取最新用户信息（这里需要导入 userModel）
      const { userModel } = await import('../models/User.js');
      const user = await userModel.getUserById(payload.userId);
      if (!user) {
        await this.destroySession(payload.sessionId);
        return null;
      }

      // 生成新的访问令牌
      const newAccessToken = AuthUtils.generateAccessToken(user, payload.sessionId);
      
      // 更新会话
      session.accessToken = newAccessToken;
      session.updatedAt = new Date();

      logger.info('访问令牌已刷新', { 
        userId: payload.userId,
        sessionId: payload.sessionId 
      });

      return {
        accessToken: newAccessToken,
        expiresIn: 15 * 60, // 15分钟
      };
    } catch (error) {
      logger.error('刷新访问令牌失败:', error);
      return null;
    }
  }

  /**
   * 销毁指定会话
   */
  async destroySession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // 从主会话存储中移除
    this.sessions.delete(sessionId);

    // 从用户会话索引中移除
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      
      // 如果用户没有其他会话，移除整个索引
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    logger.info('用户会话已销毁', { 
      userId: session.userId,
      sessionId 
    });

    return true;
  }

  /**
   * 销毁用户的所有会话
   */
  async destroyAllUserSessions(userId: string): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return 0;
    }

    let destroyedCount = 0;
    for (const sessionId of userSessionSet) {
      if (await this.destroySession(sessionId)) {
        destroyedCount++;
      }
    }

    logger.info('用户所有会话已销毁', { 
      userId,
      destroyedCount 
    });

    return destroyedCount;
  }

  /**
   * 销毁除指定会话外的所有用户会话
   */
  async destroyOtherUserSessions(userId: string, keepSessionId: string): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return 0;
    }

    let destroyedCount = 0;
    for (const sessionId of Array.from(userSessionSet)) {
      if (sessionId !== keepSessionId) {
        if (await this.destroySession(sessionId)) {
          destroyedCount++;
        }
      }
    }

    logger.info('用户其他会话已销毁', { 
      userId,
      keepSessionId,
      destroyedCount 
    });

    return destroyedCount;
  }

  /**
   * 更新会话最后活动时间
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.updatedAt = new Date();
    return true;
  }

  /**
   * 获取用户的所有活跃会话
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return [];
    }

    const sessions: UserSession[] = [];
    for (const sessionId of userSessionSet) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * 获取会话统计信息
   */
  getSessionStats() {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => session.isActive && now <= session.expiresAt);

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      expiredSessions: this.sessions.size - activeSessions.length,
      uniqueUsers: this.userSessions.size,
      averageSessionsPerUser: this.userSessions.size > 0 
        ? Math.round(activeSessions.length / this.userSessions.size * 100) / 100 
        : 0,
    };
  }

  /**
   * 验证会话并检查权限
   */
  async validateSession(sessionId: string, requiredRole?: string): Promise<{
    valid: boolean;
    session?: UserSession;
    user?: User;
    reason?: string;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: '会话不存在或已过期' };
    }

    // 获取用户信息
    const { userModel } = await import('../models/User.js');
    const user = await userModel.getUserById(session.userId);
    if (!user) {
      await this.destroySession(sessionId);
      return { valid: false, reason: '用户不存在' };
    }

    if (user.status !== 'active') {
      await this.destroySession(sessionId);
      return { valid: false, reason: '用户账户已被禁用' };
    }

    // 检查角色权限
    if (requiredRole && !AuthUtils.hasPermission(user.role as any, requiredRole as any)) {
      return { valid: false, reason: '权限不足' };
    }

    return { valid: true, session, user };
  }

  /**
   * 启动会话清理定时器
   */
  private startSessionCleanup(): void {
    // 每5分钟清理一次过期会话
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    logger.info('会话清理定时器已启动');
  }

  /**
   * 清理过期会话
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt || !session.isActive) {
        await this.destroySession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('过期会话清理完成', { cleanedCount });
    }
  }

  /**
   * 停止会话服务
   */
  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }

    this.sessions.clear();
    this.userSessions.clear();

    logger.info('会话服务已停止');
  }

  /**
   * 获取详细的会话信息（不包含敏感信息）
   */
  getSessionInfo(session: UserSession): Omit<UserSession, 'accessToken' | 'refreshToken'> {
    const { accessToken, refreshToken, ...sessionInfo } = session;
    return sessionInfo;
  }

  /**
   * 限制用户最大会话数
   */
  async limitUserSessions(userId: string, maxSessions: number = 5): Promise<void> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet || userSessionSet.size <= maxSessions) {
      return;
    }

    // 获取所有会话并按创建时间排序
    const sessions = await this.getUserSessions(userId);
    const sessionsToDestroy = sessions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, sessions.length - maxSessions);

    for (const session of sessionsToDestroy) {
      await this.destroySession(session.id);
    }

    logger.info('用户会话数量已限制', { 
      userId,
      maxSessions,
      destroyedSessions: sessionsToDestroy.length 
    });
  }
}

// 导出单例实例
export const sessionService = new SessionService();