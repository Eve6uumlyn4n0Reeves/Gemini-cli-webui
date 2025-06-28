# 聊天服务 API 使用指南

## 📋 API 端点概览

### 认证
所有聊天 API 都需要在请求头中包含 JWT 访问令牌：
```
Authorization: Bearer <your_access_token>
```

### 基础 URL
```
http://localhost:3001/api/chat
```

## 🗨️ 对话管理 API

### 1. 创建新对话
```http
POST /api/chat/conversations
Content-Type: application/json

{
  "title": "我的新对话",
  "settings": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "你是一个有用的AI助手"
  },
  "metadata": {
    "category": "工作",
    "tags": ["AI", "助手"]
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": "conv_123456",
    "title": "我的新对话",
    "userId": "user_123",
    "messages": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "isActive": true,
    "settings": {
      "model": "gemini-pro",
      "temperature": 0.7,
      "maxTokens": 4096,
      "systemPrompt": "你是一个有用的AI助手"
    }
  },
  "message": "对话创建成功"
}
```

### 2. 获取对话列表
```http
GET /api/chat/conversations?page=1&limit=20&includeInactive=false
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_123456",
        "title": "我的新对话",
        "userId": "user_123",
        "messages": [
          // 最新一条消息
        ],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "isActive": true
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

### 3. 获取指定对话详情
```http
GET /api/chat/conversations/{conversationId}
```

### 4. 更新对话信息
```http
PUT /api/chat/conversations/{conversationId}
Content-Type: application/json

{
  "title": "更新后的对话标题",
  "settings": {
    "temperature": 0.8
  }
}
```

### 5. 删除对话
```http
DELETE /api/chat/conversations/{conversationId}
```

## 💬 消息处理 API

### 1. 发送消息（同步响应）
```http
POST /api/chat/conversations/{conversationId}/messages
Content-Type: application/json

{
  "content": [
    {
      "type": "text",
      "text": "你好，请介绍一下自己。"
    }
  ],
  "parentMessageId": "msg_optional_parent",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": "msg_user_123",
      "conversationId": "conv_123456",
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "你好，请介绍一下自己。"
        }
      ],
      "status": "sent",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "userId": "user_123"
    },
    "aiMessage": {
      "id": "msg_ai_123",
      "conversationId": "conv_123456",
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "你好！我是一个有用的AI助手..."
        }
      ],
      "status": "sent",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 2. 发送消息（流式响应）
```http
POST /api/chat/conversations/{conversationId}/messages/stream
Content-Type: application/json
Accept: text/event-stream

{
  "content": [
    {
      "type": "text",
      "text": "请详细解释一下量子计算的原理。"
    }
  ]
}
```

**Server-Sent Events 响应：**
```
data: {"type":"connected"}

data: {"type":"user_message","data":{"id":"msg_user_124",...}}

data: {"type":"ai_chunk","data":{"chunk":"量子"}}

data: {"type":"ai_chunk","data":{"chunk":"计算是"}}

data: {"type":"ai_chunk","data":{"chunk":"一种..."}}

data: {"type":"ai_complete","data":{"id":"msg_ai_124",...}}

data: {"type":"done"}
```

### 3. 获取对话消息
```http
GET /api/chat/conversations/{conversationId}/messages?page=1&limit=50&before=msg_123&after=msg_456
```

**查询参数：**
- `page`: 页码（默认 1）
- `limit`: 每页消息数（默认 50，最大 100）
- `before`: 获取指定消息ID之前的消息
- `after`: 获取指定消息ID之后的消息

## 🔍 搜索功能

### 1. 搜索所有消息
```http
GET /api/chat/search?query=量子计算&limit=20
```

### 2. 在指定对话中搜索
```http
GET /api/chat/conversations/{conversationId}/search?query=量子计算&limit=20
```

## 📊 统计信息

### 获取用户聊天统计
```http
GET /api/chat/stats
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "totalConversations": 5,
    "activeConversations": 4,
    "totalMessages": 120,
    "averageMessagesPerConversation": 24
  }
}
```

