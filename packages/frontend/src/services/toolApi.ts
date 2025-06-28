import { apiClient, ApiResponse, PaginatedResponse, handleApiResponse, handlePaginatedResponse } from './apiClient'
import type {
  Tool,
  ToolExecution,
  ToolApprovalRequest,
  ToolResult,
  ToolRegistry,
  MCPServer,
  ToolExecutionStatus,
  ToolCategory,
  ToolPermissionLevel,
  ToolParameter
} from '@gemini-cli-webui/shared'

// Tool API 服务类
export class ToolApiService {
  private readonly basePath = '/api/tools'
  private readonly approvalsPath = '/api/approvals'

  // ============ 工具管理 API ============

  /**
   * 获取工具列表
   */
  async getTools(params?: {
    category?: ToolCategory
    enabled?: boolean
    search?: string
    page?: number
    limit?: number
  }): Promise<{ items: Tool[]; pagination: any }> {
    const response = await apiClient.get<PaginatedResponse<Tool>>(
      this.basePath,
      params
    )
    return handlePaginatedResponse(response)
  }

  /**
   * 获取工具详情
   */
  async getToolById(toolId: string): Promise<Tool> {
    const response = await apiClient.get<ApiResponse<Tool>>(`${this.basePath}/${toolId}`)
    return handleApiResponse(response)
  }

  /**
   * 搜索工具
   */
  async searchTools(query: string, options?: {
    category?: ToolCategory
    enabled?: boolean
    limit?: number
  }): Promise<Tool[]> {
    const params = { search: query, ...options }
    const response = await apiClient.get<PaginatedResponse<Tool>>(
      `${this.basePath}/search`,
      params
    )
    return handlePaginatedResponse(response).items
  }

  /**
   * 获取工具统计信息
   */
  async getToolStats(): Promise<{
    total: number
    enabled: number
    disabled: number
    byCategory: Record<ToolCategory, number>
    executionStats: {
      today: number
      thisWeek: number
      thisMonth: number
      total: number
    }
  }> {
    const response = await apiClient.get<ApiResponse<any>>(`${this.basePath}/stats`)
    return handleApiResponse(response)
  }

  // ============ 工具执行 API ============

  /**
   * 执行工具
   */
  async executeTool(
    toolId: string,
    input: Record<string, unknown>,
    options?: {
      conversationId?: string
      messageId?: string
      timeout?: number
    }
  ): Promise<ToolExecution> {
    const payload = {
      input,
      ...options
    }
    const response = await apiClient.post<ApiResponse<ToolExecution>>(
      `${this.basePath}/${toolId}/execute`,
      payload
    )
    return handleApiResponse(response)
  }

  /**
   * 直接执行工具（管理员权限）
   */
  async executeToolDirect(
    toolId: string,
    input: Record<string, unknown>,
    options?: {
      conversationId?: string
      messageId?: string
      timeout?: number
    }
  ): Promise<ToolResult> {
    const payload = {
      input,
      ...options
    }
    const response = await apiClient.post<ApiResponse<ToolResult>>(
      `${this.basePath}/${toolId}/execute-direct`,
      payload
    )
    return handleApiResponse(response)
  }

  /**
   * 取消工具执行
   */
  async cancelExecution(executionId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse<{ success: boolean }>>(
      `${this.basePath}/executions/${executionId}/cancel`
    )
    return handleApiResponse(response)
  }

  /**
   * 获取执行历史记录
   */
  async getExecutionHistory(params?: {
    toolId?: string
    userId?: string
    status?: ToolExecutionStatus
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  }): Promise<{ items: ToolExecution[]; pagination: any }> {
    const queryParams = {
      ...params,
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString()
    }
    const response = await apiClient.get<PaginatedResponse<ToolExecution>>(
      `${this.basePath}/executions/history`,
      queryParams
    )
    return handlePaginatedResponse(response)
  }

  /**
   * 获取活动中的执行
   */
  async getActiveExecutions(): Promise<ToolExecution[]> {
    const response = await apiClient.get<ApiResponse<ToolExecution[]>>(
      `${this.basePath}/executions/active`
    )
    return handleApiResponse(response)
  }

  /**
   * 获取执行详情
   */
  async getExecutionById(executionId: string): Promise<ToolExecution> {
    const response = await apiClient.get<ApiResponse<ToolExecution>>(
      `${this.basePath}/executions/${executionId}`
    )
    return handleApiResponse(response)
  }

  // ============ 审批管理 API ============

  /**
   * 获取待审批列表
   */
  async getPendingApprovals(params?: {
    toolId?: string
    riskLevel?: 'low' | 'medium' | 'high'
    page?: number
    limit?: number
  }): Promise<{ items: ToolApprovalRequest[]; pagination: any }> {
    const response = await apiClient.get<PaginatedResponse<ToolApprovalRequest>>(
      `${this.approvalsPath}/pending`,
      params
    )
    return handlePaginatedResponse(response)
  }

