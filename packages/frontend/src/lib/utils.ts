import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind CSS 类名，避免冲突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化日期时间
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

/**
 * 相对时间格式化
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}天前`
  } else if (hours > 0) {
    return `${hours}小时前`
  } else if (minutes > 0) {
    return `${minutes}分钟前`
  } else {
    return '刚刚'
  }
}

/**
 * 文件大小格式化
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const clonedObj = {} as T
    for (const key in obj) {
      clonedObj[key] = deepClone(obj[key])
    }
    return clonedObj
  }
  return obj
}

/**
 * 获取嵌套对象属性值
 */
export function get<T>(obj: any, path: string, defaultValue?: T): T {
  const keys = path.split('.')
  let result = obj
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue as T
    }
    result = result[key]
  }
  
  return result ?? defaultValue
}

/**
 * 设置嵌套对象属性值
 */
export function set(obj: any, path: string, value: any): void {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  let current = obj
  
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  
  current[lastKey] = value
}

/**
 * 检查是否为空值（null, undefined, '', [], {}）
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse<T = any>(str: string, defaultValue?: T): T | null {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue ?? null
  }
}

/**
 * 休眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建取消令牌
 */
export function createCancelToken() {
  let isCancelled = false
  
  return {
    cancel: () => { isCancelled = true },
    isCancelled: () => isCancelled,
    throwIfCancelled: () => {
      if (isCancelled) throw new Error('Operation was cancelled')
    }
  }
}

/**
 * 异步重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxAttempts) {
        throw lastError
      }
      await sleep(delay * attempt)
    }
  }
  
  throw lastError!
}

/**
 * 颜色工具
 */
export const colors = {
  /**
   * 获取随机头像颜色
   */
  getAvatarColor: (name: string): string => {
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-yellow-500',
      'bg-lime-500',
      'bg-green-500',
      'bg-emerald-500',
      'bg-teal-500',
      'bg-cyan-500',
      'bg-sky-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-violet-500',
      'bg-purple-500',
      'bg-fuchsia-500',
      'bg-pink-500',
      'bg-rose-500',
    ]
    
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  },
  
  /**
   * 从十六进制颜色生成 HSL
   */
  hexToHsl: (hex: string): { h: number; s: number; l: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    }
  },
}

/**
 * 本地存储工具
 */
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue ?? null
    } catch {
      return defaultValue ?? null
    }
  },
  
  set: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Silent fail
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key)
    } catch {
      // Silent fail
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear()
    } catch {
      // Silent fail
    }
  },
}

/**
 * URL 工具
 */
export const url = {
  /**
   * 构建查询字符串
   */
  buildQuery: (params: Record<string, any>): string => {
    const query = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) {
        query.append(key, String(value))
      }
    })
    
    return query.toString()
  },
  
  /**
   * 解析查询字符串
   */
  parseQuery: (search: string): Record<string, string> => {
    const params = new URLSearchParams(search)
    const result: Record<string, string> = {}
    
    params.forEach((value, key) => {
      result[key] = value
    })
    
    return result
  },
}

/**
 * 验证工具
 */
export const validate = {
  email: (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },
  
  url: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },
  
  phone: (phone: string): boolean => {
    const regex = /^1[3-9]\d{9}$/
    return regex.test(phone)
  },
}

/**
 * 常量定义
 */
export const CONSTANTS = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  APP_NAME: 'Gemini CLI WebUI',
  APP_VERSION: '0.2.0',
  
  // 本地存储键名
  STORAGE_KEYS: {
    THEME: 'gemini-ui-theme',
    AUTH_TOKEN: 'gemini-auth-token',
    USER_PREFERENCES: 'gemini-user-preferences',
    CHAT_HISTORY: 'gemini-chat-history',
  },
  
  // 路由路径
  ROUTES: {
    HOME: '/',
    LOGIN: '/login',
    CHAT: '/chat',
    TOOLS: '/tools',
    SETTINGS: '/settings',
  },
  
  // 错误代码
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
  },
} as const