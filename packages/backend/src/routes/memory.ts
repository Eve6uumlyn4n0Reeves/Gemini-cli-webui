import { Router } from 'express';
import { createMemoryTool } from '../tools/MemoryTool.js';
import { asyncHandler } from '../utils/index.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';
import * as fs from 'fs/promises';

const router = Router();

// 获取项目的 GEMINI.md 内容
router.get('/project/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  // TODO: 根据 projectId 获取项目路径
  // 这里暂时使用当前工作目录
  const projectRoot = process.cwd();
  const memoryTool = createMemoryTool(projectRoot);
  
  try {
    const content = await memoryTool.readMemories();
    
    if (!content) {
      return res.json({
        success: true,
        data: {
          content: '',
          exists: false,
          path: path.join(projectRoot, 'GEMINI.md')
        }
      });
    }
    
    return res.json({
      success: true,
      data: {
        content,
        exists: true,
        path: path.join(projectRoot, 'GEMINI.md')
      }
    });
  } catch (error: any) {
    logger.error('Failed to read GEMINI.md', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to read memory file',
      message: error.message
    });
  }
}));

// 更新项目的 GEMINI.md 内容
router.put('/project/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;
  
  if (typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Content must be a string'
    });
  }
  
  // TODO: 根据 projectId 获取项目路径
  const projectRoot = process.cwd();
  const memoryPath = path.join(projectRoot, 'GEMINI.md');
  
  try {
    await fs.writeFile(memoryPath, content, 'utf8');
    
    logger.info('GEMINI.md updated', { projectId, size: content.length });
    
    return res.json({
      success: true,
      data: {
        path: memoryPath,
        size: content.length,
        updatedAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Failed to update GEMINI.md', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update memory file',
      message: error.message
    });
  }
}));

// 搜索记忆内容
router.get('/search', asyncHandler(async (req, res) => {
  const { q: query, projectId } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Query parameter is required'
    });
  }
  
  // TODO: 根据 projectId 获取项目路径
  const projectRoot = process.cwd();
  const memoryTool = createMemoryTool(projectRoot);
  
  try {
    const matches = await memoryTool.searchMemories(query);
    
    return res.json({
      success: true,
      data: {
        query,
        matches,
        count: matches.length
      }
    });
  } catch (error: any) {
    logger.error('Failed to search memories', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search memories',
      message: error.message
    });
  }
}));

// 获取全局 GEMINI.md（用户主目录下的）
router.get('/global', asyncHandler(async (req, res) => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const globalMemoryPath = path.join(homeDir, '.gemini', 'GEMINI.md');
  
  try {
    const content = await fs.readFile(globalMemoryPath, 'utf8');
    
    return res.json({
      success: true,
      data: {
        content,
        exists: true,
        path: globalMemoryPath
      }
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.json({
        success: true,
        data: {
          content: '',
          exists: false,
          path: globalMemoryPath
        }
      });
    }
    
    logger.error('Failed to read global GEMINI.md', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to read global memory file',
      message: error.message
    });
  }
}));

// 更新全局 GEMINI.md
router.put('/global', asyncHandler(async (req, res) => {
  const { content } = req.body;
  
  if (typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Content must be a string'
    });
  }
  
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const globalMemoryDir = path.join(homeDir, '.gemini');
  const globalMemoryPath = path.join(globalMemoryDir, 'GEMINI.md');
  
  try {
    // 确保目录存在
    await fs.mkdir(globalMemoryDir, { recursive: true });
    
    await fs.writeFile(globalMemoryPath, content, 'utf8');
    
    logger.info('Global GEMINI.md updated', { size: content.length });
    
    return res.json({
      success: true,
      data: {
        path: globalMemoryPath,
        size: content.length,
        updatedAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Failed to update global GEMINI.md', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update global memory file',
      message: error.message
    });
  }
}));

export default router;