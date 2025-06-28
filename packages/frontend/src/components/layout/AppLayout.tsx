import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="h-screen bg-background">
      {/* Header */}
      <Header 
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <Sidebar 
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <MainContent 
          className={cn(
            'transition-all duration-300 ease-in-out',
            sidebarOpen ? 'ml-64' : 'ml-0'
          )}
        >
          {children}
        </MainContent>
      </div>
    </div>
  )
}