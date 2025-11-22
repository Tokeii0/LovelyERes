/**
 * VIP 权限守卫
 * 用于检查用户是否为 VIP，并限制非 VIP 用户访问特定功能
 */

import { userManager } from '../user/userManager';
import { vipValidator } from './vipValidator';

export class VIPGuard {
  private static instance: VIPGuard;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): VIPGuard {
    if (!VIPGuard.instance) {
      VIPGuard.instance = new VIPGuard();
    }
    return VIPGuard.instance;
  }

  /**
   * 检查用户是否为 VIP（使用增强验证）
   * @returns 是否为 VIP
   */
  public isVIP(): boolean {
    // 使用增强的 VIP 验证器
    const result = vipValidator.validate('general');
    return result.isValid;
  }

  /**
   * 要求用户为 VIP（使用增强验证）
   * 如果不是 VIP，显示提示消息并返回 false
   * 如果是 VIP，返回 true
   * @param featureName 功能名称
   * @returns 是否为 VIP
   */
  public requireVIP(featureName?: string): boolean {
    // 使用增强的 VIP 验证器
    const result = vipValidator.validate(featureName || 'general');

    if (result.isValid) {
      return true;
    }

    // 显示提示消息
    const reasonMessage = vipValidator.getReasonMessage(result.reason);
    const message = featureName
      ? `${featureName}是 VIP 专属功能，请升级为 VIP 会员后使用（${reasonMessage}）`
      : `VIP 专属功能，请升级为 VIP 会员后使用（${reasonMessage}）`;

    this.showVIPRequiredMessage(message);

    return false;
  }

  /**
   * 显示 VIP 要求提示消息
   * @param message 提示消息
   */
  private showVIPRequiredMessage(message: string): void {
    // 使用全局通知函数（如果存在）
    if (typeof (window as any).showNotification === 'function') {
      (window as any).showNotification(`👑 ${message}`, 'warning');
      return;
    }

    // 降级方案：创建自定义提示元素
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      min-width: 350px;
      max-width: 450px;
      min-height: 90px;
      border-radius: 8px;
      box-sizing: border-box;
      padding: 12px 15px;
      background-color: #ffffff;
      box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 15px;
      z-index: 10001;
      animation: slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 2.7s;
    `;

    notification.innerHTML = `
      <svg style="
        position: absolute;
        transform: rotate(90deg);
        left: -31px;
        top: 32px;
        width: 80px;
        fill: #f59e0b3a;
      " viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z"
        ></path>
      </svg>
      <div style="
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f59e0b48;
        border-radius: 50%;
        margin-right: 0.7rem;
        flex-shrink: 0;
      ">
        <svg style="width: 17px; fill: #f57c00;" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"></path>
        </svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; color: #f57c00; margin-bottom: 4px;">VIP 专属功能</div>
        <div style="font-size: 13px; color: #64748b; word-wrap: break-word; line-height: 1.4;">${message}</div>
      </div>
      <button style="
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 0;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      " onclick="this.parentElement.remove()">×</button>
    `;

    // 添加动画样式
    if (!document.getElementById('vip-guard-styles')) {
      const style = document.createElement('style');
      style.id = 'vip-guard-styles';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // 3秒后自动消失
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  /**
   * 获取 VIP 状态信息
   * @returns VIP 状态信息
   */
  public getVIPStatus(): {
    isVIP: boolean;
    vipDays: number;
    message: string;
  } {
    const userInfo = userManager.getCurrentUser();

    if (!userInfo) {
      return {
        isVIP: false,
        vipDays: 0,
        message: '未登录'
      };
    }

    if (!userInfo.isVip) {
      return {
        isVIP: false,
        vipDays: 0,
        message: '非 VIP 用户'
      };
    }

    if (userInfo.vipDays <= 0) {
      return {
        isVIP: false,
        vipDays: 0,
        message: 'VIP 已过期'
      };
    }

    return {
      isVIP: true,
      vipDays: userInfo.vipDays,
      message: `VIP 会员，剩余 ${userInfo.vipDays} 天`
    };
  }

  /**
   * 包装需要 VIP 权限的函数
   * @param fn 需要 VIP 权限的函数
   * @param featureName 功能名称
   * @returns 包装后的函数
   */
  public withVIP<T extends (...args: any[]) => any>(
    fn: T,
    featureName?: string
  ): T {
    return ((...args: any[]) => {
      if (this.requireVIP(featureName)) {
        return fn(...args);
      }
      return undefined;
    }) as T;
  }

  /**
   * 为元素添加 VIP 权限检查
   * @param element 元素
   * @param featureName 功能名称
   */
  public protectElement(element: HTMLElement, featureName?: string): void {
    const originalOnClick = element.onclick;
    
    element.onclick = (event) => {
      if (!this.requireVIP(featureName)) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
      
      if (originalOnClick) {
        return originalOnClick.call(element, event);
      }
      
      return true;
    };

    // 添加 VIP 标识
    this.addVIPBadge(element);
  }

  /**
   * 为元素添加 VIP 徽章
   * @param element 元素
   */
  private addVIPBadge(element: HTMLElement): void {
    // 检查是否已经有徽章
    if (element.querySelector('.vip-badge')) {
      return;
    }

    const badge = document.createElement('span');
    badge.className = 'vip-badge';
    badge.textContent = 'VIP';
    badge.style.cssText = `
      display: inline-block;
      background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
      color: #333;
      font-size: 10px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      vertical-align: middle;
      box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
    `;

    element.appendChild(badge);
  }

  /**
   * 检查功能是否需要 VIP 权限
   * @param featureName 功能名称
   * @returns 是否需要 VIP 权限
   */
  public isVIPFeature(featureName: string): boolean {
    // VIP 功能列表
    const vipFeatures = [
      'process-context-menu',
      'network-context-menu',
      'ai-assistant',
      'ai-explain',
      'ai-command',
    ];

    return vipFeatures.includes(featureName);
  }
}

// 导出单例实例
export const vipGuard = VIPGuard.getInstance();

