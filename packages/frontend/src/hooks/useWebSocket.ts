import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { CONSTANTS } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/hooks/useToast'

export interface WebSocketMessage {
  type: string
  payload: any
  timestamp: number
  id?: string
}

export interface WebSocketConnection {
  socket: Socket | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: WebSocketMessage | null
  sendMessage: (type: string, payload: any) => void
  reconnect: () => void
  disconnect: () => void
}

interface UseWebSocketOptions {
  autoConnect?: boolean
  enableReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectInterval?: number
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  onMessage?: (message: WebSocketMessage) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketConnection {
  const {
    autoConnect = true,
    enableReconnect = true,
    maxReconnectAttempts = 5,
    reconnectInterval = 3000,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
  } = options

  const { user, token } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!user || !token) {
      setError('用户未认证')
      return
    }

    if (socketRef.current?.connected) {
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const socket = io(CONSTANTS.WS_URL, {
        auth: {
          token,
        },
        transports: ['websocket'],
        reconnection: false, // 我们自己处理重连
        timeout: 10000,
      })

      // 连接成功
      socket.on('connect', () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setIsConnecting(false)
        setError(null)
        reconnectAttemptsRef.current = 0
        onConnect?.()
      })

      // 连接断开
      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        setIsConnected(false)
        setIsConnecting(false)
        onDisconnect?.()

        // 自动重连
        if (enableReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          if (reason === 'io server disconnect') {
            // 服务器主动断开，不自动重连
            return
          }

          reconnectAttemptsRef.current++
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current - 1)
          
          toast({
            title: '连接断开',
            description: `正在尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`,
            variant: 'warning',
          })

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('连接失败，已达到最大重连次数')
          toast({
            title: '连接失败',
            description: '无法连接到服务器，请检查网络连接',
            variant: 'destructive',
          })
        }
      })

      // 连接错误
      socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err)
        setIsConnecting(false)
        setError(err.message)
        onError?.(err)
      })

      // 认证错误
      socket.on('auth_error', (err) => {
        console.error('WebSocket auth error:', err)
        setError('认证失败')
        socket.disconnect()
        toast({
          title: '认证失败',
          description: '请重新登录',
          variant: 'destructive',
        })
      })

      // 接收消息
      socket.onAny((eventName, ...args) => {
        const message: WebSocketMessage = {
          type: eventName,
          payload: args[0],
          timestamp: Date.now(),
          id: args[0]?.id,
        }
        
        setLastMessage(message)
        onMessage?.(message)
      })

      socketRef.current = socket
    } catch (err) {
      console.error('Failed to create socket:', err)
      setIsConnecting(false)
      setError(err instanceof Error ? err.message : '连接失败')
    }
  }, [user, token, enableReconnect, maxReconnectAttempts, reconnectInterval, onConnect, onDisconnect, onError, onMessage])

  const disconnect = useCallback(() => {
    clearReconnectTimeout()
    
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    
    setIsConnected(false)
    setIsConnecting(false)
    setError(null)
    reconnectAttemptsRef.current = 0
  }, [clearReconnectTimeout])

  const reconnect = useCallback(() => {
    disconnect()
    connect()
  }, [disconnect, connect])

  const sendMessage = useCallback((type: string, payload: any) => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected, cannot send message')
      return
    }

    try {
      socketRef.current.emit(type, payload)
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('发送消息失败')
    }
  }, [])

  // 自动连接
  useEffect(() => {
    if (autoConnect && user && token) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, user, token, connect, disconnect])

  // 监听用户状态变化
  useEffect(() => {
    if (!user && socketRef.current) {
      disconnect()
    }
  }, [user, disconnect])

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    error,
    lastMessage,
    sendMessage,
    reconnect,
    disconnect,
  }
}

/**
 * 专门用于聊天的 WebSocket Hook
 */
export function useChatWebSocket() {
  const { sendMessage, ...connection } = useWebSocket({
    onMessage: (message) => {
      // 处理聊天相关的消息
      switch (message.type) {
        case 'message_received':
        case 'message_updated':
        case 'typing_start':
        case 'typing_stop':
        case 'conversation_updated':
          // 这些消息由 useChatStore 处理
          break
        default:
          console.log('Received chat message:', message)
      }
    },
  })

  const sendChatMessage = useCallback((conversationId: string, content: string) => {
    sendMessage('send_message', {
      conversationId,
      content,
      timestamp: Date.now(),
    })
  }, [sendMessage])

  const sendTypingStatus = useCallback((conversationId: string, isTyping: boolean) => {
    sendMessage(isTyping ? 'typing_start' : 'typing_stop', {
      conversationId,
      timestamp: Date.now(),
    })
  }, [sendMessage])

  const joinConversation = useCallback((conversationId: string) => {
    sendMessage('join_conversation', {
      conversationId,
    })
  }, [sendMessage])

  const leaveConversation = useCallback((conversationId: string) => {
    sendMessage('leave_conversation', {
      conversationId,
    })
  }, [sendMessage])

  return {
    ...connection,
    sendChatMessage,
    sendTypingStatus,
    joinConversation,
    leaveConversation,
  }
}

/**
 * 连接状态显示组件的 Hook
 */
export function useWebSocketStatus() {
  const { isConnected, isConnecting, error } = useWebSocket({ autoConnect: false })

  const getStatusText = useCallback(() => {
    if (isConnecting) return '连接中...'
    if (isConnected) return '已连接'
    if (error) return '连接失败'
    return '未连接'
  }, [isConnected, isConnecting, error])

  const getStatusColor = useCallback(() => {
    if (isConnecting) return 'text-yellow-500'
    if (isConnected) return 'text-green-500'
    if (error) return 'text-red-500'
    return 'text-gray-500'
  }, [isConnected, isConnecting, error])

  return {
    isConnected,
    isConnecting,
    error,
    statusText: getStatusText(),
    statusColor: getStatusColor(),
  }
}