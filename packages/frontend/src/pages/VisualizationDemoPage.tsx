import { useState } from 'react';
import { ReActThinkingEnhanced } from '@/components/chat/ReActThinkingEnhanced';
import { ToolExecutionLogsEnhanced } from '@/components/tools/ToolExecutionLogsEnhanced';
import { ToolExecutionMonitor } from '@/components/tools/ToolExecutionMonitor';
import { ErrorDisplay, ErrorDetail } from '@/components/ui/error-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Terminal, 
  Activity, 
  AlertCircle,
  Play,
  Pause,
  RotateCw
} from 'lucide-react';

// 模拟数据生成器
type MockReActStep = {
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
};

const generateMockReActSteps = (): MockReActStep[] => {
  const steps = [
    {
      id: 'step-1',
      type: 'thought' as const,
      content: '我需要分析用户的请求，首先理解他们想要查找关于React Hooks的最新文档。',
      timestamp: new Date(Date.now() - 5000),
      status: 'completed' as const,
      duration: 320
    },
    {
      id: 'step-2',
      type: 'action' as const,
      content: '搜索React官方文档中关于Hooks的内容',
      toolCall: {
        toolId: 'web_search',
        args: { query: 'React Hooks documentation site:react.dev' }
      },
      timestamp: new Date(Date.now() - 4000),
      status: 'completed' as const,
      duration: 1250,
      progress: 100
    },
    {
      id: 'step-3',
      type: 'observation' as const,
      content: '找到了React官方文档中的Hooks指南，包含useState、useEffect、useContext等核心Hooks的详细说明。',
      result: {
        urls: ['https://react.dev/reference/react/hooks'],
        snippets: ['Hooks let you use different React features from your components...']
      },
      timestamp: new Date(Date.now() - 2500),
      status: 'completed' as const
    },
    {
      id: 'step-4',
      type: 'thought' as const,
      content: '现在我需要获取一些实际的代码示例来帮助用户更好地理解Hooks的使用。',
      timestamp: new Date(Date.now() - 2000),
      status: 'running' as const,
      progress: 60
    }
  ];
  
  return steps;
};

const generateMockErrors = (): ErrorDetail[] => {
  return [
    {
      id: 'err-1',
      type: 'error',
      title: 'API 请求失败',
      message: '无法连接到 Gemini API 服务器。请检查网络连接和API密钥配置。',
      code: 'ECONNREFUSED',
      source: 'GeminiService.ts:156',
      timestamp: new Date(Date.now() - 30000),
      context: {
        endpoint: 'https://api.gemini.com/v1/chat',
        timeout: 30000,
        retries: 3
      },
      suggestion: '请检查您的网络连接，确保能够访问外部API。如果问题持续，请检查防火墙设置。',
      documentation: 'https://docs.gemini.com/errors/connection',
      canRetry: true,
      onRetry: () => console.log('Retrying...')
    },
    {
      id: 'warn-1',
      type: 'warning',
      title: '工具执行超时',
      message: 'read_file 工具执行时间超过预期（5秒），但仍在运行中。',
      code: 'TOOL_TIMEOUT_WARNING',
      source: 'ToolService.ts:89',
      timestamp: new Date(Date.now() - 15000),
      context: {
        toolId: 'read_file',
        expectedDuration: 1000,
        actualDuration: 5200
      },
      suggestion: '文件可能较大或系统繁忙。考虑优化文件读取或增加超时时间。'
    },
    {
      id: 'info-1',
      type: 'info',
      title: '新版本可用',
      message: 'Gemini CLI WebUI 有新版本 v0.3.0 可用，包含性能改进和新功能。',
      source: 'UpdateChecker.ts:34',
      timestamp: new Date(Date.now() - 60000),
      documentation: 'https://github.com/gemini-cli/webui/releases'
    }
  ];
};

