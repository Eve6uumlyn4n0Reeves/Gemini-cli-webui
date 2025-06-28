import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types/index.js';

/**
 * 生成请求 ID
 */
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 创建标准 API 响应
 */
export const createResponse = <T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: string,
  errors?: Record<string, string[]>,
  requestId?: string
): ApiResponse<T> => {
  return {
    success,
    data,
    message,
    error,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: '0.2.0'
    }
  };
};

/**
 * 创建分页响应
 */
export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  requestId?: string
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: '0.2.0'
    }
  };
};

/**
 * 发送成功响应
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): void => {
  const response = createResponse(true, data, message, undefined, undefined, res.locals.requestId);
  res.status(statusCode).json(response);
};

/**
 * 发送错误响应
 */
export const sendError = (
  res: Response,
  error: string,
  statusCode: number = 400,
  errors?: Record<string, string[]>
): void => {
  const response = createResponse(false, undefined, undefined, error, errors, res.locals.requestId);
  res.status(statusCode).json(response);
};

/**
 * 发送分页响应
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  statusCode: number = 200
): void => {
  const response = createPaginatedResponse(data, total, page, limit, res.locals.requestId);
  res.status(statusCode).json(response);
};

/**
 * 发送验证错误响应
 */
export const sendValidationError = (
  res: Response,
  errors: Record<string, string[]>
): void => {
  const response = createResponse(
    false,
    undefined,
    '数据验证失败',
    '请检查输入数据',
    errors,
    res.locals.requestId
  );
  res.status(422).json(response);
};

/**
 * 发送认证错误响应
 */
export const sendAuthError = (
  res: Response,
  message: string = '认证失败'
): void => {
  const response = createResponse(false, undefined, undefined, message, undefined, res.locals.requestId);
  res.status(401).json(response);
};

/**
 * 发送权限错误响应
 */
export const sendForbiddenError = (
  res: Response,
  message: string = '权限不足'
): void => {
  const response = createResponse(false, undefined, undefined, message, undefined, res.locals.requestId);
  res.status(403).json(response);
};

/**
 * 发送未找到错误响应
 */
export const sendNotFoundError = (
  res: Response,
  message: string = '资源未找到'
): void => {
  const response = createResponse(false, undefined, undefined, message, undefined, res.locals.requestId);
  res.status(404).json(response);
};

/**
 * 发送服务器错误响应
 */
export const sendServerError = (
  res: Response,
  message: string = '服务器内部错误'
): void => {
  const response = createResponse(false, undefined, undefined, message, undefined, res.locals.requestId);
  res.status(500).json(response);
};

/**
 * 处理异步路由错误
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 响应时间中间件
 */
export const responseTimeMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  
  next();
};

/**
 * 请求 ID 中间件
 */
export const requestIdMiddleware = (req: any, res: any, next: any) => {
  const requestId = generateRequestId();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  next();
};

/**
 * 创建错误对象
 */
export const createError = (
  statusCode: number,
  message: string,
  details?: any
): Error & { statusCode: number; details?: any } => {
  const error = new Error(message) as Error & { statusCode: number; details?: any };
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
};