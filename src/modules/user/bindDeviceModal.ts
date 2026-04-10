/**
 * 绑定机器模态框
 */

import { apiService } from '../api/apiService';
import { invoke } from '@tauri-apps/api/core';
import { showConfirm } from '../ui/confirmDialog';

interface DeviceInfo {
  device_uuid: string;
  device_type: string;
  device_name: string;
}

interface BoundDevice {
  id: number;
  device_code: string;
  device_name: string;
  device_type: string;
  bind_status: string;
  is_active: boolean;
  offline_license_key: string;
  license_expire_date: string;
  bound_at: string;
}

export class BindDeviceModal {
  private static instance: BindDeviceModal;
  private modal: HTMLElement | null = null;
  private currentDeviceInfo: DeviceInfo | null = null;
  private boundDevices: BoundDevice[] = [];

  private constructor() {}

  public static getInstance(): BindDeviceModal {
    if (!BindDeviceModal.instance) {
      BindDeviceModal.instance = new BindDeviceModal();
    }
    return BindDeviceModal.instance;
  }

  /**
   * 显示绑定机器模态框
   */
  public async show(): Promise<void> {
    if (!this.modal) {
      this.createModal();
    }

    // 并行获取设备信息和已绑定设备列表
    await Promise.all([
      this.loadCurrentDeviceInfo(),
      this.loadBoundDevices(),
    ]);

    // 渲染设备列表
    this.renderDeviceList();

    this.modal!.style.display = 'flex';
  }

  /**
   * 隐藏绑定机器模态框
   */
  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * 加载当前设备信息
   */
  private async loadCurrentDeviceInfo(): Promise<void> {
    try {
      this.currentDeviceInfo = await invoke<DeviceInfo>('get_device_uuid');
      console.log('📱 当前设备信息:', this.currentDeviceInfo);
    } catch (error) {
      console.error('❌ 获取设备信息失败:', error);
      (window as any).showNotification && (window as any).showNotification(
        '获取设备信息失败',
        'error'
      );
    }
  }

  /**
   * 加载已绑定设备列表
   */
  private async loadBoundDevices(): Promise<void> {
    try {
      this.boundDevices = await apiService.getDevices();
      console.log('📋 已绑定设备列表:', this.boundDevices);
    } catch (error) {
      console.error('❌ 获取设备列表失败:', error);
      (window as any).showNotification && (window as any).showNotification(
        '获取设备列表失败',
        'error'
      );
    }
  }

  /**
   * 渲染设备列表
   */
  private renderDeviceList(): void {
    const deviceListContainer = document.getElementById('device-list-container');
    if (!deviceListContainer) return;

    const currentDeviceCode = this.currentDeviceInfo?.device_uuid;
    const isCurrentDeviceBound = this.boundDevices.some(
      (device) => device.device_code === currentDeviceCode && device.bind_status === 'active'
    );

    let html = '';

    // 当前设备信息
    if (this.currentDeviceInfo) {
      html += `
        <div class="current-device-info" style="
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        ">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">
            📱 当前设备
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: var(--text-secondary);">
            <div><strong>设备名称:</strong> ${this.currentDeviceInfo.device_name}</div>
            <div><strong>设备类型:</strong> ${this.currentDeviceInfo.device_type}</div>
            <div><strong>设备 UUID:</strong> <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">${this.currentDeviceInfo.device_uuid}</code></div>
          </div>
          ${!isCurrentDeviceBound ? `
            <button
              onclick="window.bindCurrentDevice()"
              style="
                margin-top: 12px;
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                background: var(--primary-color);
                color: white;
                font-size: 14px;
                cursor: pointer;
              "
              onmouseover="this.style.opacity='0.9'"
              onmouseout="this.style.opacity='1'"
            >
              绑定当前设备
            </button>
          ` : `
            <div style="margin-top: 12px; color: var(--success-color); font-size: 14px;">
              ✅ 当前设备已绑定
            </div>
          `}
        </div>
      `;
    }

    // 已绑定设备列表
    html += `
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">
        🖥️ 已绑定设备 (${this.boundDevices.length})
      </h3>
    `;

    if (this.boundDevices.length === 0) {
      html += `
        <div style="
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
          font-size: 14px;
        ">
          暂无绑定设备
        </div>
      `;
    } else {
      html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
      
      this.boundDevices.forEach((device) => {
        const isCurrentDevice = device.device_code === currentDeviceCode;
        const statusColor = device.bind_status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)';
        const statusText = device.bind_status === 'active' ? '已激活' : '已解绑';

        html += `
          <div class="device-item" style="
            background: var(--bg-secondary);
            border-radius: 8px;
            padding: 12px;
            border: ${isCurrentDevice ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'};
          ">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">
                  ${device.device_name} ${isCurrentDevice ? '<span style="color: var(--primary-color);">(当前设备)</span>' : ''}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 4px;">
                  <div><strong>类型:</strong> ${device.device_type}</div>
                  <div><strong>状态:</strong> <span style="color: ${statusColor};">${statusText}</span></div>
                  <div><strong>绑定时间:</strong> ${new Date(device.bound_at).toLocaleString()}</div>
                  ${device.bind_status === 'active' ? `
                    <div><strong>授权密钥:</strong> <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${device.offline_license_key}</code></div>
                    <div><strong>授权到期:</strong> ${new Date(device.license_expire_date).toLocaleString()}</div>
                  ` : ''}
                </div>
              </div>
              ${device.bind_status === 'active' ? `
                <button
                  onclick="window.unbindDevice(${device.id})"
                  style="
                    padding: 6px 12px;
                    border: 1px solid var(--error-color);
                    border-radius: 4px;
                    background: transparent;
                    color: var(--error-color);
                    font-size: 12px;
                    cursor: pointer;
                  "
                  onmouseover="this.style.background='var(--error-color)'; this.style.color='white';"
                  onmouseout="this.style.background='transparent'; this.style.color='var(--error-color)';"
                >
                  解绑
                </button>
              ` : ''}
            </div>
          </div>
        `;
      });

      html += '</div>';
    }

