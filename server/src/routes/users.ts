import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate } from '../middlewares/auth';
import bcrypt from 'bcrypt';

const router = Router();

/**
 * 获取当前用户信息
 * GET /api/v1/users/me
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `SELECT
        id, username, nickname, email, qq_id,
        is_vip, vip_expire_date, max_devices, device_rebind_count, max_rebind_count,
        status, email_verified, created_at, last_login_at
      FROM users
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 404,
        message: '用户不存在',
        error: 'USER_NOT_FOUND',
        timestamp: Date.now()
      });
      return;
    }

    const user = result.rows[0];

    // 服务端实时计算 VIP 剩余天数，防止客户端篡改
    let vipDays = 0;
    if (user.is_vip && user.vip_expire_date) {
      const expireDate = new Date(user.vip_expire_date);
      const now = new Date();
      const diffTime = expireDate.getTime() - now.getTime();
      vipDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      // 如果 VIP 已过期，更新数据库状态
      if (vipDays === 0 && user.is_vip) {
        await pool.query(
          'UPDATE users SET is_vip = false WHERE id = $1',
          [userId]
        );
        user.is_vip = false;
      }
    }

    res.json({
      code: 200,
      message: 'success',
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        qq_id: user.qq_id,
        is_vip: user.is_vip,
        vip_expire_date: user.vip_expire_date,
        vip_days: vipDays, // 添加服务端计算的剩余天数
        max_devices: user.max_devices,
        device_rebind_count: user.device_rebind_count,
        max_rebind_count: user.max_rebind_count,
        status: user.status,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login_at: user.last_login_at
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 更新用户信息
 * PATCH /api/v1/users/me
 */
router.patch('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { nickname, email, qq_id } = req.body;

    // 构建更新字段
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(nickname);
    }

    if (email !== undefined) {
      // 检查邮箱是否已被其他用户使用
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        res.status(400).json({
          code: 400,
          message: '邮箱已被使用',
          error: 'EMAIL_EXISTS',
          timestamp: Date.now()
        });
        return;
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(email);
      updates.push(`email_verified = false`); // 邮箱修改后需要重新验证
    }

    if (qq_id !== undefined) {
      updates.push(`qq_id = $${paramIndex++}`);
      values.push(qq_id);
    }

    if (updates.length === 0) {
      res.status(400).json({
        code: 400,
        message: '没有需要更新的字段',
        error: 'NO_UPDATES',
        timestamp: Date.now()
      });
      return;
    }

    // 添加 updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, nickname, email, qq_id, is_vip, vip_expire_date,
                max_devices, device_rebind_count, max_rebind_count, status,
                email_verified, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    res.json({
      code: 200,
      message: '用户信息更新成功',
      data: result.rows[0],
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 修改密码
 * POST /api/v1/users/me/password
 */
router.post('/me/password', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      res.status(400).json({
        code: 400,
        message: '旧密码和新密码不能为空',
        error: 'INVALID_INPUT',
        timestamp: Date.now()
      });
      return;
    }

    // 验证旧密码
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        code: 404,
        message: '用户不存在',
        error: 'USER_NOT_FOUND',
        timestamp: Date.now()
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(old_password, userResult.rows[0].password_hash);

    if (!isValidPassword) {
      res.status(400).json({
        code: 400,
        message: '旧密码错误',
        error: 'INVALID_OLD_PASSWORD',
        timestamp: Date.now()
      });
      return;
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // 更新密码
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({
      code: 200,
      message: '密码修改成功',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

export default router;

