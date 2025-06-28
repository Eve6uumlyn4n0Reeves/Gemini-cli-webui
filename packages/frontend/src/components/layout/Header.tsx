import { Menu, Settings, User, LogOut, Bell, MessageSquare, Wrench, Shield, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuthStore } from '@/stores/useAuthStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { CONSTANTS, cn } from '@/lib/utils'

interface HeaderProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // 导航项配置
  const navigationItems = [
    {
      path: '/chat',
      label: '聊天',
      icon: MessageSquare,
      description: '与AI助手对话'
    },
    {
      path: '/tools',
      label: '工具',
      icon: Wrench,
      description: '工具管理和执行'
    },
    {
      path: '/memory',
      label: '记忆',
      icon: FileText,
      description: 'GEMINI.md 文件管理'
    }
  ]

  // 如果是管理员，添加管理员导航
  if (user?.role === 'admin') {
    navigationItems.push({
      path: '/admin',
      label: '管理',
      icon: Shield,
      description: '系统管理'
    })
  }

  const isActivePath = (path: string) => {
    if (path === '/chat') {
      return location.pathname === '/' || location.pathname.startsWith('/chat')
    }
    return location.pathname.startsWith(path)
  }

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          {/* Sidebar Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9"
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">切换侧边栏</span>
          </Button>

          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">G</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold">{CONSTANTS.APP_NAME}</h1>
              <p className="text-xs text-muted-foreground">v{CONSTANTS.APP_VERSION}</p>
            </div>
          </div>
        </div>

        {/* Center Section - Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(item.path)
            
            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2",
                  isActive && "bg-primary text-primary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            )
          })}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
            <span className="sr-only">通知</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatar} alt={user?.username} />
                  <AvatarFallback>
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.username || '用户'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* 移动端导航 */}
              <div className="md:hidden">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <DropdownMenuItem 
                      key={item.path} 
                      onClick={() => navigate(item.path)}
                      className={cn(
                        isActivePath(item.path) && "bg-accent"
                      )}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
              </div>
              
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="mr-2 h-4 w-4" />
                <span>个人资料</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>设置</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}