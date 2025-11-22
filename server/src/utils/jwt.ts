import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId: number;
  username: string;
  email: string;
}

/**
 * 生成访问令牌
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  // @ts-ignore
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * 生成刷新令牌
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  // @ts-ignore
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

/**
 * 验证访问令牌
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    throw new Error('TOKEN_INVALID');
  }
};

/**
 * 验证刷新令牌
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch (error) {
    throw new Error('TOKEN_INVALID');
  }
};

/**
 * 生成令牌对
 */
export const generateTokenPair = (payload: TokenPayload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 计算过期时间（秒）
  const expiresIn = config.jwt.expiresIn;
  let expiresInSeconds = 3600; // 默认1小时

  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 's':
          expiresInSeconds = value;
          break;
        case 'm':
          expiresInSeconds = value * 60;
          break;
        case 'h':
          expiresInSeconds = value * 3600;
          break;
        case 'd':
          expiresInSeconds = value * 86400;
          break;
      }
    }
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresInSeconds,
  };
};

