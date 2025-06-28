import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageItem } from './MessageItem'
import { TypingIndicator } from './TypingIndicator'
import { EmptyState } from './EmptyState'
import type { Message } from '@gemini-cli-webui/shared'

interface ChatMessagesProps {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
}

export function ChatMessages({ messages, isLoading, isStreaming }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  if (messages.length === 0 && !isLoading) {
    return <EmptyState />
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full">
      <div className="space-y-4 p-4 pb-8">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}
        
        {isStreaming && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}