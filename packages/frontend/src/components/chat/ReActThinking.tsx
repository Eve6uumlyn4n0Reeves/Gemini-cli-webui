import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Brain, 
  Zap, 
  Eye, 
  CheckCircle2, 
  ChevronDown,
  ChevronRight,
  Loader2,
  // AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
// import { zhCN } from 'date-fns/locale';

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
}

interface ReActThinkingProps {
  steps: ThoughtStep[];
  isActive: boolean;
  className?: string;
}

export function ReActThinking({ steps, isActive, className }: ReActThinkingProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStepIcon = (type: ThoughtStep['type']) => {
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

  const getStepColor = (type: ThoughtStep['type']) => {
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

  const getStepBadgeVariant = (type: ThoughtStep['type']) => {
    switch (type) {
      case 'thought':
        return 'default';
      case 'action':
        return 'secondary';
      case 'observation':
        return 'outline';
      case 'final':
        return 'default'; // 改为 default，因为 Badge 不支持 success
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

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle className="text-base font-medium">ReAct 推理过程</CardTitle>
            {isActive && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
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
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[300px] pr-4">
            {steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                等待推理开始...
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const isExpanded = expandedSteps.has(step.id);
                  
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        'border rounded-lg p-3 transition-colors',
                        'hover:bg-muted/50 cursor-pointer',
                        step.type === 'final' && 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                      )}
                      onClick={() => toggleStep(step.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5', getStepColor(step.type))}>
                          {getStepIcon(step.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={getStepBadgeVariant(step.type)} className="text-xs">
                              {getStepTitle(step.type)} {index + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(step.timestamp), 'HH:mm:ss')}
                            </span>
                          </div>
                          
                          <p className={cn(
                            'text-sm',
                            !isExpanded && 'line-clamp-2'
                          )}>
                            {step.content}
                          </p>
                          
                          {step.toolCall && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                              <div className="font-semibold text-purple-600 dark:text-purple-400">
                                调用工具: {step.toolCall.toolId}
                              </div>
                              {isExpanded && (
                                <pre className="mt-1 text-muted-foreground overflow-x-auto">
                                  {JSON.stringify(step.toolCall.args, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                          
                          {step.result && isExpanded && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <div className="font-semibold text-green-600 dark:text-green-400 mb-1">
                                执行结果:
                              </div>
                              <pre className="text-muted-foreground overflow-x-auto">
                                {typeof step.result === 'string' 
                                  ? step.result 
                                  : JSON.stringify(step.result, null, 2)
                                }
                              </pre>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {isActive && (
                  <div className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在推理中...
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}