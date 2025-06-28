import dotenv from 'dotenv';
import { z } from 'zod';

// 加载环境变量
dotenv.config();

/**
 * 环境变量验证模式
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('localhost'),
  
  // 数据库配置
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  
  // JWT 配置
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Session 配置
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // CORS 配置
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15分钟
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // 日志配置
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('app.log'),
  
  // Gemini CLI 配置
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-pro'),
  
  // 安全配置
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  
  // WebSocket 配置
  WS_PING_TIMEOUT: z.string().transform(Number).default('60000'),
  WS_PING_INTERVAL: z.string().transform(Number).default('25000'),
});

/**
 * 验证并导出配置
 */
export const config = envSchema.parse(process.env);

/**
 * 配置类型
 */
export type Config = z.infer<typeof envSchema>;

/**
 * 检查是否为开发环境
 */
export const isDevelopment = config.NODE_ENV === 'development';

/**
 * 检查是否为生产环境
 */
export const isProduction = config.NODE_ENV === 'production';

/**
 * 检查是否为测试环境
 */
export const isTest = config.NODE_ENV === 'test';

/**
 * 数据库配置
 */
export const dbConfig = {
  url: config.DATABASE_URL,
  redis: config.REDIS_URL,
};

/**
 * JWT 配置
 */
export const jwtConfig = {
  secret: config.JWT_SECRET,
  refreshSecret: config.JWT_REFRESH_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
  refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
};

/**
 * CORS 配置
 */
export const corsConfig = {
  origin: config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

/**
 * Rate limiting 配置
 */
export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: '请求过于频繁，请稍后再试',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * 日志配置
 */
export const logConfig = {
  level: config.LOG_LEVEL,
  file: config.LOG_FILE,
  format: isDevelopment ? 'dev' : 'combined',
  colorize: isDevelopment,
};

/**
 * Gemini CLI 配置
 */
export const geminiConfig = {
  apiKey: config.GEMINI_API_KEY,
  model: config.GEMINI_MODEL,
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 30000,
};

/**
 * WebSocket 配置
 */
export const wsConfig = {
  pingTimeout: config.WS_PING_TIMEOUT,
  pingInterval: config.WS_PING_INTERVAL,
  cors: corsConfig,
  transports: ['websocket', 'polling'],
};

/**
 * 安全配置
 */
export const securityConfig = {
  bcryptRounds: config.BCRYPT_ROUNDS,
  sessionSecret: config.SESSION_SECRET,
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  },
};

export default config;