    deviceListContainer.innerHTML = html;
  }

  /**
   * 绑定当前设备
   */
  public async bindCurrentDevice(): Promise<void> {
    if (!this.currentDeviceInfo) {
      (window as any).showNotification && (window as any).showNotification(
        '无法获取当前设备信息',
        'error'
      );
      return;
    }

    try {
      await apiService.bindDevice({
        device_code: this.currentDeviceInfo.device_uuid,
        device_name: this.currentDeviceInfo.device_name,
        device_type: this.currentDeviceInfo.device_type,
      });

      (window as any).showNotification && (window as any).showNotification(
        '设备绑定成功',
        'success'
      );

      // 重新加载设备列表
      await this.loadBoundDevices();
      this.renderDeviceList();
    } catch (error: any) {
      console.error('❌ 绑定设备失败:', error);
      (window as any).showNotification && (window as any).showNotification(
        error.message || '绑定设备失败',
        'error'
      );
    }
  }

  /**
   * 解绑设备
   */
  public async unbindDevice(deviceId: number): Promise<void> {
    if (!(await showConfirm({ title: '解绑设备', message: '确定要解绑此设备吗？' }))) {
      return;
    }

    try {
      await apiService.unbindDevice(deviceId);

      (window as any).showNotification && (window as any).showNotification(
        '设备解绑成功',
        'success'
      );

      // 重新加载设备列表
      await this.loadBoundDevices();
      this.renderDeviceList();
    } catch (error: any) {
      console.error('❌ 解绑设备失败:', error);
      (window as any).showNotification && (window as any).showNotification(
        error.message || '解绑设备失败',
        'error'
      );
    }
  }

  /**
   * 创建模态框
   */
  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'bind-device-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background: var(--bg-primary);
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      ">
        <div class="modal-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        ">
          <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">🪢 绑定机器</h2>
          <button type="button" class="close-btn" onclick="event.stopPropagation(); window.closeBindDevice();" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">×</button>
        </div>

        <div class="modal-body" id="device-list-container">
          <!-- 设备列表将在这里渲染 -->
        </div>
      </div>
    `;

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hide();
      }
    });

    document.body.appendChild(modal);
    this.modal = modal;
  }
}

// 导出单例实例
export const bindDeviceModal = BindDeviceModal.getInstance();

// 全局函数
(window as any).closeBindDevice = function() {
  bindDeviceModal.hide();
};

(window as any).bindCurrentDevice = async function() {
  await bindDeviceModal.bindCurrentDevice();
};

(window as any).unbindDevice = async function(deviceId: number) {
  await bindDeviceModal.unbindDevice(deviceId);
};

