import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { toolApi } from '@/services/toolApi'
import type { 
  Tool,
  ToolExecution,
  ToolApprovalRequest,
  ToolCategory,
  ToolExecutionStatus,
  ToolPermissionLevel,
  MCPServer
} from '@/services/toolApi'

interface ToolState {
  // 工具管理
  tools: Tool[]
  selectedTool: Tool | null
  toolsLoading: boolean
  toolsError: string | null
  
  // 工具执行
  executions: ToolExecution[]
  activeExecutions: ToolExecution[]
  executionHistory: ToolExecution[]
  executionsLoading: boolean
  executionsError: string | null
  
  // 审批管理
  approvalQueue: ToolApprovalRequest[]
  approvalsLoading: boolean
  approvalsError: string | null
  
  // MCP服务器
  mcpServers: MCPServer[]
  mcpServersLoading: boolean
  mcpServersError: string | null
  
  // 统计信息
  toolStats: {
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
  } | null
  
  approvalStats: {
    pending: number
    approved: number
    rejected: number
    expired: number
    avgApprovalTime: number
    approvalRate: number
  } | null
  
  // 分页信息
  toolsPagination: {
    page: number
    limit: number
    hasMore: boolean
  }
  
  executionsPagination: {
    page: number
    limit: number
    hasMore: boolean
  }
  
  approvalsPagination: {
    page: number
    limit: number
    hasMore: boolean
  }
  
  // 过滤条件
  toolsFilter: {
    category?: ToolCategory
    enabled?: boolean
    search?: string
  }
  
  executionsFilter: {
    toolId?: string
    status?: ToolExecutionStatus
    startDate?: Date
    endDate?: Date
  }
  
  approvalsFilter: {
    toolId?: string
    riskLevel?: 'low' | 'medium' | 'high'
  }
}

interface ToolActions {
  // ============ 工具管理 Actions ============
  loadTools: (page?: number, reset?: boolean) => Promise<void>
  searchTools: (query: string, options?: { category?: ToolCategory; enabled?: boolean }) => Promise<void>
  getToolById: (toolId: string) => Promise<Tool | null>
  setSelectedTool: (tool: Tool | null) => void
  setToolsFilter: (filter: Partial<ToolState['toolsFilter']>) => void
  clearToolsFilter: () => void
  
  // 工具配置
  updateToolPermission: (toolId: string, permissionLevel: ToolPermissionLevel) => Promise<void>
  toggleTool: (toolId: string, enabled: boolean) => Promise<void>
  
  // ============ 工具执行 Actions ============
  executeTool: (toolId: string, input: Record<string, unknown>, options?: {
    conversationId?: string
    messageId?: string
    timeout?: number
  }) => Promise<ToolExecution | null>
  
  executeToolDirect: (toolId: string, input: Record<string, unknown>, options?: {
    conversationId?: string
    messageId?: string
    timeout?: number
  }) => Promise<boolean>
  
  cancelExecution: (executionId: string) => Promise<void>
  
  loadExecutionHistory: (page?: number, reset?: boolean) => Promise<void>
  loadActiveExecutions: () => Promise<void>
  getExecutionById: (executionId: string) => Promise<ToolExecution | null>
  setExecutionsFilter: (filter: Partial<ToolState['executionsFilter']>) => void
  clearExecutionsFilter: () => void
  
  // 实时更新执行状态
  updateExecutionStatus: (executionId: string, status: ToolExecutionStatus, result?: any) => void
  addNewExecution: (execution: ToolExecution) => void
  
  // ============ 审批管理 Actions ============
  loadPendingApprovals: (page?: number, reset?: boolean) => Promise<void>
  approveExecution: (executionId: string, reason?: string) => Promise<void>
  rejectExecution: (executionId: string, reason: string) => Promise<void>
  batchApproval: (operations: Array<{
    executionId: string
    action: 'approve' | 'reject'
    reason?: string
  }>) => Promise<void>
  setApprovalsFilter: (filter: Partial<ToolState['approvalsFilter']>) => void
  clearApprovalsFilter: () => void
  