## ⚡ WebSocket 实时通信

### 连接建立
```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your_jwt_token'
  }
});

// 连接成功
socket.on('authenticated', (data) => {
  console.log('WebSocket 认证成功:', data);
});
```

### 核心事件

#### 1. 加入对话房间
```javascript
socket.emit('join_conversation', {
  conversationId: 'conv_123456'
});

socket.on('conversation_joined', (data) => {
  console.log('已加入对话:', data);
});
```

#### 2. 实时发送消息
```javascript
socket.emit('send_message', {
  conversationId: 'conv_123456',
  content: [
    {
      type: 'text',
      text: '这是一条实时消息'
    }
  ]
});

// 接收消息
socket.on('message_received', (data) => {
  console.log('收到新消息:', data);
});

// 接收AI响应片段
socket.on('ai_response_chunk', (data) => {
  console.log('AI响应片段:', data.chunk);
});
```

#### 3. 输入状态
```javascript
// 开始输入
socket.emit('typing_start', {
  conversationId: 'conv_123456'
});

// 停止输入
socket.emit('typing_stop', {
  conversationId: 'conv_123456'
});

// 监听其他用户输入状态
socket.on('typing_start', (data) => {
  console.log(`${data.username} 正在输入...`);
});
```

#### 4. 创建对话
```javascript
socket.emit('create_conversation', {
  title: '新的实时对话',
  settings: {
    model: 'gemini-pro'
  }
});

socket.on('conversation_created', (data) => {
  console.log('对话创建成功:', data.conversation);
});
```

## 🔒 权限和限制

### 速率限制
- 创建对话: 10次/分钟
- 发送消息: 30次/分钟
- 流式消息: 20次/分钟
- 搜索请求: 20次/分钟

### 权限要求
- 所有聊天API需要至少 `user` 角色权限
- 用户只能访问自己的对话和消息
- 管理员可以执行清理操作

## 🚀 最佳实践

### 1. 错误处理
```javascript
try {
  const response = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(conversationData)
  });
  
  const result = await response.json();
  
  if (!result.success) {
    console.error('API错误:', result.error);
    // 处理具体错误
  }
} catch (error) {
  console.error('网络错误:', error);
}
```

### 2. WebSocket 连接管理
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

socket.on('disconnect', () => {
  console.log('WebSocket 连接断开');
  
  if (reconnectAttempts < maxReconnectAttempts) {
    setTimeout(() => {
      reconnectAttempts++;
      socket.connect();
    }, 2000 * reconnectAttempts);
  }
});

socket.on('connect', () => {
  reconnectAttempts = 0;
  console.log('WebSocket 重新连接成功');
});
```

### 3. 消息状态管理
```javascript
// 本地消息状态
const messageStates = {
  SENDING: 'sending',
  SENT: 'sent',
  ERROR: 'error'
};

// 发送消息时先在本地显示
const tempMessage = {
  id: 'temp_' + Date.now(),
  content: messageContent,
  status: messageStates.SENDING
};

// 发送成功后更新状态
socket.on('message_received', (data) => {
  if (data.type === 'user_message') {
    // 替换临时消息
    updateMessageStatus(tempMessage.id, messageStates.SENT, data.message);
  }
});
```

## 🔧 管理员功能

### 清理过期对话
```http
POST /api/chat/admin/cleanup?days=30
Authorization: Bearer <admin_token>
```

此功能需要管理员权限，用于清理指定天数内无活动的对话。

---

## 📝 注意事项

1. **认证令牌**：所有API请求都需要有效的JWT令牌
2. **内容验证**：消息内容会经过严格的验证和过滤
3. **并发限制**：同一用户的并发请求有数量限制
4. **数据持久化**：当前使用内存存储，重启服务会丢失数据
5. **WebSocket心跳**：建议实现心跳检测机制维持连接稳定性

完整的API实现已就绪，可以开始前端集成和测试！