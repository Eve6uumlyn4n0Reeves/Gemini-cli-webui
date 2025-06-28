import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { 
  Brain, 
  Zap, 
  Eye, 
  CheckCircle2, 
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Activity,
  Clock,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ThoughtStep {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'final';
  content: string;
  toolCall?: {
    toolId: string;
    args: Record<string, any>;
  };
  result?: any;
  timestamp: Date;
  duration?: number;
  status?: 'pending' | 'running' | 'completed' | 'error';
  progress?: number;
}

interface ReActThinkingEnhancedProps {
  steps: ThoughtStep[];
  isActive: boolean;
  className?: string;
  onStepClick?: (step: ThoughtStep) => void;
}

export function ReActThinkingEnhanced({ 
  steps, 
  isActive, 
  className,
  onStepClick 
}: ReActThinkingEnhancedProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [typingStep, setTypingStep] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<Record<string, string>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 计算统计信息
  const stats = {
    totalSteps: steps.length,
    thoughtSteps: steps.filter(s => s.type === 'thought').length,
    actionSteps: steps.filter(s => s.type === 'action').length,
    observationSteps: steps.filter(s => s.type === 'observation').length,
    totalDuration: steps.reduce((acc, s) => acc + (s.duration || 0), 0),
    errorCount: steps.filter(s => s.status === 'error').length
  };

  // 打字机效果
  useEffect(() => {
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep && !displayedContent[lastStep.id]) {
        setTypingStep(lastStep.id);
        
        let currentIndex = 0;
        const content = lastStep.content;
        const interval = setInterval(() => {
          if (currentIndex <= content.length) {
            setDisplayedContent(prev => ({
              ...prev,
              [lastStep.id]: content.substring(0, currentIndex)
            }));
            currentIndex++;
          } else {
            setTypingStep(null);
            clearInterval(interval);
          }
        }, 20); // 打字速度

        return () => clearInterval(interval);
      }
    }
  }, [steps]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current && isActive) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [steps, isActive]);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (type: ThoughtStep['type'], status?: ThoughtStep['status']) => {
    if (status === 'error') return <AlertCircle className="h-4 w-4" />;
    
    switch (type) {
      case 'thought':
        return <Brain className="h-4 w-4" />;
      case 'action':
        return <Zap className="h-4 w-4" />;
      case 'observation':
        return <Eye className="h-4 w-4" />;
      case 'final':
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStepColor = (type: ThoughtStep['type'], status?: ThoughtStep['status']) => {
    if (status === 'error') return 'text-red-600 dark:text-red-400';
    
    switch (type) {
      case 'thought':
        return 'text-blue-600 dark:text-blue-400';
      case 'action':
        return 'text-purple-600 dark:text-purple-400';
      case 'observation':
        return 'text-green-600 dark:text-green-400';
      case 'final':
        return 'text-emerald-600 dark:text-emerald-400';
    }
  };

  const getStepBadgeVariant = (type: ThoughtStep['type'], status?: ThoughtStep['status']) => {
    if (status === 'error') return 'destructive';
    
    switch (type) {
      case 'thought':
        return 'default';
      case 'action':
        return 'secondary';
      case 'observation':
        return 'outline';
      case 'final':
        return 'default';
    }
  };

  const getStepTitle = (type: ThoughtStep['type']) => {
    switch (type) {
      case 'thought':
        return '思考';
      case 'action':
        return '行动';
      case 'observation':
        return '观察';
      case 'final':
        return '结论';
    }
  };

  const getStepBorderColor = (type: ThoughtStep['type'], status?: ThoughtStep['status']) => {
    if (status === 'error') return 'border-red-300 dark:border-red-700';
    if (status === 'running') return 'border-blue-400 dark:border-blue-600 animate-pulse';
    
    switch (type) {
      case 'thought':
        return 'border-blue-200 dark:border-blue-800';
      case 'action':
        return 'border-purple-200 dark:border-purple-800';
      case 'observation':
        return 'border-green-200 dark:border-green-800';
      case 'final':
        return 'border-emerald-300 dark:border-emerald-700';
      default:
        return 'border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/20 to-blue-50/20 dark:from-purple-950/10 dark:to-blue-950/10 pointer-events-none" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isActive ? 360 : 0 }}
              transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: "linear" }}
            >
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </motion.div>
            <CardTitle className="text-base font-medium">ReAct 推理过程</CardTitle>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
              >
                <Activity className="h-4 w-4 text-purple-600" />
              </motion.div>
            )}
            <Badge variant="outline" className="ml-2">
              {stats.totalSteps} 步骤
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="h-8 px-2"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 px-2"
            >
              {isCollapsed ? (
                <>
                  <ChevronRight className="h-4 w-4 mr-1" />
                  展开
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  收起
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 统计信息面板 */}
        <AnimatePresence>
          {showStats && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 bg-muted/50 rounded-lg"
            >
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span>思考: {stats.thoughtSteps}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <span>行动: {stats.actionSteps}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-green-600" />
                  <span>观察: {stats.observationSteps}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span>总耗时: {(stats.totalDuration / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>错误: {stats.errorCount}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="relative pt-0">
          <ScrollArea ref={scrollAreaRef} className="h-[400px] pr-4">
            {steps.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                等待推理开始...
              </motion.div>
            ) : (
              <div className="space-y-3 relative">
                {steps.map((step, index) => {
                  const isExpanded = expandedSteps.has(step.id);
                  const isTyping = typingStep === step.id;
                  const content = displayedContent[step.id] || step.content;
                  
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {/* 连接线 */}
                      {index > 0 && (
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: index * 0.1 + 0.05 }}
                          className="absolute left-5 -translate-y-3 w-0.5 h-6 bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-600"
                        />
                      )}
                      
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          'border rounded-lg p-3 transition-all cursor-pointer relative',
                          'hover:shadow-md dark:hover:shadow-purple-900/20',
                          getStepBorderColor(step.type, step.status),
                          step.type === 'final' && 'bg-emerald-50/50 dark:bg-emerald-950/20',
                          step.status === 'running' && 'bg-blue-50/50 dark:bg-blue-950/20'
                        )}
                        onClick={() => {
                          toggleStep(step.id);
                          onStepClick?.(step);
                        }}
                      >
                        {/* 进度条 */}
                        {step.status === 'running' && step.progress !== undefined && (
                          <Progress
                            value={step.progress}
                            className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg"
                          />
                        )}
                        
                        <div className="flex items-start gap-3">
                          <motion.div
                            className={cn('mt-0.5', getStepColor(step.type, step.status))}
                            animate={step.status === 'running' ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            {getStepIcon(step.type, step.status)}
                          </motion.div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={getStepBadgeVariant(step.type, step.status)} 
                                className="text-xs"
                              >
                                {getStepTitle(step.type)} {index + 1}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(step.timestamp), 'HH:mm:ss')}
                              </span>
                              {step.duration && (
                                <span className="text-xs text-muted-foreground">
                                  ({(step.duration / 1000).toFixed(1)}s)
                                </span>
                              )}
                              {step.status === 'running' && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            
                            <p className={cn(
                              'text-sm',
                              !isExpanded && 'line-clamp-2',
                              isTyping && 'text-muted-foreground'
                            )}>
                              {content}
                              {isTyping && (
                                <motion.span
                                  animate={{ opacity: [1, 0] }}
                                  transition={{ repeat: Infinity, duration: 0.5 }}
                                  className="inline-block w-2 h-4 bg-current ml-0.5"
                                />
                              )}
                            </p>
                            
                            {step.toolCall && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/20 rounded text-xs font-mono"
                              >
                                <div className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  调用工具: {step.toolCall.toolId}
                                </div>
                                {isExpanded && (
                                  <pre className="mt-1 text-muted-foreground overflow-x-auto">
                                    {JSON.stringify(step.toolCall.args, null, 2)}
                                  </pre>
                                )}
                              </motion.div>
                            )}
                            
                            {step.result && isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 p-2 bg-green-100 dark:bg-green-900/20 rounded text-xs"
                              >
                                <div className="font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  执行结果:
                                </div>
                                <pre className="text-muted-foreground overflow-x-auto max-h-40">
                                  {typeof step.result === 'string' 
                                    ? step.result 
                                    : JSON.stringify(step.result, null, 2)
                                  }
                                </pre>
                              </motion.div>
                            )}
                          </div>
                          
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-2"
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </motion.div>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
                
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在推理中...
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}