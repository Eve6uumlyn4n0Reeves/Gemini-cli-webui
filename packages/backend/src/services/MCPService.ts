import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import type { Tool, ToolCategory } from '@gemini-cli-webui/shared';
import { logger } from '../utils/logger.js';

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport: 'stdio' | 'sse' | 'http';
  endpoint?: string; // for HTTP/SSE
  isConnected: boolean;
  tools: MCPTool[];
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  serverName: string;
  serverId: string;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

/**
 * MCP (Model Context Protocol) 服务
 * 管理 MCP 服务器连接和工具发现
 */
export class MCPService extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private messageHandlers: Map<string, Map<string | number, (response: MCPMessage) => void>> = new Map();
  private nextMessageId = 1;

  constructor() {
    super();
  }

  /**
   * 添加 MCP 服务器配置
   */
  async addServer(server: Omit<MCPServer, 'isConnected' | 'tools' | 'error'>): Promise<void> {
    const fullServer: MCPServer = {
      ...server,
      isConnected: false,
      tools: []
    };

    this.servers.set(server.id, fullServer);
    
    // 尝试连接
    await this.connectServer(server.id);
  }

  /**
   * 连接到 MCP 服务器
   */
  async connectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      if (server.transport === 'stdio') {
        await this.connectStdioServer(server);
      } else if (server.transport === 'http' || server.transport === 'sse') {
        await this.connectHttpServer(server);
      }

      // 发现工具
      await this.discoverTools(serverId);
      
      server.isConnected = true;
      this.emit('server:connected', { serverId, server });
      
    } catch (error) {
      server.isConnected = false;
      server.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to connect to MCP server ${serverId}`, error);
      this.emit('server:error', { serverId, error: server.error });
    }
  }

  /**
   * 连接 stdio 传输的服务器
   */
  private async connectStdioServer(server: MCPServer): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(server.command, server.args || [], {
        env: { ...process.env, ...server.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.set(server.id, proc);
      this.messageHandlers.set(server.id, new Map());

      let buffer = '';

      proc.stdout?.on('data', (data) => {
        buffer += data.toString();
        
        // 尝试解析完整的 JSON-RPC 消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line) as MCPMessage;
              this.handleMessage(server.id, message);
            } catch (error) {
              logger.error('Failed to parse MCP message', { line, error });
            }
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        logger.error(`MCP server ${server.id} stderr:`, data.toString());
      });

      proc.on('error', (error) => {
        reject(error);
      });

      proc.on('exit', (code) => {
        this.processes.delete(server.id);
        server.isConnected = false;
        this.emit('server:disconnected', { serverId: server.id, code });
      });

      // 发送初始化请求
      this.sendRequest(server.id, 'initialize', {
        protocolVersion: '1.0',
        clientInfo: {
          name: 'gemini-cli-webui',
          version: '0.2.0'
        }
      }).then(() => {
        resolve();
      }).catch(reject);
    });
  }

  /**
   * 连接 HTTP/SSE 传输的服务器
   */
  private async connectHttpServer(server: MCPServer): Promise<void> {
    // TODO: 实现 HTTP/SSE 连接
    throw new Error('HTTP/SSE transport not implemented yet');
  }

  /**
   * 发现服务器提供的工具
   */
  private async discoverTools(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    try {
      const response = await this.sendRequest(serverId, 'tools/list', {});
      
      if (response.result && Array.isArray(response.result.tools)) {
        server.tools = response.result.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          serverName: server.name,
          serverId: server.id
        }));

        logger.info(`Discovered ${server.tools.length} tools from ${server.name}`);
        this.emit('tools:discovered', { serverId, tools: server.tools });
      }
    } catch (error) {
      logger.error(`Failed to discover tools for ${serverId}`, error);
    }
  }

  /**
   * 发送请求到 MCP 服务器
   */
  private async sendRequest(
    serverId: string,
    method: string,
    params: any
  ): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      const id = this.nextMessageId++;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const handlers = this.messageHandlers.get(serverId);
      if (!handlers) {
        reject(new Error(`Server ${serverId} not connected`));
        return;
      }

      // 设置响应处理器
      handlers.set(id, (response) => {
        handlers.delete(id);
        
        if (response.error) {
          reject(new Error(response.error.message || 'Unknown error'));
        } else {
          resolve(response);
        }
      });

      // 发送消息
      const proc = this.processes.get(serverId);
      if (proc && proc.stdin) {
        proc.stdin.write(JSON.stringify(message) + '\n');
      } else {
        reject(new Error(`Cannot send message to ${serverId}`));
      }

      // 设置超时
      setTimeout(() => {
        if (handlers.has(id)) {
          handlers.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 处理来自服务器的消息
   */
  private handleMessage(serverId: string, message: MCPMessage): void {
    const handlers = this.messageHandlers.get(serverId);
    if (!handlers) return;

    // 如果是响应消息
    if (message.id !== undefined) {
      const handler = handlers.get(message.id);
      if (handler) {
        handler(message);
      }
    }

    // 如果是通知消息
    if (message.method && !message.id) {
      this.emit('server:notification', {
        serverId,
        method: message.method,
        params: message.params
      });
    }
  }

  /**
   * 执行 MCP 工具
   */
  async executeTool(
    serverId: string,
    toolName: string,
    input: any
  ): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server || !server.isConnected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    try {
      const response = await this.sendRequest(serverId, 'tools/call', {
        name: toolName,
        arguments: input
      });

      if (response.result) {
        return response.result.content;
      } else {
        throw new Error('No result from tool execution');
      }
    } catch (error) {
      logger.error(`Failed to execute MCP tool ${toolName}`, error);
      throw error;
    }
  }

  /**
   * 获取所有 MCP 工具作为标准工具
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];

    for (const server of this.servers.values()) {
      if (server.isConnected) {
        for (const mcpTool of server.tools) {
          tools.push(this.convertToStandardTool(mcpTool));
        }
      }
    }

    return tools;
  }

  /**
   * 转换 MCP 工具为标准工具格式
   */
  private convertToStandardTool(mcpTool: MCPTool): Tool {
    return {
      id: `mcp_${mcpTool.serverId}_${mcpTool.name}`,
      name: mcpTool.name,
      description: mcpTool.description,
      category: 'external' as ToolCategory,
      parameters: this.convertParameters(mcpTool.parameters),
      permissionLevel: 'user_approval',
      isEnabled: true,
      isSandboxed: false,
      timeout: 60000,
      source: 'mcp',
      metadata: {
        serverId: mcpTool.serverId,
        serverName: mcpTool.serverName
      }
    };
  }

  /**
   * 转换参数格式
   */
  private convertParameters(schema: any): any[] {
    if (!schema || !schema.properties) return [];

    const required = schema.required || [];
    
    return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type || 'string',
      description: prop.description || '',
      required: required.includes(name),
      default: prop.default,
      enum: prop.enum
    }));
  }

  /**
   * 断开所有服务器
   */
  async disconnectAll(): Promise<void> {
    for (const [serverId, proc] of this.processes.entries()) {
      proc.kill();
      this.processes.delete(serverId);
      
      const server = this.servers.get(serverId);
      if (server) {
        server.isConnected = false;
      }
    }
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * 获取特定服务器的工具
   */
  getServerTools(serverId: string): MCPTool[] {
    const server = this.servers.get(serverId);
    return server?.tools || [];
  }
}