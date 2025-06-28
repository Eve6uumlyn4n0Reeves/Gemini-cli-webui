import { Tool, ToolCategory, ToolPermissionLevel } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  channels: number;
  hasAlpha: boolean;
}

interface ImageProcessParams {
  action: 'info' | 'resize' | 'convert' | 'rotate' | 'crop' | 'grayscale' | 'blur';
  inputPath: string;
  outputPath?: string;
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  angle?: number;
  x?: number;
  y?: number;
}

/**
 * 图像处理工具
 * 使用 sharp 库进行图像处理
 */
export class ImageProcessingTool {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * 获取工具定义
   */
  getToolDefinition(): Tool {
    return {
      id: 'image-processing',
      name: 'process_image',
      description: 'Process images with various operations like resize, convert, rotate, crop, etc.',
      category: 'development' as ToolCategory,
      parameters: [
        {
          name: 'action',
          type: 'string',
          description: 'Action to perform: info, resize, convert, rotate, crop, grayscale, blur',
          required: true,
          enum: ['info', 'resize', 'convert', 'rotate', 'crop', 'grayscale', 'blur']
        },
        {
          name: 'inputPath',
          type: 'string',
          description: 'Path to input image',
          required: true
        },
        {
          name: 'outputPath',
          type: 'string',
          description: 'Path for output image (required for all actions except info)',
          required: false
        },
        {
          name: 'width',
          type: 'number',
          description: 'Target width for resize/crop',
          required: false
        },
        {
          name: 'height',
          type: 'number',
          description: 'Target height for resize/crop',
          required: false
        },
        {
          name: 'format',
          type: 'string',
          description: 'Output format for convert action',
          required: false,
          enum: ['jpeg', 'png', 'webp', 'avif']
        },
        {
          name: 'quality',
          type: 'number',
          description: 'Output quality (1-100)',
          required: false,
          default: 80,
          minimum: 1,
          maximum: 100
        },
        {
          name: 'angle',
          type: 'number',
          description: 'Rotation angle in degrees',
          required: false
        },
        {
          name: 'x',
          type: 'number',
          description: 'X coordinate for crop',
          required: false
        },
        {
          name: 'y',
          type: 'number',
          description: 'Y coordinate for crop',
          required: false
        }
      ],
      permissionLevel: 'auto' as ToolPermissionLevel,
      isEnabled: true,
      isSandboxed: false,
      timeout: 30000,
      source: 'builtin'
    };
  }

  /**
   * 执行图像处理
   */
  async execute(params: ImageProcessParams): Promise<any> {
    const { action, inputPath } = params;

    if (!inputPath) {
      throw new Error('Input path is required');
    }

    const fullInputPath = path.isAbsolute(inputPath)
      ? inputPath
      : path.resolve(this.projectRoot, inputPath);

    // 验证文件存在
    try {
      await fs.access(fullInputPath);
    } catch {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    switch (action) {
      case 'info':
        return await this.getImageInfo(fullInputPath);
      
      case 'resize':
        return await this.resizeImage(fullInputPath, params);
      
      case 'convert':
        return await this.convertImage(fullInputPath, params);
      
      case 'rotate':
        return await this.rotateImage(fullInputPath, params);
      
      case 'crop':
        return await this.cropImage(fullInputPath, params);
      
      case 'grayscale':
        return await this.grayscaleImage(fullInputPath, params);
      
      case 'blur':
        return await this.blurImage(fullInputPath, params);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 获取图像信息
   */
  private async getImageInfo(inputPath: string): Promise<ImageInfo> {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    const stats = await fs.stat(inputPath);

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stats.size,
      channels: metadata.channels || 0,
      hasAlpha: metadata.hasAlpha || false
    };
  }

  /**
   * 调整图像大小
   */
  private async resizeImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath, width, height, quality = 80 } = params;

    if (!outputPath) {
      throw new Error('Output path is required for resize');
    }

    if (!width && !height) {
      throw new Error('Width or height is required for resize');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toFile(fullOutputPath);

    return `Image resized successfully to ${fullOutputPath}`;
  }

  /**
   * 转换图像格式
   */
  private async convertImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath, format, quality = 80 } = params;

    if (!outputPath) {
      throw new Error('Output path is required for convert');
    }

    if (!format) {
      throw new Error('Format is required for convert');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    const image = sharp(inputPath);

    switch (format) {
      case 'jpeg':
        await image.jpeg({ quality }).toFile(fullOutputPath);
        break;
      case 'png':
        await image.png({ quality }).toFile(fullOutputPath);
        break;
      case 'webp':
        await image.webp({ quality }).toFile(fullOutputPath);
        break;
      case 'avif':
        await image.avif({ quality }).toFile(fullOutputPath);
        break;
    }

    return `Image converted to ${format} format at ${fullOutputPath}`;
  }

  /**
   * 旋转图像
   */
  private async rotateImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath, angle = 90 } = params;

    if (!outputPath) {
      throw new Error('Output path is required for rotate');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    await sharp(inputPath)
      .rotate(angle)
      .toFile(fullOutputPath);

    return `Image rotated ${angle} degrees and saved to ${fullOutputPath}`;
  }

  /**
   * 裁剪图像
   */
  private async cropImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath, x = 0, y = 0, width, height } = params;

    if (!outputPath) {
      throw new Error('Output path is required for crop');
    }

    if (!width || !height) {
      throw new Error('Width and height are required for crop');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    await sharp(inputPath)
      .extract({ left: x, top: y, width, height })
      .toFile(fullOutputPath);

    return `Image cropped to ${width}x${height} at (${x}, ${y}) and saved to ${fullOutputPath}`;
  }

  /**
   * 转换为灰度图像
   */
  private async grayscaleImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath } = params;

    if (!outputPath) {
      throw new Error('Output path is required for grayscale');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    await sharp(inputPath)
      .grayscale()
      .toFile(fullOutputPath);

    return `Image converted to grayscale and saved to ${fullOutputPath}`;
  }

  /**
   * 模糊图像
   */
  private async blurImage(
    inputPath: string,
    params: ImageProcessParams
  ): Promise<string> {
    const { outputPath } = params;

    if (!outputPath) {
      throw new Error('Output path is required for blur');
    }

    const fullOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(this.projectRoot, outputPath);

    await sharp(inputPath)
      .blur(5)
      .toFile(fullOutputPath);

    return `Image blurred and saved to ${fullOutputPath}`;
  }
}

// 导出单例
export const imageProcessingTool = new ImageProcessingTool();