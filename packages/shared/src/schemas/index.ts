import { z } from 'zod';

// Basic validation schemas
export const objectIdSchema = z.string().min(1);
export const emailSchema = z.string().email();
export const urlSchema = z.string().url();
export const dateSchema = z.coerce.date();

// User schemas
export const userRoleSchema = z.enum(['guest', 'user', 'admin']);
export const userStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending']);

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  language: z.string().default('en'),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    toolExecutions: z.boolean().default(true),
    approvals: z.boolean().default(true),
  }),
  toolSettings: z.object({
    autoApprove: z.boolean().default(false),
    maxConcurrentTools: z.number().positive().max(10).default(3),
    timeoutMinutes: z.number().positive().max(60).default(15),
  }),
});

export const userSchema = z.object({
  id: objectIdSchema,
  username: z.string().min(3).max(50),
  email: emailSchema,
  role: userRoleSchema,
  status: userStatusSchema,
  displayName: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  lastLoginAt: dateSchema.optional(),
  preferences: userPreferencesSchema.optional(),
});

// Authentication schemas
export const registerRequestSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  email: emailSchema,
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含至少一个小写字母、一个大写字母和一个数字'),
  displayName: z.string().min(1).max(100).optional(),
  inviteCode: z.string().optional(),
});

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含至少一个小写字母、一个大写字母和一个数字'),
});

export const jwtPayloadSchema = z.object({
  userId: objectIdSchema,
  username: z.string(),
  role: userRoleSchema,
  sessionId: objectIdSchema,
  iat: z.number(),
  exp: z.number(),
});

export const authResponseSchema = z.object({
  success: z.boolean(),
  user: userSchema.optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  message: z.string().optional(),
});

export const userSessionSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  isActive: z.boolean(),
});

export const permissionCheckSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  requiredRole: userRoleSchema.optional(),
  userRole: userRoleSchema.optional(),
});

export const apiPermissionSchema = z.object({
  path: z.string(),
  method: z.string(),
  roles: z.array(userRoleSchema),
  description: z.string().optional(),
});

export const userActivitySchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  action: z.string(),
  resource: z.string(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: dateSchema,
});

// Message schemas  
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const messageStatusSchema = z.enum(['sending', 'sent', 'delivered', 'error']);
export const messageTypeSchema = z.enum(['text', 'tool_use', 'tool_result', 'image', 'file']);

export const messageContentSchema = z.object({
  type: messageTypeSchema,
  text: z.string().optional(),
  imageUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().positive().optional(),
  mimeType: z.string().optional(),
});

export const toolUseSchema = z.object({
  id: objectIdSchema,
  name: z.string().min(1),
  input: z.record(z.unknown()),
  status: z.enum(['pending', 'approved', 'rejected', 'executing', 'completed', 'error']),
  approvalRequired: z.boolean(),
  executionTime: z.number().positive().optional(),
  error: z.string().optional(),
});

export const toolResultSchema = z.object({
  toolUseId: objectIdSchema,
  content: z.union([z.string(), z.record(z.unknown())]),
  isError: z.boolean(),
  executionTime: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const messageSchema = z.object({
  id: objectIdSchema,
  conversationId: objectIdSchema,
  role: messageRoleSchema,
  content: z.array(messageContentSchema),
  toolUse: toolUseSchema.optional(),
  toolResult: toolResultSchema.optional(),
  status: messageStatusSchema,
  timestamp: dateSchema,
  userId: objectIdSchema.optional(),
  parentMessageId: objectIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Conversation schemas
export const conversationSettingsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
});

export const conversationSchema = z.object({
  id: objectIdSchema,
  title: z.string().min(1).max(200),
  userId: objectIdSchema,
  messages: z.array(messageSchema),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  settings: conversationSettingsSchema.optional(),
});

// Tool schemas
export const toolPermissionLevelSchema = z.enum(['auto', 'user_approval', 'admin_approval', 'denied']);
export const toolExecutionStatusSchema = z.enum(['pending', 'approved', 'rejected', 'executing', 'completed', 'error', 'timeout']);
export const toolCategorySchema = z.enum(['filesystem', 'network', 'system', 'development', 'database', 'mcp', 'custom']);

export const toolParameterSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
});

