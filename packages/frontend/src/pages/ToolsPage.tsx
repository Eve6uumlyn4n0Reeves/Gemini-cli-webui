import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Plus,
  FileText
} from 'lucide-react'
import { ToolList } from '@/components/tools/ToolList'
import { ToolExecutionDialog } from '@/components/tools/ToolExecutionDialog'
import { ApprovalQueue } from '@/components/tools/ApprovalQueue'
import { useToolStore } from '@/stores/useToolStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { Tool } from '@/services/toolApi'

interface ToolStatsCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description?: string
}

function ToolStatsCard({ title, value, icon: Icon, color, description }: ToolStatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', color)} />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', color)}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function ToolsPage() {
  const { toast } = useToast()
  const { user } = useAuthStore()
  
  // Store状态
  const {
    toolStats,
    approvalStats,
    activeExecutions,
    loadToolStats,
    loadApprovalStats,
    loadActiveExecutions
  } = useToolStore()
  
  // 本地状态
  const [activeTab, setActiveTab] = useState('tools')
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 初始加载数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          loadToolStats(),
          loadApprovalStats(),
          loadActiveExecutions()
        ])
      } catch (error) {
        toast({
          title: "加载数据失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [loadToolStats, loadApprovalStats, loadActiveExecutions, toast])

  // 处理工具选择
  const handleToolSelect = (tool: Tool | any) => {
    setSelectedTool(tool)
  }

  // 处理工具执行
  const handleToolExecute = (tool: Tool) => {
    setSelectedTool(tool)
    setExecutionDialogOpen(true)
  }

  // 处理工具配置
  const handleToolConfigure = (_tool: Tool) => {
    // TODO: 实现工具配置对话框
    toast({
      title: "功能开发中",
      description: "工具配置功能正在开发中",
    })
  }

  // 刷新所有数据
  const handleRefreshAll = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadToolStats(),
        loadApprovalStats(),
        loadActiveExecutions()
      ])
      toast({
        title: "数据刷新成功",
        description: "所有数据已更新到最新状态"
      })
    } catch (error) {
      toast({
        title: "刷新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isAdmin = user?.role === 'admin'
  const canApprove = user?.role === 'admin' || user?.role === 'user'

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">工具管理</h1>
          <p className="text-muted-foreground">
            管理和执行系统工具，查看执行历史和审批流程
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            刷新数据
          </Button>
          
          {isAdmin && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加工具
            </Button>
          )}
        </div>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ToolStatsCard
          title="工具总数"
          value={toolStats?.total || 0}
          icon={Package}
          color="text-blue-600"
          description="系统中所有可用工具"
        />
        
        <ToolStatsCard
          title="活动执行"
          value={activeExecutions.length}
          icon={Clock}
          color="text-orange-600"
          description="正在执行中的工具"
        />
        
        <ToolStatsCard
          title="待审批"
          value={approvalStats?.pending || 0}
          icon={AlertTriangle}
          color="text-yellow-600"
          description="等待审批的执行请求"
        />
        
        <ToolStatsCard
          title="今日执行"
          value={toolStats?.executionStats.today || 0}
          icon={CheckCircle}
          color="text-green-600"
          description="今天已完成的执行次数"
        />
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            工具列表
          </TabsTrigger>
          
          <TabsTrigger value="executions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            执行历史
            {activeExecutions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeExecutions.length}
              </Badge>
            )}
          </TabsTrigger>
          
          {canApprove && (
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              审批队列
              {approvalStats?.pending && approvalStats.pending > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {approvalStats.pending}
                </Badge>
              )}
            </TabsTrigger>
          )}
          
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            统计分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                可用工具
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ToolList
                onToolSelect={handleToolSelect}
                onToolExecute={handleToolExecute}
                onToolConfigure={handleToolConfigure}
                showStats={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                执行历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO: 实现执行历史组件 */}
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p>执行历史组件开发中...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canApprove && (
          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  审批队列
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalQueue showStats={false} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 工具使用统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  工具使用统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                {toolStats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">已启用工具:</span>
                        <span className="ml-2 text-green-600">{toolStats.enabled}</span>
                      </div>
                      <div>
                        <span className="font-medium">已禁用工具:</span>
                        <span className="ml-2 text-red-600">{toolStats.disabled}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">按类别分布:</h4>
                      {Object.entries(toolStats.byCategory).map(([category, count]) => (
                        <div key={category} className="flex justify-between items-center">
                          <span className="capitalize">{category}:</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>加载统计数据...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 审批统计 */}
            {canApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    审批统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {approvalStats ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">通过率:</span>
                          <span className="ml-2 text-green-600">
                            {Math.round(approvalStats.approvalRate * 100)}%
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">平均时间:</span>
                          <span className="ml-2 text-blue-600">
                            {Math.round(approvalStats.avgApprovalTime)}分钟
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span>已批准:</span>
                          <Badge className="bg-green-100 text-green-800">
                            {approvalStats.approved}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>已拒绝:</span>
                          <Badge className="bg-red-100 text-red-800">
                            {approvalStats.rejected}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>已过期:</span>
                          <Badge className="bg-gray-100 text-gray-800">
                            {approvalStats.expired}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>加载审批统计...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 执行趋势 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  执行趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                {toolStats ? (
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {toolStats.executionStats.today}
                      </div>
                      <div className="text-sm text-muted-foreground">今日</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {toolStats.executionStats.thisWeek}
                      </div>
                      <div className="text-sm text-muted-foreground">本周</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {toolStats.executionStats.thisMonth}
                      </div>
                      <div className="text-sm text-muted-foreground">本月</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">
                        {toolStats.executionStats.total}
                      </div>
                      <div className="text-sm text-muted-foreground">总计</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>加载执行统计...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 工具执行对话框 */}
      <ToolExecutionDialog
        tool={selectedTool}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
      />
    </div>
  )
}