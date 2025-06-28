import { Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AppLayout } from '@/components/layout/AppLayout'
import { ChatPage } from '@/pages/ChatPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ToolsPage } from '@/pages/ToolsPage'
import { AdminPage } from '@/pages/AdminPage'
import { AuthPage } from '@/pages/AuthPage'
import { MemoryPage } from '@/pages/MemoryPage'
import { VisualizationDemoPage } from '@/pages/VisualizationDemoPage'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEffect } from 'react'

function App() {
  const { user, initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Show auth page if not authenticated
  if (!user) {
    return (
      <>
        <AuthPage />
        <Toaster />
      </>
    )
  }

  // Main application with layout
  return (
    <>
      <AppLayout>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat/:conversationId?" element={<ChatPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/memory/:projectId?" element={<MemoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/demo/visualization" element={<VisualizationDemoPage />} />
        </Routes>
      </AppLayout>
      <Toaster />
    </>
  )
}

export default App