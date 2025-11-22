
import { 
    Data, 
    Plus, 
    Refresh, 
    More,
    Config
} from '@icon-park/svg';

/**
 * 数据库管理界面渲染器
 */
export class DatabaseRenderer {
    constructor() {
        this.injectStyles();
    }

    private injectStyles() {
        const styles = `
            <style>
                .database-container {
                    display: flex;
                    height: 100%;
                    gap: var(--spacing-md);
                    padding: var(--spacing-md);
                    box-sizing: border-box;
                    background: var(--bg-primary);
                }
                .database-sidebar {
                    width: 240px;
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                }
                .database-content {
                    flex: 1;
                    background: var(--bg-secondary);
                    border-radius: var(--border-radius);
                    border: 1px solid var(--border-color);
                    padding: var(--spacing-lg);
                    overflow: auto;
                    display: flex;
                    flex-direction: column;
                }
                .db-type-header {
                    padding: var(--spacing-md);
                    font-weight: 600;
                    color: var(--text-secondary);
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: var(--spacing-sm);
                }
                .db-list-item {
                    padding: 10px var(--spacing-md);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--text-primary);
                    transition: all 0.2s;
                    font-size: 13px;
                    border-left: 3px solid transparent;
                    margin-bottom: 2px;
                }
                .db-list-item:hover {
                    background: var(--bg-tertiary);
                }
                .db-list-item.active {
                    background: var(--bg-tertiary);
                    color: var(--primary-color);
                    border-left-color: var(--primary-color);
                    font-weight: 500;
                }
                .db-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: var(--spacing-md);
                    margin-top: var(--spacing-md);
                }
                .db-card {
                    background: var(--bg-primary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    padding: var(--spacing-md);
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing-sm);
                    position: relative;
                    overflow: hidden;
                }
                .db-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--primary-color);
                }
                .db-card-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                }
                .db-card-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: var(--bg-tertiary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-primary);
                }
                .db-card-menu {
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .db-card:hover .db-card-menu {
                    opacity: 1;
                }
                .db-card-title {
                    font-weight: 600;
                    font-size: 15px;
                    margin-top: 4px;
                }
                .db-card-desc {
                    font-size: 12px;
                    color: var(--text-secondary);
                    font-family: monospace;
                    background: var(--bg-tertiary);
                    padding: 4px 8px;
                    border-radius: 4px;
                    align-self: flex-start;
                }
                .db-card-status {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .status-connected {
                    background: var(--success-color);
                    box-shadow: 0 0 0 2px var(--bg-primary);
                }
                .status-disconnected {
                    background: var(--text-tertiary);
                    box-shadow: 0 0 0 2px var(--bg-primary);
                }
                .db-add-card {
                    border-style: dashed;
                    justify-content: center;
                    align-items: center;
                    min-height: 160px;
                    background: transparent;
                }
                .db-add-card:hover {
                    background: var(--bg-tertiary);
                    border-color: var(--primary-color);
                }
            </style>
        `;
        
        if (!document.getElementById('database-styles')) {
            const styleEl = document.createElement('div');
            styleEl.id = 'database-styles';
            styleEl.innerHTML = styles;
            document.head.appendChild(styleEl.firstElementChild!);
        }
    }

