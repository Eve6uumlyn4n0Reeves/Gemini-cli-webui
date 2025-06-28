import { beforeAll, afterAll, afterEach } from 'vitest';
import dotenv from 'dotenv';

// 加载测试环境变量
dotenv.config({ path: '.env.test' });

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-must-be-at-least-32-characters-long';
process.env.SESSION_SECRET = 'test-session-secret-key-must-be-at-least-32-characters-long';

beforeAll(async () => {
  // 全局测试设置
  console.log('🧪 开始测试套件');
});

afterAll(async () => {
  // 全局测试清理
  console.log('✅ 测试套件完成');
});

afterEach(() => {
  // 每个测试后清理
});