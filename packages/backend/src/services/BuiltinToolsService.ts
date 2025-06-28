import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'glob';
import { EventEmitter } from 'events';
import type {
  Tool,
  ToolCategory,
  ToolExecution,
  ToolResult,
  ToolExecutionError
} from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';
import { webSearchTool } from '../tools/WebSearchTool.js';
import { imageProcessingTool } from '../tools/ImageProcessingTool.js';
import { createReadManyFilesTool } from '../tools/ReadManyFilesTool.js';
import { createFindFilesTool } from '../tools/FindFilesTool.js';
import { createMemoryTool } from '../tools/MemoryTool.js';
import { createGitTool } from '../tools/GitTool.js';

const execAsync = promisify(exec);
const globAsync = promisify(glob);

/**
 * 内置工具服务
 * 提供系统内置的工具实现
 */
export class BuiltinToolsService extends EventEmitter {
  private projectRoot: string;
  private builtinTools: Map<string, Tool> = new Map();
  private readManyFilesTool: any;
  private findFilesTool: any;
  private memoryTool: any;
  private gitTool: any;

  constructor(projectRoot?: string) {
    super();
    this.projectRoot = projectRoot || process.cwd();
    
    // 初始化工具实例
    this.readManyFilesTool = createReadManyFilesTool(this.projectRoot);
    this.findFilesTool = createFindFilesTool(this.projectRoot);
    this.memoryTool = createMemoryTool(this.projectRoot);
    this.gitTool = createGitTool(this.projectRoot);
    
    this.registerBuiltinTools();
  }

