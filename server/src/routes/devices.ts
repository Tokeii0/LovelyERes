import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate } from '../middlewares/auth';
import crypto from 'crypto';

const router = Router();

/**
 * 生成离线授权密钥
 */
function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return `LOVELYRES-${segments.join('-')}`;
}

/**
 * 获取设备列表
 * GET /api/v1/devices
 */
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;

    const result = await pool.query(
      `SELECT
        id, device_code, device_name, device_type, device_fingerprint,
        bind_status, is_active, offline_license_key, license_expire_date,
        bound_at, last_active_at
      FROM user_devices
      WHERE user_id = $1
      ORDER BY bound_at DESC`,
      [userId]
    );

    res.json({
      code: 200,
      message: 'success',
      data: {
        devices: result.rows,
        total: result.rows.length
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 绑定设备
 * POST /api/v1/devices
 */
router.post('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { device_code, device_name, device_type, device_fingerprint } = req.body;

    if (!device_code) {
      res.status(400).json({
        code: 400,
        message: '设备标识码不能为空',
        error: 'INVALID_INPUT',
        timestamp: Date.now()
      });
      return;
    }

    // 检查设备是否已存在记录
    const deviceCheck = await pool.query(
      'SELECT id, user_id, bind_status FROM user_devices WHERE device_code = $1',
      [device_code]
    );

    // 如果设备已被其他用户绑定（且状态为 active）
    if (deviceCheck.rows.length > 0) {
      const existingDevice = deviceCheck.rows[0];

      if (existingDevice.bind_status === 'active') {
        if (existingDevice.user_id === userId) {
          res.status(400).json({
            code: 400,
            message: '该设备已绑定到您的账户',
            error: 'DEVICE_ALREADY_BOUND',
            timestamp: Date.now()
          });
          return;
        } else {
          res.status(400).json({
            code: 400,
            message: '该设备已被其他用户绑定',
            error: 'DEVICE_ALREADY_BOUND',
            timestamp: Date.now()
          });
          return;
        }
      }

      // 如果是同一用户的已解绑设备，检查是否可以重新绑定
      if (existingDevice.user_id === userId && existingDevice.bind_status === 'unbound') {
        // 允许重新绑定，后续会更新记录而不是插入
      } else if (existingDevice.user_id !== userId) {
        // 不同用户的已解绑设备，也不允许绑定
        res.status(400).json({
          code: 400,
          message: '该设备已被其他用户使用过',
          error: 'DEVICE_USED_BY_OTHERS',
          timestamp: Date.now()
        });
        return;
      }
    }

    // 检查用户的设备数量限制
    const userResult = await pool.query(
      'SELECT max_devices, is_vip, vip_expire_date FROM users WHERE id = $1',
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

    const user = userResult.rows[0];

    // 检查 VIP 是否过期
    if (user.is_vip && user.vip_expire_date) {
      const vipExpireDate = new Date(user.vip_expire_date);
      if (vipExpireDate < new Date()) {
        res.status(403).json({
          code: 403,
          message: 'VIP 已过期',
          error: 'VIP_EXPIRED',
          timestamp: Date.now()
        });
        return;
      }
    }

    // 检查当前绑定的设备数量
    const deviceCountResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_devices WHERE user_id = $1 AND bind_status = $2',
      [userId, 'active']
    );

    const currentDeviceCount = parseInt(deviceCountResult.rows[0].count);

    if (currentDeviceCount >= user.max_devices) {
      res.status(403).json({
        code: 403,
        message: `设备数量已达上限（${user.max_devices}台）`,
        error: 'DEVICE_LIMIT_EXCEEDED',
        timestamp: Date.now()
      });
      return;
    }

    // 生成离线授权密钥
    const licenseKey = generateLicenseKey();

    // 授权过期时间使用用户的 VIP 到期时间
    // 如果用户不是 VIP 或 VIP 已过期，使用默认授权时间（30 天）
    let licenseExpireDate: Date;
    if (user.is_vip && user.vip_expire_date) {
      const vipExpireDate = new Date(user.vip_expire_date);
      // 检查 VIP 是否已过期
      if (vipExpireDate > new Date()) {
        licenseExpireDate = vipExpireDate;
      } else {
        // VIP 已过期，使用默认授权时间
        licenseExpireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // 非 VIP 用户，使用默认授权时间（30 天）
      licenseExpireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    let deviceResult;

    // 检查是否是重新绑定之前解绑的设备
    const existingUnboundDevice = await pool.query(
      'SELECT id, unbound_at FROM user_devices WHERE user_id = $1 AND device_code = $2 AND bind_status = $3',
      [userId, device_code, 'unbound']
    );

    if (existingUnboundDevice.rows.length > 0) {
      // 检查解绑后是否绑定过其他设备
      const unboundAt = existingUnboundDevice.rows[0].unbound_at;

      if (unboundAt) {
        // 查询在解绑时间之后是否绑定过其他设备
        const newDevicesAfterUnbind = await pool.query(
          `SELECT COUNT(*) as count FROM user_devices
           WHERE user_id = $1
           AND device_code != $2
           AND bind_status = 'active'
           AND bound_at > $3`,
          [userId, device_code, unboundAt]
        );

        const newDeviceCount = parseInt(newDevicesAfterUnbind.rows[0].count);

        if (newDeviceCount > 0) {
          res.status(403).json({
            code: 403,
            message: '解绑后已绑定新设备，无法重新绑定原设备',
            error: 'CANNOT_REBIND_AFTER_NEW_DEVICE',
            timestamp: Date.now()
          });
          return;
        }
      }

      // 允许重新激活之前解绑的设备
      deviceResult = await pool.query(
        `UPDATE user_devices
         SET device_name = $1,
             device_type = $2,
             device_fingerprint = $3,
             bind_status = $4,
             is_active = $5,
             offline_license_key = $6,
             license_expire_date = $7,
             bound_at = CURRENT_TIMESTAMP,
             unbound_at = NULL
         WHERE id = $8
         RETURNING *`,
        [
          device_name || '未命名设备',
          device_type || 'unknown',
          device_fingerprint ? JSON.stringify(device_fingerprint) : null,
          'active',
          true,
          licenseKey,
          licenseExpireDate,
          existingUnboundDevice.rows[0].id
        ]
      );
    } else {
      // 绑定新设备
      deviceResult = await pool.query(
        `INSERT INTO user_devices
          (user_id, device_code, device_name, device_type, device_fingerprint,
           bind_status, is_active, offline_license_key, license_expire_date, bound_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          userId,
          device_code,
          device_name || '未命名设备',
          device_type || 'unknown',
          device_fingerprint ? JSON.stringify(device_fingerprint) : null,
          'active',
          true,
          licenseKey,
          licenseExpireDate
        ]
      );
    }

    // 记录绑定历史
    await pool.query(
      `INSERT INTO device_bind_history
        (user_id, action_type, new_device_code, device_name, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        userId,
        'bind',
        device_code,
        device_name || '未命名设备',
        req.ip || ''
      ]
    );

    res.status(201).json({
      code: 201,
      message: '设备绑定成功',
      data: {
        device: deviceResult.rows[0]
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('绑定设备失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 获取设备详情
 * GET /api/v1/devices/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const deviceId = parseInt(req.params.id);

    const result = await pool.query(
      `SELECT * FROM user_devices WHERE id = $1 AND user_id = $2`,
      [deviceId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 404,
        message: '设备不存在',
        error: 'DEVICE_NOT_FOUND',
        timestamp: Date.now()
      });
      return;
    }

    res.json({
      code: 200,
      message: 'success',
      data: result.rows[0],
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 解绑设备
 * DELETE /api/v1/devices/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const deviceId = parseInt(req.params.id);

    // 检查设备是否存在
    const deviceResult = await pool.query(
      'SELECT device_code, device_name FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (deviceResult.rows.length === 0) {
      res.status(404).json({
        code: 404,
        message: '设备不存在',
        error: 'DEVICE_NOT_FOUND',
        timestamp: Date.now()
      });
      return;
    }

    const device = deviceResult.rows[0];

    // 更新设备状态为已解绑
    await pool.query(
      `UPDATE user_devices
       SET bind_status = $1, is_active = $2, unbound_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      ['unbound', false, deviceId]
    );

    // 记录解绑历史
    await pool.query(
      `INSERT INTO device_bind_history
        (user_id, action_type, old_device_code, device_name, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [
        userId,
        'unbind',
        device.device_code,
        device.device_name,
        req.ip || ''
      ]
    );

    res.json({
      code: 200,
      message: '设备解绑成功',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('解绑设备失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器错误',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

export default router;

