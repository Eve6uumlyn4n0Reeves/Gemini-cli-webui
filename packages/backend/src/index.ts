import App from './app.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

/**
 * 应用程序入口点
 */
async function bootstrap() {
  try {
    logger.info('🚀 启动 Gemini CLI WebUI Backend...');
    logger.info(`📝 配置信息: ${JSON.stringify({
      NODE_ENV: config.NODE_ENV,
      PORT: config.PORT,
      HOST: config.HOST,
      LOG_LEVEL: config.LOG_LEVEL
    }, null, 2)}`);

    // 创建应用实例
    const app = new App();
    
    // 启动应用
    await app.start();
    
    logger.info('✅ 应用启动成功!');
    
    // 定期输出状态信息（仅在开发环境）
    if (config.NODE_ENV === 'development') {
      setInterval(() => {
        const status = app.getStatus();
        logger.debug('应用状态:', {
          uptime: `${Math.round(status.uptime)}s`,
          memory: `${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`,
          connections: status.connections
        });
      }, 30000); // 每30秒
    }

  } catch (error) {
    logger.error('❌ 应用启动失败:', error);
    process.exit(1);
  }
}

// 启动应用
bootstrap();