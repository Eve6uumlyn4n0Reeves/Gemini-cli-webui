# Gemini CLI WebUI Frontend

现代化的 React 前端应用，为 Gemini CLI 提供直观的 Web 界面。

## 🎯 项目进度

### ✅ 已完成功能

#### 基础架构 (100%)
- ✅ Vite + React 18 + TypeScript 构建系统
- ✅ Tailwind CSS + Shadcn/UI 设计系统  
- ✅ React Router 路由管理
- ✅ Zustand + React Query 状态管理
- ✅ 双主题支持（明亮/暗黑模式）

#### UI 组件库 (100%)
- ✅ Button, Input, Textarea, Card 基础组件
- ✅ Dialog, Dropdown, Toast, Avatar 交互组件
- ✅ ScrollArea, Separator, Tabs 布局组件
- ✅ 完整的 Shadcn/UI 组件集成

#### 应用布局 (100%)
- ✅ AppLayout - 主应用布局框架
- ✅ Header - 顶部导航栏（用户菜单、主题切换）
- ✅ Sidebar - 侧边栏（对话列表、搜索）
- ✅ MainContent - 主内容区域

#### 认证系统 (100%)
- ✅ AuthPage - 登录/注册页面
- ✅ AuthStore - 认证状态管理
- ✅ JWT Token 管理和自动刷新
- ✅ 会话持久化和安全登出

#### 聊天功能 (100%)
- ✅ ChatPage - 聊天主页面
- ✅ ChatMessages - 消息展示组件
- ✅ MessageItem - 单条消息组件
- ✅ MarkdownRenderer - Markdown 渲染
- ✅ ChatInput - 消息输入组件
- ✅ TypingIndicator - 输入状态指示
- ✅ EmptyState - 空状态展示

#### 设置页面 (100%)
- ✅ SettingsPage - 用户设置界面
- ✅ 个人资料管理
- ✅ 密码修改功能
- ✅ 主题和外观设置

#### API 服务层 (100%)
- ✅ ApiClient - 统一 HTTP 客户端
- ✅ AuthApi - 认证 API 服务
- ✅ ChatApi - 聊天 API 服务
- ✅ 错误处理和重试机制
- ✅ 请求拦截器和响应处理

### 🚧 待实现功能

#### 实时通信 (0%)
- ⏳ WebSocket 客户端集成
- ⏳ 流式消息处理
- ⏳ 实时状态同步

#### 工具系统 (0%)
- ⏳ 工具执行界面
- ⏳ 审批流程管理
- ⏳ 工具结果展示

#### 高级功能 (0%)
- ⏳ 文件上传/下载
- ⏳ 语音输入
- ⏳ 消息搜索
- ⏳ 对话导出

## 🛠️ 技术栈

### 核心框架
- **React 18** - 前端框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理

### UI 设计
- **Tailwind CSS** - 样式框架
- **Shadcn/UI** - 组件库
- **Radix UI** - 无障碍访问组件
- **Lucide React** - 图标库
- **next-themes** - 主题管理

### 状态管理
- **Zustand** - 客户端状态
- **React Query** - 服务端状态
- **React Hook Form** - 表单状态

### 工具库
- **React Markdown** - Markdown 渲染
- **Highlight.js** - 代码高亮
- **Zod** - 数据验证
- **class-variance-authority** - 样式变体

## 🚀 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+

### 安装依赖
```bash
cd packages/frontend
pnpm install
```

### 启动开发服务器
```bash
pnpm dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本
```bash
pnpm build
```

### 运行测试
```bash
pnpm test
```

## 📁 项目结构

```
src/
├── components/          # 组件目录
│   ├── ui/             # 基础 UI 组件
│   ├── layout/         # 布局组件
│   └── chat/           # 聊天相关组件
├── pages/              # 页面组件
├── stores/             # 状态管理
├── services/           # API 服务
├── hooks/              # 自定义 Hooks
├── lib/                # 工具函数
├── styles/             # 全局样式
└── types/              # 类型定义
```

## 🎨 设计系统

### 颜色主题
- 支持明亮/暗黑双主题
- CSS Variables 动态切换
- 语义化颜色命名

### 组件规范
- 基于 Shadcn/UI 设计规范
- CVA 变体管理
- 完整的 TypeScript 类型支持

### 响应式设计
- Mobile First 设计理念
- Tailwind 响应式断点
- 适配各种屏幕尺寸

## 🔧 开发指南

### 代码规范
- ESLint + Prettier 代码格式化
- TypeScript 严格模式
- 组件 Props 类型定义

### 提交规范
- 语义化提交信息
- 功能分支开发
- Code Review 流程

### 性能优化
- React.memo 组件缓存
- 代码分割和懒加载
- 图片优化和预加载

## 📋 待办事项

### 高优先级
- [ ] WebSocket 实时通信集成
- [ ] 流式消息处理
- [ ] 工具执行界面
- [ ] 错误边界和错误处理

### 中优先级
- [ ] 文件上传功能
- [ ] 消息搜索功能
- [ ] 对话导出功能
- [ ] 性能监控

### 低优先级
- [ ] 语音输入功能
- [ ] 键盘快捷键
- [ ] 无障碍访问优化
- [ ] PWA 支持

## 📞 支持与反馈

如有问题或建议，请联系开发团队或提交 Issue。