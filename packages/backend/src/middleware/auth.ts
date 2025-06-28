import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '../utils/auth.js';
import { userModel } from '../models/User.js';
import { JWTPayload, UserRole } from '@gemini-cli-webui/shared';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

// 扩展 Request 接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
        sessionId: string;
      };
      token?: string;
    }
  }
}

/**
 * JWT 认证中间件
 * 验证请求中的访问令牌并设置用户信息
 */
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      sendError(res, 401, 'AUTH_TOKEN_MISSING', '缺少访问令牌');
      return;
    }

    // 验证令牌
    const payload = AuthUtils.verifyAccessToken(token);
    if (!payload) {
      sendError(res, 401, 'AUTH_TOKEN_INVALID', '无效的访问令牌');
      return;
    }

    // 检查用户是否仍然存在且处于活跃状态
    const user = await userModel.getUserById(payload.userId);
    if (!user) {
      sendError(res, 401, 'AUTH_USER_NOT_FOUND', '用户不存在');
      return;
    }

    if (user.status !== 'active') {
      sendError(res, 401, 'AUTH_USER_INACTIVE', '用户账户已被禁用');
      return;
    }

    // 设置请求上下文
    req.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sessionId,
    };
    req.token = token;

    logger.debug('用户认证成功', { 
      userId: payload.userId, 
      username: payload.username,
      sessionId: payload.sessionId 
    });

    next();
  } catch (error) {
    logger.error('认证中间件错误:', error);
    sendError(res, 500, 'AUTH_ERROR', '认证服务出错');
  }
};

/**
 * 可选认证中间件
 * 如果有令牌则验证，没有则跳过
 */
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      next();
      return;
    }

    // 验证令牌
    const payload = AuthUtils.verifyAccessToken(token);
    if (payload) {
      const user = await userModel.getUserById(payload.userId);
      if (user && user.status === 'active') {
        req.user = {
          id: payload.userId,
          username: payload.username,
          role: payload.role,
          sessionId: payload.sessionId,
        };
        req.token = token;
      }
    }

    next();
  } catch (error) {
    logger.debug('可选认证中间件错误:', error);
    next(); // 可选认证失败不阻止请求继续
  }
};

/**
 * 权限检查中间件工厂
 * 创建检查用户权限的中间件
 */
export const requireRole = (requiredRoles: UserRole | UserRole[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', '需要认证才能访问此资源');
      return;
    }

    const { allowed, reason } = AuthUtils.canAccessResource(req.user.role, roles);
    
    if (!allowed) {
      sendError(res, 403, 'AUTH_INSUFFICIENT_PERMISSIONS', 
        reason || '权限不足');
      return;
    }

    logger.debug('权限检查通过', { 
      userId: req.user.id, 
      userRole: req.user.role,
      requiredRoles: roles 
    });

    next();
  };
};

/**
 * 管理员权限中间件
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * 用户权限中间件（用户及以上）
 */
export const requireUser = requireRole([UserRole.USER, UserRole.ADMIN]);

/**
 * 自身用户或管理员权限检查中间件工厂
 * 允许用户访问自己的资源或管理员访问任何资源
 */
export const requireSelfOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'AUTH_REQUIRED', '需要认证才能访问此资源');
      return;
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    
    // 管理员可以访问任何用户的资源
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // 用户只能访问自己的资源
    if (req.user.id === targetUserId) {
      next();
      return;
    }

    sendError(res, 403, 'AUTH_INSUFFICIENT_PERMISSIONS', 
      '只能访问自己的资源或需要管理员权限');
  };
};

/**
 * 速率限制中间件（基于用户）
 */
export const userRateLimit = (requestsPerMinute: number = 60) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟

    let userRequest = userRequests.get(userId);
    
    if (!userRequest || now > userRequest.resetTime) {
      userRequest = {
        count: 1,
        resetTime: now + windowMs,
      };
      userRequests.set(userId, userRequest);
    } else {
      userRequest.count++;
    }

    // 清理过期记录
    if (userRequests.size > 10000) {
      for (const [key, value] of userRequests.entries()) {
        if (now > value.resetTime) {
          userRequests.delete(key);
        }
      }
    }

    if (userRequest.count > requestsPerMinute) {
      const retryAfter = Math.ceil((userRequest.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 
        `请求过于频繁，请在 ${retryAfter} 秒后重试`);
      return;
    }

    // 设置响应头
    res.set('X-RateLimit-Limit', requestsPerMinute.toString());
    res.set('X-RateLimit-Remaining', (requestsPerMinute - userRequest.count).toString());
    res.set('X-RateLimit-Reset', userRequest.resetTime.toString());

    next();
  };
};

/**
 * WebSocket 认证中间件
 */
export const authenticateSocket = async (socket: any, next: any): Promise<void> => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('缺少访问令牌'));
    }

    const payload = AuthUtils.verifyAccessToken(token);
    if (!payload) {
      return next(new Error('无效的访问令牌'));
    }

    const user = await userModel.getUserById(payload.userId);
    if (!user || user.status !== 'active') {
      return next(new Error('用户不存在或已被禁用'));
    }

    socket.user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sessionId,
    };

    logger.info('WebSocket 用户认证成功', { 
      socketId: socket.id,
      userId: payload.userId, 
      username: payload.username 
    });

    next();
  } catch (error) {
    logger.error('WebSocket 认证错误:', error);
    next(new Error('认证服务出错'));
  }
};

/**
 * 检查令牌是否即将过期的中间件
 */
export const checkTokenExpiration = (req: Request, res: Response, next: NextFunction): void => {
  if (req.token && AuthUtils.isTokenExpiringSoon(req.token)) {
    res.set('X-Token-Expiring', 'true');
    res.set('X-Token-Refresh-Suggested', 'true');
  }
  
  next();
};