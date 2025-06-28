import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { Tool, ToolCategory } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';

export interface FindFilesParams {
  pattern: string;
  cwd?: string;
  maxDepth?: number;
  includeHidden?: boolean;
  excludePatterns?: string[];
  caseSensitive?: boolean;
  sortBy?: 'name' | 'size' | 'modified';
  limit?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  relativePath: string;
}

export interface FindFilesResult {
  files: FileInfo[];
  totalFound: number;
  searchTime: number;
}

class FindFilesTool {
  private projectRoot: string;
  private defaultExcludePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/.turbo/**'
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  getToolDefinition(): Tool {
    return {
      id: 'find_files',
      name: 'find_files',
      description: 'Find files using advanced glob patterns with sorting and filtering',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'pattern',
          type: 'string',
          description: 'Glob pattern to search for files',
          required: true
        },
        {
          name: 'cwd',
          type: 'string',
          description: 'Working directory for search',
          required: false
        },
        {
          name: 'maxDepth',
          type: 'number',
          description: 'Maximum directory depth to search',
          required: false
        },
        {
          name: 'includeHidden',
          type: 'boolean',
          description: 'Include hidden files (starting with .)',
          required: false,
          default: false
        },
        {
          name: 'excludePatterns',
          type: 'array',
          description: 'Additional patterns to exclude',
          required: false
        },
        {
          name: 'caseSensitive',
          type: 'boolean',
          description: 'Case sensitive search',
          required: false,
          default: true
        },
        {
          name: 'sortBy',
          type: 'string',
          description: 'Sort results by name, size, or modified date',
          required: false,
          enum: ['name', 'size', 'modified'],
          default: 'name'
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
          default: 100
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 30000,
      source: 'builtin'
    };
  }

  async execute(params: FindFilesParams): Promise<FindFilesResult> {
    const startTime = Date.now();
    const {
      pattern,
      cwd = '.',
      maxDepth,
      includeHidden = false,
      excludePatterns = [],
      caseSensitive = true,
      sortBy = 'name',
      limit = 100
    } = params;

    if (!pattern) {
      throw new Error('Pattern is required');
    }

    const workingDir = path.isAbsolute(cwd)
      ? cwd
      : path.resolve(this.projectRoot, cwd);

    // 组合排除模式
    const ignorePatterns = [
      ...this.defaultExcludePatterns,
      ...excludePatterns
    ];

    // 如果不包含隐藏文件，添加隐藏文件排除模式
    if (!includeHidden) {
      ignorePatterns.push('**/.*', '**/.*/**');
    }

    try {
      // 使用 glob 查找文件
      const globOptions: any = {
        cwd: workingDir,
        ignore: ignorePatterns,
        nocase: !caseSensitive,
        absolute: false,
        dot: includeHidden
      };

      if (maxDepth !== undefined) {
        globOptions.maxDepth = maxDepth;
      }

      const files = await glob(pattern, globOptions);
      
      // 获取文件信息
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(workingDir, file);
          try {
            const stats = await fs.stat(fullPath);
            return {
              path: fullPath,
              name: path.basename(file),
              size: stats.size,
              modified: stats.mtime.toISOString(),
              isDirectory: stats.isDirectory(),
              relativePath: file
            };
          } catch (error) {
            // 忽略无法访问的文件
            return null;
          }
        })
      );

      // 过滤掉 null 结果
      let validFiles = fileInfos.filter((f): f is FileInfo => f !== null);

      // 排序
      validFiles = this.sortFiles(validFiles, sortBy);

      // 限制结果数量
      const limitedFiles = validFiles.slice(0, limit);
      const searchTime = Date.now() - startTime;

      return {
        files: limitedFiles,
        totalFound: validFiles.length,
        searchTime
      };
    } catch (error: any) {
      throw new Error(`Find files failed: ${error.message}`);
    }
  }

  private sortFiles(files: FileInfo[], sortBy: 'name' | 'size' | 'modified'): FileInfo[] {
    switch (sortBy) {
      case 'name':
        return files.sort((a, b) => a.name.localeCompare(b.name));
      
      case 'size':
        return files.sort((a, b) => b.size - a.size);
      
      case 'modified':
        return files.sort((a, b) => 
          new Date(b.modified).getTime() - new Date(a.modified).getTime()
        );
      
      default:
        return files;
    }
  }
}

// 导出单例
let instance: FindFilesTool | null = null;

export const createFindFilesTool = (projectRoot: string): FindFilesTool => {
  if (!instance) {
    instance = new FindFilesTool(projectRoot);
  }
  return instance;
};