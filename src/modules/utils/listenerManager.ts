/**
 * 监听器/定时器作用域管理
 *
 * 解决散落在 modal、tab、页面管理器中的 addEventListener / setInterval
 * 未被清理导致的内存泄漏。使用方式：
 *
 *   const scope = new ListenerScope('DockerModal');
 *   scope.on(btn, 'click', handler);
 *   scope.setInterval(() => poll(), 5000);
 *   scope.signal;             // AbortSignal 透传给 fetch / Tauri listen
 *   scope.dispose();          // 关闭 modal / 切页时统一清理
 */

type AnyTarget = EventTarget;

interface TrackedListener {
  target: AnyTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

export class ListenerScope {
  private listeners: TrackedListener[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private intervals = new Set<ReturnType<typeof setInterval>>();
  private disposers: Array<() => void> = [];
  private controller = new AbortController();
  private disposed = false;

  constructor(public readonly name: string = 'anonymous') {}

  /** 注册事件监听，自动在 dispose 时移除 */
  on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: (ev: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    target: AnyTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  on(
    target: AnyTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (this.disposed) return;
    target.addEventListener(type, handler as EventListener, options);
    this.listeners.push({ target, type, handler, options });
  }

  /** setTimeout 作用域版本 */
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    if (this.disposed) return 0 as unknown as ReturnType<typeof setTimeout>;
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  /** setInterval 作用域版本 */
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    if (this.disposed) return 0 as unknown as ReturnType<typeof setInterval>;
    const id = setInterval(() => {
      if (this.disposed) return;
      fn();
    }, ms);
    this.intervals.add(id);
    return id;
  }

  clearInterval(id: ReturnType<typeof setInterval>): void {
    clearInterval(id);
    this.intervals.delete(id);
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    clearTimeout(id);
    this.timers.delete(id);
  }

  /** 透传给 fetch/Tauri 等支持 AbortSignal 的 API */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** 注册自定义清理函数 (例如 Tauri unlisten) */
  add(disposer: () => void): void {
    if (this.disposed) {
      try { disposer(); } catch { /* noop */ }
      return;
    }
    this.disposers.push(disposer);
  }

  /** 附加 Tauri 风格的 Promise<UnlistenFn> */
  addTauri(unlistenPromise: Promise<() => void>): void {
    unlistenPromise.then(
      (un) => { this.disposed ? un() : this.add(un); },
      () => { /* 监听建立失败 */ },
    );
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  /** 一次性清空所有已注册资源 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const { target, type, handler, options } of this.listeners) {
      try { target.removeEventListener(type, handler as EventListener, options); } catch { /* noop */ }
    }
    this.listeners.length = 0;

    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();

    for (const id of this.intervals) clearInterval(id);
    this.intervals.clear();

    for (const fn of this.disposers) {
      try { fn(); } catch { /* noop */ }
    }
    this.disposers.length = 0;

    try { this.controller.abort(); } catch { /* noop */ }
  }
}

/** 便捷工厂 */
export function createScope(name?: string): ListenerScope {
  return new ListenerScope(name);
}
