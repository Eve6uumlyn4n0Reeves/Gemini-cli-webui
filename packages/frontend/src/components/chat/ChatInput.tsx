import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/useChatStore'
import { useToast } from '@/hooks/useToast'

interface ChatInputProps {
  conversationId?: string
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ 
  conversationId, 
  disabled = false,
  placeholder = '输入您的消息...' 
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { sendMessage, isStreaming } = useChatStore()
  const { toast } = useToast()

  const isDisabled = disabled || isStreaming
  const canSend = message.trim().length > 0 && !isDisabled

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 200) // Max height: 200px
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustTextareaHeight()
  }

  const handleSubmit = async () => {
    if (!canSend) return

    const messageToSend = message.trim()
    setMessage('')
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await sendMessage(messageToSend, conversationId)
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: '发送失败',
        description: '消息发送失败，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleVoiceToggle = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false)
      toast({
        title: '语音输入',
        description: '语音输入功能将在后续版本中提供',
      })
    } else {
      // Start recording
      setIsRecording(true)
      toast({
        title: '语音输入',
        description: '语音输入功能将在后续版本中提供',
      })
    }
  }

  const handleAttachment = () => {
    toast({
      title: '文件上传',
      description: '文件上传功能将在后续版本中提供',
    })
  }

  const handleStopGeneration = () => {
    // TODO: Implement stop generation
    toast({
      title: '停止生成',
      description: '已停止 AI 响应生成',
    })
  }

  return (
    <div className="relative">
      <div className="flex items-end gap-2 p-4 bg-background border border-border rounded-lg shadow-sm">
        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAttachment}
          disabled={isDisabled}
          className="flex-shrink-0"
        >
          <Paperclip className="h-4 w-4" />
          <span className="sr-only">添加附件</span>
        </Button>

        {/* Message Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className={cn(
              'min-h-[40px] resize-none border-0 shadow-none focus-visible:ring-0 p-0',
              'placeholder:text-muted-foreground'
            )}
            style={{ height: 'auto' }}
          />
        </div>

        {/* Voice Input Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleVoiceToggle}
          disabled={isDisabled}
          className={cn(
            'flex-shrink-0',
            isRecording && 'text-red-500 bg-red-50 dark:bg-red-950'
          )}
        >
          {isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span className="sr-only">
            {isRecording ? '停止录音' : '语音输入'}
          </span>
        </Button>

        {/* Send/Stop Button */}
        {isStreaming ? (
          <Button
            variant="outline"
            size="icon"
            onClick={handleStopGeneration}
            className="flex-shrink-0"
          >
            <Square className="h-4 w-4" />
            <span className="sr-only">停止生成</span>
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSend}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">发送消息</span>
          </Button>
        )}
      </div>

      {/* Hints */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        <span>按 Enter 发送，Shift + Enter 换行</span>
        {isStreaming && (
          <span className="ml-4 text-orange-500">● AI 正在回复中...</span>
        )}
      </div>
    </div>
  )
}