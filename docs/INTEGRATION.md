# Gemini CLI 集成指南

本文档说明了如何将 Gemini CLI WebUI 与真实的 Google Gemini CLI 集成。

## 适配器类型

Gemini CLI WebUI 支持多种集成方式：

### 1. Mock 适配器（默认）
- 用于开发和测试
- 不需要真实的 Gemini API Key
- 模拟所有 API 响应

```env
GEMINI_ADAPTER_TYPE=mock
```

### 2. Subprocess 适配器
- 通过子进程调用已安装的 gemini-cli
- 需要先安装 @google/gemini-cli
- 提供完整的功能支持

```bash
# 安装 gemini-cli
npm install -g @google/gemini-cli

# 配置环境变量
GEMINI_ADAPTER_TYPE=subprocess
GEMINI_EXECUTABLE_PATH=gemini
GEMINI_API_KEY=your-api-key
```

### 3. Core 适配器
- 直接集成 gemini-cli 核心模块
- 最佳性能和集成度
- 需要本地安装 gemini-cli

```env
GEMINI_ADAPTER_TYPE=core
GEMINI_API_KEY=your-api-key
```

### 4. API 适配器（计划中）
- 通过 HTTP API 与 gemini-cli 服务通信
- 适合分布式部署
- 支持负载均衡

## 安装步骤

### 1. 克隆项目
```bash
git clone https://github.com/your-username/gemini-cli-webui.git
cd gemini-cli-webui/v0.2-code-webui
```

### 2. 安装依赖
```bash
pnpm install
```

### 3. 配置环境
```bash
cp .env.example .env
# 编辑 .env 文件，设置你的配置
```

### 4. 获取 Gemini API Key
访问 [Google AI Studio](https://aistudio.google.com/apikey) 生成 API Key

### 5. 选择适配器类型

#### 使用 Mock 适配器（开发测试）
```env
GEMINI_ADAPTER_TYPE=mock
```

#### 使用真实 Gemini CLI
```env
GEMINI_ADAPTER_TYPE=subprocess
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-pro
```

### 6. 启动应用
```bash
# 开发模式
pnpm dev

# 生产构建
pnpm build
pnpm start
```

## 配置说明

### 基本配置
```typescript
{
  adapterConfig: {
    type: AdapterType.SUBPROCESS,
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-pro',
    debugMode: true
  }
}
```

### 高级配置
```typescript
{
  adapterConfig: {
    type: AdapterType.CORE,
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 60000,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 1000
    }
  },
  enableWebSocketNotifications: true,
  enableMetrics: true,
  maxConcurrentSessions: 10,
  sessionTimeout: 3600000
}
```

## 功能对比

| 功能 | Mock | Subprocess | Core | API |
|------|------|------------|------|-----|
| 实时响应 | ✅ | ✅ | ✅ | ✅ |
| 工具执行 | ⚠️ 模拟 | ✅ | ✅ | ✅ |
| MCP 支持 | ❌ | ✅ | ✅ | ❌ |
| 沙箱执行 | ❌ | ✅ | ❌ | ❌ |
| 内存支持 | ✅ | ✅ | ✅ | ❌ |
| 视觉能力 | ❌ | ✅ | ✅ | ✅ |
| 性能 | 高 | 中 | 高 | 中 |

## 故障排除

### 常见问题

1. **找不到 gemini-cli**
   ```bash
   # 检查是否已安装
   which gemini
   
   # 如未安装，执行
   npm install -g @google/gemini-cli
   ```

2. **API Key 无效**
   - 确保 API Key 正确设置在环境变量中
   - 检查 API Key 是否有效且未过期
   - 确认所选模型与 API Key 权限匹配

3. **适配器初始化失败**
   - 检查日志输出获取详细错误信息
   - 确认所选适配器类型的依赖已安装
   - 验证配置参数是否正确

4. **工具执行失败**
   - 确认工具权限设置正确
   - 检查沙箱配置（如果启用）
   - 查看工具执行日志

## 开发指南

### 创建自定义适配器
```typescript
import { EventEmitter } from 'eventemitter3';

export class CustomAdapter extends EventEmitter {
  async initialize(): Promise<void> {
    // 初始化逻辑
  }
  
  async sendMessage(conversation, content, options): Promise<Message> {
    // 发送消息逻辑
  }
  
  async executeTool(tool, input, context): Promise<ToolResult> {
    // 执行工具逻辑
  }
}
```

### 扩展工具支持
```typescript
const customTool: Tool = {
  id: 'custom-tool',
  name: 'customTool',
  description: 'A custom tool',
  category: 'custom',
  parameters: [...],
  execute: async (params) => {
    // 工具执行逻辑
  }
};
```

## 生产部署

### Docker 部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install --production
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

### 环境变量
确保在生产环境中安全地管理环境变量：
- 使用密钥管理服务
- 避免在代码中硬编码敏感信息
- 定期轮换 API Keys

### 监控和日志
- 启用指标收集：`ENABLE_METRICS=true`
- 配置日志级别：`LOG_LEVEL=info`
- 集成监控服务（如 Prometheus、Grafana）

## 贡献指南

欢迎贡献代码！请查看 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解详情。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。