/**
 * 数据库管理器
 * 管理数据库连接、SQL 执行、数据浏览等功能
 */

import { invoke } from '@tauri-apps/api/core';

// ==================== Types ====================

export interface DatabaseInfo {
  db_type: string;
  name: string;
  version: string;
  status: string;
  port: number;
  data_dir: string;
}

export interface DbConnection {
  id: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  name: string;          // 显示名称
  isConnected: boolean;
}

export interface SqlResult {
  columns: string[];
  rows: string[][];
  row_count: number;
  affected_rows?: number;
  execution_time_ms: number;
  error?: string;
}

export interface TableInfo {
  name: string;
  row_count?: number;
  size?: string;
  engine?: string;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value?: string;
}

export interface DbUser {
  username: string;
  host: string;
  privileges: string[];
}

export interface SqlHistoryEntry {
  sql: string;
  db_type: string;
  database: string;
  timestamp: number;
  success: boolean;
  row_count?: number;
}

export type DbTab = 'connections' | 'sql' | 'browser' | 'users' | 'ops';

// ==================== Manager ====================

export class DatabaseManager {
  private detectedDatabases: DatabaseInfo[] = [];
  private connections: DbConnection[] = [];
  private activeConnection: DbConnection | null = null;
  private currentTab: DbTab = 'connections';
  private sqlHistory: SqlHistoryEntry[] = [];
  private lastSqlResult: SqlResult | null = null;

  // 数据浏览状态
  private databases: string[] = [];
  private currentDatabase: string = '';
  private tables: TableInfo[] = [];
  private currentTable: string = '';
  private tableData: SqlResult | null = null;
  private columns: ColumnInfo[] = [];

  // 用户管理状态
  private users: DbUser[] = [];

  // UI 状态
  private initialized = false;
  private loading = false;

  constructor() {
    this.loadConnectionsFromStorage();
    this.loadSqlHistory();
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.bindEvents();
    this.initialized = true;
    (window as any).databaseManager = this;
  }

