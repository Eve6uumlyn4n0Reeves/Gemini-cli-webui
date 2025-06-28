import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Grid3X3, 
  List,
  MoreVertical,
  Settings,
  BarChart3,
  Package
} from 'lucide-react'
import { ToolCard } from './ToolCard'
import { useToolStore } from '@/stores/useToolStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { Tool, ToolCategory, ToolPermissionLevel } from '@/services/toolApi'

interface ToolListProps {
  onToolSelect?: (tool: Tool) => void
  onToolExecute?: (tool: Tool) => void
  onToolConfigure?: (tool: Tool) => void
  className?: string
  showStats?: boolean
  compact?: boolean
}

const CATEGORIES: ToolCategory[] = [
  'filesystem',
  'network', 
  'system',
  'development',
  'database',
  'mcp',
  'custom'
]

const PERMISSION_LEVELS: ToolPermissionLevel[] = [
  'auto',
  'user_approval',
  'admin_approval', 
  'denied'
]

export function ToolList({
  onToolSelect,
  onToolExecute,
  onToolConfigure,
  className,
  showStats = true,
  compact = false
}: ToolListProps) {
  const { toast } = useToast()
  
  // Store状态
  const {
    tools,
    toolsLoading,
    toolsError,
    toolStats,
    // toolsFilter,
    toolsPagination,
    loadTools,
    searchTools,
    setToolsFilter,
    clearToolsFilter,
    updateToolPermission,
    toggleTool,
    loadToolStats
  } = useToolStore()
  
  // 本地状态
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCategories, setSelectedCategories] = useState<Set<ToolCategory>>(new Set())
  const [selectedPermissions, setSelectedPermissions] = useState<Set<ToolPermissionLevel>>(new Set())
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

  // 初始加载
  useEffect(() => {
    loadTools()
    if (showStats) {
      loadToolStats()
    }
  }, [loadTools, loadToolStats, showStats])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchTools(searchQuery.trim(), {
          category: selectedCategories.size === 1 ? Array.from(selectedCategories)[0] : undefined,
          enabled: enabledFilter === 'all' ? undefined : enabledFilter === 'enabled'
        })
      } else {
        // 应用过滤条件
        const filter = {
          ...(selectedCategories.size > 0 && { categories: Array.from(selectedCategories) }),
          ...(enabledFilter !== 'all' && { enabled: enabledFilter === 'enabled' })
        }
        setToolsFilter(filter)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategories, enabledFilter, searchTools, setToolsFilter])

  // 过滤工具
  const filteredTools = useMemo(() => {
    let filtered = tools

    // 按权限过滤
    if (selectedPermissions.size > 0) {
      filtered = filtered.filter(tool => selectedPermissions.has(tool.permissionLevel))
    }

    return filtered
  }, [tools, selectedPermissions])

  // 处理工具执行
  const handleToolExecute = (tool: Tool) => {
    if (tool.permissionLevel === 'denied') {
      toast({
        title: "工具执行被拒绝",
        description: `工具 "${tool.name}" 的执行权限被设置为拒绝`,
        variant: "destructive"
      })
      return
    }

    if (!tool.isEnabled) {
      toast({
        title: "工具未启用",
        description: `工具 "${tool.name}" 当前处于禁用状态`,
        variant: "destructive"
      })
      return
    }

    onToolExecute?.(tool)
  }

  // 处理工具权限更新
  const handleUpdatePermission = async (tool: Tool, permission: ToolPermissionLevel) => {
    try {
      await updateToolPermission(tool.id, permission)
      toast({
        title: "权限更新成功",
        description: `工具 "${tool.name}" 的权限已更新为 ${permission}`
      })
    } catch (error) {
      toast({
        title: "权限更新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 处理工具启用/禁用
  const handleToggleEnabled = async (tool: Tool, enabled: boolean) => {
    try {
      await toggleTool(tool.id, enabled)
      toast({
        title: enabled ? "工具已启用" : "工具已禁用",
        description: `工具 "${tool.name}" 已${enabled ? '启用' : '禁用'}`
      })
    } catch (error) {
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 处理类别过滤切换
  const handleCategoryToggle = (category: ToolCategory) => {
    const newSelected = new Set(selectedCategories)
    if (newSelected.has(category)) {
      newSelected.delete(category)
    } else {
      newSelected.add(category)
    }
    setSelectedCategories(newSelected)
  }

  // 处理权限过滤切换
  const handlePermissionToggle = (permission: ToolPermissionLevel) => {
    const newSelected = new Set(selectedPermissions)
    if (newSelected.has(permission)) {
      newSelected.delete(permission)
    } else {
      newSelected.add(permission)
    }
    setSelectedPermissions(newSelected)
  }

  // 清除所有过滤条件
  const handleClearFilters = () => {
    setSearchQuery('')
    setSelectedCategories(new Set())
    setSelectedPermissions(new Set())
    setEnabledFilter('all')
    clearToolsFilter()
  }

  // 刷新数据
  const handleRefresh = () => {
    loadTools(1, true)
    if (showStats) {
      loadToolStats()
    }
  }

  const hasActiveFilters = searchQuery || 
    selectedCategories.size > 0 || 
    selectedPermissions.size > 0 || 
    enabledFilter !== 'all'

  return (
    <div className={cn('space-y-4', className)}>
      {/* 统计信息 */}
      {showStats && toolStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">总工具数</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{toolStats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">已启用</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">{toolStats.enabled}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">今日执行</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">{toolStats.executionStats.today}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">总执行次数</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-purple-600">{toolStats.executionStats.total}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* 搜索 */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索工具..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 状态过滤 */}
          <Select value={enabledFilter} onValueChange={(value: any) => setEnabledFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="enabled">已启用</SelectItem>
              <SelectItem value="disabled">已禁用</SelectItem>
            </SelectContent>
          </Select>

          {/* 过滤菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                过滤
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                    {[
                      ...selectedCategories,
                      ...selectedPermissions
                    ].length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>按类别过滤</DropdownMenuLabel>
              {CATEGORIES.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.has(category)}
                  onCheckedChange={() => handleCategoryToggle(category)}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>按权限过滤</DropdownMenuLabel>
              {PERMISSION_LEVELS.map((permission) => (
                <DropdownMenuCheckboxItem
                  key={permission}
                  checked={selectedPermissions.has(permission)}
                  onCheckedChange={() => handlePermissionToggle(permission)}
                >
                  {permission}
                </DropdownMenuCheckboxItem>
              ))}
              {hasActiveFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleClearFilters}>
                    清除过滤条件
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {/* 视图切换 */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* 刷新按钮 */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={toolsLoading}
          >
            <RefreshCw className={cn('h-4 w-4', toolsLoading && 'animate-spin')} />
          </Button>

          {/* 更多操作 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToolConfigure?.({} as Tool)}>
                <Settings className="h-4 w-4 mr-2" />
                全局设置
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BarChart3 className="h-4 w-4 mr-2" />
                统计报告
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Package className="h-4 w-4 mr-2" />
                导入工具
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 活动过滤器显示 */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">活动过滤器:</span>
          {selectedCategories.size > 0 && (
            <Badge variant="secondary">
              类别: {Array.from(selectedCategories).join(', ')}
            </Badge>
          )}
          {selectedPermissions.size > 0 && (
            <Badge variant="secondary">
              权限: {Array.from(selectedPermissions).join(', ')}
            </Badge>
          )}
          {enabledFilter !== 'all' && (
            <Badge variant="secondary">
              状态: {enabledFilter === 'enabled' ? '已启用' : '已禁用'}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            清除全部
          </Button>
        </div>
      )}

      {/* 错误显示 */}
      {toolsError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <p className="text-red-600 text-sm">{toolsError}</p>
          </CardContent>
        </Card>
      )}

      {/* 工具列表 */}
      <ScrollArea className="h-[600px]">
        {toolsLoading && filteredTools.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>加载工具列表...</span>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Package className="h-8 w-8 mr-2" />
            <span>没有找到工具</span>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-2'
          )}>
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onExecute={handleToolExecute}
                onConfigure={onToolConfigure}
                onToggleEnabled={handleToggleEnabled}
                onUpdatePermission={handleUpdatePermission}
                onClick={onToolSelect}
                compact={compact || viewMode === 'list'}
                className={cn(
                  viewMode === 'list' && 'hover:bg-muted/50'
                )}
              />
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {toolsPagination.hasMore && filteredTools.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              onClick={() => loadTools(toolsPagination.page + 1)}
              disabled={toolsLoading}
            >
              {toolsLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                '加载更多'
              )}
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}