  // ============ MCP服务器管理 Actions ============
  loadMCPServers: () => Promise<void>
  addMCPServer: (server: Omit<MCPServer, 'id' | 'tools' | 'healthStatus' | 'lastChecked'>) => Promise<void>
  updateMCPServer: (serverId: string, updates: Partial<MCPServer>) => Promise<void>
  deleteMCPServer: (serverId: string) => Promise<void>
  checkMCPServerHealth: (serverId: string) => Promise<void>
  
  // ============ 统计信息 Actions ============
  loadToolStats: () => Promise<void>
  loadApprovalStats: () => Promise<void>
  
  // ============ 工具函数 Actions ============
  clearAllErrors: () => void
  reset: () => void
}

const initialState: ToolState = {
  // 工具管理
  tools: [],
  selectedTool: null,
  toolsLoading: false,
  toolsError: null,
  
  // 工具执行
  executions: [],
  activeExecutions: [],
  executionHistory: [],
  executionsLoading: false,
  executionsError: null,
  
  // 审批管理
  approvalQueue: [],
  approvalsLoading: false,
  approvalsError: null,
  
  // MCP服务器
  mcpServers: [],
  mcpServersLoading: false,
  mcpServersError: null,
  
  // 统计信息
  toolStats: null,
  approvalStats: null,
  
  // 分页信息
  toolsPagination: {
    page: 1,
    limit: 20,
    hasMore: true
  },
  
  executionsPagination: {
    page: 1,
    limit: 20,
    hasMore: true
  },
  
  approvalsPagination: {
    page: 1,
    limit: 20,
    hasMore: true
  },
  
  // 过滤条件
  toolsFilter: {},
  executionsFilter: {},
  approvalsFilter: {}
}

