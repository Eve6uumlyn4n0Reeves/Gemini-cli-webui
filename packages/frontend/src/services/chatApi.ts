import { apiClient, handlePaginatedResponse, ApiResponse, PaginatedResponse, handleApiResponse } from './apiClient'
import type { Conversation, Message } from '@gemini-cli-webui/shared'
import type {
  CreateConversationRequest,
  SendMessageRequest,
  SearchMessagesRequest,
  ConversationStats
} from '@/types/api'

export interface GetConversationsParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface GetMessagesParams {
  page?: number
  limit?: number
  before?: Date
  after?: Date
}

export const chatApi = {
  // Conversations
  async getConversations(params?: GetConversationsParams) {
    const response = await apiClient.get<PaginatedResponse<Conversation>>('/chat/conversations', params)
    const result = await handlePaginatedResponse(response)
    return {
      conversations: result.items || [],
      hasMore: result.pagination?.hasMore || false,
      total: result.pagination?.total || 0,
      page: result.pagination?.page || 1,
    }
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await apiClient.get<ApiResponse<Conversation>>(`/chat/conversations/${id}`)
    return handleApiResponse(response)
  },

  async createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const response = await apiClient.post<ApiResponse<Conversation>>('/chat/conversations', data)
    return handleApiResponse(response)
  },

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const response = await apiClient.put<ApiResponse<Conversation>>(`/chat/conversations/${id}`, updates)
    return handleApiResponse(response)
  },

  async deleteConversation(id: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${id}`)
  },

  async archiveConversation(id: string): Promise<Conversation> {
    const response = await apiClient.post<ApiResponse<Conversation>>(`/chat/conversations/${id}/archive`)
    return handleApiResponse(response)
  },

  async unarchiveConversation(id: string): Promise<Conversation> {
    const response = await apiClient.post<ApiResponse<Conversation>>(`/chat/conversations/${id}/unarchive`)
    return handleApiResponse(response)
  },

  // Messages
  async getMessages(conversationId: string, params?: GetMessagesParams) {
    const response = await apiClient.get<PaginatedResponse<Message>>(`/chat/conversations/${conversationId}/messages`, params)
    const result = await handlePaginatedResponse(response)
    return {
      messages: result.items || [],
      hasMore: result.pagination?.hasMore || false,
      total: result.pagination?.total || 0,
      page: result.pagination?.page || 1,
    }
  },

  async getMessage(conversationId: string, messageId: string): Promise<Message> {
    const response = await apiClient.get<ApiResponse<Message>>(`/chat/conversations/${conversationId}/messages/${messageId}`)
    return handleApiResponse(response)
  },

  async sendMessage(conversationId: string, data: SendMessageRequest): Promise<Message> {
    const response = await apiClient.post<ApiResponse<Message>>(`/chat/conversations/${conversationId}/messages`, data)
    return handleApiResponse(response)
  },

  async sendStreamingMessage(conversationId: string, data: SendMessageRequest): Promise<ReadableStream> {
    return apiClient.stream(`/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  },

  async updateMessage(conversationId: string, messageId: string, updates: Partial<Message>): Promise<Message> {
    const response = await apiClient.put<ApiResponse<Message>>(`/chat/conversations/${conversationId}/messages/${messageId}`, updates)
    return handleApiResponse(response)
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}/messages/${messageId}`)
  },

  // Search
  async searchMessages(params: SearchMessagesRequest) {
    const response = await apiClient.get<PaginatedResponse<Message>>('/chat/search', params)
    return handlePaginatedResponse(response)
  },

  async searchConversations(query: string, limit = 20) {
    const response = await apiClient.get<ApiResponse<Conversation[]>>('/chat/conversations/search', { query, limit })
    return handleApiResponse(response)
  },

  // Statistics
  async getConversationStats(conversationId?: string): Promise<ConversationStats> {
    const endpoint = conversationId 
      ? `/chat/conversations/${conversationId}/stats`
      : '/chat/stats'
    const response = await apiClient.get<ApiResponse<ConversationStats>>(endpoint)
    return handleApiResponse(response)
  },

  async getUserChatStats(): Promise<{
    totalConversations: number
    totalMessages: number
    averageMessagesPerConversation: number
    mostActiveDay: string
    recentActivity: Array<{
      date: string
      messageCount: number
    }>
  }> {
    const response = await apiClient.get<ApiResponse<any>>('/chat/user-stats')
    return handleApiResponse(response)
  },

  // Export/Import
  async exportConversation(conversationId: string, format: 'json' | 'markdown' | 'txt' = 'json'): Promise<Blob> {
    const response = await fetch(`${apiClient['baseURL']}/chat/conversations/${conversationId}/export?format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
    
    if (!response.ok) {
      throw new Error('导出失败')
    }
    
    return response.blob()
  },

  async importConversation(file: File): Promise<Conversation> {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.upload<Conversation>('/chat/conversations/import', formData)
  },

  // Bulk operations
  async bulkDeleteConversations(conversationIds: string[]): Promise<void> {
    return apiClient.post<void>('/chat/conversations/bulk-delete', { conversationIds })
  },

  async bulkArchiveConversations(conversationIds: string[]): Promise<void> {
    return apiClient.post<void>('/chat/conversations/bulk-archive', { conversationIds })
  },

  // Real-time features
  async markAsRead(conversationId: string): Promise<void> {
    return apiClient.post<void>(`/chat/conversations/${conversationId}/mark-read`)
  },

  async setTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
    return apiClient.post<void>(`/chat/conversations/${conversationId}/typing`, { isTyping })
  },
}