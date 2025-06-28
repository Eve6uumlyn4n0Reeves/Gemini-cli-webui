import jwt from 'jsonwebtoken';
import { JWTPayload, User, UserRole } from '@gemini-cli-webui/shared';
import { config } from '../config/index.js';
import { generateId } from './index.js';
import logger from './logger.js';

/**
 * JWT 认证工具类
 */
export class AuthUtils {
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';

  /**
   * 生成访问令牌
   */
  static generateAccessToken(user: User, sessionId: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId,
    };

    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'gemini-cli-webui',
      audience: 'gemini-cli-webui-client',
    });
  }

  /**
   * 生成刷新令牌
   */
  static generateRefreshToken(user: User, sessionId: string): string {
    const payload = {
      userId: user.id,
      sessionId,
      type: 'refresh',
    };

    return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'gemini-cli-webui',
      audience: 'gemini-cli-webui-client',
    });
  }

  /**
   * 验证访问令牌
   */
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET, {
        issuer: 'gemini-cli-webui',
        audience: 'gemini-cli-webui-client',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('访问令牌验证失败:', error.message);
      } else {
        logger.error('访问令牌验证出错:', error);
      }
      return null;
    }
  }

  /**
   * 验证刷新令牌
   */
  static verifyRefreshToken(token: string): { userId: string; sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, {
        issuer: 'gemini-cli-webui',
        audience: 'gemini-cli-webui-client',
      }) as any;

      if (decoded.type !== 'refresh') {
        return null;
      }

      return {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('刷新令牌验证失败:', error.message);
      } else {
        logger.error('刷新令牌验证出错:', error);
      }
      return null;
    }
  }

  /**
   * 解析令牌（不验证签名）
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.debug('令牌解析失败:', error);
      return null;
    }
  }

  /**
   * 检查令牌是否即将过期（5分钟内）
   */
  static isTokenExpiringSoon(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const expirationTime = decoded.exp;
    const timeUntilExpiration = expirationTime - now;

    // 如果在5分钟内过期，认为即将过期
    return timeUntilExpiration <= 300;
  }

  /**
   * 获取令牌过期时间
   */
  static getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  /**
   * 生成会话 ID
   */
  static generateSessionId(): string {
    return generateId();
  }

  /**
   * 检查用户权限级别
   */
  static hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.ADMIN]: 2,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * 检查用户是否有权限访问特定资源
   */
  static canAccessResource(
    userRole: UserRole, 
    requiredRoles: UserRole[]
  ): { allowed: boolean; reason?: string } {
    if (requiredRoles.length === 0) {
      return { allowed: true };
    }

    const hasAccess = requiredRoles.some(role => this.hasPermission(userRole, role));
    
    if (!hasAccess) {
      return {
        allowed: false,
        reason: `需要以下角色之一: ${requiredRoles.join(', ')}，当前角色: ${userRole}`,
      };
    }

    return { allowed: true };
  }

  /**
   * 生成安全的随机字符串
   */
  static generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * 验证密码强度
   */
  static validatePasswordStrength(password: string): { 
    isValid: boolean; 
    errors: string[] 
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码长度至少为8个字符');
    }

    if (password.length > 128) {
      errors.push('密码长度不能超过128个字符');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('建议包含特殊字符以增强安全性');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 清理敏感信息
   */
  static sanitizeUser(user: User): Omit<User, 'email'> & { email?: string } {
    const { email, ...sanitizedUser } = user;
    
    // 只对非管理员用户隐藏邮箱
    if (user.role !== UserRole.ADMIN) {
      return sanitizedUser;
    }

    return user;
  }
}