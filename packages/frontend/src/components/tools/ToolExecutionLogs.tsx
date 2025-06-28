import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Terminal, 
  Download, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
// import { zhCN } from 'date-fns/locale';
import { useWebSocket } from '@/hooks/useWebSocket';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug' | 'success';
  message: string;
  data?: any;
  source?: string;
}

interface ToolExecutionLogsProps {
  executionId: string;
  className?: string;
  maxHeight?: string;
  autoScroll?: boolean;
}

export function ToolExecutionLogs({
  executionId,
  className,
  maxHeight = '400px',
  autoScroll = true
}: ToolExecutionLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(autoScroll);
  const { socket, isConnected } = useWebSocket();

  // 通过 WebSocket 接收实时日志
  useEffect(() => {
    if (!socket || !isConnected) return;

    // 监听工具日志事件
    const handleToolLog = (data: { executionId: string; logEntry: LogEntry }) => {
      if (data.executionId === executionId) {
        setLogs(prev => [...prev, {
          ...data.logEntry,
          timestamp: new Date(data.logEntry.timestamp)
        }]);
      }
    };

    socket.on('tool:log', handleToolLog);

    // 初始日志
    setLogs([{
      id: `${executionId}-start`,
      timestamp: new Date(),
      level: 'info',
      message: '工具执行开始',
      source: 'system'
    }]);

    return () => {
      socket.off('tool:log', handleToolLog);
    };
  }, [executionId, socket, isConnected]);

  // 自动滚动到底部
  useEffect(() => {
    if (shouldAutoScroll.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop === target.clientHeight;
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

  const getLevelBadgeVariant = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'default';
      case 'warning': return 'outline'; // Badge 不支持 warning，改为 outline
      case 'error': return 'destructive';
      case 'debug': return 'secondary';
      case 'success': return 'default'; // Badge 不支持 success，改为 default
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

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          <CardTitle className="text-base font-medium">执行日志</CardTitle>
          <Badge variant="outline" className="ml-2">
            {logs.length} 条
          </Badge>
        </div>
        <div className="flex items-center gap-1">
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
                暂无日志
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="group hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {format(log.timestamp, 'HH:mm:ss.SSS')}
                      </span>
                      <Badge
                        variant={getLevelBadgeVariant(log.level)}
                        className="h-5 px-1 text-xs font-normal"
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className={cn('flex-1 break-all', getLevelColor(log.level))}>
                        {log.message}
                      </span>
                    </div>
                    {log.data && (
                      <div className="mt-1 ml-[140px] text-xs text-muted-foreground">
                        <pre className="bg-muted/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}