import { v4 as uuidv4 } from 'uuid';
import type { Message, ToolExecution, WebSocketEvent } from '../types/index.js';

// ID generation utilities
export const generateId = (): string => uuidv4();

export const generateSessionId = (): string => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const generateRequestId = (): string => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Date utilities
export const formatTimestamp = (date: Date): string => {
  return date.toISOString();
};

export const parseTimestamp = (timestamp: string): Date => {
  return new Date(timestamp);
};

export const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// String utilities
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};

export const sanitizeString = (str: string): string => {
  return str.replace(/[<>]/g, '');
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const kebabCase = (str: string): string => {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

export const camelCase = (str: string): string => {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, c => c.toLowerCase());
};

// Object utilities
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
};

export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

// Array utilities
export const uniqueBy = <T, K extends keyof T>(array: T[], key: K): T[] => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

export const groupBy = <T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
};

export const sortBy = <T>(
  array: T[],
  keyFn: (item: T) => string | number | Date,
  direction: 'asc' | 'desc' = 'asc'
): T[] => {
  return [...array].sort((a, b) => {
    const aValue = keyFn(a);
    const bValue = keyFn(b);
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidUuid = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// File utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
};

export const getMimeType = (filename: string): string => {
  const extension = getFileExtension(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

// Error utilities
export const createError = (
  code: string,
  message: string,
  details?: Record<string, unknown>
): Error & { code: string; details?: Record<string, unknown> } => {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
};

export const isErrorWithCode = (
  error: unknown
): error is Error & { code: string } => {
  return error instanceof Error && 'code' in error;
};

// WebSocket utilities
export const createWebSocketEvent = <T>(
  type: string,
  data: T,
  options?: {
    conversationId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
): WebSocketEvent<T> => {
  return {
    type: type as any,
    data,
    timestamp: new Date(),
    id: generateId(),
    ...(options?.conversationId && { conversationId: options.conversationId }),
    ...(options?.userId && { userId: options.userId }),
    ...(options?.metadata && { metadata: options.metadata }),
  };
};

// Message utilities
export const createMessage = (
  conversationId: string,
  content: string,
  role: 'user' | 'assistant' | 'system' = 'user',
  userId?: string
): Omit<Message, 'id' | 'timestamp' | 'status'> => {
  return {
    conversationId,
    role,
    content: [{ type: 'text', text: content }],
    ...(userId && { userId }),
  };
};

export const extractTextFromMessage = (message: Message): string => {
  return message.content
    .filter(content => content.type === 'text')
    .map(content => content.text)
    .filter(Boolean)
    .join(' ');
};

// Tool utilities
export const isToolExecutionPending = (execution: ToolExecution): boolean => {
  return ['pending', 'approved', 'executing'].includes(execution.status);
};

export const isToolExecutionCompleted = (execution: ToolExecution): boolean => {
  return ['completed', 'error', 'timeout'].includes(execution.status);
};

export const getToolExecutionDuration = (execution: ToolExecution): number | null => {
  if (!execution.executedAt || !execution.completedAt) return null;
  return execution.completedAt.getTime() - execution.executedAt.getTime();
};

// Performance utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Promise utilities
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Promise timeout')), ms);
  });
  
  return Promise.race([promise, timeoutPromise]);
};

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      await sleep(delay * attempt);
    }
  }
  
  throw lastError!;
};