import bcrypt from 'bcrypt';
import { 
  User, 
  UserRole, 
  UserStatus, 
  UserPreferences,
  RegisterRequest,
  LoginRequest 
} from '@gemini-cli-webui/shared';
import { generateId } from '../utils/index.js';
import logger from '../utils/logger.js';

/**
 * 用户模型类
 * 提供用户数据管理和验证功能
 */
export class UserModel {
  private users: Map<string, User & { passwordHash: string }> = new Map();
  private usersByUsername: Map<string, string> = new Map();
  private usersByEmail: Map<string, string> = new Map();

  constructor() {
    // 初始化默认管理员用户
    this.initializeDefaultAdmin();
  }

  /**
   * 初始化默认管理员用户
   */
  private async initializeDefaultAdmin(): Promise<void> {
    try {
      const adminExists = Array.from(this.users.values()).some(user => user.role === UserRole.ADMIN);
      
      if (!adminExists) {
        const adminId = generateId();
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPass123!';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);
        
        const adminUser: User & { passwordHash: string } = {
          id: adminId,
          username: 'admin',
          email: 'admin@gemini-cli-webui.local',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          displayName: '系统管理员',
          createdAt: new Date(),
          updatedAt: new Date(),
          preferences: {
            theme: 'auto',
            language: 'zh-CN',
            notifications: {
              email: true,
              push: true,
              toolExecutions: true,
              approvals: true,
            },
            toolSettings: {
              autoApprove: false,
              maxConcurrentTools: 10,
              timeoutMinutes: 30,
            },
          },
          passwordHash,
        };

        this.users.set(adminId, adminUser);
        this.usersByUsername.set('admin', adminId);
        this.usersByEmail.set('admin@gemini-cli-webui.local', adminId);
        
        logger.info('默认管理员用户已创建', { 
          username: 'admin', 
          password: defaultPassword 
        });
      }
    } catch (error) {
      logger.error('初始化默认管理员用户失败:', error);
    }
  }

  /**
   * 创建新用户
   */
  async createUser(registerData: RegisterRequest): Promise<User> {
    // 检查用户名是否已存在
    if (this.usersByUsername.has(registerData.username)) {
      throw new Error('用户名已存在');
    }

    // 检查邮箱是否已存在
    if (this.usersByEmail.has(registerData.email)) {
      throw new Error('邮箱已被使用');
    }

    const userId = generateId();
    const passwordHash = await bcrypt.hash(registerData.password, 12);
    
    const newUser: User & { passwordHash: string } = {
      id: userId,
      username: registerData.username,
      email: registerData.email,
      role: UserRole.USER, // 新用户默认为普通用户
      status: UserStatus.ACTIVE,
      displayName: registerData.displayName || registerData.username,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'auto',
        language: 'zh-CN',
        notifications: {
          email: true,
          push: true,
          toolExecutions: true,
          approvals: true,
        },
        toolSettings: {
          autoApprove: false,
          maxConcurrentTools: 3,
          timeoutMinutes: 15,
        },
      },
      passwordHash,
    };

    this.users.set(userId, newUser);
    this.usersByUsername.set(registerData.username, userId);
    this.usersByEmail.set(registerData.email, userId);

    logger.info('新用户已创建', { 
      userId, 
      username: registerData.username,
      email: registerData.email 
    });

    // 返回不包含密码哈希的用户对象
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * 验证用户登录
   */
  async validateLogin(loginData: LoginRequest): Promise<User | null> {
    const userId = this.usersByUsername.get(loginData.username);
    if (!userId) {
      return null;
    }

    const user = this.users.get(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(loginData.password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    logger.info('用户登录成功', { 
      userId: user.id, 
      username: user.username 
    });

    // 返回不包含密码哈希的用户对象
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 通过 ID 获取用户
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // 返回不包含密码哈希的用户对象
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 通过用户名获取用户
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usersByUsername.get(username);
    if (!userId) {
      return null;
    }

    return this.getUserById(userId);
  }

  /**
   * 通过邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.usersByEmail.get(email);
    if (!userId) {
      return null;
    }

    return this.getUserById(userId);
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, updateData: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // 更新允许的字段
    const allowedFields: (keyof User)[] = [
      'displayName', 'avatar', 'preferences', 'status'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        (user as any)[field] = updateData[field];
      }
    }

    user.updatedAt = new Date();

    logger.info('用户信息已更新', { 
      userId, 
      updatedFields: Object.keys(updateData) 
    });

    // 返回不包含密码哈希的用户对象
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 更改用户密码
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return false;
    }

    // 更新密码
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.updatedAt = new Date();

    logger.info('用户密码已更改', { userId });

    return true;
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.role = newRole;
    user.updatedAt = new Date();

    logger.info('用户角色已更新', { 
      userId, 
      newRole 
    });

    // 返回不包含密码哈希的用户对象
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // 不允许删除管理员用户
    if (user.role === UserRole.ADMIN) {
      throw new Error('不能删除管理员用户');
    }

    this.users.delete(userId);
    this.usersByUsername.delete(user.username);
    this.usersByEmail.delete(user.email);

    logger.info('用户已删除', { 
      userId, 
      username: user.username 
    });

    return true;
  }

  /**
   * 获取所有用户列表
   */
  async getAllUsers(): Promise<User[]> {
    const users = Array.from(this.users.values()).map(user => {
      const { passwordHash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return users.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats() {
    const allUsers = Array.from(this.users.values());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(user => user.status === UserStatus.ACTIVE).length,
      newUsersToday: allUsers.filter(user => user.createdAt >= today).length,
      usersByRole: {
        [UserRole.GUEST]: allUsers.filter(user => user.role === UserRole.GUEST).length,
        [UserRole.USER]: allUsers.filter(user => user.role === UserRole.USER).length,
        [UserRole.ADMIN]: allUsers.filter(user => user.role === UserRole.ADMIN).length,
      },
      usersByStatus: {
        [UserStatus.ACTIVE]: allUsers.filter(user => user.status === UserStatus.ACTIVE).length,
        [UserStatus.INACTIVE]: allUsers.filter(user => user.status === UserStatus.INACTIVE).length,
        [UserStatus.SUSPENDED]: allUsers.filter(user => user.status === UserStatus.SUSPENDED).length,
        [UserStatus.PENDING]: allUsers.filter(user => user.status === UserStatus.PENDING).length,
      },
    };
  }

  /**
   * 检查用户是否存在
   */
  async userExists(username: string, email?: string): Promise<boolean> {
    if (this.usersByUsername.has(username)) {
      return true;
    }
    
    if (email && this.usersByEmail.has(email)) {
      return true;
    }
    
    return false;
  }
}

// 导出单例实例
export const userModel = new UserModel();