  /**
   * 批准工具执行
   */
  async approveExecution(executionId: string, reason?: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse<{ success: boolean }>>(
      `${this.approvalsPath}/executions/${executionId}/approve`,
      { reason }
    )
    return handleApiResponse(response)
  }

  /**
   * 拒绝工具执行
   */
  async rejectExecution(executionId: string, reason: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse<{ success: boolean }>>(
      `${this.approvalsPath}/executions/${executionId}/reject`,
      { reason }
    )
    return handleApiResponse(response)
  }

  /**
   * 批量审批操作（管理员权限）
   */
  async batchApproval(operations: Array<{
    executionId: string
    action: 'approve' | 'reject'
    reason?: string
  }>): Promise<{
    success: number
    failed: number
    results: Array<{ executionId: string; success: boolean; error?: string }>
  }> {
    const response = await apiClient.post<ApiResponse<any>>(
      `${this.approvalsPath}/batch`,
      { operations }
    )
    return handleApiResponse(response)
  }

  /**
   * 获取审批统计信息
   */
  async getApprovalStats(): Promise<{
    pending: number
    approved: number
    rejected: number
    expired: number
    avgApprovalTime: number // 平均审批时间（分钟）
    approvalRate: number // 审批通过率
  }> {
    const response = await apiClient.get<ApiResponse<any>>(`${this.approvalsPath}/stats`)
    return handleApiResponse(response)
  }

  // ============ MCP服务器管理 API ============

  /**
   * 获取MCP服务器列表
   */
  async getMCPServers(): Promise<MCPServer[]> {
    const response = await apiClient.get<ApiResponse<MCPServer[]>>(
      `${this.basePath}/mcp/servers`
    )
    return handleApiResponse(response)
  }

  /**
   * 添加MCP服务器
   */
  async addMCPServer(server: Omit<MCPServer, 'id' | 'tools' | 'healthStatus' | 'lastChecked'>): Promise<MCPServer> {
    const response = await apiClient.post<ApiResponse<MCPServer>>(
      `${this.basePath}/mcp/servers`,
      server
    )
    return handleApiResponse(response)
  }

  /**
   * 更新MCP服务器
   */
  async updateMCPServer(serverId: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    const response = await apiClient.put<ApiResponse<MCPServer>>(
      `${this.basePath}/mcp/servers/${serverId}`,
      updates
    )
    return handleApiResponse(response)
  }

  /**
   * 删除MCP服务器
   */
  async deleteMCPServer(serverId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(
      `${this.basePath}/mcp/servers/${serverId}`
    )
    return handleApiResponse(response)
  }

  /**
   * 检查MCP服务器健康状态
   */
  async checkMCPServerHealth(serverId: string): Promise<{ 
    status: 'healthy' | 'unhealthy' | 'unknown'
    lastChecked: Date
    error?: string 
  }> {
    const response = await apiClient.post<ApiResponse<any>>(
      `${this.basePath}/mcp/servers/${serverId}/health`
    )
    return handleApiResponse(response)
  }

  // ============ 工具配置管理 API ============

  /**
   * 更新工具权限级别
   */
  async updateToolPermission(toolId: string, permissionLevel: ToolPermissionLevel): Promise<Tool> {
    const response = await apiClient.patch<ApiResponse<Tool>>(
      `${this.basePath}/${toolId}/permission`,
      { permissionLevel }
    )
    return handleApiResponse(response)
  }

  /**
   * 启用/禁用工具
   */
  async toggleTool(toolId: string, enabled: boolean): Promise<Tool> {
    const response = await apiClient.patch<ApiResponse<Tool>>(
      `${this.basePath}/${toolId}/toggle`,
      { enabled }
    )
    return handleApiResponse(response)
  }

  /**
   * 获取工具注册表
   */
  async getToolRegistry(): Promise<ToolRegistry> {
    const response = await apiClient.get<ApiResponse<ToolRegistry>>(
      `${this.basePath}/registry`
    )
    return handleApiResponse(response)
  }

  /**
   * 更新工具注册表配置
   */
  async updateToolRegistry(updates: Partial<ToolRegistry>): Promise<ToolRegistry> {
    const response = await apiClient.put<ApiResponse<ToolRegistry>>(
      `${this.basePath}/registry`,
      updates
    )
    return handleApiResponse(response)
  }
}

// 导出单例实例
export const toolApi = new ToolApiService()

// 导出类型定义用于组件
export type {
  Tool,
  ToolExecution,
  ToolApprovalRequest,
  ToolResult,
  ToolExecutionStatus,
  ToolCategory,
  ToolPermissionLevel,
  MCPServer,
  ToolParameter,
  ToolRegistry
}