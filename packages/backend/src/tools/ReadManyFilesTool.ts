import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import type { Tool, ToolCategory } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';

export interface ReadManyFilesParams {
  paths: string[];
  encoding?: BufferEncoding;
  maxFileSizeMB?: number;
  includeContent?: boolean;
}

export interface FileReadResult {
  path: string;
  success: boolean;
  content?: string;
  error?: string;
  size?: number;
}

export interface ReadManyFilesResult {
  files: FileReadResult[];
  totalSize: number;
  successCount: number;
  errorCount: number;
}

class ReadManyFilesTool {
  private projectRoot: string;
  private defaultIgnorePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/*.lock',
    '**/*.log'
  ];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  getToolDefinition(): Tool {
    return {
      id: 'read_many_files',
      name: 'read_many_files',
      description: 'Read multiple files at once, supports glob patterns',
      category: 'filesystem' as ToolCategory,
      parameters: [
        {
          name: 'paths',
          type: 'array',
          description: 'Array of file paths or glob patterns',
          required: true
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'File encoding (default: utf8)',
          required: false,
          default: 'utf8'
        },
        {
          name: 'maxFileSizeMB',
          type: 'number',
          description: 'Maximum file size in MB to read (default: 10)',
          required: false,
          default: 10
        },
        {
          name: 'includeContent',
          type: 'boolean',
          description: 'Whether to include file content (default: true)',
          required: false,
          default: true
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 30000,
      source: 'builtin'
    };
  }

  async execute(params: ReadManyFilesParams): Promise<ReadManyFilesResult> {
    const { 
      paths, 
      encoding = 'utf8', 
      maxFileSizeMB = 10,
      includeContent = true 
    } = params;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      throw new Error('Paths array is required and must not be empty');
    }

    const maxFileSize = maxFileSizeMB * 1024 * 1024;
    const resolvedPaths = await this.resolvePaths(paths);
    const results: FileReadResult[] = [];
    let totalSize = 0;

    for (const filePath of resolvedPaths) {
      try {
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(this.projectRoot, filePath);

        const stats = await fs.stat(fullPath);
        
        if (!stats.isFile()) {
          results.push({
            path: filePath,
            success: false,
            error: 'Not a file'
          });
          continue;
        }

        if (stats.size > maxFileSize) {
          results.push({
            path: filePath,
            success: false,
            error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB > ${maxFileSizeMB}MB)`,
            size: stats.size
          });
          continue;
        }

        if (includeContent) {
          const content = await fs.readFile(fullPath, encoding);
          results.push({
            path: filePath,
            success: true,
            content,
            size: stats.size
          });
        } else {
          results.push({
            path: filePath,
            success: true,
            size: stats.size
          });
        }

        totalSize += stats.size;
      } catch (error: any) {
        results.push({
          path: filePath,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return {
      files: results,
      totalSize,
      successCount,
      errorCount
    };
  }

  private async resolvePaths(patterns: string[]): Promise<string[]> {
    const resolvedPaths = new Set<string>();

    for (const pattern of patterns) {
      // 如果是 glob 模式
      if (this.isGlobPattern(pattern)) {
        try {
          const files = await glob(pattern, {
            cwd: this.projectRoot,
            ignore: this.defaultIgnorePatterns,
            nodir: true,
            absolute: false
          });
          
          files.forEach(file => resolvedPaths.add(file));
        } catch (error) {
          logger.warn(`Failed to resolve glob pattern: ${pattern}`, error);
        }
      } else {
        // 普通路径
        resolvedPaths.add(pattern);
      }
    }

    return Array.from(resolvedPaths);
  }

  private isGlobPattern(pattern: string): boolean {
    return pattern.includes('*') || 
           pattern.includes('?') || 
           pattern.includes('[') || 
           pattern.includes('{');
  }
}

// 导出单例
let instance: ReadManyFilesTool | null = null;

export const createReadManyFilesTool = (projectRoot: string): ReadManyFilesTool => {
  if (!instance) {
    instance = new ReadManyFilesTool(projectRoot);
  }
  return instance;
};