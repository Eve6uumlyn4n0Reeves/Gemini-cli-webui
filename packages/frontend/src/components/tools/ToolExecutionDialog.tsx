import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  Loader2, 
  AlertTriangle, 
  XCircle,
  Clock,
  Settings,
  Info,
  Terminal
} from 'lucide-react'
import { useToolStore } from '@/stores/useToolStore'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { ToolExecutionLogs } from './ToolExecutionLogs'
import type { Tool, ToolParameter, ToolExecution } from '@/services/toolApi'

interface ToolExecutionDialogProps {
  tool: Tool | null
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId?: string
  messageId?: string
}

interface ParameterInputProps {
  parameter: ToolParameter
  value: any
  onChange: (value: any) => void
  error?: string
}

function ParameterInput({ parameter, value, onChange, error }: ParameterInputProps) {
  const handleChange = (newValue: string) => {
    let parsedValue: any = newValue
    
    // 类型转换
    if (parameter.type === 'number') {
      parsedValue = newValue === '' ? undefined : Number(newValue)
    } else if (parameter.type === 'boolean') {
      parsedValue = newValue === 'true'
    } else if (parameter.type === 'array') {
      try {
        parsedValue = newValue ? JSON.parse(newValue) : []
      } catch {
        parsedValue = newValue.split(',').map(s => s.trim()).filter(s => s)
      }
    } else if (parameter.type === 'object') {
      try {
        parsedValue = newValue ? JSON.parse(newValue) : {}
      } catch {
        // 保持字符串，让后端处理错误
        parsedValue = newValue
      }
    }
    
    onChange(parsedValue)
  }

  const displayValue = useMemo(() => {
    if (value === undefined || value === null) return ''
    
    if (parameter.type === 'array' || parameter.type === 'object') {
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    }
    
    return String(value)
  }, [value, parameter.type])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={parameter.name} className="flex items-center gap-2">
          {parameter.name}
          {parameter.required && <span className="text-red-500">*</span>}
        </Label>
        <Badge variant="outline" className="text-xs">
          {parameter.type}
        </Badge>
      </div>
      
      <div className="space-y-1">
        {parameter.enum ? (
          <Select value={displayValue} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择选项..." />
            </SelectTrigger>
            <SelectContent>
              {parameter.enum.map((option: any) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : parameter.type === 'boolean' ? (
          <Select value={displayValue} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">是</SelectItem>
              <SelectItem value="false">否</SelectItem>
            </SelectContent>
          </Select>
        ) : parameter.type === 'object' || parameter.type === 'array' ? (
          <Textarea
            id={parameter.name}
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={
              parameter.type === 'array' 
                ? '["item1", "item2"] 或 item1, item2'
                : '{"key": "value"}'
            }
            className={cn('font-mono text-sm', error && 'border-red-500')}
            rows={3}
          />
        ) : (
          <Input
            id={parameter.name}
            type={parameter.type === 'number' ? 'number' : 'text'}
            value={displayValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={parameter.default ? `默认: ${parameter.default}` : ''}
            min={parameter.minimum}
            max={parameter.maximum}
            pattern={parameter.pattern}
            className={cn(error && 'border-red-500')}
          />
        )}
        
        {parameter.description && (
          <p className="text-xs text-muted-foreground">{parameter.description}</p>
        )}
        
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  )
}

export function ToolExecutionDialog({
  tool,
  open,
  onOpenChange,
  conversationId,
  messageId
}: ToolExecutionDialogProps) {
  const { toast } = useToast()
  const { executeTool, executeToolDirect, executionsLoading } = useToolStore()
  
  // 表单状态
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({})
  const [timeout, setTimeout] = useState<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState('parameters')
  const [currentExecution, setCurrentExecution] = useState<ToolExecution | null>(null)

  // 重置表单
  useEffect(() => {
    if (tool && open) {
      const initialParams: Record<string, any> = {}
      const initialErrors: Record<string, string> = {}
      
      tool.parameters.forEach(param => {
        if (param.default !== undefined) {
          initialParams[param.name] = param.default
        }
      })
      
      setParameters(initialParams)
      setParameterErrors(initialErrors)
      setTimeout(tool.timeout > 0 ? tool.timeout : undefined)
      setCurrentExecution(null)
      setActiveTab('parameters')
    }
  }, [tool, open])

  // 参数验证
  const validateParameters = () => {
    if (!tool) return false
    
    const errors: Record<string, string> = {}
    let isValid = true

    tool.parameters.forEach(param => {
      const value = parameters[param.name]
      
      // 必需参数检查
      if (param.required && (value === undefined || value === null || value === '')) {
        errors[param.name] = '此参数为必需项'
        isValid = false
        return
      }
      
      // 跳过可选的空值
      if (!param.required && (value === undefined || value === null || value === '')) {
        return
      }
      
      // 类型验证
      if (param.type === 'number') {
        if (isNaN(Number(value))) {
          errors[param.name] = '请输入有效数字'
          isValid = false
        } else {
          const numValue = Number(value)
          if (param.minimum !== undefined && numValue < param.minimum) {
            errors[param.name] = `值不能小于 ${param.minimum}`
            isValid = false
          }
          if (param.maximum !== undefined && numValue > param.maximum) {
            errors[param.name] = `值不能大于 ${param.maximum}`
            isValid = false
          }
        }
      }
      
      // 枚举值验证
      if (param.enum && !param.enum.includes(String(value))) {
        errors[param.name] = `请选择有效选项: ${param.enum.join(', ')}`
        isValid = false
      }
      
      // 正则表达式验证
      if (param.pattern && typeof value === 'string') {
        const regex = new RegExp(param.pattern)
        if (!regex.test(value)) {
          errors[param.name] = '输入格式不正确'
          isValid = false
        }
      }
      
      // JSON 格式验证
      if ((param.type === 'object' || param.type === 'array') && typeof value === 'string') {
        try {
          JSON.parse(value)
        } catch {
          if (param.type === 'array' && value.includes(',')) {
            // 允许逗号分隔的数组格式
            return
          }
          errors[param.name] = 'JSON 格式不正确'
          isValid = false
        }
      }
    })

    setParameterErrors(errors)
    return isValid
  }

  // 执行工具
  const handleExecute = async (direct = false) => {
    if (!tool || !validateParameters()) return

    try {
      const execution = await (direct ? executeToolDirect : executeTool)(
        tool.id,
        parameters,
        {
          conversationId,
          messageId,
          timeout: timeout || tool.timeout
        }
      )

      if (execution) {
        setCurrentExecution(execution as ToolExecution)
        setActiveTab('execution')
        
        toast({
          title: direct ? "工具执行成功" : "工具执行已提交",
          description: direct 
            ? `工具 "${tool.name}" 执行完成`
            : `工具 "${tool.name}" 已提交执行，等待${tool.permissionLevel === 'user_approval' ? '用户' : '管理员'}审批`
        })
      }
    } catch (error) {
      toast({
        title: "执行失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      })
    }
  }

  // 参数更新处理
  const handleParameterChange = (name: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [name]: value
    }))
    
    // 清除该参数的错误信息
    if (parameterErrors[name]) {
      setParameterErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  if (!tool) return null

  const canExecute = tool.isEnabled && tool.permissionLevel !== 'denied'
  const needsApproval = tool.permissionLevel === 'user_approval' || tool.permissionLevel === 'admin_approval'
  const canExecuteDirect = tool.permissionLevel === 'auto'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            执行工具: {tool.name}
          </DialogTitle>
          <DialogDescription>
            {tool.description}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="parameters" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              参数配置
            </TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              工具信息
            </TabsTrigger>
            <TabsTrigger value="execution" className="flex items-center gap-2" disabled={!currentExecution}>
              <Play className="h-4 w-4" />
              执行结果
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2" disabled={!currentExecution}>
              <Terminal className="h-4 w-4" />
              执行日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="mt-4 space-y-4 overflow-hidden">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* 权限警告 */}
                {needsApproval && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      此工具需要{tool.permissionLevel === 'user_approval' ? '用户' : '管理员'}审批后才能执行。
                      提交后请等待审批完成。
                    </AlertDescription>
                  </Alert>
                )}

                {!canExecute && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {!tool.isEnabled ? '工具当前处于禁用状态' : '工具执行权限被拒绝'}
                    </AlertDescription>
                  </Alert>
                )}

                {/* 参数输入 */}
                {tool.parameters.length > 0 ? (
                  <div className="space-y-4">
                    {tool.parameters.map((parameter) => (
                      <ParameterInput
                        key={parameter.name}
                        parameter={parameter}
                        value={parameters[parameter.name]}
                        onChange={(value) => handleParameterChange(parameter.name, value)}
                        error={parameterErrors[parameter.name]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    此工具不需要输入参数
                  </div>
                )}

                {/* 高级选项 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">高级选项</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="timeout">超时时间 (毫秒)</Label>
                        <Input
                          id="timeout"
                          type="number"
                          value={timeout || ''}
                          onChange={(e) => setTimeout(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder={`默认: ${tool.timeout}`}
                          min={1000}
                          max={300000}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>执行环境</Label>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant={tool.isSandboxed ? 'default' : 'secondary'}>
                            {tool.isSandboxed ? '沙盒环境' : '主机环境'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="info" className="mt-4 overflow-hidden">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">基本信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">类别:</span> {tool.category}
                      </div>
                      <div>
                        <span className="font-medium">来源:</span> {tool.source || 'builtin'}
                      </div>
                      <div>
                        <span className="font-medium">权限级别:</span> {tool.permissionLevel}
                      </div>
                      <div>
                        <span className="font-medium">沙盒执行:</span> {tool.isSandboxed ? '是' : '否'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {tool.parameters.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">参数详情</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {tool.parameters.map((param) => (
                          <div key={param.name} className="border rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{param.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{param.type}</Badge>
                                {param.required && (
                                  <Badge variant="destructive" className="text-xs">必需</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {param.description}
                            </p>
                            {(param.default !== undefined || param.enum || param.minimum !== undefined || param.maximum !== undefined) && (
                              <div className="text-xs space-y-1">
                                {param.default !== undefined && (
                                  <div>默认值: <code>{JSON.stringify(param.default)}</code></div>
                                )}
                                {param.enum && (
                                  <div>可选值: <code>{param.enum.join(', ')}</code></div>
                                )}
                                {param.minimum !== undefined && (
                                  <div>最小值: <code>{param.minimum}</code></div>
                                )}
                                {param.maximum !== undefined && (
                                  <div>最大值: <code>{param.maximum}</code></div>
                                )}
                                {param.pattern && (
                                  <div>格式: <code>{param.pattern}</code></div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {tool.metadata && Object.keys(tool.metadata).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">元数据</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(tool.metadata, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="execution" className="mt-4 overflow-hidden">
            <ScrollArea className="h-[400px] pr-4">
              {currentExecution ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        执行状态
                        <Badge variant={
                          currentExecution.status === 'completed' ? 'default' :
                          currentExecution.status === 'error' ? 'destructive' :
                          currentExecution.status === 'executing' ? 'secondary' : 'outline'
                        }>
                          {currentExecution.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>执行ID: <code>{currentExecution.id}</code></div>
                      <div>提交时间: {new Date(currentExecution.executedAt || currentExecution.approvedAt || '').toLocaleString()}</div>
                      {currentExecution.executionTime && (
                        <div>执行时间: {currentExecution.executionTime}ms</div>
                      )}
                    </CardContent>
                  </Card>

                  {currentExecution.output && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">输出结果</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                          {typeof currentExecution.output === 'string' 
                            ? currentExecution.output 
                            : JSON.stringify(currentExecution.output, null, 2)
                          }
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  {currentExecution.error && (
                    <Card className="border-red-200">
                      <CardHeader>
                        <CardTitle className="text-sm text-red-600">错误信息</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div><strong>错误代码:</strong> {currentExecution.error.code}</div>
                          <div><strong>错误信息:</strong> {currentExecution.error.message}</div>
                          {currentExecution.error.details && (
                            <div>
                              <strong>详细信息:</strong>
                              <pre className="text-xs bg-red-50 p-2 rounded mt-1">
                                {JSON.stringify(currentExecution.error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  还没有执行记录
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="mt-4 overflow-hidden">
            {currentExecution ? (
              <ToolExecutionLogs 
                executionId={currentExecution.id}
                maxHeight="450px"
                className="border-0"
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                请先执行工具以查看日志
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              超时: {timeout || tool.timeout}ms
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              
              {canExecute && activeTab === 'parameters' && (
                <>
                  {canExecuteDirect && (
                    <Button
                      onClick={() => handleExecute(true)}
                      disabled={executionsLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {executionsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          执行中...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          直接执行
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleExecute(false)}
                    disabled={executionsLoading}
                  >
                    {executionsLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {needsApproval ? '提交审批' : '执行'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}