import { createContext, useContext } from 'react'
import { storage, CONSTANTS } from './utils'

export type Theme = 'dark' | 'light' | 'system'

export interface ThemeConfig {
  theme: Theme
  systemTheme: 'dark' | 'light'
  resolvedTheme: 'dark' | 'light'
}

export interface ThemeContextType {
  theme: Theme
  systemTheme: 'dark' | 'light'
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * 检测系统主题
 */
export function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light'
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 解析主题
 */
export function resolveTheme(theme: Theme, systemTheme: 'dark' | 'light'): 'dark' | 'light' {
  return theme === 'system' ? systemTheme : theme
}

/**
 * 应用主题到 DOM
 */
export function applyTheme(theme: 'dark' | 'light'): void {
  const root = document.documentElement
  
  // 移除旧的主题类
  root.classList.remove('light', 'dark')
  
  // 添加新的主题类
  root.classList.add(theme)
  
  // 设置 color-scheme 属性
  root.style.colorScheme = theme
  
  // 设置 meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    const color = theme === 'dark' ? '#0F172A' : '#FFFFFF'
    metaThemeColor.setAttribute('content', color)
  }
}

/**
 * 从本地存储获取主题
 */
export function getStoredTheme(): Theme {
  return storage.get<Theme>(CONSTANTS.STORAGE_KEYS.THEME) || 'system'
}

/**
 * 保存主题到本地存储
 */
export function setStoredTheme(theme: Theme): void {
  storage.set(CONSTANTS.STORAGE_KEYS.THEME, theme)
}

/**
 * 创建系统主题监听器
 */
export function createSystemThemeListener(callback: (theme: 'dark' | 'light') => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  const handleChange = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light')
  }
  
  mediaQuery.addEventListener('change', handleChange)
  
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

/**
 * 主题工具类
 */
export class ThemeManager {
  private theme: Theme = 'system'
  private systemTheme: 'dark' | 'light' = 'light'
  private listeners: Set<(config: ThemeConfig) => void> = new Set()
  private systemThemeCleanup?: () => void

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    // 获取存储的主题
    this.theme = getStoredTheme()
    
    // 获取系统主题
    this.systemTheme = getSystemTheme()
    
    // 监听系统主题变化
    this.systemThemeCleanup = createSystemThemeListener((systemTheme) => {
      this.systemTheme = systemTheme
      this.notifyListeners()
      this.applyCurrentTheme()
    })
    
    // 应用初始主题
    this.applyCurrentTheme()
  }

  private get resolvedTheme(): 'dark' | 'light' {
    return resolveTheme(this.theme, this.systemTheme)
  }

  private notifyListeners(): void {
    const config: ThemeConfig = {
      theme: this.theme,
      systemTheme: this.systemTheme,
      resolvedTheme: this.resolvedTheme,
    }
    
    this.listeners.forEach(listener => listener(config))
  }

  private applyCurrentTheme(): void {
    applyTheme(this.resolvedTheme)
  }

  public setTheme(theme: Theme): void {
    this.theme = theme
    setStoredTheme(theme)
    this.applyCurrentTheme()
    this.notifyListeners()
  }

  public getTheme(): Theme {
    return this.theme
  }

  public getSystemTheme(): 'dark' | 'light' {
    return this.systemTheme
  }

  public getResolvedTheme(): 'dark' | 'light' {
    return this.resolvedTheme
  }

  public toggleTheme(): void {
    const newTheme = this.resolvedTheme === 'dark' ? 'light' : 'dark'
    this.setTheme(newTheme)
  }

  public subscribe(listener: (config: ThemeConfig) => void): () => void {
    this.listeners.add(listener)
    
    return () => {
      this.listeners.delete(listener)
    }
  }

  public destroy(): void {
    this.systemThemeCleanup?.()
    this.listeners.clear()
  }
}

/**
 * 全局主题管理器实例
 */
export const themeManager = new ThemeManager()

/**
 * 使用主题的 Hook
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  
  return context
}

/**
 * 主题相关的 CSS 类名工具
 */
export const themeClasses = {
  /**
   * 获取主题感知的背景类名
   */
  background: (variant: 'default' | 'muted' | 'card' = 'default'): string => {
    const classMap = {
      default: 'bg-background',
      muted: 'bg-muted',
      card: 'bg-card',
    }
    return classMap[variant]
  },

  /**
   * 获取主题感知的文本类名
   */
  foreground: (variant: 'default' | 'muted' | 'primary' = 'default'): string => {
    const classMap = {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
    }
    return classMap[variant]
  },

  /**
   * 获取主题感知的边框类名
   */
  border: (variant: 'default' | 'muted' = 'default'): string => {
    const classMap = {
      default: 'border-border',
      muted: 'border-muted',
    }
    return classMap[variant]
  },

  /**
   * 获取状态相关的类名
   */
  status: (status: 'success' | 'warning' | 'error' | 'info'): string => {
    const classMap = {
      success: 'text-success bg-success/10 border-success/20',
      warning: 'text-warning bg-warning/10 border-warning/20',
      error: 'text-error bg-error/10 border-error/20',
      info: 'text-info bg-info/10 border-info/20',
    }
    return classMap[status]
  },

  /**
   * 获取交互状态类名
   */
  interactive: (variant: 'default' | 'primary' | 'destructive' = 'default'): string => {
    const classMap = {
      default: 'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
      primary: 'hover:bg-primary/90 focus-visible:bg-primary/90',
      destructive: 'hover:bg-destructive/90 focus-visible:bg-destructive/90',
    }
    return classMap[variant]
  },
}

/**
 * 主题相关常量
 */
export const THEME_CONSTANTS = {
  // CSS 变量名
  CSS_VARS: {
    BACKGROUND: '--background',
    FOREGROUND: '--foreground',
    PRIMARY: '--primary',
    SECONDARY: '--secondary',
    MUTED: '--muted',
    ACCENT: '--accent',
    BORDER: '--border',
    RING: '--ring',
  },
  
  // 主题变化事件名
  EVENTS: {
    THEME_CHANGE: 'theme-change',
    SYSTEM_THEME_CHANGE: 'system-theme-change',
  },
  
  // 主题切换动画持续时间
  TRANSITION_DURATION: 200,
} as const