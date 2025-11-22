import { v4 as uuidv4 } from 'uuid';

/**
 * 生成离线授权密钥
 * 格式: LOVELYRES-XXXX-XXXX-XXXX-XXXX
 */
export const generateLicenseKey = (): string => {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  
  // 分成4段，每段4个字符
  const part1 = uuid.substring(0, 4);
  const part2 = uuid.substring(4, 8);
  const part3 = uuid.substring(8, 12);
  const part4 = uuid.substring(12, 16);
  
  return `LOVELYRES-${part1}-${part2}-${part3}-${part4}`;
};

/**
 * 验证授权密钥格式
 */
export const validateLicenseKeyFormat = (licenseKey: string): boolean => {
  const pattern = /^LOVELYRES-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  return pattern.test(licenseKey);
};

/**
 * 计算剩余天数
 */
export const calculateRemainingDays = (expireDate: Date): number => {
  const now = new Date();
  const diff = expireDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/**
 * 检查授权是否过期
 */
export const isLicenseExpired = (expireDate: Date): boolean => {
  return new Date() > expireDate;
};

