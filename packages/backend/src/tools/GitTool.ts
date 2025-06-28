import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { Tool, ToolCategory } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export interface GitToolParams {
  command: string;
  args?: string[];
  cwd?: string;
}

export interface GitToolResult {
  output: string;
  exitCode: number;
  command: string;
}

class GitTool {
  private projectRoot: string;
  private allowedCommands = [
    'status', 'log', 'diff', 'branch', 'show',
    'add', 'commit', 'push', 'pull', 'fetch',
    'checkout', 'merge', 'rebase', 'reset',
    'stash', 'tag', 'remote', 'config'
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  getToolDefinition(): Tool {
    return {
      id: 'git',
      name: 'git',
      description: 'Execute git commands in the project repository',
      category: 'development' as ToolCategory,
      parameters: [
        {
          name: 'command',
          type: 'string',
          description: 'Git command to execute (e.g., status, log, diff)',
          required: true,
          enum: this.allowedCommands
        },
        {
          name: 'args',
          type: 'array',
          description: 'Additional arguments for the git command',
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
    };
  }

  async execute(params: GitToolParams): Promise<GitToolResult> {
    const { command, args = [], cwd } = params;

    if (!command) {
      throw new Error('Git command is required');
    }

    if (!this.allowedCommands.includes(command)) {
      throw new Error(`Git command '${command}' is not allowed`);
    }

    const workingDir = cwd
      ? path.resolve(this.projectRoot, cwd)
      : this.projectRoot;

    // 构建完整的 git 命令
    const gitArgs = [command, ...args].map(arg => {
      // 对包含空格的参数进行引号包裹
      if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
        return `"${arg}"`;
      }
      return arg;
    });

    const fullCommand = `git ${gitArgs.join(' ')}`;

    try {
      logger.info(`Executing git command: ${fullCommand}`, { cwd: workingDir });

      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: workingDir,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000
      });

      const output = stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : '');

      return {
        output: output.trim(),
        exitCode: 0,
        command: fullCommand
      };
    } catch (error: any) {
      logger.error(`Git command failed: ${fullCommand}`, error);

      // 即使命令失败，也返回输出（如果有）
      const output = (error.stdout || '') + 
                    (error.stderr ? `\n\nERROR:\n${error.stderr}` : '');

      return {
        output: output.trim() || error.message,
        exitCode: error.code || 1,
        command: fullCommand
      };
    }
  }

  /**
   * 检查是否在 Git 仓库中（辅助方法）
   */
  async isGitRepository(dir?: string): Promise<boolean> {
    const checkDir = dir || this.projectRoot;
    
    try {
      await execAsync('git rev-parse --git-dir', {
        cwd: checkDir,
        encoding: 'utf8'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前分支（辅助方法）
   */
  async getCurrentBranch(dir?: string): Promise<string | null> {
    const checkDir = dir || this.projectRoot;
    
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: checkDir,
        encoding: 'utf8'
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * 获取仓库状态摘要（辅助方法）
   */
  async getStatusSummary(dir?: string): Promise<{
    branch: string | null;
    clean: boolean;
    ahead: number;
    behind: number;
    staged: number;
    unstaged: number;
    untracked: number;
  }> {
    const checkDir = dir || this.projectRoot;
    
    try {
      // 获取当前分支
      const branch = await this.getCurrentBranch(checkDir);
      
      // 获取状态
      const { stdout } = await execAsync('git status --porcelain=v1 -b', {
        cwd: checkDir,
        encoding: 'utf8'
      });

      const lines = stdout.split('\n').filter(line => line.trim());
      let ahead = 0, behind = 0;
      let staged = 0, unstaged = 0, untracked = 0;

      for (const line of lines) {
        if (line.startsWith('##')) {
          // 分支信息行
          const match = line.match(/\[ahead (\d+), behind (\d+)\]|\[ahead (\d+)\]|\[behind (\d+)\]/);
          if (match) {
            ahead = parseInt(match[1] || match[3] || '0');
            behind = parseInt(match[2] || match[4] || '0');
          }
        } else {
          // 文件状态
          const status = line.substring(0, 2);
          if (status === '??') {
            untracked++;
          } else if (status[0] !== ' ' && status[0] !== '?') {
            staged++;
          }
          if (status[1] !== ' ' && status[1] !== '?') {
            unstaged++;
          }
        }
      }

      return {
        branch,
        clean: staged === 0 && unstaged === 0 && untracked === 0,
        ahead,
        behind,
        staged,
        unstaged,
        untracked
      };
    } catch (error) {
      logger.error('Failed to get git status summary', error);
      return {
        branch: null,
        clean: true,
        ahead: 0,
        behind: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0
      };
    }
  }
}

// 导出单例
let instance: GitTool | null = null;

export const createGitTool = (projectRoot: string): GitTool => {
  if (!instance) {
    instance = new GitTool(projectRoot);
  }
  return instance;
};