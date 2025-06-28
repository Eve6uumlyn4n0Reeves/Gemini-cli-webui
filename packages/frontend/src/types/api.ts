// API Request Types
export interface CreateConversationRequest {
  title?: string
  metadata?: Record<string, unknown>
  settings?: {
    model?: string
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
    tools?: string[]
    mcpServers?: string[]
  }
}

export interface SendMessageRequest {
  conversationId: string
  content: string
  metadata?: Record<string, unknown>
}

export interface SearchMessagesRequest {
  query: string
  conversationId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  page?: number
}

export interface ConversationStats {
  totalConversations: number
  totalMessages: number
  activeConversations: number
  avgMessagesPerConversation: number
  lastActivity?: Date
}