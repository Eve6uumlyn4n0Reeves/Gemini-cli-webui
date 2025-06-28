import { CONSTANTS } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'

export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string = CONSTANTS.API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    // Get token from auth store
    const token = useAuthStore.getState().token
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      // Handle non-JSON responses
      const contentType = response.headers.get('Content-Type')
      const isJson = contentType?.includes('application/json')
      
      let data: any
      if (isJson) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          const { refreshAuth, logout } = useAuthStore.getState()
          
          // Try to refresh token
          const refreshed = await refreshAuth()
          if (refreshed) {
            // Retry the original request with new token
            return this.request(endpoint, options)
          } else {
            // Refresh failed, logout user
            await logout()
            throw new ApiError(401, '登录已过期，请重新登录', 'AUTH_EXPIRED')
          }
        }

        const message = isJson ? (data.error || data.message || response.statusText) : data
        throw new ApiError(response.status, message, data.code)
      }

      return isJson ? data : { data } as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      // Network or other errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(0, '网络连接失败，请检查网络设置', 'NETWORK_ERROR')
      }
      
      throw new ApiError(500, '请求失败，请稍后重试', 'UNKNOWN_ERROR')
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint
    return this.request<T>(url, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // Upload files
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = useAuthStore.getState().token
    
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
      body: formData,
    })
  }

  // Stream response
  async stream(endpoint: string, options: RequestInit = {}): Promise<ReadableStream> {
    const url = `${this.baseURL}${endpoint}`
    const token = useAuthStore.getState().token
    
    const config: RequestInit = {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText)
    }
    
    if (!response.body) {
      throw new ApiError(500, 'No response body for stream')
    }
    
    return response.body
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient()

// Helper function to handle API responses
export function handleApiResponse<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.error || response.message || '请求失败')
  }
  return response.data
}

// Helper function for paginated responses
export function handlePaginatedResponse<T>(response: PaginatedResponse<T>) {
  return {
    items: response.items,
    pagination: {
      total: response.total,
      page: response.page,
      limit: response.limit,
      totalPages: response.totalPages,
      hasMore: response.hasMore,
    }
  }
}