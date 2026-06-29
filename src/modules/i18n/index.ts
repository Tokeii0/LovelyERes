/**
 * 国际化模块
 * 提供中英文双语支持
 */

type LangKey = 'zh-CN' | 'en-US';

// ========== 翻译字典 ==========
const messages: Record<LangKey, Record<string, string>> = {
  'zh-CN': {
    // 通用
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.close': '关闭',
    'common.refresh': '刷新',
    'common.search': '搜索',
    'common.loading': '加载中...',
    'common.success': '成功',
    'common.error': '错误',
    'common.warning': '警告',
    'common.info': '提示',
    'common.copy': '复制',
    'common.export': '导出',
    'common.import': '导入',

    // 导航
    'nav.dashboard': '仪表盘',
    'nav.systemInfo': '系统信息',
    'nav.sftp': '文件管理',
    'nav.emergency': '应急指令',
    'nav.detection': '快速检测',
    'nav.docker': '容器管理',
    'nav.kubernetes': 'K8s 管理',
    'nav.logAnalysis': '日志分析',
    'nav.settings': '设置',

    // 连接
    'connection.connect': '连接',
    'connection.disconnect': '断开',
    'connection.connected': '已连接',
    'connection.disconnected': '未连接',
    'connection.host': '主机',
    'connection.port': '端口',
    'connection.username': '用户名',
    'connection.password': '密码',
    'connection.privateKey': '私钥',
    'connection.test': '测试连接',

    // 检测
    'detection.startScan': '开始检测',
    'detection.stopScan': '停止检测',
    'detection.exportReport': '导出报告',
    'detection.securityScan': '安全检测',
    'detection.performanceScan': '性能检测',
    'detection.score': '安全评分',
    'detection.critical': '严重',
    'detection.high': '高',
    'detection.medium': '中',
    'detection.low': '低',

  },

  'en-US': {
    // Common
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.copy': 'Copy',
    'common.export': 'Export',
    'common.import': 'Import',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.systemInfo': 'System Info',
    'nav.sftp': 'File Manager',
    'nav.emergency': 'Emergency',
    'nav.detection': 'Detection',
    'nav.docker': 'Containers',
    'nav.kubernetes': 'K8s',
    'nav.logAnalysis': 'Log Analysis',
    'nav.settings': 'Settings',

    // Connection
    'connection.connect': 'Connect',
    'connection.disconnect': 'Disconnect',
    'connection.connected': 'Connected',
    'connection.disconnected': 'Disconnected',
    'connection.host': 'Host',
    'connection.port': 'Port',
    'connection.username': 'Username',
    'connection.password': 'Password',
    'connection.privateKey': 'Private Key',
    'connection.test': 'Test Connection',

    // Detection
    'detection.startScan': 'Start Scan',
    'detection.stopScan': 'Stop Scan',
    'detection.exportReport': 'Export Report',
    'detection.securityScan': 'Security Scan',
    'detection.performanceScan': 'Performance Scan',
    'detection.score': 'Security Score',
    'detection.critical': 'Critical',
    'detection.high': 'High',
    'detection.medium': 'Medium',
    'detection.low': 'Low',

  },
};

// ========== I18n 管理器 ==========

class I18n {
  private currentLang: LangKey;
  private listeners: Array<(lang: LangKey) => void> = [];

  constructor() {
    this.currentLang = (localStorage.getItem('lovelyres-lang') as LangKey) || 'zh-CN';
  }

  /** 获取翻译文本 */
  t(key: string, fallback?: string): string {
    return messages[this.currentLang]?.[key] || fallback || key;
  }

  /** 获取当前语言 */
  get lang(): LangKey {
    return this.currentLang;
  }

  /** 切换语言 */
  setLang(lang: LangKey): void {
    this.currentLang = lang;
    localStorage.setItem('lovelyres-lang', lang);
    this.listeners.forEach(fn => fn(lang));
  }

  /** 切换到另一种语言 */
  toggle(): void {
    this.setLang(this.currentLang === 'zh-CN' ? 'en-US' : 'zh-CN');
  }

  /** 监听语言变更 */
  onChange(fn: (lang: LangKey) => void): void {
    this.listeners.push(fn);
  }
}

export const i18n = new I18n();
