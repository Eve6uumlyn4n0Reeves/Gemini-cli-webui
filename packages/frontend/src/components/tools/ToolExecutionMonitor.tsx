import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Activity,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { ToolExecution } from '@/services/toolApi';

interface ExecutionMetrics {
  executionsPerMinute: number;
  avgExecutionTime: number;
  successRate: number;
  activeExecutions: number;
  queuedExecutions: number;
  completedToday: number;
  failedToday: number;
  trend: 'up' | 'down' | 'stable';
}

interface ActiveExecution extends ToolExecution {
  progress?: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

interface ToolExecutionMonitorProps {
  className?: string;
  onExecutionClick?: (execution: ActiveExecution) => void;
}

export function ToolExecutionMonitor({ 
  className,
  onExecutionClick 
}: ToolExecutionMonitorProps) {
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    executionsPerMinute: 0,
    avgExecutionTime: 0,
    successRate: 100,
    activeExecutions: 0,
    queuedExecutions: 0,
    completedToday: 0,
    failedToday: 0,
    trend: 'stable'
  });
  const [isPaused, setIsPaused] = useState(false);
  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    if (!socket || !isConnected || isPaused) return;

    // 监听执行更新
    const handleExecutionUpdate = (data: {
      execution: ActiveExecution;
      action: 'started' | 'updated' | 'completed' | 'failed';
    }) => {
      setActiveExecutions(prev => {
        const { execution, action } = data;
        
        switch (action) {
          case 'started':
            return [...prev, execution];
          
          case 'updated':
            return prev.map(e => 
              e.id === execution.id ? { ...e, ...execution } : e
            );
          
          case 'completed':
          case 'failed':
            return prev.filter(e => e.id !== execution.id);
          
          default:
            return prev;
        }
      });
    };

    // 监听指标更新
    const handleMetricsUpdate = (data: Partial<ExecutionMetrics>) => {
      setMetrics(prev => ({ ...prev, ...data }));
    };

    socket.on('tool:execution:update', handleExecutionUpdate);
    socket.on('tool:metrics:update', handleMetricsUpdate);

    return () => {
      socket.off('tool:execution:update', handleExecutionUpdate);
      socket.off('tool:metrics:update', handleMetricsUpdate);
    };
  }, [socket, isConnected, isPaused]);

  // 计算本地指标
  useEffect(() => {
    const active = activeExecutions.length;
    const queued = activeExecutions.filter(e => e.status === 'pending').length;
    
    setMetrics(prev => ({
      ...prev,
      activeExecutions: active,
      queuedExecutions: queued
    }));
  }, [activeExecutions]);

  const getStatusIcon = (status: ToolExecution['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case 'executing':
        return <Activity className="h-4 w-4 text-purple-600 animate-pulse" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ToolExecution['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'approved':
        return 'text-blue-600';
      case 'executing':
        return 'text-purple-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div whileHover={{ scale: 1.02 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                执行速率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.executionsPerMinute}
                </span>
                <div className="flex items-center text-xs">
                  {metrics.trend === 'up' && (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  )}
                  {metrics.trend === 'down' && (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-muted-foreground">/分钟</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                平均耗时
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {formatDuration(metrics.avgExecutionTime)}
                </span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                成功率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {metrics.successRate.toFixed(1)}%
                </span>
                <div className="w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${metrics.successRate}, 100`}
                      className={cn(
                        'transition-all duration-500',
                        metrics.successRate >= 90 ? 'text-green-600' :
                        metrics.successRate >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      )}
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                活跃/队列
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">
                    {metrics.activeExecutions}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-xl">
                    {metrics.queuedExecutions}
                  </span>
                </div>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 活跃执行列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>活跃执行</CardTitle>
            {activeExecutions.length > 0 && (
              <Badge variant="outline">{activeExecutions.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  继续
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  暂停
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <RotateCw className="h-4 w-4 mr-1" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {activeExecutions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                当前没有活跃的工具执行
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {activeExecutions.map((execution) => (
                    <motion.div
                      key={execution.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      whileHover={{ scale: 1.01 }}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onExecutionClick?.(execution)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <span className="font-medium">{execution.toolId}</span>
                          <Badge variant="outline" className="text-xs">
                            {execution.id.slice(0, 8)}
                          </Badge>
                        </div>
                        <span className={cn('text-xs', getStatusColor(execution.status))}>
                          {execution.status}
                        </span>
                      </div>

                      {execution.currentStep && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {execution.currentStep}
                        </p>
                      )}

                      {execution.progress !== undefined && execution.status === 'executing' && (
                        <div className="space-y-1">
                          <Progress value={execution.progress} className="h-1.5" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{execution.progress}%</span>
                            {execution.estimatedTimeRemaining && (
                              <span>
                                剩余 {formatDuration(execution.estimatedTimeRemaining)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {execution.executionTime && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(execution.executionTime)}
                          </div>
                          {execution.executedAt && (
                            <div>
                              开始于 {new Date(execution.executedAt).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 今日统计 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              今日完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{metrics.completedToday}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              今日失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{metrics.failedToday}</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}