export function VisualizationDemoPage() {
  const [activeTab, setActiveTab] = useState('react');
  const [isRunning, setIsRunning] = useState(true);
  const [reactSteps, setReactSteps] = useState<MockReActStep[]>(generateMockReActSteps());
  const [errors, setErrors] = useState<ErrorDetail[]>(generateMockErrors());

  const handleAddStep = () => {
    const newStep: MockReActStep = {
      id: `step-${reactSteps.length + 1}`,
      type: 'action',
      content: `执行新的操作 ${reactSteps.length + 1}`,
      toolCall: {
        toolId: 'example_tool',
        args: { query: 'example query', param: 'value' }
      },
      timestamp: new Date(),
      status: 'running',
      progress: 0,
      duration: 0
    };
    setReactSteps([...reactSteps, newStep]);
  };

  const handleClearErrors = () => {
    setErrors([]);
  };

  const handleDismissError = (errorId: string) => {
    setErrors(errors.filter(e => e.id !== errorId));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">可视化组件演示</h1>
          <p className="text-muted-foreground mt-1">
            展示增强的 ReAct 推理、工具执行和错误处理可视化组件
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">演示模式</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                暂停
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                继续
              </>
            )}
          </Button>
          <Button variant="outline" size="sm">
            <RotateCw className="h-4 w-4 mr-1" />
            重置
          </Button>
        </div>
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-[600px]">
          <TabsTrigger value="react" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            ReAct 推理
          </TabsTrigger>
          <TabsTrigger value="execution" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            工具执行
          </TabsTrigger>
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            执行监控
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            错误展示
          </TabsTrigger>
        </TabsList>

        <TabsContent value="react" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>增强版 ReAct 推理可视化</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                展示了带有动画效果、打字机效果、步骤连接线、实时统计和进度显示的 ReAct 推理过程。
              </p>
              <div className="flex gap-2">
                <Button onClick={handleAddStep} size="sm">
                  添加新步骤
                </Button>
                <Button 
                  onClick={() => setReactSteps(generateMockReActSteps())} 
                  variant="outline" 
                  size="sm"
                >
                  重置步骤
                </Button>
              </div>
              <ReActThinkingEnhanced
                steps={reactSteps}
                isActive={isRunning}
                onStepClick={(step) => console.log('Clicked step:', step)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>增强版工具执行日志</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                展示了带有进度条、统计信息、暂停/继续功能和动画效果的工具执行日志。
              </p>
              <ToolExecutionLogsEnhanced
                executionId="demo-execution-001"
                showStats={true}
                onStatusChange={(status) => console.log('Status changed:', status)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>工具执行监控面板</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                实时监控所有工具执行的状态、进度和统计信息。
              </p>
              <ToolExecutionMonitor
                onExecutionClick={(execution) => console.log('Clicked execution:', execution)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>错误和警告可视化</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                美观地展示错误、警告和信息，支持展开详情、复制错误信息和重试操作。
              </p>
              <ErrorDisplay
                errors={errors}
                showStackTrace={true}
                onClear={handleClearErrors}
                onDismiss={handleDismissError}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>集成指南</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <h3>1. ReActThinkingEnhanced 组件</h3>
          <pre className="bg-muted p-3 rounded">
{`import { ReActThinkingEnhanced } from '@/components/chat/ReActThinkingEnhanced';

<ReActThinkingEnhanced
  steps={reActSteps}
  isActive={isThinking}
  onStepClick={handleStepClick}
/>`}
          </pre>

          <h3>2. ToolExecutionLogsEnhanced 组件</h3>
          <pre className="bg-muted p-3 rounded">
{`import { ToolExecutionLogsEnhanced } from '@/components/tools/ToolExecutionLogsEnhanced';

<ToolExecutionLogsEnhanced
  executionId={currentExecutionId}
  showStats={true}
  autoScroll={true}
  onStatusChange={handleStatusChange}
/>`}
          </pre>

          <h3>3. ErrorDisplay 组件</h3>
          <pre className="bg-muted p-3 rounded">
{`import { ErrorDisplay } from '@/components/ui/error-display';

<ErrorDisplay
  errors={errorList}
  showStackTrace={true}
  onClear={handleClearErrors}
  onDismiss={handleDismissError}
/>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}