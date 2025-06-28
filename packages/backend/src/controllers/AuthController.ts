import { Request, Response } from 'express';
import { 
  RegisterRequest,
  LoginRequest,
  PasswordChangeRequest,
  PasswordResetRequest,
  registerRequestSchema,
  loginRequestSchema,
  passwordChangeRequestSchema,
  passwordResetRequestSchema,
  UserRole 
} from '@gemini-cli-webui/shared';
import { userModel } from '../models/User.js';
import { sessionService } from '../services/SessionService.js';
import { AuthUtils } from '../utils/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { extractClientIp } from '../utils/index.js';
import logger from '../utils/logger.js';

/**
 * 认证控制器
 * 处理用户认证相关的 API 请求
 */
export class AuthController {
  /**
   * 用户注册
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      // 验证请求数据
      const validationResult = registerRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const registerData: RegisterRequest = validationResult.data;

      // 检查用户是否已存在
      const userExists = await userModel.userExists(registerData.username, registerData.email);
      if (userExists) {
        sendError(res, 409, 'USER_EXISTS', '用户名或邮箱已被使用');
        return;
      }

      // 验证密码强度
      const passwordValidation = AuthUtils.validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        sendError(res, 400, 'WEAK_PASSWORD', '密码强度不足', {
          errors: passwordValidation.errors,
        });
        return;
      }

      // 创建用户
      const newUser = await userModel.createUser(registerData);

      // 创建会话
      const ipAddress = extractClientIp(req);
      const userAgent = req.get('User-Agent');
      const session = await sessionService.createSession(
        newUser,
        false, // 注册不默认记住登录
        ipAddress,
        userAgent
      );

      logger.info('用户注册成功', { 
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email 
      });

      sendSuccess(res, 201, {
        user: AuthUtils.sanitizeUser(newUser),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: 15 * 60, // 15分钟
      }, '注册成功');
    } catch (error) {
      logger.error('用户注册失败:', error);
      sendError(res, 500, 'REGISTRATION_ERROR', '注册失败，请稍后重试');
    }
  }

  /**
   * 用户登录
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // 验证请求数据
      const validationResult = loginRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const loginData: LoginRequest = validationResult.data;

      // 验证用户凭据
      const user = await userModel.validateLogin(loginData);
      if (!user) {
        sendError(res, 401, 'INVALID_CREDENTIALS', '用户名或密码错误');
        return;
      }

      // 限制用户最大会话数
      await sessionService.limitUserSessions(user.id, 5);

      // 创建会话
      const ipAddress = extractClientIp(req);
      const userAgent = req.get('User-Agent');
      const session = await sessionService.createSession(
        user,
        loginData.rememberMe || false,
        ipAddress,
        userAgent
      );

      logger.info('用户登录成功', { 
        userId: user.id,
        username: user.username,
        rememberMe: loginData.rememberMe 
      });

      sendSuccess(res, 200, {
        user: AuthUtils.sanitizeUser(user),
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: 15 * 60, // 15分钟
      }, '登录成功');
    } catch (error) {
      logger.error('用户登录失败:', error);
      sendError(res, 500, 'LOGIN_ERROR', '登录失败，请稍后重试');
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        sendError(res, 400, 'MISSING_REFRESH_TOKEN', '缺少刷新令牌');
        return;
      }

      const result = await sessionService.refreshAccessToken(refreshToken);
      if (!result) {
        sendError(res, 401, 'INVALID_REFRESH_TOKEN', '无效的刷新令牌');
        return;
      }

      sendSuccess(res, 200, result, '令牌刷新成功');
    } catch (error) {
      logger.error('令牌刷新失败:', error);
      sendError(res, 500, 'TOKEN_REFRESH_ERROR', '令牌刷新失败');
    }
  }

  /**
   * 用户登出
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.sessionId) {
        sendError(res, 400, 'NO_ACTIVE_SESSION', '没有活跃的会话');
        return;
      }

      const success = await sessionService.destroySession(req.user.sessionId);
      if (!success) {
        sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
        return;
      }

      logger.info('用户登出成功', { 
        userId: req.user.id,
        sessionId: req.user.sessionId 
      });

      sendSuccess(res, 200, null, '登出成功');
    } catch (error) {
      logger.error('用户登出失败:', error);
      sendError(res, 500, 'LOGOUT_ERROR', '登出失败');
    }
  }

  /**
   * 登出所有设备
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 400, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const destroyedCount = await sessionService.destroyAllUserSessions(req.user.id);

      logger.info('用户所有设备登出成功', { 
        userId: req.user.id,
        destroyedSessions: destroyedCount 
      });

      sendSuccess(res, 200, {
        destroyedSessions: destroyedCount
      }, '所有设备登出成功');
    } catch (error) {
      logger.error('所有设备登出失败:', error);
      sendError(res, 500, 'LOGOUT_ALL_ERROR', '所有设备登出失败');
    }
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const user = await userModel.getUserById(req.user.id);
      if (!user) {
        sendError(res, 404, 'USER_NOT_FOUND', '用户不存在');
        return;
      }

      sendSuccess(res, 200, AuthUtils.sanitizeUser(user), '获取用户信息成功');
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      sendError(res, 500, 'GET_USER_ERROR', '获取用户信息失败');
    }
  }

  /**
   * 更改密码
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      // 验证请求数据
      const validationResult = passwordChangeRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const { currentPassword, newPassword }: PasswordChangeRequest = validationResult.data;

      // 验证新密码强度
      const passwordValidation = AuthUtils.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        sendError(res, 400, 'WEAK_PASSWORD', '新密码强度不足', {
          errors: passwordValidation.errors,
        });
        return;
      }

      // 更改密码
      const success = await userModel.changePassword(req.user.id, currentPassword, newPassword);
      if (!success) {
        sendError(res, 400, 'INVALID_CURRENT_PASSWORD', '当前密码错误');
        return;
      }

      // 登出其他所有设备（保留当前会话）
      await sessionService.destroyOtherUserSessions(req.user.id, req.user.sessionId);

      logger.info('用户密码更改成功', { userId: req.user.id });

      sendSuccess(res, 200, null, '密码更改成功');
    } catch (error) {
      logger.error('密码更改失败:', error);
      sendError(res, 500, 'PASSWORD_CHANGE_ERROR', '密码更改失败');
    }
  }

  /**
   * 获取活跃会话列表
   */
  static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const sessions = await sessionService.getUserSessions(req.user.id);
      const sessionInfos = sessions.map(session => ({
        ...sessionService.getSessionInfo(session),
        isCurrent: session.id === req.user?.sessionId,
      }));

