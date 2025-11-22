import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { errorResponse } from '../utils/response';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * 认证中间件
 * 验证 JWT token 并将用户信息添加到 request 对象
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      errorResponse(res, '未提供认证令牌', 'TOKEN_MISSING', 401);
      return;
    }

    // 检查格式: Bearer <token>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      errorResponse(res, '认证令牌格式错误', 'TOKEN_FORMAT_INVALID', 401);
      return;
    }

    const token = parts[1];

    // 验证 token
    try {
      const payload = verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'jwt expired') {
          errorResponse(res, '认证令牌已过期', 'TOKEN_EXPIRED', 401);
        } else {
          errorResponse(res, '认证令牌无效', 'TOKEN_INVALID', 401);
        }
      } else {
        errorResponse(res, '认证失败', 'AUTH_FAILED', 401);
      }
      return;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    errorResponse(res, '认证失败', 'AUTH_FAILED', 500);
    return;
  }
};

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，否则继续
 */
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  const token = parts[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
  } catch (error) {
    // 忽略错误，继续执行
  }

  next();
};

