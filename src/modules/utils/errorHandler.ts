/**
 * 统一错误提示与日志
 *
 * 目的:
 *  - 消灭散落在代码里的 `catch {}` / `catch (e) { console.log(e) }`
 *  - 向用户反馈失败 (showNotification),并同时进入 logger 缓冲区
 *  - 让"取消"类错误 (AbortError / 用户主动取消) 不产生噪音
 */

import { logger } from '../core/logger';

export interface ReportOptions {
  /** 出现在通知与日志里的模块名, 如 'DockerManager' */
  module: string;
  /** 给用户看的动作描述, 如 '加载容器列表' */
  action?: string;
  /** 是否弹 toast, 默认 true */
  notify?: boolean;
  /** 通知严重程度, 默认 error */
  level?: 'error' | 'warning';
  /** 静默: 仅记日志, 不通知用户 */
  silent?: boolean;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  if (name === 'AbortError' || name === 'CanceledError') return true;
  const msg = (err as { message?: string }).message;
  return !!msg && /aborted|cancell?ed/i.test(msg);
}

export function formatError(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err === 'object') {
    const anyErr = err as { message?: unknown; toString?: () => string };
    if (typeof anyErr.message === 'string') return anyErr.message;
    try { return JSON.stringify(err); } catch { /* noop */ }
  }
  try { return String(err); } catch { return 'Unknown error'; }
}

/**
 * 报告错误: 既记日志, 又通知用户.
 *
 * 用法:
 *   try { ... } catch (e) { reportError(e, { module: 'DockerManager', action: '加载容器列表' }); }
 */
export function reportError(err: unknown, opts: ReportOptions): void {
  if (isAbortError(err)) {
    logger.module(opts.module).debug(`${opts.action ?? ''} 已取消`);
    return;
  }

  const msg = formatError(err);
  const log = logger.module(opts.module);
  log.error(opts.action ? `${opts.action}失败: ${msg}` : msg, err);

  if (opts.silent) return;
  if (opts.notify === false) return;

  const toast = (window as unknown as {
    showNotification?: (m: string, t: 'error' | 'warning' | 'info' | 'success') => void;
  }).showNotification;
  if (typeof toast === 'function') {
    const display = opts.action ? `${opts.action}失败: ${msg}` : msg;
    toast(display, opts.level ?? 'error');
  }
}

/**
 * 包装一个 async 函数: 失败时自动 reportError 并返回 undefined.
 *
 * 用法:
 *   const containers = await safeCall(
 *     () => invoke<Container[]>('docker_list'),
 *     { module: 'DockerManager', action: '加载容器列表' },
 *   ) ?? [];
 */
export async function safeCall<T>(
  fn: () => Promise<T> | T,
  opts: ReportOptions,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    reportError(e, opts);
    return undefined;
  }
}
