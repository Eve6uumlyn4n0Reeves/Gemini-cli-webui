export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'error';

export type MessageType = 'text' | 'tool_use' | 'tool_result' | 'image' | 'file';

// User type is imported from auth.ts

export interface MessageContent {
  type: MessageType;
  text?: string;
  imageUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'error';
  approvalRequired: boolean;
  executionTime?: number;
  error?: string;
}

export interface ChatToolResult {
  toolUseId: string;
  content: string | Record<string, unknown>;
  isError: boolean;
  executionTime: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: MessageContent[];
  toolUse?: ToolUse;
  toolResult?: ChatToolResult;
  status: MessageStatus;
  timestamp: Date;
  userId?: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  settings?: ConversationSettings;
}

export interface ConversationSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
  mcpServers?: string[];
}

export interface ChatSession {
  id: string;
  conversationId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  toolUseCount: number;
  isActive: boolean;
}

export interface StreamingMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  isComplete: boolean;
  timestamp: Date;
}