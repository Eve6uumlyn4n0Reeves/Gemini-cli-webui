import type { Message, StreamingMessage, Conversation } from './chat.js';
import type { ToolExecution, ToolApprovalRequest } from './tools.js';

export type WebSocketEventType = 
  // Connection events
  | 'connection'
  | 'disconnect'
  | 'reconnect'
  | 'error'
  // Chat events  
  | 'message:send'
  | 'message:receive'
  | 'message:update'
  | 'message:delete'
  | 'message:stream'
  | 'conversation:create'
  | 'conversation:update'
  | 'conversation:delete'
  | 'conversation:list'
  // Tool events
  | 'tool:execute'
  | 'tool:approve' 
  | 'tool:reject'
  | 'tool:result'
  | 'tool:list'
  | 'tool:approval_request'
  // Approval events
  | 'approval-request'
  | 'approval-granted'
  | 'approval-rejected'
  // Status events
  | 'typing:start'
  | 'typing:stop'
  | 'status:update'
  | 'user:join'
  | 'user:leave'
  // System events
  | 'system:notification'
  | 'system:health'
  | 'system:config_update';

export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  data: T;
  timestamp: Date;
  id: string;
  conversationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Connection Events
export interface ConnectionEvent {
  userId: string;
  sessionId: string;
  timestamp: Date;
}

export interface DisconnectEvent {
  userId: string;
  sessionId: string;
  reason: string;
  timestamp: Date;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

// Chat Events
export interface MessageSendEvent {
  message: Omit<Message, 'id' | 'timestamp' | 'status'>;
  tempId: string;
}

export interface MessageReceiveEvent {
  message: Message;
}

export interface MessageUpdateEvent {
  messageId: string;
  updates: Partial<Message>;
}

export interface MessageDeleteEvent {
  messageId: string;
  conversationId: string;
}

export interface MessageStreamEvent {
  streamingMessage: StreamingMessage;
}

export interface ConversationCreateEvent {
  conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>;
  tempId: string;
}

export interface ConversationUpdateEvent {
  conversationId: string;
  updates: Partial<Conversation>;
}

export interface ConversationDeleteEvent {
  conversationId: string;
}

export interface ConversationListEvent {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

// Tool Events
export interface ToolExecuteEvent {
  toolId: string;
  input: Record<string, unknown>;
  messageId: string;
  conversationId: string;
}

export interface ToolApproveEvent {
  toolExecutionId: string;
  approved: boolean;
  reason?: string;
}

export interface ToolResultEvent {
  toolExecution: ToolExecution;
}

export interface ToolListEvent {
  tools: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    isEnabled: boolean;
  }>;
}

export interface ToolApprovalRequestEvent {
  approvalRequest: ToolApprovalRequest;
}

// Status Events
export interface TypingEvent {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

export interface StatusUpdateEvent {
  status: 'online' | 'away' | 'busy' | 'offline';
  message?: string;
}

export interface UserJoinEvent {
  userId: string;
  conversationId: string;
  timestamp: Date;
}

export interface UserLeaveEvent {
  userId: string;
  conversationId: string;
  timestamp: Date;
}

// System Events
export interface SystemNotificationEvent {
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: string;
  }>;
  persistent?: boolean;
}

export interface SystemHealthEvent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    error?: string;
  }>;
  timestamp: Date;
}

export interface SystemConfigUpdateEvent {
  config: Record<string, unknown>;
  changedKeys: string[];
  timestamp: Date;
}

// WebSocket Protocol Types
export interface ClientToServerEvents {
  'message:send': (data: MessageSendEvent, callback: (response: { success: boolean; messageId?: string; error?: string }) => void) => void;
  'conversation:create': (data: ConversationCreateEvent, callback: (response: { success: boolean; conversationId?: string; error?: string }) => void) => void;
  'conversation:update': (data: ConversationUpdateEvent) => void;
  'conversation:delete': (data: ConversationDeleteEvent) => void;
  'conversation:list': (data: { page?: number; limit?: number }, callback: (response: ConversationListEvent) => void) => void;
  'tool:execute': (data: ToolExecuteEvent, callback: (response: { success: boolean; executionId?: string; error?: string }) => void) => void;
  'tool:approve': (data: ToolApproveEvent) => void;
  'tool:list': (callback: (response: ToolListEvent) => void) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'status:update': (data: StatusUpdateEvent) => void;
}

export interface ServerToClientEvents {
  'message:receive': (data: MessageReceiveEvent) => void;
  'message:update': (data: MessageUpdateEvent) => void;
  'message:delete': (data: MessageDeleteEvent) => void;
  'message:stream': (data: MessageStreamEvent) => void;
  'conversation:update': (data: ConversationUpdateEvent) => void;
  'conversation:delete': (data: ConversationDeleteEvent) => void;
  'tool:result': (data: ToolResultEvent) => void;
  'tool:approval_request': (data: ToolApprovalRequestEvent) => void;
  'typing:start': (data: TypingEvent) => void;
  'typing:stop': (data: TypingEvent) => void;
  'user:join': (data: UserJoinEvent) => void;
  'user:leave': (data: UserLeaveEvent) => void;
  'system:notification': (data: SystemNotificationEvent) => void;
  'system:health': (data: SystemHealthEvent) => void;
  'system:config_update': (data: SystemConfigUpdateEvent) => void;
  'error': (data: ErrorEvent) => void;
}

export interface InterServerEvents {
  'broadcast:message': (data: MessageReceiveEvent) => void;
  'broadcast:tool_result': (data: ToolResultEvent) => void;
  'broadcast:system_notification': (data: SystemNotificationEvent) => void;
}

export interface SocketData {
  userId: string;
  sessionId: string;
  conversationIds: string[];
  lastActivity: Date;
}