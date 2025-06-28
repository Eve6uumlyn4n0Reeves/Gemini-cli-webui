import { Bot } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Typing Animation */}
      <Card className="p-3 bg-muted max-w-[80%]">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-muted-foreground">AI 正在思考</span>
          <div className="flex space-x-1">
            <div className="h-1 w-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="h-1 w-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="h-1 w-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </Card>
    </div>
  )
}