    public render(): string {
        return `
            <div class="database-container">
                <div class="database-sidebar">
                    <div style="padding: var(--spacing-md); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 14px;">数据库管理</span>
                        <button class="modern-btn icon-only" title="刷新">
                            ${Refresh({theme: 'outline', size: '16', fill: 'currentColor'})}
                        </button>
                    </div>
                    
                    <div class="db-type-header">视图</div>
                    <div class="db-list-item active" onclick="window.switchDatabaseView('all')">
                        ${Data({theme: 'outline', size: '16', fill: 'currentColor'})}
                        <span>所有连接</span>
                    </div>
                    
                    <div class="db-type-header">数据库类型</div>
                    <div class="db-list-item" onclick="window.switchDatabaseView('mysql')">
                         <span class="nav-icon" style="width: 16px; display: flex; justify-content: center;">M</span>
                         <span>MySQL / MariaDB</span>
                    </div>
                    <div class="db-list-item" onclick="window.switchDatabaseView('postgresql')">
                         <span class="nav-icon" style="width: 16px; display: flex; justify-content: center;">P</span>
                         <span>PostgreSQL</span>
                    </div>
                    <div class="db-list-item" onclick="window.switchDatabaseView('redis')">
                         <span class="nav-icon" style="width: 16px; display: flex; justify-content: center;">R</span>
                         <span>Redis</span>
                    </div>
                    <div class="db-list-item" onclick="window.switchDatabaseView('mongodb')">
                         <span class="nav-icon" style="width: 16px; display: flex; justify-content: center;">Mg</span>
                         <span>MongoDB</span>
                    </div>
                    <div class="db-list-item" onclick="window.switchDatabaseView('sqlite')">
                         <span class="nav-icon" style="width: 16px; display: flex; justify-content: center;">Sq</span>
                         <span>SQLite</span>
                    </div>
                </div>
                
                <div class="database-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
                        <div>
                            <h2 style="font-weight: 600; font-size: 20px; margin-bottom: 4px;">数据库连接</h2>
                            <p style="color: var(--text-secondary); font-size: 13px;">管理和监控您的数据库实例</p>
                        </div>
                        <div style="display: flex; gap: var(--spacing-sm);">
                            <button class="modern-btn primary" onclick="window.showAddDatabaseModal()">
                                ${Plus({theme: 'outline', size: '16', fill: 'currentColor'})}
                                <span>新建连接</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="db-grid">
                        <!-- 新建连接卡片 -->
                        <div class="db-card db-add-card" onclick="window.showAddDatabaseModal()">
                            <div style="font-size: 32px; color: var(--primary-color); margin-bottom: 8px;">+</div>
                            <div style="font-size: 14px; font-weight: 500;">添加新数据库</div>
                        </div>

                        <!-- 示例连接卡片 -->
                        <div class="db-card">
                            <div class="db-card-status status-connected" title="已连接"></div>
                            <div class="db-card-header">
                                <div class="db-card-icon" style="color: #00758F;">
                                    <!-- MySQL Color -->
                                    <span style="font-weight: bold; font-size: 10px;">MySQL</span>
                                </div>
                                <div class="db-card-menu">
                                    <button class="modern-btn icon-only small">
                                        ${More({theme: 'outline', size: '16', fill: 'currentColor'})}
                                    </button>
                                </div>
                            </div>
                            <div class="db-card-title">Production DB</div>
                            <div class="db-card-desc">192.168.1.10:3306</div>
                            <div style="margin-top: 10px; display: flex; gap: 8px;">
                                <button class="modern-btn secondary small" style="flex: 1;">打开</button>
                                <button class="modern-btn secondary small icon-only">
                                    ${Config({theme: 'outline', size: '14', fill: 'currentColor'})}
                                </button>
                            </div>
                        </div>
                        
                        <div class="db-card">
                            <div class="db-card-status status-disconnected" title="未连接"></div>
                            <div class="db-card-header">
                                <div class="db-card-icon" style="color: #D82C20;">
                                    <!-- Redis Color -->
                                    <span style="font-weight: bold; font-size: 10px;">Redis</span>
                                </div>
                                <div class="db-card-menu">
                                    <button class="modern-btn icon-only small">
                                        ${More({theme: 'outline', size: '16', fill: 'currentColor'})}
                                    </button>
                                </div>
                            </div>
                            <div class="db-card-title">Cache Layer</div>
                            <div class="db-card-desc">localhost:6379</div>
                            <div style="margin-top: 10px; display: flex; gap: 8px;">
                                <button class="modern-btn secondary small" style="flex: 1;">连接</button>
                                <button class="modern-btn secondary small icon-only">
                                    ${Config({theme: 'outline', size: '14', fill: 'currentColor'})}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }
}
