import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  // 数据库错误
  if (err.code) {
    switch (err.code) {
      case '23505': // 唯一约束违反
        errorResponse(res, '数据已存在', 'DUPLICATE_ENTRY', 409);
        return;
      case '23503': // 外键约束违反
        errorResponse(res, '关联数据不存在', 'FOREIGN_KEY_VIOLATION', 400);
        return;
      case '23502': // 非空约束违反
        errorResponse(res, '必填字段缺失', 'NOT_NULL_VIOLATION', 400);
        return;
      default:
        errorResponse(res, '数据库错误', 'DATABASE_ERROR', 500);
        return;
    }
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    errorResponse(res, '认证令牌无效', 'TOKEN_INVALID', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse(res, '认证令牌已过期', 'TOKEN_EXPIRED', 401);
    return;
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    errorResponse(res, err.message, 'VALIDATION_ERROR', 400);
    return;
  }

  // 默认错误
  errorResponse(
    res,
    err.message || '服务器内部错误',
    err.code || 'INTERNAL_SERVER_ERROR',
    err.statusCode || 500
  );
};

/**
 * 404 处理中间件
 */
export const notFoundHandler = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  errorResponse(res, '请求的资源不存在', 'NOT_FOUND', 404);
};

