import winston from 'winston';
import { logConfig, isDevelopment } from '../config/index.js';

/**
 * 自定义日志格式
 */
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  
  return log;
});

/**
 * 创建 Winston logger 实例
 */
const logger = winston.createLogger({
  level: logConfig.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'gemini-cli-webui-backend',
    version: process.env.npm_package_version || '0.2.0'
  },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // 所有级别日志文件
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

/**
 * 开发环境控制台输出
 */
if (isDevelopment) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      customFormat
    )
  }));
}

/**
 * 请求日志中间件
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous'
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
};

/**
 * WebSocket 连接日志
 */
export const logWebSocketConnection = (socket: any, event: string, data?: any) => {
  logger.info('WebSocket Event', {
    event,
    socketId: socket.id,
    userId: socket.data?.user?.id || 'anonymous',
    timestamp: new Date().toISOString(),
    data: data ? JSON.stringify(data) : undefined
  });
};

/**
 * 安全事件日志
 */
export const logSecurityEvent = (
  event: string, 
  details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    result: 'success' | 'failure';
    reason?: string;
  }
) => {
  logger.warn('Security Event', {
    type: 'SECURITY',
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * 错误日志
 */
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: context || {}
  });
};

/**
 * 调试日志（仅在开发环境）
 */
export const logDebug = (message: string, data?: any) => {
  if (isDevelopment) {
    logger.debug(message, data);
  }
};

/**
 * 性能日志
 */
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info('Performance Metric', {
    type: 'PERFORMANCE',
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    metadata
  });
};

/**
 * 业务事件日志
 */
export const logBusinessEvent = (
  event: string,
  userId: string,
  details: Record<string, any>
) => {
  logger.info('Business Event', {
    type: 'BUSINESS',
    event,
    userId,
    timestamp: new Date().toISOString(),
    details
  });
};

export { logger };
export default logger;