export const useToolStore = create<ToolState & ToolActions>()(
  immer((set, get) => ({
    ...initialState,

    // ============ 工具管理 Actions ============
    loadTools: async (page = 1, reset = false) => {
      if (get().toolsLoading) return
      
      set((state) => {
        state.toolsLoading = true
        state.toolsError = null
        if (page === 1 || reset) {
          state.tools = []
        }
      })

      try {
        const { toolsFilter } = get()
        const response = await toolApi.getTools({
          ...toolsFilter,
          page,
          limit: get().toolsPagination.limit
        })

        set((state) => {
          if (page === 1 || reset) {
            state.tools = response.items
          } else {
            state.tools.push(...response.items)
          }
          state.toolsPagination.page = page
          state.toolsPagination.hasMore = response.pagination.hasMore
          state.toolsLoading = false
        })
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '加载工具列表失败'
          state.toolsLoading = false
        })
      }
    },

    searchTools: async (query, options = {}) => {
      set((state) => {
        state.toolsLoading = true
        state.toolsError = null
      })

      try {
        const tools = await toolApi.searchTools(query, options)
        
        set((state) => {
          state.tools = tools
          state.toolsLoading = false
        })
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '搜索工具失败'
          state.toolsLoading = false
        })
      }
    },

    getToolById: async (toolId) => {
      try {
        const tool = await toolApi.getToolById(toolId)
        
        set((state) => {
          // 更新tools数组中的工具信息
          const index = state.tools.findIndex((t: any) => t.id === toolId)
          if (index !== -1) {
            state.tools[index] = tool
          }
        })
        
        return tool
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '获取工具详情失败'
        })
        return null
      }
    },

    setSelectedTool: (tool) => {
      set((state) => {
        state.selectedTool = tool
      })
    },

    setToolsFilter: (filter) => {
      set((state) => {
        state.toolsFilter = { ...state.toolsFilter, ...filter }
      })
      
      // 重新加载数据
      get().loadTools(1, true)
    },

    clearToolsFilter: () => {
      set((state) => {
        state.toolsFilter = {}
      })
      
      get().loadTools(1, true)
    },

    updateToolPermission: async (toolId, permissionLevel) => {
      try {
        const updatedTool = await toolApi.updateToolPermission(toolId, permissionLevel)
        
        set((state) => {
          const index = state.tools.findIndex((t: any) => t.id === toolId)
          if (index !== -1) {
            state.tools[index] = updatedTool
          }
          if (state.selectedTool?.id === toolId) {
            state.selectedTool = updatedTool
          }
        })
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '更新工具权限失败'
        })
      }
    },

    toggleTool: async (toolId, enabled) => {
      try {
        const updatedTool = await toolApi.toggleTool(toolId, enabled)
        
        set((state) => {
          const index = state.tools.findIndex((t: any) => t.id === toolId)
          if (index !== -1) {
            state.tools[index] = updatedTool
          }
          if (state.selectedTool?.id === toolId) {
            state.selectedTool = updatedTool
          }
        })
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '切换工具状态失败'
        })
      }
    },

    // ============ 工具执行 Actions ============
    executeTool: async (toolId, input, options = {}) => {
      set((state) => {
        state.executionsLoading = true
        state.executionsError = null
      })

      try {
        const execution = await toolApi.executeTool(toolId, input, options)
        
        set((state) => {
          state.executions.unshift(execution)
          state.activeExecutions.unshift(execution)
          state.executionsLoading = false
        })
        
        return execution
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '执行工具失败'
          state.executionsLoading = false
        })
        return null
      }
    },

    executeToolDirect: async (toolId, input, options = {}) => {
      set((state) => {
        state.executionsLoading = true
        state.executionsError = null
      })

      try {
        await toolApi.executeToolDirect(toolId, input, options)
        
        set((state) => {
          state.executionsLoading = false
        })
        
        return true
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '直接执行工具失败'
          state.executionsLoading = false
        })
        return false
      }
    },

    cancelExecution: async (executionId) => {
      try {
        await toolApi.cancelExecution(executionId)
        
        set((state) => {
          // 更新执行状态为取消
          const updateExecution = (execution: ToolExecution) => {
            if (execution.id === executionId) {
              execution.status = 'error'
            }
          }
          
          state.executions.forEach(updateExecution)
          state.activeExecutions.forEach(updateExecution)
          state.executionHistory.forEach(updateExecution)
          
          // 从活动执行中移除
          state.activeExecutions = state.activeExecutions.filter((e: any) => e.id !== executionId)
        })
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '取消执行失败'
        })
      }
    },

    loadExecutionHistory: async (page = 1, reset = false) => {
      if (get().executionsLoading) return
      
      set((state) => {
        state.executionsLoading = true
        state.executionsError = null
        if (page === 1 || reset) {
          state.executionHistory = []
        }
      })

      try {
        const { executionsFilter } = get()
        const response = await toolApi.getExecutionHistory({
          ...executionsFilter,
          page,
          limit: get().executionsPagination.limit
        })

        set((state) => {
          if (page === 1 || reset) {
            state.executionHistory = response.items
          } else {
            state.executionHistory.push(...response.items)
          }
          state.executionsPagination.page = page
          state.executionsPagination.hasMore = response.pagination.hasMore
          state.executionsLoading = false
        })
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '加载执行历史失败'
          state.executionsLoading = false
        })
      }
    },

    loadActiveExecutions: async () => {
      try {
        const executions = await toolApi.getActiveExecutions()
        
        set((state) => {
          state.activeExecutions = executions
        })
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '加载活动执行失败'
        })
      }
    },

    getExecutionById: async (executionId) => {
      try {
        const execution = await toolApi.getExecutionById(executionId)
        
        set((state) => {
          // 更新相关数组中的执行信息
          const updateInArray = (array: ToolExecution[]) => {
            const index = array.findIndex((e: any) => e.id === executionId)
            if (index !== -1) {
              array[index] = execution
            }
          }
          
          updateInArray(state.executions)
          updateInArray(state.activeExecutions)
          updateInArray(state.executionHistory)
        })
        
        return execution
      } catch (error) {
        set((state) => {
          state.executionsError = error instanceof Error ? error.message : '获取执行详情失败'
        })
        return null
      }
    },

    setExecutionsFilter: (filter) => {
      set((state) => {
        state.executionsFilter = { ...state.executionsFilter, ...filter }
      })
      
      get().loadExecutionHistory(1, true)
    },

    clearExecutionsFilter: () => {
      set((state) => {
        state.executionsFilter = {}
      })
      
      get().loadExecutionHistory(1, true)
    },

    updateExecutionStatus: (executionId, status, result) => {
      set((state) => {
        const updateExecution = (execution: ToolExecution) => {
          if (execution.id === executionId) {
            execution.status = status
            if (result) {
              execution.output = result.output
              execution.executionTime = result.executionTime
              execution.completedAt = new Date()
            }
          }
        }
        
        state.executions.forEach(updateExecution)
        state.activeExecutions.forEach(updateExecution)
        state.executionHistory.forEach(updateExecution)
        
        // 如果执行完成或出错，从活动执行中移除
        if (['completed', 'error', 'timeout'].includes(status)) {
          state.activeExecutions = state.activeExecutions.filter((e: any) => e.id !== executionId)
        }
      })
    },

    addNewExecution: (execution) => {
      set((state) => {
        state.executions.unshift(execution)
        if (['pending', 'approved', 'executing'].includes(execution.status)) {
          state.activeExecutions.unshift(execution)
        }
      })
    },

    // ============ 审批管理 Actions ============
    loadPendingApprovals: async (page = 1, reset = false) => {
      if (get().approvalsLoading) return
      
      set((state) => {
        state.approvalsLoading = true
        state.approvalsError = null
        if (page === 1 || reset) {
          state.approvalQueue = []
        }
      })

      try {
        const { approvalsFilter } = get()
        const response = await toolApi.getPendingApprovals({
          ...approvalsFilter,
          page,
          limit: get().approvalsPagination.limit
        })

        set((state) => {
          if (page === 1 || reset) {
            state.approvalQueue = response.items
          } else {
            state.approvalQueue.push(...response.items)
          }
          state.approvalsPagination.page = page
          state.approvalsPagination.hasMore = response.pagination.hasMore
          state.approvalsLoading = false
        })
      } catch (error) {
        set((state) => {
          state.approvalsError = error instanceof Error ? error.message : '加载待审批列表失败'
          state.approvalsLoading = false
        })
      }
    },

    approveExecution: async (executionId, reason) => {
      try {
        await toolApi.approveExecution(executionId, reason)
        
        set((state) => {
          // 从待审批队列中移除
          state.approvalQueue = state.approvalQueue.filter(
            (approval: any) => approval.toolExecutionId !== executionId
          )
          
          // 更新执行状态
          const updateExecution = (execution: ToolExecution) => {
            if (execution.id === executionId) {
              execution.status = 'approved'
              execution.approvedAt = new Date()
            }
          }
          
          state.executions.forEach(updateExecution)
          state.activeExecutions.forEach(updateExecution)
        })
      } catch (error) {
        set((state) => {
          state.approvalsError = error instanceof Error ? error.message : '批准执行失败'
        })
      }
    },

    rejectExecution: async (executionId, reason) => {
      try {
        await toolApi.rejectExecution(executionId, reason)
        
        set((state) => {
          // 从待审批队列中移除
          state.approvalQueue = state.approvalQueue.filter(
            (approval: any) => approval.toolExecutionId !== executionId
          )
          
          // 更新执行状态
          const updateExecution = (execution: ToolExecution) => {
            if (execution.id === executionId) {
              execution.status = 'rejected'
            }
          }
          
          state.executions.forEach(updateExecution)
          state.activeExecutions.forEach(updateExecution)
          
          // 从活动执行中移除
          state.activeExecutions = state.activeExecutions.filter((e: any) => e.id !== executionId)
        })
      } catch (error) {
        set((state) => {
          state.approvalsError = error instanceof Error ? error.message : '拒绝执行失败'
        })
      }
    },

    batchApproval: async (operations) => {
      try {
        await toolApi.batchApproval(operations)
        
        // 重新加载待审批列表
        get().loadPendingApprovals(1, true)
        get().loadActiveExecutions()
      } catch (error) {
        set((state) => {
          state.approvalsError = error instanceof Error ? error.message : '批量审批失败'
        })
      }
    },

    setApprovalsFilter: (filter) => {
      set((state) => {
        state.approvalsFilter = { ...state.approvalsFilter, ...filter }
      })
      
      get().loadPendingApprovals(1, true)
    },

    clearApprovalsFilter: () => {
      set((state) => {
        state.approvalsFilter = {}
      })
      
      get().loadPendingApprovals(1, true)
    },

    // ============ MCP服务器管理 Actions ============
    loadMCPServers: async () => {
      set((state) => {
        state.mcpServersLoading = true
        state.mcpServersError = null
      })

      try {
        const servers = await toolApi.getMCPServers()
        
        set((state) => {
          state.mcpServers = servers
          state.mcpServersLoading = false
        })
      } catch (error) {
        set((state) => {
          state.mcpServersError = error instanceof Error ? error.message : '加载MCP服务器失败'
          state.mcpServersLoading = false
        })
      }
    },

    addMCPServer: async (server) => {
      try {
        const newServer = await toolApi.addMCPServer(server)
        
        set((state) => {
          state.mcpServers.push(newServer)
        })
      } catch (error) {
        set((state) => {
          state.mcpServersError = error instanceof Error ? error.message : '添加MCP服务器失败'
        })
      }
    },

    updateMCPServer: async (serverId, updates) => {
      try {
        const updatedServer = await toolApi.updateMCPServer(serverId, updates)
        
        set((state) => {
          const index = state.mcpServers.findIndex((s: any) => s.id === serverId)
          if (index !== -1) {
            state.mcpServers[index] = updatedServer
          }
        })
      } catch (error) {
        set((state) => {
          state.mcpServersError = error instanceof Error ? error.message : '更新MCP服务器失败'
        })
      }
    },

    deleteMCPServer: async (serverId) => {
      try {
        await toolApi.deleteMCPServer(serverId)
        
        set((state) => {
          state.mcpServers = state.mcpServers.filter((s: any) => s.id !== serverId)
        })
      } catch (error) {
        set((state) => {
          state.mcpServersError = error instanceof Error ? error.message : '删除MCP服务器失败'
        })
      }
    },

    checkMCPServerHealth: async (serverId) => {
      try {
        const healthResult = await toolApi.checkMCPServerHealth(serverId)
        
        set((state) => {
          const index = state.mcpServers.findIndex((s: any) => s.id === serverId)
          if (index !== -1) {
            state.mcpServers[index].healthStatus = healthResult.status
            state.mcpServers[index].lastChecked = healthResult.lastChecked
          }
        })
      } catch (error) {
        set((state) => {
          state.mcpServersError = error instanceof Error ? error.message : '检查服务器健康状态失败'
        })
      }
    },

    // ============ 统计信息 Actions ============
    loadToolStats: async () => {
      try {
        const stats = await toolApi.getToolStats()
        
        set((state) => {
          state.toolStats = stats
        })
      } catch (error) {
        set((state) => {
          state.toolsError = error instanceof Error ? error.message : '加载工具统计失败'
        })
      }
    },

    loadApprovalStats: async () => {
      try {
        const stats = await toolApi.getApprovalStats()
        
        set((state) => {
          state.approvalStats = stats
        })
      } catch (error) {
        set((state) => {
          state.approvalsError = error instanceof Error ? error.message : '加载审批统计失败'
        })
      }
    },

    // ============ 工具函数 Actions ============
    clearAllErrors: () => {
      set((state) => {
        state.toolsError = null
        state.executionsError = null
        state.approvalsError = null
        state.mcpServersError = null
      })
    },

    reset: () => {
      set(() => ({ ...initialState }))
    }
  }))
)