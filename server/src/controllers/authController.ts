import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt';
import { successResponse, errorResponse, createdResponse } from '../utils/response';
import { body, validationResult } from 'express-validator';

/**
 * 用户注册
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, nickname, email, password, qq_id } = req.body;

    // 检查用户名是否已存在
    const usernameExists = await UserModel.usernameExists(username);
    if (usernameExists) {
      errorResponse(res, '用户名已存在', 'USERNAME_EXISTS', 409);
      return;
    }

    // 检查邮箱是否已存在
    const emailExists = await UserModel.emailExists(email);
    if (emailExists) {
      errorResponse(res, '邮箱已存在', 'EMAIL_EXISTS', 409);
      return;
    }

    // 创建用户
    const user = await UserModel.create({
      username,
      nickname,
      email,
      password,
      qq_id,
    });

    // 生成 token
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    // 返回用户信息和 token
    createdResponse(
      res,
      {
        user: UserModel.sanitizeUser(user),
        token: tokens,
      },
      '注册成功'
    );
  } catch (error) {
    console.error('Register error:', error);
    errorResponse(res, '注册失败', 'REGISTER_FAILED', 500);
  }
};

/**
 * 用户登录
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await UserModel.findByUsernameOrEmail(username);
    if (!user) {
      errorResponse(res, '用户名或密码错误', 'INVALID_CREDENTIALS', 401);
      return;
    }

    // 验证密码
    const isPasswordValid = await UserModel.verifyPassword(user, password);
    if (!isPasswordValid) {
      errorResponse(res, '用户名或密码错误', 'INVALID_CREDENTIALS', 401);
      return;
    }

    // 检查账户状态
    if (user.status !== 'active') {
      errorResponse(res, '账户已被禁用', 'ACCOUNT_DISABLED', 403);
      return;
    }

    // 更新最后登录时间
    await UserModel.updateLastLogin(user.id);

    // 生成 token
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    // 返回用户信息和 token
    successResponse(res, {
      user: UserModel.sanitizeUser(user),
      token: tokens,
    }, '登录成功');
  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, '登录失败', 'LOGIN_FAILED', 500);
  }
};

/**
 * 刷新 Token
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      errorResponse(res, '缺少刷新令牌', 'REFRESH_TOKEN_MISSING', 400);
      return;
    }

    // 验证 refresh token
    const payload = verifyRefreshToken(refresh_token);

    // 查找用户
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      errorResponse(res, '用户不存在', 'USER_NOT_FOUND', 404);
      return;
    }

    // 生成新的 token
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    successResponse(res, {
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
    }, 'Token 刷新成功');
  } catch (error) {
    console.error('Refresh error:', error);
    errorResponse(res, '刷新令牌无效或已过期', 'REFRESH_TOKEN_INVALID', 401);
  }
};

/**
 * 用户登出
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // 在实际应用中，这里可以将 token 加入黑名单
    // 目前只是返回成功响应
    successResponse(res, null, '登出成功');
  } catch (error) {
    console.error('Logout error:', error);
    errorResponse(res, '登出失败', 'LOGOUT_FAILED', 500);
  }
};

// 验证规则
export const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在 3-50 个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('邮箱格式不正确')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少为 6 个字符'),
  body('nickname')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('昵称长度不能超过 100 个字符'),
  body('qq_id')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('QQ号长度不能超过 20 个字符')
    .matches(/^[0-9]+$/)
    .withMessage('QQ号只能包含数字'),
];

export const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
];

