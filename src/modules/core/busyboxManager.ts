/**
 * Busybox 管理器
 * 从本地上传 busybox 静态二进制到远端，用于可信命令执行
 *
 * 启用后，所有通过 Rust 后端 execute_command 执行的 SSH 命令
 * 都会自动用 busybox sh -c 包裹执行，绕过被篡改的系统命令和 LD_PRELOAD
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export type BusyboxStatus = 'unknown' | 'not-installed' | 'installed' | 'enabled';

class BusyboxManager {
  private status: BusyboxStatus = 'unknown';
  private path: string = '';
  private listeners: Array<(status: BusyboxStatus, path: string) => void> = [];

  /** 检测远端 busybox 状态 */
  async detect(): Promise<{ status: BusyboxStatus; path: string }> {
    try {
      const enabledPath = await invoke('busybox_status') as string | null;
      if (enabledPath) {
        this.status = 'enabled';
        this.path = enabledPath;
        this.notify();
        return { status: this.status, path: this.path };
      }

      const detected = await invoke('busybox_detect') as string;
      if (detected && detected.trim()) {
        this.status = 'installed';
        this.path = detected.trim();
      } else {
        this.status = 'not-installed';
        this.path = '';
      }
    } catch {
      this.status = 'unknown';
      this.path = '';
    }
    this.notify();
    return { status: this.status, path: this.path };
  }

  /** 打开文件选择器，选择本地 busybox 二进制，通过 SFTP 上传到远端 */
  async uploadFromLocal(): Promise<string> {
    // 弹出文件选择对话框
    let localPath: string | null = null;
    try {
      const selected = await open({
        title: '选择本地 busybox 静态二进制文件',
        multiple: false,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });
      if (typeof selected === 'string') {
        localPath = selected;
      } else if (selected && typeof selected === 'object' && 'path' in selected) {
        localPath = (selected as any).path;
      }
    } catch {
      // 如果 dialog 插件不可用，用 input 框让用户手动输入
      localPath = null;
    }

    if (!localPath) {
      throw new Error('未选择文件');
    }

    // 通过 SFTP 上传到远端
    const output = await invoke('busybox_install', { localPath }) as string;
    if (output.includes('INSTALL_OK')) {
      this.path = '/tmp/busybox';
      this.status = 'installed';
      this.notify();
    } else {
      throw new Error('上传或验证失败: ' + output);
    }
    return output;
  }

  /** 直接指定本地路径上传 (不弹文件选择器) */
  async uploadFromPath(localPath: string): Promise<string> {
    const output = await invoke('busybox_install', { localPath }) as string;
    if (output.includes('INSTALL_OK')) {
      this.path = '/tmp/busybox';
      this.status = 'installed';
      this.notify();
    } else {
      throw new Error('上传或验证失败: ' + output);
    }
    return output;
  }

  /** 启用 busybox 模式 */
  async enable(path?: string): Promise<void> {
    const p = path || this.path || '/tmp/busybox';
    await invoke('busybox_enable', { path: p });
    this.status = 'enabled';
    this.path = p;
    this.notify();
  }

  /** 禁用 busybox 模式 */
  async disable(): Promise<void> {
    await invoke('busybox_disable');
    this.status = this.path ? 'installed' : 'not-installed';
    this.notify();
  }

  /** 一键部署: 检测 → 上传(如需) → 启用 */
  async deployAndEnable(): Promise<string> {
    let log = '';

    // 1. 检测远端是否已有
    const { status } = await this.detect();
    log += `检测状态: ${status}\n`;

    if (status === 'enabled') {
      log += `busybox 已启用: ${this.path}\n`;
      return log;
    }

    // 2. 远端已有但未启用 → 直接启用
    if (status === 'installed') {
      log += `远端已有 busybox: ${this.path}，正在启用...\n`;
      await this.enable();
      log += 'busybox 模式已启用。\n';
      return log;
    }

    // 3. 远端没有 → 从本地上传
    log += '远端未找到 busybox，请选择本地文件上传...\n';
    try {
      const uploadLog = await this.uploadFromLocal();
      log += uploadLog + '\n';
    } catch (e) {
      log += `上传失败: ${e}\n`;
      throw new Error(log);
    }

    // 4. 启用
    log += `正在启用 busybox 模式: ${this.path}\n`;
    await this.enable();
    log += 'busybox 模式已启用。所有命令将通过 busybox sh 执行。\n';

    return log;
  }

  getStatus(): BusyboxStatus { return this.status; }
  getPath(): string { return this.path; }
  isEnabled(): boolean { return this.status === 'enabled'; }

  onStatusChange(fn: (status: BusyboxStatus, path: string) => void): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try { fn(this.status, this.path); } catch { /* ignore */ }
    }
  }
}

export const busyboxManager = new BusyboxManager();
