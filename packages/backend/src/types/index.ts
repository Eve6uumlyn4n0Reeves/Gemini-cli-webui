export * from './express.js';

/**
 * API 响应类型
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 错误类型
 */
export interface AppError {
  name: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
  stack?: string;
  details?: Record<string, any>;
}

/**
 * 认证载荷类型
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * 登录请求类型
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 注册请求类型
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  confirmPassword: string;
}

/**
 * 刷新令牌请求类型
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * 认证响应类型
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

/**
 * WebSocket 事件类型
 */
export interface SocketEventData {
  type: string;
  payload: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

/**
 * 健康检查响应类型
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database?: 'up' | 'down';
    redis?: 'up' | 'down';
    geminiCli?: 'up' | 'down';
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
    requestCount: number;
  };
}

/**
 * 审计日志类型
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
  ip: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}