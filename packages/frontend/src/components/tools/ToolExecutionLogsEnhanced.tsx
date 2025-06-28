import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { 
  Terminal, 
  Download, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Copy,
  CheckCircle2,
  Activity,
  AlertCircle,
  Clock,
  Zap,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useWebSocket } from '@/hooks/useWebSocket';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug' | 'success';
  message: string;
  data?: any;
  source?: string;
  duration?: number;
  progress?: number;
}

interface ExecutionStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  avgDuration: number;
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused';
  progress: number;
  startTime?: Date;
  endTime?: Date;
}

interface ToolExecutionLogsEnhancedProps {
  executionId: string;
  className?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  showStats?: boolean;
  onStatusChange?: (status: ExecutionStats['status']) => void;
}

export function ToolExecutionLogsEnhanced({
  executionId,
  className,
  maxHeight = '400px',
  autoScroll = true,
  showStats = true,
  onStatusChange
}: ToolExecutionLogsEnhancedProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<ExecutionStats>({
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    avgDuration: 0,
    status: 'pending',
    progress: 0
  });
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(autoScroll);
  const { socket, isConnected } = useWebSocket();

  // 计算统计信息
  useEffect(() => {
    const errorCount = logs.filter(log => log.level === 'error').length;
    const warningCount = logs.filter(log => log.level === 'warning').length;
    const durations = logs.filter(log => log.duration).map(log => log.duration!);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    // 计算总体进度
    const lastLog = logs[logs.length - 1];
    const progress = lastLog?.progress || 0;

    // 确定状态
    let status: ExecutionStats['status'] = 'running';
    if (logs.length === 0) {
      status = 'pending';
    } else if (errorCount > 0) {
      status = 'error';
    } else if (lastLog?.message.includes('完成') || progress === 100) {
      status = 'completed';
    } else if (isPaused) {
      status = 'paused';
    }

    const newStats: ExecutionStats = {
      totalLogs: logs.length,
      errorCount,
      warningCount,
      avgDuration,
      status,
      progress,
      startTime: logs[0]?.timestamp,
      endTime: status === 'completed' ? lastLog?.timestamp : undefined
    };

    setStats(newStats);
    onStatusChange?.(newStats.status);
  }, [logs, isPaused, onStatusChange]);

  // 通过 WebSocket 接收实时日志
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleToolLog = (data: { executionId: string; logEntry: LogEntry }) => {
      if (data.executionId === executionId && !isPaused) {
        setLogs(prev => [...prev, {
          ...data.logEntry,
          timestamp: new Date(data.logEntry.timestamp)
        }]);
      }
    };

    const handleToolProgress = (data: { executionId: string; progress: number }) => {
      if (data.executionId === executionId) {
        setLogs(prev => {
          if (prev.length > 0) {
            const updated = [...prev];
            updated[updated.length - 1].progress = data.progress;
            return updated;
          }
          return prev;
        });
      }
    };

    socket.on('tool:log', handleToolLog);
    socket.on('tool:progress', handleToolProgress);

    // 初始日志
    if (logs.length === 0) {
      setLogs([{
        id: `${executionId}-start`,
        timestamp: new Date(),
        level: 'info',
        message: '工具执行开始',
        source: 'system',
        progress: 0
      }]);
    }

    return () => {
      socket.off('tool:log', handleToolLog);
      socket.off('tool:progress', handleToolProgress);
    };
  }, [executionId, socket, isConnected, isPaused, logs.length]);

  // 自动滚动到底部
  useEffect(() => {
    if (shouldAutoScroll.current && scrollAreaRef.current && !isPaused) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [logs, isPaused]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 5;
    shouldAutoScroll.current = isAtBottom;
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-blue-600 dark:text-blue-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'debug': return 'text-gray-600 dark:text-gray-400';
      case 'success': return 'text-green-600 dark:text-green-400';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return <AlertCircle className="h-3 w-3" />;
      case 'warning': return <AlertCircle className="h-3 w-3" />;
      case 'success': return <CheckCircle2 className="h-3 w-3" />;
      default: return null;
    }
  };

  const getStatusIcon = (status: ExecutionStats['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'running': return <Activity className="h-4 w-4 animate-pulse" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ExecutionStats['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'paused': return 'text-yellow-600';
    }
  };

  const handleCopy = async () => {
    const logText = logs.map(log => 
      `[${format(log.timestamp, 'HH:mm:ss.SSS')}] [${log.level.toUpperCase()}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
    
    await navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const logText = logs.map(log => 
      `[${format(log.timestamp, 'yyyy-MM-dd HH:mm:ss.SSS')}] [${log.level.toUpperCase()}] [${log.source || 'unknown'}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <CardTitle className="text-base font-medium">执行日志</CardTitle>
          <div className={cn('flex items-center gap-1', getStatusColor(stats.status))}>
            {getStatusIcon(stats.status)}
            <span className="text-xs font-medium">
              {stats.status === 'pending' && '等待中'}
              {stats.status === 'running' && '执行中'}
              {stats.status === 'completed' && '已完成'}
              {stats.status === 'error' && '错误'}
              {stats.status === 'paused' && '已暂停'}
            </span>
          </div>
          <Badge variant="outline" className="ml-2">
            {stats.totalLogs} 条
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={togglePause}
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            title="复制日志"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            title="下载日志"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClear}
            title="清空日志"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? '收起' : '展开'}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* 进度条 */}
      {stats.status === 'running' && (
        <div className="px-6 pb-2">
          <Progress value={stats.progress} className="h-1.5" />
        </div>
      )}

      {/* 统计信息 */}
      <AnimatePresence>
        {showStats && !isExpanded && stats.totalLogs > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 pb-3"
          >
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {stats.errorCount > 0 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{stats.errorCount} 错误</span>
                </div>
              )}
              {stats.warningCount > 0 && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-3 w-3" />
                  <span>{stats.warningCount} 警告</span>
                </div>
              )}
              {stats.avgDuration > 0 && (
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  <span>平均 {stats.avgDuration.toFixed(0)}ms</span>
                </div>
              )}
              {stats.startTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {stats.endTime 
                      ? `耗时 ${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(1)}s`
                      : `已运行 ${((Date.now() - stats.startTime.getTime()) / 1000).toFixed(0)}s`
                    }
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardContent className="p-0">
        <ScrollArea
          ref={scrollAreaRef}
          className={cn(
            'border-t',
            isExpanded ? 'h-[600px]' : `h-[${maxHeight}]`
          )}
          style={{ height: isExpanded ? '600px' : maxHeight }}
          onScroll={handleScroll}
        >
          <div className="p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                等待执行开始...
              </div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence mode="popLayout">
                  {logs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {format(log.timestamp, 'HH:mm:ss.SSS')}
                        </span>
                        <Badge
                          variant={
                            log.level === 'error' ? 'destructive' :
                            log.level === 'warning' ? 'outline' :
                            log.level === 'success' ? 'default' :
                            'secondary'
                          }
                          className="h-5 px-1 text-xs font-normal flex items-center gap-0.5"
                        >
                          {getLevelIcon(log.level)}
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className={cn('flex-1 break-all', getLevelColor(log.level))}>
                          {log.message}
                          {log.duration && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({log.duration}ms)
                            </span>
                          )}
                        </span>
                      </div>
                      {log.data && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-1 ml-[140px] text-xs text-muted-foreground"
                        >
                          <pre className="bg-muted/50 rounded p-2 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </motion.div>
                      )}
                      {log.progress !== undefined && log.progress < 100 && index === logs.length - 1 && (
                        <div className="mt-1 ml-[140px]">
                          <Progress value={log.progress} className="h-1" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {stats.status === 'running' && !isPaused && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground"
                  >
                    <Activity className="h-4 w-4 animate-pulse" />
                    处理中...
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}