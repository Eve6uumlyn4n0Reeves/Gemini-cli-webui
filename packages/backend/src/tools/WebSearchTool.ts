import { Tool, ToolCategory, ToolPermissionLevel } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';
import fetch from 'node-fetch';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

interface WebSearchParams {
  query: string;
  limit?: number;
  lang?: string;
}

/**
 * Web 搜索工具
 * 使用多个搜索引擎 API 获取搜索结果
 */
export class WebSearchTool {
  private apiKey?: string;
  private searchEngineId?: string;

  constructor(config?: { apiKey?: string; searchEngineId?: string }) {
    this.apiKey = config?.apiKey || process.env.GOOGLE_API_KEY;
    this.searchEngineId = config?.searchEngineId || process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  /**
   * 获取工具定义
   */
  getToolDefinition(): Tool {
    return {
      id: 'web-search',
      name: 'web_search',
      description: 'Search the web for information using Google Custom Search API',
      category: 'network' as ToolCategory,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results (1-10)',
          required: false,
          default: 5,
          minimum: 1,
          maximum: 10
        },
        {
          name: 'lang',
          type: 'string',
          description: 'Language code (e.g., en, zh-CN)',
          required: false,
          default: 'en'
        }
      ],
      permissionLevel: 'user_approval' as ToolPermissionLevel,
      isEnabled: true,
      isSandboxed: false,
      timeout: 15000,
      source: 'builtin'
    };
  }

  /**
   * 执行搜索
   */
  async execute(params: WebSearchParams): Promise<SearchResult[]> {
    const { query, limit = 5, lang = 'en' } = params;

    if (!query) {
      throw new Error('Search query is required');
    }

    // 如果配置了 Google API，优先使用
    if (this.apiKey && this.searchEngineId) {
      try {
        return await this.googleSearch(query, limit, lang);
      } catch (error) {
        logger.warn('Google search failed, falling back to DuckDuckGo', error);
      }
    }

    // 使用 DuckDuckGo 作为备选
    return await this.duckDuckGoSearch(query, limit);
  }

  /**
   * Google Custom Search API
   */
  private async googleSearch(
    query: string,
    limit: number,
    lang: string
  ): Promise<SearchResult[]> {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', this.apiKey!);
    url.searchParams.append('cx', this.searchEngineId!);
    url.searchParams.append('q', query);
    url.searchParams.append('num', limit.toString());
    url.searchParams.append('hl', lang);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Google search failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    return (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'Google'
    }));
  }

  /**
   * DuckDuckGo 搜索（通过 HTML 解析）
   */
  private async duckDuckGoSearch(
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    // DuckDuckGo 不提供官方 API，这里使用简化的方法
    // 在生产环境中，建议使用专业的搜索 API 服务
    
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo search failed: ${response.statusText}`);
      }

      const html = await response.text();
      
      // 简单的 HTML 解析提取结果
      const results: SearchResult[] = [];
      const resultRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet">([^<]+)</g;
      
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
        results.push({
          title: this.decodeHtml(match[2]),
          url: match[1],
          snippet: this.decodeHtml(match[3]),
          source: 'DuckDuckGo'
        });
      }

      return results;
    } catch (error) {
      logger.error('DuckDuckGo search failed', error);
      throw new Error('Web search failed');
    }
  }

  /**
   * 解码 HTML 实体
   */
  private decodeHtml(html: string): string {
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<b>|<\/b>/g, '');
  }
}

// 导出单例
export const webSearchTool = new WebSearchTool();