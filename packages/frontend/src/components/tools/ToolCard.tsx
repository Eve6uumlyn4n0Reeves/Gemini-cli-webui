import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Play, 
  Settings, 
  MoreVertical,
  Shield,
  Clock,
  Tag,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tool, ToolPermissionLevel } from '@/services/toolApi'

interface ToolCardProps {
  tool: Tool
  onExecute?: (tool: Tool) => void
  onConfigure?: (tool: Tool) => void
  onToggleEnabled?: (tool: Tool, enabled: boolean) => void
  onUpdatePermission?: (tool: Tool, permission: ToolPermissionLevel) => void
  onClick?: (tool: Tool) => void
  className?: string
  showActions?: boolean
  compact?: boolean
}

const permissionColors = {
  auto: 'bg-green-100 text-green-800 border-green-200',
  user_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  admin_approval: 'bg-red-100 text-red-800 border-red-200',
  denied: 'bg-gray-100 text-gray-800 border-gray-200'
}

const permissionIcons = {
  auto: CheckCircle,
  user_approval: AlertTriangle,
  admin_approval: Shield,
  denied: XCircle
}

const categoryColors = {
  filesystem: 'bg-blue-100 text-blue-800',
  network: 'bg-purple-100 text-purple-800',
  system: 'bg-orange-100 text-orange-800',
  development: 'bg-green-100 text-green-800',
  database: 'bg-indigo-100 text-indigo-800',
  mcp: 'bg-pink-100 text-pink-800',
  custom: 'bg-gray-100 text-gray-800'
}

export function ToolCard({
  tool,
  onExecute,
  onConfigure,
  onToggleEnabled,
  onUpdatePermission,
  onClick,
  className,
  showActions = true,
  compact = false
}: ToolCardProps) {
  const PermissionIcon = permissionIcons[tool.permissionLevel]
  
  const handleExecute = () => {
    if (tool.isEnabled && onExecute) {
      onExecute(tool)
    }
  }

  const handleToggleEnabled = () => {
    if (onToggleEnabled) {
      onToggleEnabled(tool, !tool.isEnabled)
    }
  }

  const handleUpdatePermission = (permission: ToolPermissionLevel) => {
    if (onUpdatePermission) {
      onUpdatePermission(tool, permission)
    }
  }

  return (
    <Card 
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        !tool.isEnabled && 'opacity-60',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={() => onClick?.(tool)}
    >
      <CardHeader className={cn('pb-3', compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className={cn(
                'truncate',
                compact ? 'text-sm' : 'text-base'
              )}>
                {tool.name}
              </CardTitle>
              
              {/* 工具状态指示器 */}
              <div className="flex items-center gap-1">
                {tool.isEnabled ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <Zap className="h-3 w-3 text-green-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>工具已启用</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <XCircle className="h-3 w-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>工具已禁用</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {tool.isSandboxed && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Shield className="h-3 w-3 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>沙盒环境执行</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            
            <CardDescription className={cn(
              'line-clamp-2',
              compact && 'text-xs'
            )}>
              {tool.description}
            </CardDescription>
          </div>

          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onConfigure?.(tool)}>
                  <Settings className="h-4 w-4 mr-2" />
                  配置
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleEnabled}>
                  {tool.isEnabled ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      禁用
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      启用
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleUpdatePermission('auto')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  自动执行
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePermission('user_approval')}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  用户审批
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePermission('admin_approval')}>
                  <Shield className="h-4 w-4 mr-2" />
                  管理员审批
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUpdatePermission('denied')}>
                  <XCircle className="h-4 w-4 mr-2" />
                  拒绝执行
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'pb-3')}>
        <div className="space-y-3">
          {/* 标签和权限 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={cn(categoryColors[tool.category], 'text-xs')}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tool.category}
              </Badge>
              
              {tool.source && (
                <Badge variant="outline" className="text-xs">
                  {tool.source}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-xs border',
                      permissionColors[tool.permissionLevel]
                    )}
                  >
                    <PermissionIcon className="h-3 w-3 mr-1" />
                    {tool.permissionLevel === 'auto' && '自动'}
                    {tool.permissionLevel === 'user_approval' && '用户审批'}
                    {tool.permissionLevel === 'admin_approval' && '管理员审批'}
                    {tool.permissionLevel === 'denied' && '拒绝'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>权限级别: {tool.permissionLevel}</p>
                </TooltipContent>
              </Tooltip>
              
              {tool.timeout > 0 && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {tool.timeout / 1000}s
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>超时时间: {tool.timeout / 1000} 秒</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* 参数信息 */}
          {!compact && tool.parameters.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">参数: </span>
              {tool.parameters.length} 个 
              {tool.parameters.some(p => p.required) && (
                <span className="text-red-500 ml-1">
                  ({tool.parameters.filter(p => p.required).length} 必需)
                </span>
              )}
            </div>
          )}

          {/* 执行按钮 */}
          {showActions && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={!tool.isEnabled || tool.permissionLevel === 'denied'}
                className="h-8"
              >
                <Play className="h-3 w-3 mr-1" />
                执行
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}