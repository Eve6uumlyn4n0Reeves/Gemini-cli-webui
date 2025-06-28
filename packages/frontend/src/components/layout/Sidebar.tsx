import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  MessageSquare, 
  Plus, 
  Search, 
  MoreHorizontal,
  Edit3,
  Trash2,
  Archive
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { useChatStore } from '@/stores/useChatStore'
import { formatRelativeTime } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  
  const { 
    conversations, 
    currentConversationId,
    createNewConversation,
    deleteConversation,
    loadConversations,
    setCurrentConversation
  } = useChatStore()

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    const lastMessage = conv.messages[conv.messages.length - 1]
    const lastMessageText = lastMessage?.content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join(' ')
      .toLowerCase()
    
    return conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lastMessageText && lastMessageText.includes(searchQuery.toLowerCase()))
  })

  const handleNewChat = async () => {
    const newConv = await createNewConversation()
    if (newConv) {
      navigate(`/chat/${newConv.id}`)
    }
  }

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversation(conversationId)
    navigate(`/chat/${conversationId}`)
  }

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这个对话吗？此操作无法撤销。')) {
      await deleteConversation(conversationId)
      if (currentConversationId === conversationId) {
        navigate('/')
      }
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          'fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 transform border-r border-border bg-background transition-transform duration-300 ease-in-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* New Chat Button */}
          <div className="p-4">
            <Button 
              onClick={handleNewChat}
              className="w-full justify-start"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建对话
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索对话..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Separator />

          {/* Conversations List */}
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-1 p-2">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchQuery ? '没有找到匹配的对话' : '暂无对话'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      'group relative flex cursor-pointer items-center justify-between rounded-lg p-3 text-sm transition-colors hover:bg-accent',
                      currentConversationId === conversation.id && 'bg-accent'
                    )}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <p className="truncate font-medium">
                        {conversation.title || '新对话'}
                      </p>
                      {(() => {
                        const lastMessage = conversation.messages[conversation.messages.length - 1]
                        const lastMessageText = lastMessage?.content
                          .filter(c => c.type === 'text' && c.text)
                          .map(c => c.text)
                          .join(' ')
                        
                        return lastMessageText ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {lastMessageText}
                          </p>
                        ) : null
                      })()}
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(conversation.updatedAt)}
                      </p>
                    </div>

                    {/* Actions Menu */}
                    <div className="opacity-0 group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">更多操作</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit3 className="mr-2 h-4 w-4" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Archive className="mr-2 h-4 w-4" />
                            归档
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => handleDeleteConversation(conversation.id, e)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              共 {conversations.length} 个对话
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}