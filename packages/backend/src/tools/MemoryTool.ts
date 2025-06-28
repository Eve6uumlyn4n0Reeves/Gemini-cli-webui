import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolCategory } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';

export interface MemoryToolParams {
  content: string;
  category?: string;
  tags?: string[];
  overwrite?: boolean;
}

export interface MemoryToolResult {
  success: boolean;
  message: string;
  filePath: string;
  totalMemories?: number;
}

class MemoryTool {
  private projectRoot: string;
  private memoryFileName = 'GEMINI.md';
  
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  getToolDefinition(): Tool {
    return {
      id: 'memory',
      name: 'memory',
      description: 'Save important information to GEMINI.md for long-term memory',
      category: 'development' as ToolCategory,
      parameters: [
        {
          name: 'content',
          type: 'string',
          description: 'Content to save to memory',
          required: true
        },
        {
          name: 'category',
          type: 'string',
          description: 'Category or section for the memory',
          required: false,
          default: 'General'
        },
        {
          name: 'tags',
          type: 'array',
          description: 'Tags to associate with this memory',
          required: false
        },
        {
          name: 'overwrite',
          type: 'boolean',
          description: 'Overwrite existing file instead of appending',
          required: false,
          default: false
        }
      ],
      permissionLevel: 'auto',
      isEnabled: true,
      isSandboxed: false,
      timeout: 10000,
      source: 'builtin'
    };
  }

  async execute(params: MemoryToolParams): Promise<MemoryToolResult> {
    const { 
      content, 
      category = 'General',
      tags = [],
      overwrite = false 
    } = params;

    if (!content || content.trim() === '') {
      throw new Error('Content is required and cannot be empty');
    }

    const memoryFilePath = path.join(this.projectRoot, this.memoryFileName);
    
    try {
      // 准备记忆内容
      const timestamp = new Date().toISOString();
      const formattedMemory = this.formatMemory(content, category, tags, timestamp);

      // 检查文件是否存在
      let existingContent = '';
      let totalMemories = 1;
      
      try {
        existingContent = await fs.readFile(memoryFilePath, 'utf8');
        if (!overwrite) {
          // 计算现有记忆数量
          totalMemories = (existingContent.match(/^## /gm) || []).length + 1;
        }
      } catch (error) {
        // 文件不存在，创建新文件
        logger.info('Creating new GEMINI.md file');
      }

      let finalContent: string;
      
      if (overwrite || !existingContent) {
        // 创建新文件或覆盖
        finalContent = this.createMemoryFileHeader() + formattedMemory;
      } else {
        // 追加到现有文件
        // 确保内容之间有适当的间隔
        finalContent = existingContent.trimEnd() + '\n\n' + formattedMemory;
      }

      // 写入文件
      await fs.writeFile(memoryFilePath, finalContent, 'utf8');

      logger.info(`Memory saved to ${memoryFilePath}`, {
        category,
        tags,
        overwrite,
        totalMemories
      });

      return {
        success: true,
        message: `Memory saved successfully to ${this.memoryFileName}`,
        filePath: memoryFilePath,
        totalMemories
      };
    } catch (error: any) {
      logger.error('Failed to save memory', error);
      throw new Error(`Failed to save memory: ${error.message}`);
    }
  }

  private createMemoryFileHeader(): string {
    return `# GEMINI.md - Project Memory

This file contains important information and context about the project that should be remembered across sessions.

---

`;
  }

  private formatMemory(
    content: string, 
    category: string, 
    tags: string[], 
    timestamp: string
  ): string {
    let formatted = `## ${category}\n\n`;
    
    // 添加元数据
    formatted += `> **Date**: ${timestamp}\n`;
    if (tags.length > 0) {
      formatted += `> **Tags**: ${tags.map(t => `\`${t}\``).join(', ')}\n`;
    }
    formatted += '\n';
    
    // 添加内容
    formatted += content.trim();
    formatted += '\n';
    
    return formatted;
  }

  /**
   * 读取所有记忆（辅助方法）
   */
  async readMemories(): Promise<string | null> {
    const memoryFilePath = path.join(this.projectRoot, this.memoryFileName);
    
    try {
      const content = await fs.readFile(memoryFilePath, 'utf8');
      return content;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 搜索记忆（辅助方法）
   */
  async searchMemories(query: string): Promise<string[]> {
    const content = await this.readMemories();
    if (!content) return [];

    const sections = content.split(/^## /m).filter(s => s.trim());
    const matches: string[] = [];

    for (const section of sections) {
      if (section.toLowerCase().includes(query.toLowerCase())) {
        matches.push('## ' + section.trim());
      }
    }

    return matches;
  }
}

// 导出单例
let instance: MemoryTool | null = null;

export const createMemoryTool = (projectRoot: string): MemoryTool => {
  if (!instance) {
    instance = new MemoryTool(projectRoot);
  }
  return instance;
};