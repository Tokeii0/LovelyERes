import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { errorResponse } from '../utils/response';

/**
 * VIP 验证中间件
 * 用于保护需要 VIP 权限的接口，在服务端进行验证
 * 防止客户端抓包修改会员信息
 */
export const requireVIP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      errorResponse(res, '未登录', 'UNAUTHORIZED', 401);
      return;
    }

    // 从数据库查询用户的 VIP 状态（不信任客户端传递的数据）
    const result = await pool.query(
      'SELECT is_vip, vip_expire_date FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      errorResponse(res, '用户不存在', 'USER_NOT_FOUND', 404);
      return;
    }

    const user = result.rows[0];

    // 检查是否为 VIP
    if (!user.is_vip) {
      errorResponse(res, '此功能需要 VIP 权限', 'VIP_REQUIRED', 403);
      return;
    }

    // 检查 VIP 是否过期
    if (user.vip_expire_date) {
      const expireDate = new Date(user.vip_expire_date);
      const now = new Date();

      if (now > expireDate) {
        // VIP 已过期，更新数据库状态
        await pool.query(
          'UPDATE users SET is_vip = false WHERE id = $1',
          [userId]
        );

        errorResponse(res, 'VIP 已过期，请续费', 'VIP_EXPIRED', 403);
        return;
      }

      // 计算剩余天数
      const diffTime = expireDate.getTime() - now.getTime();
      const vipDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      // 将 VIP 信息附加到请求对象上，供后续处理使用
      (req as any).vip = {
        isVip: true,
        vipDays,
        vipExpireDate: user.vip_expire_date
      };
    } else {
      // VIP 标志为 true 但没有过期时间，视为永久 VIP
      (req as any).vip = {
        isVip: true,
        vipDays: 999999, // 表示永久
        vipExpireDate: null
      };
    }

    // 验证通过，继续处理请求
    next();
  } catch (error) {
    console.error('VIP 验证失败:', error);
    errorResponse(res, '服务器错误', 'INTERNAL_SERVER_ERROR', 500);
  }
};

/**
 * 可选的 VIP 验证中间件
 * 不会阻止非 VIP 用户访问，但会在请求对象上附加 VIP 信息
 */
export const optionalVIP = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      (req as any).vip = { isVip: false, vipDays: 0 };
      next();
      return;
    }

    // 从数据库查询用户的 VIP 状态
    const result = await pool.query(
      'SELECT is_vip, vip_expire_date FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      (req as any).vip = { isVip: false, vipDays: 0 };
      next();
      return;
    }

    const user = result.rows[0];

    // 检查 VIP 状态
    if (user.is_vip && user.vip_expire_date) {
      const expireDate = new Date(user.vip_expire_date);
      const now = new Date();
      const diffTime = expireDate.getTime() - now.getTime();
      const vipDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      if (vipDays > 0) {
        (req as any).vip = {
          isVip: true,
          vipDays,
          vipExpireDate: user.vip_expire_date
        };
      } else {
        // VIP 已过期
        await pool.query(
          'UPDATE users SET is_vip = false WHERE id = $1',
          [userId]
        );
        (req as any).vip = { isVip: false, vipDays: 0 };
      }
    } else if (user.is_vip && !user.vip_expire_date) {
      // 永久 VIP
      (req as any).vip = {
        isVip: true,
        vipDays: 999999,
        vipExpireDate: null
      };
    } else {
      (req as any).vip = { isVip: false, vipDays: 0 };
    }

    next();
  } catch (error) {
    console.error('VIP 信息获取失败:', error);
    (req as any).vip = { isVip: false, vipDays: 0 };
    next();
  }
};
