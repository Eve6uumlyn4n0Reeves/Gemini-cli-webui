// Application constants
export const APP_CONFIG = {
  NAME: 'Gemini CLI WebUI',
  VERSION: '0.2.0',
  DESCRIPTION: 'Web UI for Gemini CLI with full tool execution and MCP server support',
  HOMEPAGE: 'https://github.com/gemini-cli/webui',
} as const;

// API constants
export const API_CONFIG = {
  VERSION: 'v1',
  BASE_PATH: '/api/v1',
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// WebSocket constants
export const WEBSOCKET_CONFIG = {
  TIMEOUT: 5000, // 5 seconds
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 2000, // 2 seconds
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  MESSAGE_BUFFER_SIZE: 100,
} as const;

// Chat constants
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 10000,
  MAX_CONVERSATION_TITLE_LENGTH: 200,
  MAX_MESSAGES_PER_CONVERSATION: 1000,
  MESSAGE_PAGINATION_LIMIT: 50,
  TYPING_TIMEOUT: 3000, // 3 seconds
  AUTO_SAVE_INTERVAL: 5000, // 5 seconds
} as const;

// Tool execution constants
export const TOOL_CONFIG = {
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  MAX_TIMEOUT: 1800000, // 30 minutes
  MIN_TIMEOUT: 1000, // 1 second
  APPROVAL_TIMEOUT: 300000, // 5 minutes
  MAX_CONCURRENT_EXECUTIONS: 10,
  MAX_INPUT_SIZE: 1048576, // 1MB
  MAX_OUTPUT_SIZE: 10485760, // 10MB
} as const;

// Sandbox constants
export const SANDBOX_CONFIG = {
  DEFAULT_MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB
  DEFAULT_CPU_LIMIT: 50, // 50%
  DEFAULT_EXECUTION_TIME: 300000, // 5 minutes
  DEFAULT_FILE_SIZE_LIMIT: 100 * 1024 * 1024, // 100MB
  DEFAULT_NETWORK_REQUESTS: 100,
  WORKING_DIRECTORY: '/workspace',
} as const;

// File upload constants
export const FILE_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_PER_UPLOAD: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'text/plain',
    'text/markdown',
    'application/json',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
} as const;

// Security constants
export const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  CSRF_TOKEN_LENGTH: 32,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  PASSWORD_MIN_LENGTH: 8,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const;

// WebSocket event names
export const WS_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  
  // Chat events
  MESSAGE_SEND: 'message:send',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_STREAM: 'message:stream',
  
  // Conversation events
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  CONVERSATION_LIST: 'conversation:list',
  
  // Tool events
  TOOL_EXECUTE: 'tool:execute',
  TOOL_APPROVE: 'tool:approve',
  TOOL_REJECT: 'tool:reject',
  TOOL_RESULT: 'tool:result',
  TOOL_LIST: 'tool:list',
  TOOL_APPROVAL_REQUEST: 'tool:approval_request',
  
  // Status events
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  STATUS_UPDATE: 'status:update',
  USER_JOIN: 'user:join',
  USER_LEAVE: 'user:leave',
  
  // System events
  SYSTEM_NOTIFICATION: 'system:notification',
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_CONFIG_UPDATE: 'system:config_update',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_ME: '/auth/me',
  
  // Users
  USERS: '/users',
  USER_BY_ID: (id: string) => `/users/${id}`,
  
  // Conversations
  CONVERSATIONS: '/conversations',
  CONVERSATION_BY_ID: (id: string) => `/conversations/${id}`,
  CONVERSATION_MESSAGES: (id: string) => `/conversations/${id}/messages`,
  
  // Messages
  MESSAGES: '/messages',
  MESSAGE_BY_ID: (id: string) => `/messages/${id}`,
  
  // Tools
  TOOLS: '/tools',
  TOOL_BY_ID: (id: string) => `/tools/${id}`,
  TOOL_EXECUTE: '/tools/execute',
  TOOL_EXECUTIONS: '/tools/executions',
  TOOL_EXECUTION_BY_ID: (id: string) => `/tools/executions/${id}`,
  TOOL_APPROVAL: '/tools/approve',
  
  // MCP Servers
  MCP_SERVERS: '/mcp/servers',
  MCP_SERVER_BY_ID: (id: string) => `/mcp/servers/${id}`,
  MCP_SERVER_HEALTH: (id: string) => `/mcp/servers/${id}/health`,
  
  // System
  SYSTEM_HEALTH: '/system/health',
  SYSTEM_INFO: '/system/info',
  SYSTEM_CONFIG: '/system/config',
  
  // Files
  FILES_UPLOAD: '/files/upload',
  FILES_DOWNLOAD: (id: string) => `/files/${id}/download`,
  FILES_METADATA: (id: string) => `/files/${id}/metadata`,
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error codes
export const ERROR_CODES = {
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  
  // Tool execution errors
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_TIMEOUT: 'TOOL_TIMEOUT',
  TOOL_PERMISSION_DENIED: 'TOOL_PERMISSION_DENIED',
  TOOL_APPROVAL_REQUIRED: 'TOOL_APPROVAL_REQUIRED',
  TOOL_APPROVAL_REJECTED: 'TOOL_APPROVAL_REJECTED',
  
  // Sandbox errors
  SANDBOX_CREATION_FAILED: 'SANDBOX_CREATION_FAILED',
  SANDBOX_RESOURCE_LIMIT_EXCEEDED: 'SANDBOX_RESOURCE_LIMIT_EXCEEDED',
  SANDBOX_TIMEOUT: 'SANDBOX_TIMEOUT',
  
  // WebSocket errors
  WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  WS_AUTHENTICATION_FAILED: 'WS_AUTHENTICATION_FAILED',
  WS_MESSAGE_TOO_LARGE: 'WS_MESSAGE_TOO_LARGE',
  
  // File errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Log levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
} as const;

// Default configuration values
export const DEFAULTS = {
  USER_ROLE: 'user',
  MESSAGE_ROLE: 'user',
  MESSAGE_STATUS: 'sending',
  MESSAGE_TYPE: 'text',
  TOOL_PERMISSION_LEVEL: 'user_approval',
  TOOL_EXECUTION_STATUS: 'pending',
  TOOL_CATEGORY: 'custom',
  CONVERSATION_TITLE: 'New Conversation',
  PAGINATION_LIMIT: 20,
  PAGINATION_PAGE: 1,
} as const;

// Environment variables
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  WS_PORT: 'WS_PORT',
  LOG_LEVEL: 'LOG_LEVEL',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  DATABASE_URL: 'DATABASE_URL',
  REDIS_URL: 'REDIS_URL',
  JWT_SECRET: 'JWT_SECRET',
  CORS_ORIGIN: 'CORS_ORIGIN',
  SANDBOX_ENABLED: 'SANDBOX_ENABLED',
  MCP_SERVER_TIMEOUT: 'MCP_SERVER_TIMEOUT',
} as const;

// Feature flags
export const FEATURES = {
  TOOL_EXECUTION: 'tool_execution',
  MCP_SERVERS: 'mcp_servers',
  FILE_UPLOADS: 'file_uploads',
  STREAMING_RESPONSES: 'streaming_responses',
  CONVERSATION_HISTORY: 'conversation_history',
  USER_MANAGEMENT: 'user_management',
  RATE_LIMITING: 'rate_limiting',
  AUDIT_LOGGING: 'audit_logging',
} as const;