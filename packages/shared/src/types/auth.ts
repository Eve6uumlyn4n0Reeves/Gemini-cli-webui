/**
 * 认证和用户管理相关类型定义
 */

// 用户角色枚举
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin'
}

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// 基础用户信息接口
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  preferences?: UserPreferences;
}

// 用户偏好设置
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    toolExecutions: boolean;
    approvals: boolean;
  };
  toolSettings: {
    autoApprove: boolean;
    maxConcurrentTools: number;
    timeoutMinutes: number;
  };
}

// 用户注册请求
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  inviteCode?: string;
}

// 用户登录请求
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// 密码重置请求
export interface PasswordResetRequest {
  email: string;
}

// 更改密码请求
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

// JWT Token 载荷
export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}

// 认证响应
export interface AuthResponse {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  message?: string;
}

// 用户会话信息
export interface UserSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

// 权限检查结果
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  requiredRole?: UserRole;
  userRole?: UserRole;
}

// API 权限配置
export interface ApiPermission {
  path: string;
  method: string;
  roles: UserRole[];
  description?: string;
}

// 用户活动日志
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// 用户统计信息
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  usersByRole: Record<UserRole, number>;
  usersByStatus: Record<UserStatus, number>;
}