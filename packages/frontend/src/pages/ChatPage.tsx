import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { ChatMessages } from '@/components/chat/ChatMessages'
import { ChatInput } from '@/components/chat/ChatInput'
import { useChatStore } from '@/stores/useChatStore'

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { 
    currentConversationId, 
    currentMessages, 
    isLoading, 
    isStreaming,
    setCurrentConversation,
    clearCurrentConversation
  } = useChatStore()

  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      setCurrentConversation(conversationId)
    } else if (!conversationId && currentConversationId) {
      clearCurrentConversation()
    }
  }, [conversationId, currentConversationId, setCurrentConversation, clearCurrentConversation])

  // Empty state when no conversation is selected
  if (!conversationId && !currentConversationId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">
                欢迎使用 Gemini CLI WebUI
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                选择一个对话开始聊天，或创建一个新对话。您可以与 AI 助手进行自然语言交流，执行各种任务和获取帮助。
              </p>
            </div>
          </div>
        </div>
        
        {/* Input at bottom even in empty state */}
        <div className="border-t bg-background p-4">
          <div className="max-w-4xl mx-auto">
            <ChatInput />
          </div>
        </div>
      </div>
    )
  }

  // Main chat interface
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ChatMessages 
          messages={currentMessages}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput 
            conversationId={conversationId || currentConversationId || undefined}
            disabled={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}