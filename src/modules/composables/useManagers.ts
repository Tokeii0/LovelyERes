/**
 * Vue 响应式桥接 — 将现有的单例管理器暴露为 Vue 组合式函数
 * 这是 modernUIRenderer → Vue SFC 渐进式迁移的关键基础设施
 *
 * 使用方法：
 *   import { useSSHConnection } from './composables/useManagers';
 *   const { isConnected, activeServer } = useSSHConnection();
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { liveMonitor, type SystemMetrics, type MetricsHistory } from '../monitoring/liveMonitor';
import { eventBus } from '../core/eventBus';
import { i18n } from '../i18n';

// ========== useSSHConnection ==========

export interface UseSSHConnectionReturn {
  isConnected: Ref<boolean>;
  activeServer: Ref<string>;
}

/**
 * SSH 连接状态组合式函数
 */
export function useSSHConnection(): UseSSHConnectionReturn {
  const isConnected = ref(false);
  const activeServer = ref('');

  // 轮询后端状态
  let pollTimer: number | null = null;

  const checkStatus = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status: any = await invoke('ssh_get_connection_status');
      isConnected.value = !!status;
      activeServer.value = status ? `${status.username}@${status.host}:${status.port}` : '';
    } catch {
      isConnected.value = false;
      activeServer.value = '';
    }
  };

  checkStatus();
  pollTimer = window.setInterval(checkStatus, 5000);

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  return { isConnected, activeServer };
}

// ========== useLiveMonitor ==========

export interface UseLiveMonitorReturn {
  latest: Ref<SystemMetrics | null>;
  history: Ref<MetricsHistory>;
  running: ComputedRef<boolean>;
  start: (intervalMs?: number) => void;
  stop: () => void;
}

/**
 * 实时监控组合式函数
 */
export function useLiveMonitor(): UseLiveMonitorReturn {
  const latest = ref<SystemMetrics | null>(liveMonitor.latest);
  const history = ref<MetricsHistory>(liveMonitor.metricsHistory);
  const running = computed(() => liveMonitor.running);

  const onUpdate = (m: SystemMetrics, h: MetricsHistory) => {
    latest.value = m;
    history.value = { ...h }; // 触发响应式
  };

  liveMonitor.onUpdate(onUpdate);

  onUnmounted(() => {
    liveMonitor.offUpdate(onUpdate);
  });

  return {
    latest: latest as Ref<SystemMetrics | null>,
    history: history as Ref<MetricsHistory>,
    running,
    start: (ms?: number) => liveMonitor.start(ms),
    stop: () => liveMonitor.stop(),
  };
}

// ========== useEventBus ==========

/**
 * EventBus 组合式函数 — 自动在组件销毁时取消订阅
 */
export function useEventBus() {
  const subscriptions: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  function on<K extends string>(event: K, handler: (...args: any[]) => void) {
    (eventBus as any).on(event, handler);
    subscriptions.push({ event, handler });
  }

  function emit<K extends string>(event: K, payload?: any) {
    (eventBus as any).emit(event, payload);
  }

  onUnmounted(() => {
    subscriptions.forEach(({ event, handler }) => {
      (eventBus as any).off(event, handler);
    });
  });

  return { on, emit };
}

// ========== useNotification ==========

export function useNotification() {
  return {
    success: (message: string, title?: string) =>
      eventBus.emit('notification', { type: 'success', message, title }),
    error: (message: string, title?: string) =>
      eventBus.emit('notification', { type: 'error', message, title }),
    warning: (message: string, title?: string) =>
      eventBus.emit('notification', { type: 'warning', message, title }),
    info: (message: string, title?: string) =>
      eventBus.emit('notification', { type: 'info', message, title }),
  };
}

// ========== useI18n ==========

export function useI18n() {
  const lang = ref(i18n.lang);

  i18n.onChange((newLang) => {
    lang.value = newLang;
  });

  return {
    t: (key: string, fallback?: string) => i18n.t(key, fallback),
    lang,
    setLang: (l: 'zh-CN' | 'en-US') => i18n.setLang(l),
    toggle: () => i18n.toggle(),
  };
}
