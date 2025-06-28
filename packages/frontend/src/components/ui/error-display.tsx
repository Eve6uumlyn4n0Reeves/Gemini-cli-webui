import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Code,
  Terminal,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface ErrorDetail {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  code?: string;
  stack?: string;
  source?: string;
  timestamp: Date;
  context?: Record<string, any>;
  suggestion?: string;
  documentation?: string;
  canRetry?: boolean;
  onRetry?: () => void;
}

interface ErrorDisplayProps {
  errors: ErrorDetail[];
  className?: string;
  showStackTrace?: boolean;
  onClear?: () => void;
  onDismiss?: (errorId: string) => void;
}

export function ErrorDisplay({
  errors,
  className,
  showStackTrace = true,
  onClear,
  onDismiss
}: ErrorDisplayProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getIcon = (type: ErrorDetail['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = (type: ErrorDetail['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800';
    }
  };

  const toggleExpanded = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const copyError = async (error: ErrorDetail) => {
    const text = `${error.type.toUpperCase()}: ${error.title}
Message: ${error.message}
${error.code ? `Code: ${error.code}` : ''}
${error.source ? `Source: ${error.source}` : ''}
Timestamp: ${error.timestamp.toISOString()}
${error.stack ? `\nStack Trace:\n${error.stack}` : ''}
${error.context ? `\nContext:\n${JSON.stringify(error.context, null, 2)}` : ''}`;

    await navigator.clipboard.writeText(text);
    setCopiedId(error.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (errors.length === 0) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="text-center py-8">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <p className="text-muted-foreground">没有错误或警告</p>
        </CardContent>
      </Card>
    );
  }

  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;
  const infoCount = errors.filter(e => e.type === 'info').length;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <CardTitle>错误和警告</CardTitle>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Badge variant="destructive">{errorCount} 错误</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline">{warningCount} 警告</Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary">{infoCount} 信息</Badge>
            )}
          </div>
        </div>
        {onClear && errors.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            清除全部
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            <AnimatePresence mode="sync">
              {errors.map((error) => {
                const isExpanded = expandedErrors.has(error.id);
                
                return (
                  <motion.div
                    key={error.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      'border rounded-lg p-4 transition-colors',
                      getBgColor(error.type)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getIcon(error.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium">{error.title}</h4>
                          <div className="flex items-center gap-1">
                            {error.code && (
                              <Badge variant="outline" className="text-xs">
                                {error.code}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyError(error)}
                            >
                              {copiedId === error.id ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                            {onDismiss && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onDismiss(error.id)}
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {error.message}
                        </p>

                        {error.suggestion && (
                          <div className="flex items-start gap-2 mb-2 p-2 bg-background/50 rounded">
                            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                            <p className="text-sm">{error.suggestion}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {error.source && (
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {error.source}
                            </div>
                          )}
                          <div>
                            {error.timestamp.toLocaleTimeString()}
                          </div>
                        </div>

                        {(error.stack || error.context || error.documentation) && (
                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => toggleExpanded(error.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  收起详情
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-3 w-3 mr-1" />
                                  查看详情
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 space-y-3"
                            >
                              {error.stack && showStackTrace && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1 text-sm font-medium">
                                    <Terminal className="h-4 w-4" />
                                    堆栈跟踪
                                  </div>
                                  <pre className="text-xs bg-black/10 dark:bg-white/5 p-3 rounded overflow-x-auto">
                                    {error.stack}
                                  </pre>
                                </div>
                              )}

                              {error.context && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1 text-sm font-medium">
                                    <Code className="h-4 w-4" />
                                    上下文信息
                                  </div>
                                  <pre className="text-xs bg-black/10 dark:bg-white/5 p-3 rounded overflow-x-auto">
                                    {JSON.stringify(error.context, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {error.documentation && (
                                <div>
                                  <a
                                    href={error.documentation}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    查看文档
                                  </a>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {error.canRetry && error.onRetry && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={error.onRetry}
                            >
                              重试
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}