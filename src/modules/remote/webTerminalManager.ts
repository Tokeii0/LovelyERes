/**
 * Web 终端管理器
 * 支持连接 ttyd / wetty / shellinabox / gotty 等 Web 终端
 * 用于 CTF 比赛中连接题目环境
 */

import { invoke } from '@tauri-apps/api/core';

export interface WebTerminalConfig {
    id: string;
    name: string;
    url: string;
    username?: string;
    encryptedPassword?: string;
    type: 'ttyd' | 'wetty' | 'shellinabox' | 'gotty' | 'other';
    createdAt: string;
}

class WebTerminalManager {
    private terminals: WebTerminalConfig[] = [];
    private readonly STORAGE_KEY = 'lovelyres_web_terminals';

    constructor() {
        this.loadFromStorage();
    }

    // ============================================================
    // Storage
    // ============================================================

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Array<WebTerminalConfig & { password?: string }>;
                this.terminals = parsed.map(item => ({
                    id: item.id,
                    name: item.name,
                    url: item.url,
                    username: item.username,
                    encryptedPassword: item.encryptedPassword,
                    type: item.type,
                    createdAt: item.createdAt,
                }));
            }
        } catch { /* ignore */ }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.terminals));
        } catch { /* ignore */ }
    }

    // ============================================================
    // CRUD
    // ============================================================

    getAll(): WebTerminalConfig[] {
        return [...this.terminals];
    }

    add(config: Omit<WebTerminalConfig, 'id' | 'createdAt'>): WebTerminalConfig {
        const newConfig: WebTerminalConfig = {
            ...config,
            url: WebTerminalManager.normalizeUrl(config.url),
            id: `wt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            createdAt: new Date().toISOString(),
        };
        this.terminals.push(newConfig);
        this.saveToStorage();
        return newConfig;
    }

    remove(id: string): void {
        this.terminals = this.terminals.filter(t => t.id !== id);
        this.saveToStorage();
    }

    // ============================================================
    // Auto-detect terminal type from URL
    // ============================================================

    static detectType(url: string): WebTerminalConfig['type'] {
        const lower = url.toLowerCase();
        if (lower.includes('ttyd') || lower.includes('/ws')) return 'ttyd';
        if (lower.includes('wetty')) return 'wetty';
        if (lower.includes('shell')) return 'shellinabox';
        if (lower.includes('gotty')) return 'gotty';
        return 'other';
    }

    // ============================================================
    // Build connection URL (handle basic auth embedding)
    // ============================================================

    static normalizeUrl(value: string): string {
        let url = value.trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }

        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Web 终端只支持 http/https URL');
        }
        if (!parsed.hostname) {
            throw new Error('Web 终端 URL 必须包含主机名');
        }
        parsed.username = '';
        parsed.password = '';
        return parsed.toString();
    }

    static buildUrl(config: WebTerminalConfig): string {
        let url = config.url.trim();

        // Ensure protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        return WebTerminalManager.normalizeUrl(url);
    }

    // ============================================================
    // Open terminal
    // ============================================================

    async open(config: WebTerminalConfig): Promise<string> {
        const url = WebTerminalManager.buildUrl(config);
        const title = `Web终端 — ${config.name}`;

        try {
            const label = await invoke<string>('open_web_terminal', { url, title });
            window.showNotification?.(`已打开 Web 终端: ${config.name}`, 'success');
            return label;
        } catch (e) {
            window.showNotification?.(`打开 Web 终端失败: ${e}`, 'error');
            throw e;
        }
    }

    async openUrl(url: string, name?: string): Promise<string> {
        const normalizedUrl = WebTerminalManager.normalizeUrl(url);
        const config: WebTerminalConfig = {
            id: 'temp',
            name: name || new URL(normalizedUrl).hostname,
            url: normalizedUrl,
            type: WebTerminalManager.detectType(normalizedUrl),
            createdAt: new Date().toISOString(),
        };
        return this.open(config);
    }
}

export const webTerminalManager = new WebTerminalManager();
