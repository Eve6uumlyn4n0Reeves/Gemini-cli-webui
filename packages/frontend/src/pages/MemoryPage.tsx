import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Save, FileText, Globe, Search, Plus, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
// import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import { apiClient } from '@/services/apiClient'

interface MemoryFile {
  content: string
  exists: boolean
  path: string
}

interface MemorySearchResult {
  query: string
  matches: string[]
  count: number
}

export function MemoryPage() {
  const { projectId } = useParams()
  // const navigate = useNavigate()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'project' | 'global'>('project')
  const [projectMemory, setProjectMemory] = useState<MemoryFile | null>(null)
  const [globalMemory, setGlobalMemory] = useState<MemoryFile | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MemorySearchResult | null>(null)

  // 加载记忆文件
  useEffect(() => {
    loadMemoryFiles()
  }, [projectId])

  const loadMemoryFiles = async () => {
    setIsLoading(true)
    try {
      // 加载项目记忆
      if (projectId) {
        const projectRes = await apiClient.get<any>(`/memory/project/${projectId}`)
        setProjectMemory(projectRes.data)
      }
      
      // 加载全局记忆
      const globalRes = await apiClient.get<any>('/memory/global')
      setGlobalMemory(globalRes.data)
    } catch (error) {
      toast({
        title: '加载失败',
        description: '无法加载记忆文件',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = () => {
    const memory = activeTab === 'project' ? projectMemory : globalMemory
    if (memory) {
      setEditingContent(memory.content || getDefaultContent())
      setIsEditing(true)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const endpoint = activeTab === 'project' 
        ? `/memory/project/${projectId}` 
        : '/memory/global'
      
      await apiClient.put(endpoint, { content: editingContent })
      
      // 更新本地状态
      if (activeTab === 'project') {
        setProjectMemory(prev => prev ? { ...prev, content: editingContent, exists: true } : null)
      } else {
        setGlobalMemory(prev => prev ? { ...prev, content: editingContent, exists: true } : null)
      }
      
      setIsEditing(false)
      toast({
        title: '保存成功',
        description: 'GEMINI.md 文件已更新'
      })
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法保存记忆文件',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    try {
      const params = projectId ? { q: searchQuery, projectId } : { q: searchQuery }
      const res = await apiClient.get<any>('/memory/search', params)
      setSearchResults(res.data)
    } catch (error) {
      toast({
        title: '搜索失败',
        description: '无法搜索记忆内容',
        variant: 'destructive'
      })
    }
  }

  const getDefaultContent = () => {
    const type = activeTab === 'project' ? '项目' : '全局'
    return `# GEMINI.md - ${type}记忆

这个文件包含了重要的${type}信息和上下文，这些信息应该在不同会话之间保持记忆。

---

## 概述

在这里添加${type}的概述信息...

## 重要配置

在这里记录重要的配置信息...

## 开发笔记

在这里添加开发过程中的重要笔记...
`
  }

  const renderMemoryContent = (memory: MemoryFile | null) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )
    }

    if (!memory) {
      return (
        <Alert>
          <AlertDescription>
            无法加载记忆文件
          </AlertDescription>
        </Alert>
      )
    }

    if (isEditing) {
      return (
        <div className="space-y-4">
          <Textarea
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            className="min-h-[500px] font-mono text-sm"
            placeholder="在这里编辑 GEMINI.md 内容..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      )
    }

    if (!memory.exists || !memory.content) {
      return (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            GEMINI.md 文件尚未创建
          </p>
          <Button onClick={handleEdit}>
            <Plus className="mr-2 h-4 w-4" />
            创建文件
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            文件路径: {memory.path}
          </div>
          <Button onClick={handleEdit} size="sm">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
        </div>
        <ScrollArea className="h-[500px] rounded-md border p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {memory.content}
          </pre>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">记忆管理</h1>
        <p className="text-muted-foreground">
          管理项目和全局的 GEMINI.md 文件，保存重要的上下文信息
        </p>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="搜索记忆内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              搜索
            </Button>
          </div>
          
          {searchResults && searchResults.count > 0 && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground mb-2">
                找到 {searchResults.count} 个匹配项
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {searchResults.matches.map((match, index) => (
                    <Card key={index} className="p-3">
                      <pre className="text-sm whitespace-pre-wrap">
                        {match}
                      </pre>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 记忆文件标签页 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="project">
            <FileText className="mr-2 h-4 w-4" />
            项目记忆
          </TabsTrigger>
          <TabsTrigger value="global">
            <Globe className="mr-2 h-4 w-4" />
            全局记忆
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="project">
          <Card>
            <CardHeader>
              <CardTitle>项目 GEMINI.md</CardTitle>
              <CardDescription>
                当前项目的记忆文件，包含项目特定的上下文和配置信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderMemoryContent(projectMemory)}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="global">
          <Card>
            <CardHeader>
              <CardTitle>全局 GEMINI.md</CardTitle>
              <CardDescription>
                用户级别的记忆文件，在所有项目中共享的信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderMemoryContent(globalMemory)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}