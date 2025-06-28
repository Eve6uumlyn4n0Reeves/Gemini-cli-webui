import { useState } from 'react'
import { User, Bot, Copy, Check, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MarkdownRenderer } from './MarkdownRenderer'
import { formatRelativeTime, cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import type { Message } from '@gemini-cli-webui/shared'

interface MessageItemProps {
  message: Message
  isLast?: boolean
}

export function MessageItem({ message }: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const handleCopy = async () => {
    try {
      // 将 MessageContent 数组转换为纯文本
      const textContent = message.content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text)
        .join('\n')
      
      await navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      toast({
        title: '已复制',
        description: '消息内容已复制到剪贴板',
      })
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制消息内容',
        variant: 'destructive',
      })
    }
  }

  const handleEdit = () => {
    // TODO: Implement message editing
    toast({
      title: '编辑消息',
      description: '消息编辑功能将在后续版本中提供',
    })
  }

  const handleDelete = () => {
    // TODO: Implement message deletion
    if (confirm('确定要删除这条消息吗？')) {
      toast({
        title: '删除消息',
        description: '消息删除功能将在后续版本中提供',
        variant: 'destructive',
      })
    }
  }

  return (
    <div 
      className={cn(
        'flex gap-3 group',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="h-8 w-8">
          {isUser ? (
            <>
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </>
          ) : (
            <>
              <AvatarImage src="" alt="Assistant" />
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </>
          )}
        </Avatar>
      </div>

      {/* Message Content */}
      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        {/* Message Bubble */}
        <Card 
          className={cn(
            'p-3 max-w-[80%] relative',
            isUser 
              ? 'bg-primary text-primary-foreground ml-auto' 
              : 'bg-muted',
            'group-hover:shadow-sm transition-shadow'
          )}
        >
          {/* Message Content */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {message.content.map((content, index) => {
              if (content.type === 'text' && content.text) {
                return isAssistant ? (
                  <MarkdownRenderer key={index} content={content.text} />
                ) : (
                  <div key={index} className="whitespace-pre-wrap break-words">
                    {content.text}
                  </div>
                )
              }
              
              if (content.type === 'image' && content.imageUrl) {
                return (
                  <img
                    key={index}
                    src={content.imageUrl}
                    alt="附件图片"
                    className="max-w-full h-auto rounded"
                  />
                )
              }
              
              if (content.type === 'file' && content.fileName) {
                return (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <span className="text-sm">📎 {content.fileName}</span>
                    {content.fileSize && (
                      <span className="text-xs text-muted-foreground">
                        ({(content.fileSize / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </div>
                )
              }
              
              return null
            })}
          </div>

          {/* Actions */}
          <div 
            className={cn(
              'absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity',
              isUser ? 'left-2' : 'right-2'
            )}
          >
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-background/20"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-background/20"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isUser ? 'start' : 'end'}>
                  {isUser && (
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </Card>

        {/* Metadata */}
        <div 
          className={cn(
            'text-xs text-muted-foreground px-1',
            isUser && 'text-right'
          )}
        >
          {formatRelativeTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}