export const toolSchema = z.object({
  id: objectIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: toolCategorySchema,
  parameters: z.array(toolParameterSchema),
  permissionLevel: toolPermissionLevelSchema,
  isEnabled: z.boolean(),
  isSandboxed: z.boolean(),
  timeout: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
  source: z.enum(['builtin', 'mcp', 'plugin']).optional(),
  mcpServerId: objectIdSchema.optional(),
});

export const resourceLimitsSchema = z.object({
  maxMemory: z.number().positive(),
  maxCpu: z.number().min(0).max(100),
  maxExecutionTime: z.number().positive(),
  maxFileSize: z.number().positive(),
  maxNetworkRequests: z.number().positive().optional(),
});

export const sandboxInfoSchema = z.object({
  containerId: z.string().optional(),
  workingDirectory: z.string().min(1),
  environment: z.record(z.string()),
  resourceLimits: resourceLimitsSchema,
  networkAccess: z.boolean(),
  filesystemAccess: z.enum(['none', 'readonly', 'readwrite']),
});

export const toolExecutionErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  stack: z.string().optional(),
});

export const toolExecutionSchema = z.object({
  id: objectIdSchema,
  toolId: objectIdSchema,
  toolName: z.string().min(1),
  messageId: objectIdSchema,
  conversationId: objectIdSchema,
  userId: objectIdSchema,
  input: z.record(z.unknown()),
  output: z.union([z.string(), z.record(z.unknown())]).optional(),
  status: toolExecutionStatusSchema,
  approvedBy: objectIdSchema.optional(),
  approvedAt: dateSchema.optional(),
  executedAt: dateSchema.optional(),
  completedAt: dateSchema.optional(),
  executionTime: z.number().positive().optional(),
  error: toolExecutionErrorSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  sandboxInfo: sandboxInfoSchema.optional(),
});

// WebSocket event schemas
export const webSocketEventTypeSchema = z.enum([
  'connection', 'disconnect', 'reconnect', 'error',
  'message:send', 'message:receive', 'message:update', 'message:delete', 'message:stream',
  'conversation:create', 'conversation:update', 'conversation:delete', 'conversation:list',
  'tool:execute', 'tool:approve', 'tool:reject', 'tool:result', 'tool:list', 'tool:approval_request',
  'typing:start', 'typing:stop', 'status:update', 'user:join', 'user:leave',
  'system:notification', 'system:health', 'system:config_update'
]);

export const webSocketEventSchema = z.object({
  type: webSocketEventTypeSchema,
  data: z.unknown(),
  timestamp: dateSchema,
  id: objectIdSchema,
  conversationId: objectIdSchema.optional(),
  userId: objectIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// API request/response schemas
export const createConversationRequestSchema = z.object({
  title: z.string().min(1).max(200),
  settings: conversationSettingsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createMessageRequestSchema = z.object({
  conversationId: objectIdSchema,
  content: z.array(messageContentSchema),
  parentMessageId: objectIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const executeToolRequestSchema = z.object({
  toolId: objectIdSchema,
  input: z.record(z.unknown()),
  messageId: objectIdSchema,
  conversationId: objectIdSchema,
});

export const approveToolRequestSchema = z.object({
  toolExecutionId: objectIdSchema,
  approved: z.boolean(),
  reason: z.string().optional(),
});

export const updateConversationRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  settings: conversationSettingsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Chat API request schemas
export const getChatMessagesRequestSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(50),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const searchMessagesRequestSchema = z.object({
  query: z.string().min(1).max(500),
  conversationId: z.string().optional(),
  limit: z.number().positive().max(100).default(50),
});

// API response schemas
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }).optional(),
  meta: z.object({
    timestamp: dateSchema,
    requestId: z.string(),
    version: z.string(),
  }).optional(),
});

export const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  total: z.number().nonnegative().optional(),
  totalPages: z.number().nonnegative().optional(),
});

// Export type inference helpers
export type User = z.infer<typeof userSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type PermissionCheck = z.infer<typeof permissionCheckSchema>;
export type ApiPermission = z.infer<typeof apiPermissionSchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;
export type Message = z.infer<typeof messageSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolExecution = z.infer<typeof toolExecutionSchema>;
export type WebSocketEvent = z.infer<typeof webSocketEventSchema>;
export type CreateConversationRequest = z.infer<typeof createConversationRequestSchema>;
export type CreateMessageRequest = z.infer<typeof createMessageRequestSchema>;
export type ExecuteToolRequest = z.infer<typeof executeToolRequestSchema>;
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
};
export type Pagination = z.infer<typeof paginationSchema>;