  /**
   * 注册所有内置工具
   */
  private registerBuiltinTools(): void {
    // Shell 命令执行工具
    this.registerTool({
      id: 'shell',
      name: 'run_shell_command',
      description: 'Execute shell commands in a controlled environment',
      category: 'system' as ToolCategory,
      parameters: [
        {
          name: 'command',
          type: 'string',
          description: 'Command to execute',
          required: true
        },
        {
          name: 'description',
          type: 'string',
          description: 'Description of what the command does',
          required: false
        },
        {
          name: 'cwd',
          type: 'string',
          description: 'Working directory (relative to project root)',
          required: false
        }
      ],
      permissionLevel: 'user_approval',
      isEnabled: true,
      isSandboxed: true,
      timeout: 30000,
      source: 'builtin'
    });

    // 文件读取工具
    this.registerTool({
      id: 'read_file',
      name: 'read_file',
      description: 'Read contents of a file',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Path to the file to read',
          required: true
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (default: utf8)',
          required: false,
          default: 'utf8',
          enum: ['utf8', 'ascii', 'base64', 'hex', 'utf16le']
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 10000,
      source: 'builtin'
    });

    // 文件写入工具
    this.registerTool({
      id: 'write_file',
      name: 'write_file',
      description: 'Write content to a file',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Path to the file to write',
          required: true
        },
        {
          name: 'content',
          type: 'string',
          description: 'Content to write to the file',
          required: true
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (default: utf8)',
          required: false,
          default: 'utf8',
          enum: ['utf8', 'ascii', 'base64', 'hex']
        },
        {
          name: 'mode',
          type: 'string',
          description: 'Write mode (default: overwrite)',
          required: false,
          default: 'overwrite',
          enum: ['overwrite', 'append']
        }
      ],
      permissionLevel: 'user_approval',
      isEnabled: true,
      isSandboxed: true,
      timeout: 10000,
      source: 'builtin'
    });

    // 文件编辑工具
    this.registerTool({
      id: 'edit_file',
      name: 'edit_file',
      description: 'Edit a file by applying a diff or replacement',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Path to the file to edit',
          required: true
        },
        {
          name: 'search',
          type: 'string',
          description: 'Text to search for',
          required: true
        },
        {
          name: 'replace',
          type: 'string',
          description: 'Text to replace with',
          required: true
        },
        {
          name: 'all',
          type: 'boolean',
          description: 'Replace all occurrences (default: false)',
          required: false,
          default: false
        }
      ],
      permissionLevel: 'user_approval',
      isEnabled: true,
      isSandboxed: true,
      timeout: 10000,
      source: 'builtin'
    });

    // Grep 搜索工具
    this.registerTool({
      id: 'grep',
      name: 'grep',
      description: 'Search for patterns in files',
      category: 'development' as ToolCategory,
      parameters: [
        {
          name: 'pattern',
          type: 'string',
          description: 'Pattern to search for (regex supported)',
          required: true
        },
        {
          name: 'path',
          type: 'string',
          description: 'File or directory to search in',
          required: false,
          default: '.'
        },
        {
          name: 'recursive',
          type: 'boolean',
          description: 'Search recursively in directories',
          required: false,
          default: true
        },
        {
          name: 'ignoreCase',
          type: 'boolean',
          description: 'Case-insensitive search',
          required: false,
          default: false
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 30000,
      source: 'builtin'
    });

    // Glob 文件模式匹配工具
    this.registerTool({
      id: 'glob',
      name: 'glob',
      description: 'Find files using glob patterns',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'pattern',
          type: 'string',
          description: 'Glob pattern to match files',
          required: true
        },
        {
          name: 'cwd',
          type: 'string',
          description: 'Working directory',
          required: false,
          default: '.'
        },
        {
          name: 'ignore',
          type: 'array',
          description: 'Patterns to ignore',
          required: false,
          default: ['**/node_modules/**', '**/.git/**']
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 10000,
      source: 'builtin'
    });

    // 目录列表工具
    this.registerTool({
      id: 'ls',
      name: 'ls',
      description: 'List directory contents',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Directory path to list',
          required: false,
          default: '.'
        },
        {
          name: 'showHidden',
          type: 'boolean',
          description: 'Show hidden files',
          required: false,
          default: false
        },
        {
          name: 'details',
          type: 'boolean',
          description: 'Show detailed information',
          required: false,
          default: false
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 10000,
      source: 'builtin'
    });

    // 注册 Web 搜索工具
    this.registerTool(webSearchTool.getToolDefinition());

    // 注册图像处理工具
    this.registerTool(imageProcessingTool.getToolDefinition());

    // 注册多文件读取工具
    this.registerTool(this.readManyFilesTool.getToolDefinition());

    // 注册文件查找工具
    this.registerTool(this.findFilesTool.getToolDefinition());

    // 注册记忆工具
    this.registerTool(this.memoryTool.getToolDefinition());

    // 注册 Git 工具
    this.registerTool(this.gitTool.getToolDefinition());
  }

  /**
   * 注册工具
   */
  private registerTool(tool: Tool): void {
    this.builtinTools.set(tool.name, tool);
  }

  /**
   * 获取所有内置工具
   */
  getBuiltinTools(): Tool[] {
    return Array.from(this.builtinTools.values());
  }

  /**
   * 获取特定工具
   */
  getTool(toolName: string): Tool | undefined {
    return this.builtinTools.get(toolName);
  }

  /**
   * 发送日志事件
   */
  private emitLog(
    executionId: string,
    level: 'info' | 'warning' | 'error' | 'debug' | 'success',
    message: string,
    data?: any
  ): void {
    const logEntry = {
      id: `${executionId}-${Date.now()}`,
      timestamp: new Date(),
      level,
      message,
      data,
      source: 'tool'
    };
    
    this.emit('tool:log', { executionId, logEntry });
  }

  /**
   * 执行工具
   */
  async executeTool(
    execution: ToolExecution,
    context?: { abortSignal?: AbortSignal; onProgress?: (msg: string) => void }
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.builtinTools.get(execution.toolName);

    if (!tool) {
      this.emitLog(execution.id, 'error', `工具 '${execution.toolName}' 未找到`);
      return this.createErrorResult(
        execution.id,
        'TOOL_NOT_FOUND',
        `Tool '${execution.toolName}' not found`
      );
    }

    try {
      this.emitLog(execution.id, 'info', `开始执行工具: ${execution.toolName}`, {
        toolName: execution.toolName,
        input: execution.input
      });

      let output: any;

      switch (execution.toolName) {
        case 'run_shell_command':
          output = await this.executeShell(execution.input as any, context, execution.id);
          break;

        case 'read_file':
          output = await this.executeReadFile(execution.input as any, execution.id);
          break;

        case 'write_file':
          output = await this.executeWriteFile(execution.input as any, execution.id);
          break;

        case 'edit_file':
          output = await this.executeEditFile(execution.input as any, execution.id);
          break;

        case 'grep':
          output = await this.executeGrep(execution.input as any, execution.id);
          break;

        case 'glob':
          output = await this.executeGlob(execution.input as any, execution.id);
          break;

        case 'ls':
          output = await this.executeLs(execution.input as any, execution.id);
          break;

        case 'web_search':
          output = await this.executeWebSearch(execution.input as any, execution.id);
          break;

        case 'process_image':
          output = await this.executeImageProcessing(execution.input as any, execution.id);
          break;

        case 'read_many_files':
          output = await this.readManyFilesTool.execute(execution.input as any);
          break;

        case 'find_files':
          output = await this.findFilesTool.execute(execution.input as any);
          break;

        case 'memory':
          output = await this.memoryTool.execute(execution.input as any);
          break;

        case 'git':
          output = await this.gitTool.execute(execution.input as any);
          break;

        default:
          throw new Error(`Tool '${execution.toolName}' not implemented`);
      }

      const executionTime = Date.now() - startTime;

      this.emitLog(execution.id, 'success', `工具执行成功`, {
        executionTime,
        outputLength: typeof output === 'string' ? output.length : undefined
      });

      return {
        toolExecutionId: execution.id,
        success: true,
        output,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('工具执行失败', { tool: execution.toolName, error });

      return this.createErrorResult(
        execution.id,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : String(error),
        executionTime
      );
    }
  }

  /**
   * 执行 Shell 命令
   */
  private async executeShell(
    params: { command: string; description?: string; cwd?: string },
    context?: { abortSignal?: AbortSignal; onProgress?: (msg: string) => void },
    executionId?: string
  ): Promise<string> {
    const { command, cwd } = params;

    if (!command) {
      throw new Error('Command is required');
    }

    if (executionId) {
      this.emitLog(executionId, 'debug', `执行命令: ${command}`, { cwd });
    }

    const workingDir = cwd
      ? path.resolve(this.projectRoot, cwd)
      : this.projectRoot;

    // 验证目录存在
    try {
      await fs.access(workingDir);
    } catch {
      throw new Error(`Directory does not exist: ${workingDir}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000,
        signal: context?.abortSignal
      });

      const output = stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : '');
      
      if (executionId && stderr) {
        this.emitLog(executionId, 'warning', 'STDERR 输出', { stderr });
      }

      if (executionId) {
        this.emitLog(executionId, 'info', '命令执行完成', { 
          outputLines: output.split('\n').length 
        });
      }
      
      if (context?.onProgress) {
        context.onProgress(output);
      }

      return output;
    } catch (error: any) {
      if (executionId) {
        this.emitLog(executionId, 'error', `命令执行失败: ${error.message}`);
      }
      
      if (error.killed) {
        throw new Error('Command timed out');
      }
      if (error.signal === 'SIGTERM') {
        throw new Error('Command was cancelled');
      }
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  /**
   * 读取文件
   */
  private async executeReadFile(
    params: { path: string; encoding?: BufferEncoding },
    executionId?: string
  ): Promise<string> {
    const { path: filePath, encoding = 'utf8' } = params;

    if (!filePath) {
      throw new Error('File path is required');
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.projectRoot, filePath);

    try {
      const content = await fs.readFile(fullPath, encoding);
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * 写入文件
   */
  private async executeWriteFile(
    params: {
      path: string;
      content: string;
      encoding?: BufferEncoding;
      mode?: 'overwrite' | 'append';
    }
  ): Promise<string> {
    const { path: filePath, content, encoding = 'utf8', mode = 'overwrite' } = params;

    if (!filePath) {
      throw new Error('File path is required');
    }
    if (content === undefined) {
      throw new Error('Content is required');
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.projectRoot, filePath);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error: any) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }

    try {
      if (mode === 'append') {
        await fs.appendFile(fullPath, content, encoding);
      } else {
        await fs.writeFile(fullPath, content, encoding);
      }
      return `File ${mode === 'append' ? 'appended' : 'written'} successfully: ${filePath}`;
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * 编辑文件
   */
  private async executeEditFile(
    params: {
      path: string;
      search: string;
      replace: string;
      all?: boolean;
    }
  ): Promise<string> {
    const { path: filePath, search, replace, all = false } = params;

    if (!filePath || !search || replace === undefined) {
      throw new Error('Path, search, and replace are required');
    }

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.projectRoot, filePath);

    try {
      let content = await fs.readFile(fullPath, 'utf8');
      let replacements = 0;

      if (all) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        content = content.replace(regex, () => {
          replacements++;
          return replace;
        });
      } else {
        const index = content.indexOf(search);
        if (index !== -1) {
          content = content.substring(0, index) + replace + content.substring(index + search.length);
          replacements = 1;
        }
      }

      if (replacements === 0) {
        throw new Error('No matches found');
      }

      await fs.writeFile(fullPath, content, 'utf8');
      return `Replaced ${replacements} occurrence${replacements > 1 ? 's' : ''} in ${filePath}`;
    } catch (error: any) {
      if (error.message === 'No matches found') {
        throw error;
      }
      throw new Error(`Failed to edit file: ${error.message}`);
    }
  }

  /**
   * 执行 Grep
   */
  private async executeGrep(
    params: {
      pattern: string;
      path?: string;
      recursive?: boolean;
      ignoreCase?: boolean;
    }
  ): Promise<any> {
    const { pattern, path: searchPath = '.', recursive = true, ignoreCase = false } = params;

    if (!pattern) {
      throw new Error('Pattern is required');
    }

    const fullPath = path.isAbsolute(searchPath)
      ? searchPath
      : path.resolve(this.projectRoot, searchPath);

    const command = `grep ${ignoreCase ? '-i' : ''} ${recursive ? '-r' : ''} -n "${pattern}" "${fullPath}" 2>/dev/null || true`;

    try {
      const { stdout } = await execAsync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.split('\n').filter(line => line.trim());
      const results = lines.map(line => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          return {
            file: match[1],
            line: parseInt(match[2]),
            content: match[3]
          };
        }
        return { raw: line };
      });

      return {
        pattern,
        matchCount: results.length,
        matches: results
      };
    } catch (error: any) {
      throw new Error(`Grep failed: ${error.message}`);
    }
  }

  /**
   * 执行 Glob
   */
  private async executeGlob(
    params: {
      pattern: string;
      cwd?: string;
      ignore?: string[];
    }
  ): Promise<string[]> {
    const { pattern, cwd = '.', ignore = ['**/node_modules/**', '**/.git/**'] } = params;

    if (!pattern) {
      throw new Error('Pattern is required');
    }

    const workingDir = path.isAbsolute(cwd)
      ? cwd
      : path.resolve(this.projectRoot, cwd);

    try {
      const files = await globAsync(pattern, {
        cwd: workingDir,
        ignore,
        nodir: false
      });

      return files;
    } catch (error: any) {
      throw new Error(`Glob failed: ${error.message}`);
    }
  }

  /**
   * 执行 ls
   */
  private async executeLs(
    params: {
      path?: string;
      showHidden?: boolean;
      details?: boolean;
    }
  ): Promise<any> {
    const { path: dirPath = '.', showHidden = false, details = false } = params;

    const fullPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.resolve(this.projectRoot, dirPath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      const files = await Promise.all(
        entries
          .filter(entry => showHidden || !entry.name.startsWith('.'))
          .map(async entry => {
            const filePath = path.join(fullPath, entry.name);
            
            if (details) {
              const stats = await fs.stat(filePath);
              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime.toISOString(),
                permissions: stats.mode.toString(8).slice(-3)
              };
            }
            
            return {
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file'
            };
          })
      );

      return files;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * 执行 Web 搜索
   */
  private async executeWebSearch(
    params: any,
    executionId?: string
  ): Promise<any> {
    if (executionId) {
      this.emitLog(executionId, 'info', '开始执行 Web 搜索', { query: params.query });
    }

    try {
      const results = await webSearchTool.execute(params);
      
      if (executionId) {
        this.emitLog(executionId, 'success', `搜索完成，找到 ${results.length} 个结果`);
      }

      return results;
    } catch (error: any) {
      if (executionId) {
        this.emitLog(executionId, 'error', `搜索失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 执行图像处理
   */
  private async executeImageProcessing(
    params: any,
    executionId?: string
  ): Promise<any> {
    if (executionId) {
      this.emitLog(executionId, 'info', '开始处理图像', { 
        action: params.action,
        inputPath: params.inputPath 
      });
    }

    try {
      const result = await imageProcessingTool.execute(params);
      
      if (executionId) {
        this.emitLog(executionId, 'success', '图像处理完成', { result });
      }

      return result;
    } catch (error: any) {
      if (executionId) {
        this.emitLog(executionId, 'error', `图像处理失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    executionId: string,
    code: string,
    message: string,
    executionTime: number = 0
  ): ToolResult {
    const error: ToolExecutionError = {
      code,
      message
    };

    return {
      toolExecutionId: executionId,
      success: false,
      error,
      executionTime
    };
  }
}