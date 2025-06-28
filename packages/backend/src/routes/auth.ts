import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { 
  authenticateToken, 
  requireAdmin, 
  userRateLimit,
  checkTokenExpiration 
} from '../middleware/auth.js';

const router = Router();

/**
 * 认证路由
 * 处理用户注册、登录、登出等认证相关的端点
 */

// 公开端点（不需要认证）
router.post('/register', userRateLimit(5), AuthController.register);
router.post('/login', userRateLimit(10), AuthController.login);
router.post('/refresh-token', userRateLimit(20), AuthController.refreshToken);
router.post('/password-reset/request', userRateLimit(3), AuthController.requestPasswordReset);

// 需要认证的端点
router.use(authenticateToken);
router.use(checkTokenExpiration);

// 用户相关端点
router.get('/me', AuthController.getCurrentUser);
router.post('/logout', AuthController.logout);
router.post('/logout-all', AuthController.logoutAll);
router.post('/change-password', userRateLimit(5), AuthController.changePassword);
router.get('/validate-token', AuthController.validateToken);

// 会话管理端点
router.get('/sessions', AuthController.getSessions);
router.delete('/sessions/:sessionId', AuthController.terminateSession);

// 管理员端点
router.get('/stats', requireAdmin, AuthController.getAuthStats);

export default router;