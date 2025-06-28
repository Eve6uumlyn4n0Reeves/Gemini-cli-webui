import * as React from 'react'
import { 
  ThemeContext, 
  ThemeContextType, 
  Theme, 
  ThemeConfig,
  themeManager,
  getSystemTheme,
  resolveTheme
} from '@/lib/theme'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  enableSystem?: boolean
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  enableSystem = true,
  ...props
}: ThemeProviderProps) {
  const [themeConfig, setThemeConfig] = React.useState<ThemeConfig>(() => ({
    theme: defaultTheme,
    systemTheme: getSystemTheme(),
    resolvedTheme: resolveTheme(defaultTheme, getSystemTheme()),
  }))

  React.useEffect(() => {
    // 订阅主题管理器的变化
    const unsubscribe = themeManager.subscribe((config) => {
      setThemeConfig(config)
    })

    // 初始化时获取当前主题状态
    setThemeConfig({
      theme: themeManager.getTheme(),
      systemTheme: themeManager.getSystemTheme(),
      resolvedTheme: themeManager.getResolvedTheme(),
    })

    return unsubscribe
  }, [])

  const setTheme = React.useCallback((theme: Theme) => {
    themeManager.setTheme(theme)
  }, [])

  const toggleTheme = React.useCallback(() => {
    themeManager.toggleTheme()
  }, [])

  const value: ThemeContextType = React.useMemo(
    () => ({
      ...themeConfig,
      setTheme,
      toggleTheme,
    }),
    [themeConfig, setTheme, toggleTheme]
  )

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  )
}