      sendSuccess(res, 200, sessionInfos, '获取会话列表成功');
    } catch (error) {
      logger.error('获取会话列表失败:', error);
      sendError(res, 500, 'GET_SESSIONS_ERROR', '获取会话列表失败');
    }
  }

  /**
   * 终止指定会话
   */
  static async terminateSession(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        sendError(res, 401, 'USER_NOT_AUTHENTICATED', '用户未认证');
        return;
      }

      const { sessionId } = req.params;
      
      // 验证会话是否属于当前用户
      const session = await sessionService.getSession(sessionId);
      if (!session || session.userId !== req.user.id) {
        sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
        return;
      }

      // 不允许终止当前会话
      if (sessionId === req.user.sessionId) {
        sendError(res, 400, 'CANNOT_TERMINATE_CURRENT_SESSION', '不能终止当前会话');
        return;
      }

      const success = await sessionService.destroySession(sessionId);
      if (!success) {
        sendError(res, 404, 'SESSION_NOT_FOUND', '会话不存在');
        return;
      }

      logger.info('会话已终止', { 
        userId: req.user.id,
        terminatedSessionId: sessionId 
      });

      sendSuccess(res, 200, null, '会话已终止');
    } catch (error) {
      logger.error('终止会话失败:', error);
      sendError(res, 500, 'TERMINATE_SESSION_ERROR', '终止会话失败');
    }
  }

  /**
   * 密码重置请求（发送重置邮件）
   */
  static async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      // 验证请求数据
      const validationResult = passwordResetRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        sendError(res, 400, 'VALIDATION_ERROR', '输入数据无效', {
          errors: validationResult.error.errors,
        });
        return;
      }

      const { email }: PasswordResetRequest = validationResult.data;

      // 查找用户
      const user = await userModel.getUserByEmail(email);
      
      // 无论用户是否存在，都返回成功信息（安全考虑）
      // 这样可以防止邮箱枚举攻击
      
      if (user) {
        // TODO: 实现邮件发送功能
        // 生成重置令牌
        // 发送重置邮件
        
        logger.info('密码重置邮件已发送', { 
          userId: user.id,
          email: user.email 
        });
      } else {
        logger.info('尝试为不存在的邮箱发送密码重置邮件', { email });
      }

      sendSuccess(res, 200, null, '如果该邮箱存在，重置邮件已发送');
    } catch (error) {
      logger.error('密码重置请求失败:', error);
      sendError(res, 500, 'PASSWORD_RESET_REQUEST_ERROR', '密码重置请求失败');
    }
  }

  /**
   * 验证令牌状态
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.token) {
        sendError(res, 401, 'INVALID_TOKEN', '无效的令牌');
        return;
      }

      const expirationTime = AuthUtils.getTokenExpiration(req.token);
      const isExpiringSoon = AuthUtils.isTokenExpiringSoon(req.token);

      sendSuccess(res, 200, {
        valid: true,
        user: req.user,
        expiresAt: expirationTime?.toISOString(),
        expiringSoon: isExpiringSoon,
      }, '令牌有效');
    } catch (error) {
      logger.error('令牌验证失败:', error);
      sendError(res, 500, 'TOKEN_VALIDATION_ERROR', '令牌验证失败');
    }
  }

  /**
   * 获取认证统计信息（管理员）
   */
  static async getAuthStats(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== UserRole.ADMIN) {
        sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', '权限不足');
        return;
      }

      const userStats = await userModel.getUserStats();
      const sessionStats = sessionService.getSessionStats();

      sendSuccess(res, 200, {
        users: userStats,
        sessions: sessionStats,
      }, '获取认证统计信息成功');
    } catch (error) {
      logger.error('获取认证统计信息失败:', error);
      sendError(res, 500, 'GET_AUTH_STATS_ERROR', '获取认证统计信息失败');
    }
  }
}