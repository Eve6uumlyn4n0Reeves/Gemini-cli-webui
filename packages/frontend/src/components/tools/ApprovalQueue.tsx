import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  MoreVertical,
  Eye,
  Users,
  Search,
  Calendar
} from 'lucide-react'
import { useToolStore } from '@/stores/useToolStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import type { ToolApprovalRequest } from '@/services/toolApi'

interface ApprovalQueueProps {
  className?: string
  showStats?: boolean
  compact?: boolean
}

interface ApprovalItemProps {
  approval: ToolApprovalRequest
  onApprove: (approval: ToolApprovalRequest, reason?: string) => void
  onReject: (approval: ToolApprovalRequest, reason: string) => void
  onViewDetails: (approval: ToolApprovalRequest) => void
  compact?: boolean
}

interface ApprovalDialogProps {
  approval: ToolApprovalRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  action: 'approve' | 'reject' | null
  onConfirm: (reason?: string) => void
}

const riskColors = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200'
}

const riskIcons = {
  low: CheckCircle,
  medium: AlertTriangle,
  high: XCircle
}

function ApprovalDialog({ approval, open, onOpenChange, action, onConfirm }: ApprovalDialogProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (action === 'reject' && !reason.trim()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm(reason.trim() || undefined)
      setReason('')
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setReason('')
    }
  }, [open])

  if (!approval || !action) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                批准工具执行
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                拒绝工具执行
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            工具: {approval.toolName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 工具信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">执行详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">风险级别:</span>
                    <Badge 
                      variant="outline" 
                      className={cn('ml-2', riskColors[approval.riskLevel])}
                    >
                      {approval.riskLevel}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">请求时间:</span>
                    <span className="ml-2">{new Date(approval.requestedAt).toLocaleString()}</span>
                  </div>
                </div>
                
                {approval.reason && (
                  <div className="mt-3">
                    <span className="font-medium">请求原因:</span>
                    <p className="mt-1 text-muted-foreground">{approval.reason}</p>
                  </div>
                )}
              </div>
              
              {/* 输入参数 */}
              <div className="mt-4">
                <Label className="text-sm font-medium">输入参数:</Label>
                <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(approval.input, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* 原因输入 */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              {action === 'approve' ? '批准原因 (可选)' : '拒绝原因 (必填)'}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === 'approve' 
                  ? '请输入批准原因...'
                  : '请说明拒绝的原因...'
              }
              required={action === 'reject'}
              rows={3}
            />
            {action === 'reject' && !reason.trim() && (
              <p className="text-xs text-red-500">拒绝时必须提供原因</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            variant={action === 'approve' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={isSubmitting || (action === 'reject' && !reason.trim())}
          >
            {isSubmitting ? '处理中...' : (action === 'approve' ? '批准' : '拒绝')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApprovalItem({ approval, onApprove, onReject, onViewDetails, compact }: ApprovalItemProps) {
  const RiskIcon = riskIcons[approval.riskLevel]
  const isExpired = new Date(approval.requiredBy) < new Date()

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      isExpired && 'opacity-60 border-red-200',
      compact && 'p-3'
    )}>
      <CardHeader className={cn('pb-3', compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className={cn(
                'truncate',
                compact ? 'text-sm' : 'text-base'
              )}>
                {approval.toolName}
              </CardTitle>
              
              <Badge 
                variant="outline" 
                className={cn(riskColors[approval.riskLevel])}
              >
                <RiskIcon className="h-3 w-3 mr-1" />
                {approval.riskLevel}
              </Badge>
              
              {isExpired && (
                <Badge variant="destructive" className="text-xs">
                  已过期
                </Badge>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-4">
                <span>请求者: {approval.requestedBy}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(approval.requestedAt).toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                需要在 {new Date(approval.requiredBy).toLocaleString()} 前处理
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(approval)}>
                <Eye className="h-4 w-4 mr-2" />
                查看详情
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onApprove(approval)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                批准
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReject(approval, '')}>
                <XCircle className="h-4 w-4 mr-2" />
                拒绝
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'pb-3')}>
        <div className="space-y-3">
          {/* 原因 */}
          {approval.reason && (
            <div className="text-sm">
              <span className="font-medium">请求原因: </span>
              <span className="text-muted-foreground">{approval.reason}</span>
            </div>
          )}

          {/* 审批者 */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>审批者: {approval.approvers.join(', ')}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApprove(approval)}
                disabled={isExpired}
                className="h-7"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                批准
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(approval, '')}
                disabled={isExpired}
                className="h-7 text-red-600 hover:text-red-700"
              >
                <XCircle className="h-3 w-3 mr-1" />
                拒绝
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ApprovalQueue({ className, showStats = true, compact = false }: ApprovalQueueProps) {
  const { toast } = useToast()
  // const { user } = useAuthStore()
  
  // Store状态
  const {
    approvalQueue,
    approvalsLoading,
    approvalsError,
    approvalStats,
    // approvalsFilter,
    approvalsPagination,
    loadPendingApprovals,
    approveExecution,
    rejectExecution,
    batchApproval,
    // setApprovalsFilter,
    // clearApprovalsFilter,
    loadApprovalStats
  } = useToolStore()
  
  // 本地状态
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<'low' | 'medium' | 'high' | 'all'>('all')
  const [selectedApprovals, setSelectedApprovals] = useState<Set<string>>(new Set())
  const [approvalDialog, setApprovalDialog] = useState<{
    approval: ToolApprovalRequest | null
    action: 'approve' | 'reject' | null
    open: boolean
  }>({ approval: null, action: null, open: false })

  // 初始加载
  useEffect(() => {
    loadPendingApprovals()
    if (showStats) {
      loadApprovalStats()
    }
  }, [loadPendingApprovals, loadApprovalStats, showStats])

  // 搜索和过滤
  const filteredApprovals = useMemo(() => {
    let filtered = approvalQueue

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(approval => 
        approval.toolName.toLowerCase().includes(query) ||
        approval.requestedBy.toLowerCase().includes(query) ||
        approval.reason?.toLowerCase().includes(query)
      )
    }

    // 风险级别过滤
    if (selectedRiskLevel !== 'all') {
      filtered = filtered.filter(approval => approval.riskLevel === selectedRiskLevel)
    }

    return filtered
  }, [approvalQueue, searchQuery, selectedRiskLevel])

  // 处理批准
  const handleApprove = async (approval: ToolApprovalRequest, reason?: string) => {
    try {
      await approveExecution(approval.toolExecutionId, reason)
      toast({
        title: "审批成功",
        description: `已批准工具 "${approval.toolName}" 的执行请求`
      })
    } catch (error) {
      toast({
        title: "审批失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 处理拒绝
  const handleReject = async (approval: ToolApprovalRequest, reason: string) => {
    try {
      await rejectExecution(approval.toolExecutionId, reason)
      toast({
        title: "审批成功",
        description: `已拒绝工具 "${approval.toolName}" 的执行请求`
      })
    } catch (error) {
      toast({
        title: "审批失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 批量操作
  const handleBatchOperation = async (action: 'approve' | 'reject', reason?: string) => {
    if (selectedApprovals.size === 0) return

    const operations = Array.from(selectedApprovals).map(approvalId => {
      const approval = approvalQueue.find(a => a.id === approvalId)
      return {
        executionId: approval?.toolExecutionId || '',
        action,
        reason
      }
    }).filter(op => op.executionId)

    try {
      await batchApproval(operations)
      setSelectedApprovals(new Set())
      toast({
        title: "批量操作成功",
        description: `已${action === 'approve' ? '批准' : '拒绝'} ${operations.length} 个执行请求`
      })
    } catch (error) {
      toast({
        title: "批量操作失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 切换选择
  const handleToggleSelection = (approvalId: string) => {
    const newSelected = new Set(selectedApprovals)
    if (newSelected.has(approvalId)) {
      newSelected.delete(approvalId)
    } else {
      newSelected.add(approvalId)
    }
    setSelectedApprovals(newSelected)
  }

  // 全选/取消全选
  const handleToggleSelectAll = () => {
    if (selectedApprovals.size === filteredApprovals.length) {
      setSelectedApprovals(new Set())
    } else {
      setSelectedApprovals(new Set(filteredApprovals.map(a => a.id)))
    }
  }

  // 查看详情
  const handleViewDetails = (approval: ToolApprovalRequest) => {
    setApprovalDialog({
      approval,
      action: null,
      open: true
    })
  }

  // 刷新数据
  const handleRefresh = () => {
    loadPendingApprovals(1, true)
    if (showStats) {
      loadApprovalStats()
    }
  }

  const hasActiveFilters = searchQuery || selectedRiskLevel !== 'all'

  return (
    <div className={cn('space-y-4', className)}>
      {/* 统计信息 */}
      {showStats && approvalStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">待审批</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-orange-600">{approvalStats.pending}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">已批准</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">{approvalStats.approved}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">通过率</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(approvalStats.approvalRate * 100)}%
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">平均审批时间</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(approvalStats.avgApprovalTime)}分钟
              </div>
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
              placeholder="搜索审批请求..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 风险级别过滤 */}
          <Select value={selectedRiskLevel} onValueChange={(value: any) => setSelectedRiskLevel(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部风险</SelectItem>
              <SelectItem value="low">低风险</SelectItem>
              <SelectItem value="medium">中风险</SelectItem>
              <SelectItem value="high">高风险</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* 批量操作 */}
          {selectedApprovals.size > 0 && (
            <>
              <Button
                size="sm"
                onClick={() => handleBatchOperation('approve')}
                className="bg-green-600 hover:bg-green-700"
              >
                批量批准 ({selectedApprovals.size})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBatchOperation('reject', '批量拒绝')}
              >
                批量拒绝 ({selectedApprovals.size})
              </Button>
            </>
          )}

          {/* 刷新按钮 */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={approvalsLoading}
          >
            <RefreshCw className={cn('h-4 w-4', approvalsLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* 全选控制 */}
      {filteredApprovals.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedApprovals.size === filteredApprovals.length}
            onChange={handleToggleSelectAll}
            className="rounded"
          />
          <span className="text-sm text-muted-foreground">
            已选择 {selectedApprovals.size} / {filteredApprovals.length} 项
          </span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => {
              setSearchQuery('')
              setSelectedRiskLevel('all')
            }}>
              清除过滤
            </Button>
          )}
        </div>
      )}

      {/* 错误显示 */}
      {approvalsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{approvalsError}</AlertDescription>
        </Alert>
      )}

      {/* 审批列表 */}
      <ScrollArea className="h-[600px]">
        {approvalsLoading && filteredApprovals.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>加载审批队列...</span>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mr-2" />
            <span>没有待审批的请求</span>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApprovals.map((approval) => (
              <div key={approval.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedApprovals.has(approval.id)}
                  onChange={() => handleToggleSelection(approval.id)}
                  className="mt-4 rounded"
                />
                <div className="flex-1">
                  <ApprovalItem
                    approval={approval}
                    onApprove={(a) => setApprovalDialog({ approval: a, action: 'approve', open: true })}
                    onReject={(a) => setApprovalDialog({ approval: a, action: 'reject', open: true })}
                    onViewDetails={handleViewDetails}
                    compact={compact}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {approvalsPagination.hasMore && filteredApprovals.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              onClick={() => loadPendingApprovals(approvalsPagination.page + 1)}
              disabled={approvalsLoading}
            >
              {approvalsLoading ? (
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

      {/* 审批对话框 */}
      <ApprovalDialog
        approval={approvalDialog.approval}
        open={approvalDialog.open}
        action={approvalDialog.action}
        onOpenChange={(open) => setApprovalDialog(prev => ({ ...prev, open }))}
        onConfirm={async (reason) => {
          if (!approvalDialog.approval || !approvalDialog.action) return

          if (approvalDialog.action === 'approve') {
            await handleApprove(approvalDialog.approval, reason)
          } else {
            await handleReject(approvalDialog.approval, reason || '用户拒绝')
          }
        }}
      />
    </div>
  )
}