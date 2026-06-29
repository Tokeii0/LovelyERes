/**
 * 前端全局工具: 通知 / 确认 / 弹窗
 *
 * 取代全仓里的 `window.showNotification?.(...)` 与
 * `(window as any).app?...` 动态访问.
 *
 * 约束: 本文件不 import 其他业务模块, 仅对 window 挂载做类型收敛.
 */

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface AppStateSlice {
  currentServer?: string;
  [k: string]: unknown;
}

interface AppShell {
  stateManager?: { getState: () => AppStateSlice };
  modernUIRenderer?: { baselineRenderer?: unknown; [k: string]: unknown };
  sshManager?: { executeCommand?: (cmd: string) => Promise<string> };
  [k: string]: unknown;
}

interface TauriCore {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

interface GlobalExt {
  showNotification?: (message: string, type?: NotificationType) => void;
  app?: AppShell;
  __TAURI__?: { core?: TauriCore };
}

function g(): GlobalExt {
  return window as unknown as GlobalExt;
}

/** 显示一条 toast 通知, 若通知系统尚未就绪则静默忽略 */
export function notify(message: string, type: NotificationType = 'info'): void {
  const fn = g().showNotification;
  if (typeof fn === 'function') fn(message, type);
}

/** 读取 app 壳层状态 (只读, 未初始化返回 undefined) */
export function getApp(): AppShell | undefined {
  return g().app;
}

/** 读取当前服务器标识, 缺省 'unknown' */
export function getCurrentServer(): string {
  return getApp()?.stateManager?.getState()?.currentServer ?? 'unknown';
}

/** 读取 Tauri core.invoke, 无 Tauri 环境返回 undefined */
export function getTauriInvoke(): TauriCore['invoke'] | undefined {
  return g().__TAURI__?.core?.invoke;
}

/** 保证执行 Tauri 命令, 无环境时抛错 */
export async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const inv = getTauriInvoke();
  if (!inv) throw new Error('Tauri 环境不可用');
  return inv<T>(cmd, args);
}

/** 读取 app.sshManager.executeCommand (如可用) */
export function getSSHExecutor(): ((cmd: string) => Promise<string>) | undefined {
  const fn = getApp()?.sshManager?.executeCommand;
  return typeof fn === 'function' ? fn.bind(getApp()!.sshManager) : undefined;
}
