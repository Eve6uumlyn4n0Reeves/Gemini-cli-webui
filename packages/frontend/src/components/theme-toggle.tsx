// import * as React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/lib/theme'

interface ThemeToggleProps {
  variant?: 'icon' | 'button'
  size?: 'sm' | 'default' | 'lg'
  showLabel?: boolean
}

export function ThemeToggle({ 
  variant = 'icon', 
  size = 'default',
  showLabel = false 
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    {
      value: 'light' as const,
      label: '明亮模式',
      icon: Sun,
    },
    {
      value: 'dark' as const,
      label: '暗黑模式',
      icon: Moon,
    },
    {
      value: 'system' as const,
      label: '跟随系统',
      icon: Monitor,
    },
  ]

  const currentTheme = themeOptions.find(option => option.value === theme)
  const CurrentIcon = currentTheme?.icon || Sun

  if (variant === 'button') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className="gap-2">
            <CurrentIcon className="h-4 w-4" />
            {showLabel && <span>{currentTheme?.label}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {themeOptions.map((option) => {
            const IconComponent = option.icon
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
                className="gap-2"
              >
                <IconComponent className="h-4 w-4" />
                <span>{option.label}</span>
                {theme === option.value && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    当前
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size === 'default' ? 'icon' : size}>
          <CurrentIcon className="h-4 w-4" />
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => {
          const IconComponent = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="gap-2"
            >
              <IconComponent className="h-4 w-4" />
              <span>{option.label}</span>
              {theme === option.value && (
                <span className="ml-auto text-xs text-muted-foreground">
                  当前
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 简单的主题切换按钮（仅在明亮和暗黑之间切换）
 */
export function SimpleThemeToggle({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size={size === 'default' ? 'icon' : size}
      onClick={toggleTheme}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">切换主题</span>
    </Button>
  )
}