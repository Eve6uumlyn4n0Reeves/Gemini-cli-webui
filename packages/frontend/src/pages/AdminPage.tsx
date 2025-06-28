import React, { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users,
  Server,
  Shield,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Globe,
  Package,
  Activity
} from 'lucide-react'
import { useToolStore } from '@/stores/useToolStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { MCPServer } from '@/services/toolApi'

interface MCPServerFormProps {
  server: MCPServer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (server: Omit<MCPServer, 'id' | 'tools' | 'healthStatus' | 'lastChecked'>) => void
}

function MCPServerForm({ server, open, onOpenChange, onSubmit }: MCPServerFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    version: '1.0.0',
    isEnabled: true,
    metadata: '{}'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        description: server.description,
        endpoint: server.endpoint,
        version: server.version,
        isEnabled: server.isEnabled,
        metadata: JSON.stringify(server.metadata || {}, null, 2)
      })
    } else {
      setFormData({
        name: '',
        description: '',
        endpoint: '',
        version: '1.0.0',
        isEnabled: true,
        metadata: '{}'
      })
    }
  }, [server, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let metadata: Record<string, unknown> = {}
    try {
      metadata = JSON.parse(formData.metadata)
    } catch (error) {
      // 处理JSON解析错误
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: formData.name,
        description: formData.description,
        endpoint: formData.endpoint,
        version: formData.version,
        isEnabled: formData.isEnabled,
        metadata
      })
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {server ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
          </DialogTitle>
          <DialogDescription>
            配置 MCP (Model Context Protocol) 服务器连接信息
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">服务器名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入服务器名称"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="version">版本</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint">服务器地址 *</Label>
            <Input
              id="endpoint"
              value={formData.endpoint}
              onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
              placeholder="http://localhost:3000/mcp 或 ws://localhost:3000/mcp"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="描述这个MCP服务器的功能..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata">元数据 (JSON)</Label>
            <Textarea
              id="metadata"
              value={formData.metadata}
              onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))}
              placeholder='{"key": "value"}'
              className="font-mono text-sm"
              rows={4}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={formData.isEnabled}
              onChange={(e) => setFormData(prev => ({ ...prev, isEnabled: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="isEnabled">启用服务器</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : (server ? '更新' : '添加')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminPage() {
  const { toast } = useToast()
  const { user } = useAuthStore()
  
  // Store状态
  const {
    mcpServers,
    mcpServersLoading,
    mcpServersError,
    toolStats,
    approvalStats,
    loadMCPServers,
    addMCPServer,
    updateMCPServer,
    deleteMCPServer,
    checkMCPServerHealth,
    loadToolStats,
    loadApprovalStats
  } = useToolStore()
  
  // 本地状态
  const [activeTab, setActiveTab] = useState('overview')
  const [mcpServerDialog, setMCPServerDialog] = useState<{
    server: MCPServer | null
    open: boolean
  }>({ server: null, open: false })
  const [isLoading, setIsLoading] = useState(false)

  // 权限检查
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast({
        title: "访问被拒绝",
        description: "只有管理员可以访问此页面",
        variant: "destructive"
      })
      return
    }

    // 初始加载数据
    const loadData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          loadMCPServers(),
          loadToolStats(),
          loadApprovalStats()
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
  }, [user, loadMCPServers, loadToolStats, loadApprovalStats, toast])

  // 如果不是管理员，返回空
  if (user?.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            您没有权限访问管理员页面。只有管理员可以访问此功能。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 处理MCP服务器操作
  const handleAddMCPServer = async (serverData: Omit<MCPServer, 'id' | 'tools' | 'healthStatus' | 'lastChecked'>) => {
    try {
      await addMCPServer(serverData)
      toast({
        title: "服务器添加成功",
        description: `MCP服务器 "${serverData.name}" 已成功添加`
      })
    } catch (error) {
      toast({
        title: "添加失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  const handleUpdateMCPServer = async (serverId: string, updates: Partial<MCPServer>) => {
    try {
      await updateMCPServer(serverId, updates)
      toast({
        title: "服务器更新成功",
        description: "MCP服务器配置已更新"
      })
    } catch (error) {
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  const handleDeleteMCPServer = async (serverId: string, serverName: string) => {
    if (!confirm(`确定要删除MCP服务器 "${serverName}" 吗？此操作不可撤销。`)) {
      return
    }

    try {
      await deleteMCPServer(serverId)
      toast({
        title: "服务器删除成功",
        description: `MCP服务器 "${serverName}" 已删除`
      })
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  const handleCheckHealth = async (serverId: string) => {
    try {
      await checkMCPServerHealth(serverId)
      toast({
        title: "健康检查完成",
        description: "服务器健康状态已更新"
      })
    } catch (error) {
      toast({
        title: "健康检查失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  const handleRefreshAll = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadMCPServers(),
        loadToolStats(),
        loadApprovalStats()
      ])
      toast({
        title: "数据刷新成功",
        description: "所有管理数据已更新到最新状态"
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统管理</h1>
          <p className="text-muted-foreground">
            管理系统设置、用户权限、MCP服务器和系统监控
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
        </div>
      </div>

      {/* 管理面板 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            系统概览
          </TabsTrigger>
          
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          
          <TabsTrigger value="mcp" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            MCP服务器
            {mcpServers.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {mcpServers.length}
              </Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            安全设置
          </TabsTrigger>
          
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            系统监控
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 系统状态卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  工具状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {toolStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>总工具数:</span>
                      <Badge>{toolStats.total}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>已启用:</span>
                      <Badge className="bg-green-100 text-green-800">{toolStats.enabled}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>已禁用:</span>
                      <Badge className="bg-red-100 text-red-800">{toolStats.disabled}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>今日执行:</span>
                      <Badge className="bg-blue-100 text-blue-800">{toolStats.executionStats.today}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  审批状态
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvalStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>待审批:</span>
                      <Badge className="bg-orange-100 text-orange-800">{approvalStats.pending}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>已批准:</span>
                      <Badge className="bg-green-100 text-green-800">{approvalStats.approved}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>已拒绝:</span>
                      <Badge className="bg-red-100 text-red-800">{approvalStats.rejected}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>通过率:</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {Math.round(approvalStats.approvalRate * 100)}%
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">加载中...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  MCP服务器
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>总服务器:</span>
                    <Badge>{mcpServers.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>健康:</span>
                    <Badge className="bg-green-100 text-green-800">
                      {mcpServers.filter(s => s.healthStatus === 'healthy').length}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>异常:</span>
                    <Badge className="bg-red-100 text-red-800">
                      {mcpServers.filter(s => s.healthStatus === 'unhealthy').length}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>未知:</span>
                    <Badge className="bg-gray-100 text-gray-800">
                      {mcpServers.filter(s => s.healthStatus === 'unknown').length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                用户管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2" />
                <p>用户管理功能开发中...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">MCP服务器管理</h2>
            <Button onClick={() => setMCPServerDialog({ server: null, open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              添加服务器
            </Button>
          </div>

          {mcpServersError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{mcpServersError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {mcpServersLoading && mcpServers.length === 0 ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p>加载MCP服务器...</p>
              </div>
            ) : mcpServers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Server className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">还没有配置MCP服务器</p>
                  <Button 
                    className="mt-4"
                    onClick={() => setMCPServerDialog({ server: null, open: true })}
                  >
                    添加第一个服务器
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {mcpServers.map((server) => (
                  <Card key={server.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {server.name}
                            <Badge 
                              variant={server.isEnabled ? 'default' : 'secondary'}
                              className={cn(
                                server.healthStatus === 'healthy' && 'bg-green-100 text-green-800',
                                server.healthStatus === 'unhealthy' && 'bg-red-100 text-red-800',
                                server.healthStatus === 'unknown' && 'bg-gray-100 text-gray-800'
                              )}
                            >
                              {server.healthStatus}
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {server.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCheckHealth(server.id)}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMCPServerDialog({ server, open: true })}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteMCPServer(server.id, server.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span className="font-medium">地址:</span>
                          <code className="text-xs bg-muted px-1 rounded">{server.endpoint}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span className="font-medium">工具数量:</span>
                          <Badge variant="outline">{server.tools.length}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          <span className="font-medium">版本:</span>
                          <code className="text-xs">{server.version}</code>
                        </div>
                        {server.lastChecked && (
                          <div className="text-xs text-muted-foreground">
                            最后检查: {new Date(server.lastChecked).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                安全设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2" />
                <p>安全设置功能开发中...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                系统监控
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p>系统监控功能开发中...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MCP服务器表单对话框 */}
      <MCPServerForm
        server={mcpServerDialog.server}
        open={mcpServerDialog.open}
        onOpenChange={(open) => setMCPServerDialog(prev => ({ ...prev, open }))}
        onSubmit={mcpServerDialog.server ? 
          (data) => handleUpdateMCPServer(mcpServerDialog.server!.id, data) :
          handleAddMCPServer
        }
      />
    </div>
  )
}