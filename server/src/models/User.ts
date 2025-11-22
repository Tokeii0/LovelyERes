import { query } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';

export interface User {
  id: number;
  username: string;
  nickname?: string;
  email: string;
  password_hash: string;
  qq_id?: string;
  is_vip: boolean;
  vip_expire_date?: Date;
  max_devices: number;
  device_rebind_count: number;
  max_rebind_count: number;
  status: 'active' | 'suspended' | 'deleted';
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface CreateUserData {
  username: string;
  nickname?: string;
  email: string;
  password: string;
  qq_id?: string;
}

export interface UpdateUserData {
  nickname?: string;
  email?: string;
  qq_id?: string;
}

export class UserModel {
  /**
   * 创建用户
   */
  static async create(data: CreateUserData): Promise<User> {
    const passwordHash = await hashPassword(data.password);

    const result = await query(
      `INSERT INTO users (username, nickname, email, password_hash, qq_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.username, data.nickname || data.username, data.email, passwordHash, data.qq_id || null]
    );

    return result.rows[0];
  }

  /**
   * 通过 ID 查找用户
   */
  static async findById(id: number): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * 通过用户名查找用户
   */
  static async findByUsername(username: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE username = $1', [
      username,
    ]);
    return result.rows[0] || null;
  }

  /**
   * 通过邮箱查找用户
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }

  /**
   * 通过用户名或邮箱查找用户
   */
  static async findByUsernameOrEmail(
    usernameOrEmail: string
  ): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [usernameOrEmail]
    );
    return result.rows[0] || null;
  }

  /**
   * 验证密码
   */
  static async verifyPassword(
    user: User,
    password: string
  ): Promise<boolean> {
    return await comparePassword(password, user.password_hash);
  }

  /**
   * 更新用户信息
   */
  static async update(id: number, data: UpdateUserData): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.nickname !== undefined) {
      fields.push(`nickname = $${paramIndex++}`);
      values.push(data.nickname);
    }

    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(data.email);
      // 邮箱更新后需要重新验证
      fields.push(`email_verified = $${paramIndex++}`);
      values.push(false);
    }

    if (data.qq_id !== undefined) {
      fields.push(`qq_id = $${paramIndex++}`);
      values.push(data.qq_id);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * 更新密码
   */
  static async updatePassword(id: number, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      id,
    ]);
  }

  /**
   * 更新最后登录时间
   */
  static async updateLastLogin(id: number): Promise<void> {
    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [
      id,
    ]);
  }

  /**
   * 增加设备换绑次数
   */
  static async incrementRebindCount(id: number): Promise<void> {
    await query(
      'UPDATE users SET device_rebind_count = device_rebind_count + 1 WHERE id = $1',
      [id]
    );
  }

  /**
   * 检查用户名是否存在
   */
  static async usernameExists(username: string): Promise<boolean> {
    const result = await query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)',
      [username]
    );
    return result.rows[0].exists;
  }

  /**
   * 检查邮箱是否存在
   */
  static async emailExists(email: string): Promise<boolean> {
    const result = await query(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)',
      [email]
    );
    return result.rows[0].exists;
  }

  /**
   * 删除用户（软删除）
   */
  static async softDelete(id: number): Promise<void> {
    await query("UPDATE users SET status = 'deleted' WHERE id = $1", [id]);
  }

  /**
   * 计算 VIP 剩余天数
   */
  static calculateVipDays(user: User): number {
    if (!user.is_vip || !user.vip_expire_date) {
      return 0;
    }

    const expireDate = new Date(user.vip_expire_date);
    const now = new Date();
    const diffTime = expireDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * 获取用户的公开信息（不包含密码）
   */
  static sanitizeUser(user: User): Omit<User, 'password_hash'> & { vip_days: number } {
    const { password_hash, ...sanitized } = user;
    const vip_days = this.calculateVipDays(user);
    return {
      ...sanitized,
      vip_days
    };
  }
}