  private bindEvents(): void {
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-db-action]') as HTMLElement;
      if (!target) return;
      const action = target.getAttribute('data-db-action') || '';
      this.handleAction(action, target);
    });

    // SQL 执行快捷键
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const sqlEditor = document.getElementById('db-sql-editor') as HTMLTextAreaElement;
        if (sqlEditor && document.activeElement === sqlEditor) {
          e.preventDefault();
          this.executeSql();
        }
      }
    });
  }

  // ==================== Action Router ====================

  private async handleAction(action: string, el: HTMLElement): Promise<void> {
    switch (action) {
      case 'switch-tab': this.switchTab(el.getAttribute('data-tab') as DbTab); break;
      case 'detect': await this.detectDatabases(); break;
      case 'add-connection': this.showAddConnectionModal(); break;
      case 'connect': await this.connectToDatabase(el.getAttribute('data-conn-id') || ''); break;
      case 'disconnect': this.disconnectDatabase(); break;
      case 'service-start': await this.serviceControl(el.getAttribute('data-db-type') || '', 'start'); break;
      case 'service-stop': await this.serviceControl(el.getAttribute('data-db-type') || '', 'stop'); break;
      case 'service-restart': await this.serviceControl(el.getAttribute('data-db-type') || '', 'restart'); break;
      case 'execute-sql': await this.executeSql(); break;
      case 'clear-sql': this.clearSqlEditor(); break;
      case 'select-database': await this.selectDatabase(el.getAttribute('data-name') || ''); break;
      case 'select-table': await this.selectTable(el.getAttribute('data-name') || ''); break;
      case 'refresh-tables': await this.refreshTables(); break;
      case 'list-users': await this.listUsers(); break;
      case 'backup': await this.backupDatabase(); break;
      case 'delete-connection': this.deleteConnection(el.getAttribute('data-conn-id') || ''); break;
      case 'save-connection': await this.saveNewConnection(); break;
      case 'close-modal': this.hideAddConnectionModal(); break;
      case 'history-item': this.loadHistoryItem(parseInt(el.getAttribute('data-index') || '0')); break;
    }
  }

  // ==================== Database Detection ====================

  async detectDatabases(): Promise<void> {
    this.loading = true;
    this.updateUI();
    try {
      this.detectedDatabases = await invoke('db_detect') as DatabaseInfo[];
      window.showNotification?.(`发现 ${this.detectedDatabases.length} 个数据库实例`, 'success');
    } catch (e) {
      console.error('数据库检测失败:', e);
      window.showNotification?.(`检测失败: ${e}`, 'error');
    }
    this.loading = false;
    this.updateUI();
  }

  // ==================== Connection Management ====================

  async connectToDatabase(connId: string): Promise<void> {
    const conn = this.connections.find(c => c.id === connId);
    if (!conn) return;

    try {
      // 验证连接（执行一个简单查询）
      const testSql = conn.db_type === 'redis' ? 'PING'
        : conn.db_type === 'mongodb' ? 'db.runCommand({ping:1})'
        : 'SELECT 1';

      await invoke('db_execute_sql', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: conn.database || '', sql: testSql,
      });

      conn.isConnected = true;
      this.activeConnection = conn;
      this.saveConnectionsToStorage();

      // 加载数据库列表
      await this.loadDatabases();

      window.showNotification?.(`已连接 ${conn.name}`, 'success');
    } catch (e) {
      window.showNotification?.(`连接失败: ${e}`, 'error');
    }
    this.updateUI();
  }

  disconnectDatabase(): void {
    if (this.activeConnection) {
      this.activeConnection.isConnected = false;
      this.activeConnection = null;
      this.databases = [];
      this.tables = [];
      this.currentDatabase = '';
      this.currentTable = '';
      this.tableData = null;
      this.updateUI();
    }
  }

  // ==================== SQL Execution ====================

  async executeSql(): Promise<void> {
    if (!this.activeConnection) {
      window.showNotification?.('请先连接数据库', 'warning');
      return;
    }

    const editor = document.getElementById('db-sql-editor') as HTMLTextAreaElement;
    if (!editor) return;

    // 支持选中执行
    const sql = editor.selectionStart !== editor.selectionEnd
      ? editor.value.substring(editor.selectionStart, editor.selectionEnd).trim()
      : editor.value.trim();

    if (!sql) return;

    const conn = this.activeConnection;
    this.loading = true;
    this.updateResultsArea('<div class="db-loading">执行中...</div>');

    try {
      const result = await invoke('db_execute_sql', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: this.currentDatabase || conn.database || '', sql,
      }) as SqlResult;

      this.lastSqlResult = result;
      this.addToHistory(sql, conn.db_type, this.currentDatabase, !result.error, result.row_count);

      if (result.error) {
        this.updateResultsArea(`<div class="db-error">${this.escapeHtml(result.error)}</div>`);
      } else {
        this.renderSqlResults(result);
      }
    } catch (e) {
      this.addToHistory(sql, conn.db_type, this.currentDatabase, false);
      this.updateResultsArea(`<div class="db-error">执行失败: ${this.escapeHtml(String(e))}</div>`);
    }
    this.loading = false;
  }

  // ==================== Data Browser ====================

  async loadDatabases(): Promise<void> {
    if (!this.activeConnection) return;
    const conn = this.activeConnection;
    try {
      this.databases = await invoke('db_list_databases', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
      }) as string[];
      if (this.databases.length > 0 && !this.currentDatabase) {
        this.currentDatabase = this.databases[0];
      }
    } catch (e) {
      console.error('加载数据库列表失败:', e);
    }
    this.updateUI();
  }

  async selectDatabase(name: string): Promise<void> {
    this.currentDatabase = name;
    this.currentTable = '';
    this.tableData = null;
    await this.refreshTables();
  }

  async refreshTables(): Promise<void> {
    if (!this.activeConnection || !this.currentDatabase) return;
    const conn = this.activeConnection;
    try {
      this.tables = await invoke('db_list_tables', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: this.currentDatabase,
      }) as TableInfo[];
    } catch (e) {
      console.error('加载表列表失败:', e);
    }
    this.updateUI();
  }

  async selectTable(name: string): Promise<void> {
    if (!this.activeConnection || !this.currentDatabase) return;
    this.currentTable = name;
    const conn = this.activeConnection;

    try {
      // 加载列信息
      this.columns = await invoke('db_list_columns', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: this.currentDatabase, table: name,
      }) as ColumnInfo[];

      // 加载前 100 行数据
      const sql = conn.db_type === 'mongodb'
        ? `db.${name}.find().limit(100).toArray()`
        : `SELECT * FROM ${name} LIMIT 100`;

      this.tableData = await invoke('db_execute_sql', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: this.currentDatabase, sql,
      }) as SqlResult;
    } catch (e) {
      console.error('加载表数据失败:', e);
    }
    this.updateUI();
  }

  // ==================== User Management ====================

  async listUsers(): Promise<void> {
    if (!this.activeConnection) return;
    const conn = this.activeConnection;
    try {
      this.users = await invoke('db_list_users', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
      }) as DbUser[];
    } catch (e) {
      console.error('加载用户列表失败:', e);
      window.showNotification?.(`加载用户失败: ${e}`, 'error');
    }
    this.updateUI();
  }

  // ==================== Operations ====================

  async serviceControl(dbType: string, action: string): Promise<void> {
    try {
      const result = await invoke('db_service_control', { dbType, action }) as string;
      window.showNotification?.(`${dbType} ${action}: ${result}`, 'success');
      // 刷新检测
      setTimeout(() => this.detectDatabases(), 1000);
    } catch (e) {
      window.showNotification?.(`操作失败: ${e}`, 'error');
    }
  }

  async backupDatabase(): Promise<void> {
    if (!this.activeConnection || !this.currentDatabase) {
      window.showNotification?.('请先选择数据库', 'warning');
      return;
    }
    const conn = this.activeConnection;
    try {
      window.showNotification?.(`正在备份 ${this.currentDatabase}...`, 'info');
      const result = await invoke('db_backup', {
        dbType: conn.db_type, host: conn.host, port: conn.port,
        username: conn.username, password: conn.password,
        database: this.currentDatabase,
      }) as string;
      window.showNotification?.(`备份完成: ${result}`, 'success');
    } catch (e) {
      window.showNotification?.(`备份失败: ${e}`, 'error');
    }
  }

  // ==================== Tab Management ====================

  switchTab(tab: DbTab): void {
    this.currentTab = tab;
    // Update tab buttons
    document.querySelectorAll('.db-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    // Show/hide panels
    document.querySelectorAll('.db-tab-panel').forEach(panel => {
      (panel as HTMLElement).style.display = panel.id === `db-tab-${tab}` ? '' : 'none';
    });

    // 延迟加载
    if (tab === 'users' && this.users.length === 0 && this.activeConnection) {
      this.listUsers();
    }
    if (tab === 'browser' && this.databases.length === 0 && this.activeConnection) {
      this.loadDatabases();
    }
  }

  // ==================== Connection Storage ====================

  private loadConnectionsFromStorage(): void {
    try {
      const data = localStorage.getItem('lovelyres-db-connections');
      if (data) this.connections = JSON.parse(data);
    } catch { /* ignore */ }
  }

  private saveConnectionsToStorage(): void {
    try {
      // 不存储密码到 localStorage
      const safe = this.connections.map(c => ({ ...c, password: '' }));
      localStorage.setItem('lovelyres-db-connections', JSON.stringify(safe));
    } catch { /* ignore */ }
  }

  // ==================== SQL History ====================

  private loadSqlHistory(): void {
    try {
      const data = localStorage.getItem('lovelyres-sql-history');
      if (data) this.sqlHistory = JSON.parse(data);
    } catch { /* ignore */ }
  }

  private addToHistory(sql: string, dbType: string, database: string, success: boolean, rowCount?: number): void {
    this.sqlHistory.unshift({
      sql, db_type: dbType, database, timestamp: Date.now(), success, row_count: rowCount,
    });
    if (this.sqlHistory.length > 50) this.sqlHistory.length = 50;
    try {
      localStorage.setItem('lovelyres-sql-history', JSON.stringify(this.sqlHistory));
    } catch { /* ignore */ }
  }

  private loadHistoryItem(index: number): void {
    const entry = this.sqlHistory[index];
    if (!entry) return;
    const editor = document.getElementById('db-sql-editor') as HTMLTextAreaElement;
    if (editor) editor.value = entry.sql;
  }

  // ==================== Modal ====================

  showAddConnectionModal(): void {
    const modal = document.getElementById('db-add-modal');
    if (modal) modal.style.display = 'flex';
  }

  hideAddConnectionModal(): void {
    const modal = document.getElementById('db-add-modal');
    if (modal) modal.style.display = 'none';
  }

  async saveNewConnection(): Promise<void> {
    const name = (document.getElementById('db-add-name') as HTMLInputElement)?.value?.trim();
    const dbType = (document.getElementById('db-add-type') as HTMLSelectElement)?.value;
    const host = (document.getElementById('db-add-host') as HTMLInputElement)?.value?.trim() || '127.0.0.1';
    const port = parseInt((document.getElementById('db-add-port') as HTMLInputElement)?.value) || 3306;
    const username = (document.getElementById('db-add-username') as HTMLInputElement)?.value?.trim() || 'root';
    const password = (document.getElementById('db-add-password') as HTMLInputElement)?.value || '';
    const database = (document.getElementById('db-add-database') as HTMLInputElement)?.value?.trim() || '';

    if (!name) {
      window.showNotification?.('请输入连接名称', 'warning');
      return;
    }

    const conn: DbConnection = {
      id: `db-${Date.now()}`, db_type: dbType, host, port,
      username, password, database, name, isConnected: false,
    };

    this.connections.push(conn);
    this.saveConnectionsToStorage();
    this.hideAddConnectionModal();
    this.updateUI();
    window.showNotification?.(`已添加连接: ${name}`, 'success');
  }

  deleteConnection(connId: string): void {
    this.connections = this.connections.filter(c => c.id !== connId);
    if (this.activeConnection?.id === connId) {
      this.disconnectDatabase();
    }
    this.saveConnectionsToStorage();
    this.updateUI();
  }

  // ==================== UI Helpers ====================

  private updateUI(): void {
    // 由 renderer 负责（通过 getters 获取状态）
    const content = document.getElementById(`db-tab-${this.currentTab}`);
    if (content) {
      // Trigger re-render based on current tab
      const renderer = (window as any).app?.modernUIRenderer?.databaseRenderer;
      if (renderer?.renderTabContent) {
        content.innerHTML = renderer.renderTabContent(this.currentTab, this);
      }
    }
  }

  private updateResultsArea(html: string): void {
    const area = document.getElementById('db-results-area');
    if (area) area.innerHTML = html;
  }

  private renderSqlResults(result: SqlResult): void {
    if (!result.columns.length) {
      this.updateResultsArea(`<div class="db-results-info">执行成功，影响 ${result.affected_rows || 0} 行 (${result.execution_time_ms}ms)</div>`);
      return;
    }

    const html = `
      <table class="db-results-table">
        <thead><tr>${result.columns.map(c => `<th>${this.escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>${result.rows.map(row =>
          `<tr>${row.map(cell => `<td>${this.escapeHtml(cell ?? 'NULL')}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
      <div class="db-results-info">${result.row_count} 行 · ${result.execution_time_ms}ms</div>
    `;
    this.updateResultsArea(html);
  }

  private clearSqlEditor(): void {
    const editor = document.getElementById('db-sql-editor') as HTMLTextAreaElement;
    if (editor) editor.value = '';
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ==================== Getters (for renderer) ====================

  getDetectedDatabases(): DatabaseInfo[] { return this.detectedDatabases; }
  getConnections(): DbConnection[] { return this.connections; }
  getActiveConnection(): DbConnection | null { return this.activeConnection; }
  getCurrentTab(): DbTab { return this.currentTab; }
  getSqlHistory(): SqlHistoryEntry[] { return this.sqlHistory; }
  getLastSqlResult(): SqlResult | null { return this.lastSqlResult; }
  getDatabases(): string[] { return this.databases; }
  getCurrentDatabase(): string { return this.currentDatabase; }
  getTables(): TableInfo[] { return this.tables; }
  getCurrentTable(): string { return this.currentTable; }
  getTableData(): SqlResult | null { return this.tableData; }
  getColumns(): ColumnInfo[] { return this.columns; }
  getUsers(): DbUser[] { return this.users; }
  isLoading(): boolean { return this.loading; }
}

export const databaseManager = new DatabaseManager();
