import { MessageSquare, Sparkles, Zap, FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function EmptyState() {
  const examples = [
    {
      icon: <Sparkles className="h-5 w-5 text-blue-500" />,
      title: '创意写作',
      description: '帮我写一篇关于人工智能的文章',
    },
    {
      icon: <Zap className="h-5 w-5 text-green-500" />,
      title: '代码编程',
      description: '用 Python 写一个计算器程序',
    },
    {
      icon: <FileText className="h-5 w-5 text-purple-500" />,
      title: '文档分析',
      description: '总结这个 PDF 文档的要点',
    },
  ]

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-2xl">
        {/* Main Icon */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Welcome Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            欢迎使用 Gemini CLI WebUI
          </h2>
          <p className="text-muted-foreground text-lg">
            您的智能助手已准备就绪。开始对话，探索无限可能。
          </p>
        </div>

        {/* Example Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {examples.map((example, index) => (
            <Card 
              key={index}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {example.icon}
                  <h3 className="font-medium text-sm">{example.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {example.description}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Tips */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>💡 提示：您可以询问任何问题，或请求帮助完成各种任务</p>
          <p>🔧 支持：代码编写、文档分析、创意写作、问题解答等</p>
        </div>
      </div>
    </div>
  )
}