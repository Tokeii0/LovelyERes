import { Response } from 'express';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * 成功响应
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'success',
  code: number = 200
): Response => {
  const response: ApiResponse<T> = {
    code,
    message,
    data,
    timestamp: Date.now(),
  };
  return res.status(code).json(response);
};

/**
 * 错误响应
 */
export const errorResponse = (
  res: Response,
  message: string,
  error: string,
  code: number = 400
): Response => {
  const response: ApiResponse = {
    code,
    message,
    error,
    timestamp: Date.now(),
  };
  return res.status(code).json(response);
};

/**
 * 创建响应（201）
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message: string = '创建成功'
): Response => {
  return successResponse(res, data, message, 201);
};

/**
 * 无内容响应（204）
 */
export const noContentResponse = (res: Response): Response => {
  return res.status(204).send();
};

