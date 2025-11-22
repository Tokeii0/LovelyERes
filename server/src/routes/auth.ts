import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  registerValidation,
  loginValidation,
} from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';
import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/response';
import { Request, Response, NextFunction } from 'express';

const router = Router();

// 验证中间件
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    errorResponse(
      res,
      errors.array()[0].msg,
      'VALIDATION_ERROR',
      400
    );
    return;
  }
  next();
};

// 用户注册
router.post('/register', authLimiter, registerValidation, validate, register);

// 用户登录
router.post('/login', authLimiter, loginValidation, validate, login);

// 刷新 Token
router.post('/refresh', refresh);

// 用户登出（需要认证）
router.post('/logout', authenticate, logout);

export default router;

