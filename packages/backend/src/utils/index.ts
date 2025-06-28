export * from './auth.js';
export * from './logger.js';
export * from './response.js';

/**
 * 通用工具函数
 */

/**
 * 生成唯一 ID
 */
export const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${randomPart}`;
};

/**
 * 延迟函数
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 生成随机字符串
 */
export const generateRandomString = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 安全比较字符串
 */
export const safeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
};

/**
 * 提取 IP 地址
 */
export const extractClientIp = (req: any): string => {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    'unknown'
  );
};

/**
 * 清理敏感数据
 */
export const sanitizeUser = (user: any): any => {
  const { password, refreshToken, ...sanitized } = user;
  return sanitized;
};

/**
 * 验证邮箱格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证强密码
 */
export const isStrongPassword = (password: string): boolean => {
  // 至少8位，包含大小写字母、数字和特殊字符
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * 深拷贝对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {} as any;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  
  return obj;
};

/**
 * 移除对象中的空值
 */
export const removeEmptyValues = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nested = removeEmptyValues(value);
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
};

/**
 * 限制字符串长度
 */
export const truncateString = (str: string, maxLength: number, suffix: string = '...'): string => {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * 获取环境变量（带默认值）
 */
export const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`环境变量 ${key} 未设置`);
  }
  return value;
};

/**
 * 解析分页参数
 */
export const parsePaginationParams = (query: any): { page: number; limit: number; offset: number } => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

/**
 * 计算执行时间
 */
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;
  
  if (label) {
    console.log(`[${label}] 执行时间: ${duration}ms`);
  }
  
  return { result, duration };
};