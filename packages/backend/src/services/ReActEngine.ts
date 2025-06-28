import { EventEmitter } from 'events';
import type { Tool, ToolExecution } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';
import { ToolService } from './ToolService.js';

export interface ReActStep {
  type: 'thought' | 'action' | 'observation' | 'answer' | 'internal_thought';
  content: string;
  toolCall?: {
    name: string;
    input: any;
  };
  toolResult?: any;
  timestamp: Date;
  isInternal?: boolean;
}

export interface ReActContext {
  conversationId: string;
  executionId: string;
  userId: string;
  maxSteps?: number;
  availableTools: Tool[];
}

export interface ReActResult {
  steps: ReActStep[];
  finalAnswer: string;
  success: boolean;
  error?: string;
  executionTime: number;
}

/**
 * ReAct (Reasoning and Acting) 引擎
 * 实现思考-行动-观察循环，支持智能任务规划和执行
 */
export class ReActEngine extends EventEmitter {
  private toolService: ToolService;
  private maxStepsDefault = 10;
  private systemPrompt = `You are an AI assistant that uses the ReAct (Reasoning and Acting) framework to solve problems.

For each task, you should:
1. THINK: Analyze what needs to be done and plan your approach
2. ACT: Choose and execute appropriate tools
3. OBSERVE: Examine the results and determine next steps
4. Repeat until the task is complete or you have enough information

Format your response as:
THOUGHT: [Your reasoning about what to do next]
ACTION: [tool_name]
INPUT: {json input for the tool}

When you have the final answer or the task is complete, respond with:
ANSWER: [Your final response to the user]

Available tools and their descriptions will be provided for each task.`;

  constructor(toolService: ToolService) {
    super();
    this.toolService = toolService;
  }

  /**
   * 执行 ReAct 推理循环
   */
  async execute(
    userMessage: string,
    context: ReActContext,
    llmFunction: (prompt: string) => Promise<string>
  ): Promise<ReActResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const maxSteps = context.maxSteps || this.maxStepsDefault;

    try {
      // 构建初始提示
      const toolDescriptions = this.buildToolDescriptions(context.availableTools);
      const initialPrompt = `${this.systemPrompt}

Available Tools:
${toolDescriptions}

User Request: ${userMessage}

Begin your reasoning:`;

      let currentPrompt = initialPrompt;
      let stepCount = 0;

      while (stepCount < maxSteps) {
        stepCount++;

        // 获取 LLM 响应
        const response = await llmFunction(currentPrompt);
        
        // 解析响应
        const parsedSteps = this.parseResponse(response);
        
        if (parsedSteps.length === 0) {
          throw new Error('Failed to parse LLM response');
        }

        for (const step of parsedSteps) {
          steps.push(step);
          this.emitStep(context.executionId, step);

          // 如果是最终答案，结束循环
          if (step.type === 'answer') {
            return {
              steps,
              finalAnswer: step.content,
              success: true,
              executionTime: Date.now() - startTime
            };
          }

          // 如果是行动，执行工具
          if (step.type === 'action' && step.toolCall) {
            const observation = await this.executeTool(
              step.toolCall.name,
              step.toolCall.input,
              context
            );

            const observationStep: ReActStep = {
              type: 'observation',
              content: this.formatObservation(observation),
              toolResult: observation,
              timestamp: new Date()
            };

            steps.push(observationStep);
            this.emitStep(context.executionId, observationStep);

            // 更新提示，包含观察结果
            currentPrompt += `\n\nTHOUGHT: ${steps[steps.length - 2].content}`;
            currentPrompt += `\nACTION: ${step.toolCall.name}`;
            currentPrompt += `\nINPUT: ${JSON.stringify(step.toolCall.input)}`;
            currentPrompt += `\nOBSERVATION: ${observationStep.content}`;
            currentPrompt += `\n\nContinue with your next thought:`;
          }
        }
      }

      // 达到最大步数
      throw new Error(`Maximum steps (${maxSteps}) reached without completing the task`);

    } catch (error) {
      logger.error('ReAct execution failed', error);
      
      return {
        steps,
        finalAnswer: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(response: string): ReActStep[] {
    const steps: ReActStep[] = [];
    const lines = response.split('\n');
    
    let currentType: string | null = null;
    let currentContent = '';
    let toolName: string | null = null;
    let toolInput: any = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('THOUGHT:')) {
        if (currentType) {
          this.addParsedStep(steps, currentType, currentContent, toolName, toolInput);
        }
        currentType = 'thought';
        currentContent = trimmedLine.substring('THOUGHT:'.length).trim();
        toolName = null;
        toolInput = null;
      } else if (trimmedLine.startsWith('ACTION:')) {
        if (currentType === 'thought' && currentContent) {
          steps.push({
            type: 'thought',
            content: currentContent,
            timestamp: new Date()
          });
        }
        currentType = 'action';
        toolName = trimmedLine.substring('ACTION:'.length).trim();
        currentContent = '';
      } else if (trimmedLine.startsWith('INPUT:')) {
        if (currentType === 'action' && toolName) {
          try {
            const inputStr = trimmedLine.substring('INPUT:'.length).trim();
            toolInput = JSON.parse(inputStr);
          } catch (e) {
            // 如果不是有效的 JSON，作为字符串处理
            toolInput = { input: trimmedLine.substring('INPUT:'.length).trim() };
          }
        }
      } else if (trimmedLine.startsWith('ANSWER:')) {
        if (currentType) {
          this.addParsedStep(steps, currentType, currentContent, toolName, toolInput);
        }
        steps.push({
          type: 'answer',
          content: trimmedLine.substring('ANSWER:'.length).trim(),
          timestamp: new Date()
        });
        break;
      } else if (trimmedLine && currentType === 'thought') {
        // 继续思考内容
        currentContent += ' ' + trimmedLine;
      }
    }

    // 处理最后的步骤
    if (currentType) {
      this.addParsedStep(steps, currentType, currentContent, toolName, toolInput);
    }

    return steps;
  }

