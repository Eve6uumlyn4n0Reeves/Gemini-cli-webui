import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { chatApi } from '@/services/chatApi'
import type { Conversation, Message } from '@gemini-cli-webui/shared'
import type { CreateConversationRequest, SendMessageRequest } from '@/types/api'

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  currentMessages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  
  // Pagination
  conversationsPage: number
  conversationsHasMore: boolean
  messagesPage: number
  messagesHasMore: boolean
}

interface ChatActions {
  // Conversations
  loadConversations: (page?: number) => Promise<void>
  createNewConversation: (title?: string) => Promise<Conversation | null>
  deleteConversation: (id: string) => Promise<void>
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>
  setCurrentConversation: (id: string) => void
  clearCurrentConversation: () => void
  
  // Messages
  loadMessages: (conversationId: string, page?: number) => Promise<void>
  sendMessage: (content: string, conversationId?: string) => Promise<void>
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  
  // Streaming
  startStreaming: () => void
  stopStreaming: () => void
  appendToLastMessage: (content: string) => void
  
  // Utils
  clearError: () => void
  reset: () => void
}

const initialState: ChatState = {
  conversations: [],
  currentConversationId: null,
  currentMessages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  conversationsPage: 1,
  conversationsHasMore: true,
  messagesPage: 1,
  messagesHasMore: true,
}

export const useChatStore = create<ChatState & ChatActions>()(
  immer((set, get) => ({
    ...initialState,

    // Conversations Management
    loadConversations: async (page = 1) => {
      if (get().isLoading) return
      
      set((state) => {
        state.isLoading = true
        state.error = null
        if (page === 1) {
          state.conversations = []
        }
      })

      try {
        const response = await chatApi.getConversations({
          page,
          limit: 20,
        })

        set((state) => {
          if (page === 1) {
            state.conversations = response.conversations
          } else {
            state.conversations.push(...response.conversations)
          }
          state.conversationsPage = page
          state.conversationsHasMore = response.hasMore
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '加载对话失败'
          state.isLoading = false
        })
      }
    },

    createNewConversation: async (title) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })

      try {
        const request: CreateConversationRequest = {
          title: title || `新对话 ${new Date().toLocaleString()}`
        }
        
        const conversation = await chatApi.createConversation(request)

        set((state) => {
          state.conversations.unshift(conversation)
          state.currentConversationId = conversation.id
          state.currentMessages = []
          state.isLoading = false
        })

        return conversation
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '创建对话失败'
          state.isLoading = false
        })
        return null
      }
    },

    deleteConversation: async (id) => {
      try {
        await chatApi.deleteConversation(id)

        set((state) => {
          state.conversations = state.conversations.filter((conv: any) => conv.id !== id)
          if (state.currentConversationId === id) {
            state.currentConversationId = null
            state.currentMessages = []
          }
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '删除对话失败'
        })
      }
    },

    updateConversation: async (id, updates) => {
      try {
        const updatedConversation = await chatApi.updateConversation(id, updates)

        set((state) => {
          const index = state.conversations.findIndex((conv: any) => conv.id === id)
          if (index !== -1) {
            state.conversations[index] = updatedConversation
          }
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '更新对话失败'
        })
      }
    },

    setCurrentConversation: (id) => {
      const { loadMessages } = get()
      
      set((state) => {
        state.currentConversationId = id
        state.currentMessages = []
        state.messagesPage = 1
        state.messagesHasMore = true
      })

      loadMessages(id)
    },

    clearCurrentConversation: () => {
      set((state) => {
        state.currentConversationId = null
        state.currentMessages = []
      })
    },

    // Messages Management
    loadMessages: async (conversationId, page = 1) => {
      if (get().isLoading) return

      set((state) => {
        state.isLoading = true
        state.error = null
        if (page === 1) {
          state.currentMessages = []
        }
      })

      try {
        const response = await chatApi.getMessages(conversationId, {
          page,
          limit: 50,
        })

        set((state) => {
          if (page === 1) {
            state.currentMessages = response.messages
          } else {
            state.currentMessages.unshift(...response.messages)
          }
          state.messagesPage = page
          state.messagesHasMore = response.hasMore
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '加载消息失败'
          state.isLoading = false
        })
      }
    },

    sendMessage: async (content, conversationId) => {
      const { currentConversationId, createNewConversation } = get()
      
      let targetConversationId = conversationId || currentConversationId

      // Create new conversation if none exists
      if (!targetConversationId) {
        const newConv = await createNewConversation()
        if (!newConv) return
        targetConversationId = newConv.id
      }

      // Add user message immediately
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId: targetConversationId,
        role: 'user',
        content: [{ type: 'text', text: content }],
        timestamp: new Date(),
        status: 'sending' as const
      }

      set((state) => {
        state.currentMessages.push(userMessage)
        state.isStreaming = true
        state.error = null
      })

      try {
        const request: SendMessageRequest = {
          conversationId: targetConversationId,
          content
        }

        await chatApi.sendMessage(targetConversationId, request)
        
        // The actual response will be handled by WebSocket streaming
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : '发送消息失败'
          state.isStreaming = false
          
          // Remove the temporary user message on error
          state.currentMessages = state.currentMessages.filter(
            (msg: any) => msg.id !== userMessage.id
          )
        })
      }
    },

    addMessage: (message) => {
      set((state) => {
        state.currentMessages.push(message)
      })
    },

    updateMessage: (messageId, updates) => {
      set((state) => {
        const index = state.currentMessages.findIndex((msg: any) => msg.id === messageId)
        if (index !== -1) {
          Object.assign(state.currentMessages[index], updates)
        }
      })
    },

    // Streaming
    startStreaming: () => {
      set((state) => {
        state.isStreaming = true
      })
    },

    stopStreaming: () => {
      set((state) => {
        state.isStreaming = false
      })
    },

    appendToLastMessage: (content) => {
      set((state) => {
        const lastMessage = state.currentMessages[state.currentMessages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          // 查找最后一个文本内容并追加
          const lastTextContent = lastMessage.content.find(c => c.type === 'text')
          if (lastTextContent && lastTextContent.text) {
            lastTextContent.text += content
          } else {
            // 如果没有文本内容，创建一个新的
            lastMessage.content.push({ type: 'text', text: content })
          }
        } else {
          // Create new assistant message
          const assistantMessage: Message = {
            id: `stream-${Date.now()}`,
            conversationId: state.currentConversationId!,
            role: 'assistant',
            content: [{ type: 'text', text: content }],
            timestamp: new Date(),
            status: 'sent' as const
          }
          state.currentMessages.push(assistantMessage)
        }
      })
    },

    // Utils
    clearError: () => {
      set((state) => {
        state.error = null
      })
    },

    reset: () => {
      set(() => ({ ...initialState }))
    },
  }))
)