  /**
   * 添加解析的步骤
   */
  private addParsedStep(
    steps: ReActStep[],
    type: string,
    content: string,
    toolName: string | null,
    toolInput: any
  ): void {
    if (type === 'action' && toolName) {
      steps.push({
        type: 'action',
        content: `Executing tool: ${toolName}`,
        toolCall: {
          name: toolName,
          input: toolInput || {}
        },
        timestamp: new Date()
      });
    } else if (type === 'thought' && content) {
      steps.push({
        type: 'thought',
        content,
        timestamp: new Date()
      });
    }
  }

  /**
   * 执行工具
   */
  private async executeTool(
    toolName: string,
    input: any,
    context: ReActContext
  ): Promise<any> {
    try {
      // 创建工具执行对象
      const execution: ToolExecution = {
        id: `${context.executionId}-${Date.now()}`,
        toolName,
        toolId: toolName,
        input,
        userId: context.userId,
        conversationId: context.conversationId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 执行工具
      const result = await this.toolService.executeDirectly(execution);
      
      if (result.success) {
        return result.output;
      } else {
        return { error: result.error?.message || 'Tool execution failed' };
      }
    } catch (error) {
      logger.error(`Failed to execute tool ${toolName}`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * 构建工具描述
   */
  private buildToolDescriptions(tools: Tool[]): string {
    return tools.map(tool => {
      const params = tool.parameters.map(p => 
        `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
      ).join('\n');

      return `- ${tool.name}: ${tool.description}
  Parameters:
${params}`;
    }).join('\n\n');
  }

  /**
   * 格式化观察结果
   */
  private formatObservation(result: any): string {
    if (result.error) {
      return `Error: ${result.error}`;
    }

    if (typeof result === 'string') {
      // 限制长度
      if (result.length > 500) {
        return result.substring(0, 500) + '... (truncated)';
      }
      return result;
    }

    // 对于对象，格式化为 JSON
    try {
      const json = JSON.stringify(result, null, 2);
      if (json.length > 500) {
        return json.substring(0, 500) + '... (truncated)';
      }
      return json;
    } catch {
      return String(result);
    }
  }

  /**
   * 发送步骤事件
   */
  private emitStep(executionId: string, step: ReActStep): void {
    this.emit('react:step', {
      executionId,
      step
    });
  }

  /**
   * 增强的执行方法，支持流式输出
   */
  async executeStreaming(
    userMessage: string,
    context: ReActContext,
    llmFunction: (prompt: string, onToken?: (token: string) => void) => Promise<string>
  ): Promise<AsyncGenerator<ReActStep, ReActResult, unknown>> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const maxSteps = context.maxSteps || this.maxStepsDefault;

    return (async function* generator(this: ReActEngine) {
      try {
        const toolDescriptions = this.buildToolDescriptions(context.availableTools);
        const initialPrompt = `${this.systemPrompt}

Available Tools:
${toolDescriptions}

User Request: ${userMessage}

Begin your reasoning:`;

        let currentPrompt = initialPrompt;
        let stepCount = 0;

        while (stepCount < maxSteps) {
          stepCount++;

          let currentThought = '';
          
          // 使用流式 LLM
          const response = await llmFunction(currentPrompt, (token) => {
            currentThought += token;
            // 实时发送思考过程
            if (currentThought.includes('\n')) {
              const thoughtStep: ReActStep = {
                type: 'internal_thought',
                content: currentThought.trim(),
                timestamp: new Date(),
                isInternal: true
              };
              // 这里可以 yield 内部思考，但通常我们不展示
            }
          });

          const parsedSteps = this.parseResponse(response);

          for (const step of parsedSteps) {
            steps.push(step);
            yield step;

            if (step.type === 'answer') {
              return {
                steps,
                finalAnswer: step.content,
                success: true,
                executionTime: Date.now() - startTime
              };
            }

            if (step.type === 'action' && step.toolCall) {
              const observation = await this.executeTool(
                step.toolCall.name,
                step.toolCall.input,
                context
              );

              const observationStep: ReActStep = {
                type: 'observation',
                content: this.formatObservation(observation),
                toolResult: observation,
                timestamp: new Date()
              };

              steps.push(observationStep);
              yield observationStep;

              currentPrompt += `\n\nTHOUGHT: ${steps[steps.length - 2].content}`;
              currentPrompt += `\nACTION: ${step.toolCall.name}`;
              currentPrompt += `\nINPUT: ${JSON.stringify(step.toolCall.input)}`;
              currentPrompt += `\nOBSERVATION: ${observationStep.content}`;
              currentPrompt += `\n\nContinue with your next thought:`;
            }
          }
        }

        throw new Error(`Maximum steps (${maxSteps}) reached`);

      } catch (error) {
        logger.error('ReAct streaming execution failed', error);
        
        return {
          steps,
          finalAnswer: '',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime
        };
      }
    }.bind(this))();
  }
}