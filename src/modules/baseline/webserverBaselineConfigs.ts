/**
 * Web 服务器基线配置 -- Nginx / Apache / PHP
 * 覆盖安全加固、性能优化、常见漏洞修复
 */

import type { BaselineCategory, BaselineConfigItem } from './baselineConfigs';
import { backup } from './baselineConfigs';

// ─── 辅助：Nginx/Apache/PHP 配置文件写入 ───

/** nginx.conf 风格: key value; (带分号) */
function nginxSet(file: string, key: string, value: string): string {
  return `grep -qE '^\\s*#?\\s*${key}\\b' ${file} && sed -i 's/^\\s*#*\\s*${key}\\b.*/${key} ${value};/' ${file} || sed -i '/^http\\s*{/a\\    ${key} ${value};' ${file}`;
}

/** nginx.conf server 块内写入 */
function nginxServerSet(file: string, directive: string): string {
  return `grep -qF '${directive.substring(0, 30)}' ${file} || sed -i '/^\\s*server\\s*{/a\\    ${directive}' ${file}`;
}

/** Apache httpd.conf 风格: Key Value */
function apacheSet(file: string, key: string, value: string): string {
  return `grep -qiE '^\\s*#?\\s*${key}\\b' ${file} && sed -i 's/^\\s*#*\\s*${key}\\b.*/${key} ${value}/' ${file} || echo '${key} ${value}' >> ${file}`;
}

// phpSet/NGINX_CONF/APACHE_CONF/PHP_INI 辅助函数已内联到各 writeCommand 中

// ═══════════════════════════════════════════════
// Nginx 安全加固
// ═══════════════════════════════════════════════

const nginxSecurityItems: BaselineConfigItem[] = [
  {
    id: 'nginx-server-tokens', name: 'server_tokens',
    description: '隐藏 Nginx 版本号，防止信息泄露',
    filePath: '/etc/nginx/nginx.conf', type: 'enum',
    enumValues: ['on', 'off'],
    defaultValue: 'on', recommendedValue: 'off', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*server_tokens\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'server_tokens on'`,
    parseRegex: 'server_tokens\\s+(\\w+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'server_tokens', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    restartService: 'nginx',
    complianceRef: 'CIS Nginx 2.5.1',
  },
  {
    id: 'nginx-x-frame-options', name: 'X-Frame-Options',
    description: '防止点击劫持攻击(Clickjacking)',
    filePath: '/etc/nginx/nginx.conf', type: 'enum',
    enumValues: ['DENY', 'SAMEORIGIN', 'ALLOW-FROM'],
    defaultValue: '', recommendedValue: 'SAMEORIGIN', riskLevel: 'high',
    readCommand: `grep -rE 'X-Frame-Options' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: 'X-Frame-Options[\\s"]*?(\\S+)',
    writeCommand: (v) => nginxServerSet('/etc/nginx/nginx.conf', `add_header X-Frame-Options "${v}" always;`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    complianceRef: 'CIS Nginx 4.1.1',
  },
  {
    id: 'nginx-x-content-type', name: 'X-Content-Type-Options',
    description: '禁止浏览器MIME嗅探，防止XSS',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: 'nosniff', riskLevel: 'medium',
    readCommand: `grep -rE 'X-Content-Type-Options' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: 'X-Content-Type-Options[\\s"]*?(\\S+)',
    writeCommand: (v) => nginxServerSet('/etc/nginx/nginx.conf', `add_header X-Content-Type-Options "${v}" always;`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    complianceRef: 'CIS Nginx 4.1.2',
  },
  {
    id: 'nginx-xss-protection', name: 'X-XSS-Protection',
    description: '启用浏览器XSS过滤器',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: '1; mode=block', riskLevel: 'medium',
    readCommand: `grep -rE 'X-XSS-Protection' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: "X-XSS-Protection[\"']?\\s+[\"']?([^\";]+)",
    writeCommand: (v) => nginxServerSet('/etc/nginx/nginx.conf', `add_header X-XSS-Protection "${v}" always;`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-csp', name: 'Content-Security-Policy',
    description: '内容安全策略，防止XSS和数据注入',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: "default-src 'self'", riskLevel: 'medium',
    readCommand: `grep -rE 'Content-Security-Policy' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: "Content-Security-Policy[\"']?\\s+[\"']?([^\";]+)",
    writeCommand: (v) => nginxServerSet('/etc/nginx/nginx.conf', `add_header Content-Security-Policy "${v}" always;`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    complianceRef: 'CIS Nginx 4.1.4',
  },
  {
    id: 'nginx-ssl-protocols', name: 'ssl_protocols',
    description: 'SSL/TLS协议版本，禁用不安全的SSLv3/TLSv1.0/1.1',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: 'TLSv1 TLSv1.1 TLSv1.2', recommendedValue: 'TLSv1.2 TLSv1.3', riskLevel: 'critical',
    readCommand: `grep -rE '^\\s*ssl_protocols\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'ssl_protocols TLSv1 TLSv1.1 TLSv1.2'`,
    parseRegex: 'ssl_protocols\\s+(.+?)\\s*;',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'ssl_protocols', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    complianceRef: 'CIS Nginx 4.1.5',
  },
  {
    id: 'nginx-ssl-ciphers', name: 'ssl_ciphers',
    description: '加密套件，禁用弱密码',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:!aNULL:!MD5:!3DES:!RC4', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*ssl_ciphers\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: "ssl_ciphers\\s+'?([^;']+)",
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'ssl_ciphers', `'${v}'`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    complianceRef: 'CIS Nginx 4.1.6',
  },
  {
    id: 'nginx-ssl-prefer-server', name: 'ssl_prefer_server_ciphers',
    description: '优先使用服务端加密套件',
    filePath: '/etc/nginx/nginx.conf', type: 'enum',
    enumValues: ['on', 'off'],
    defaultValue: 'off', recommendedValue: 'on', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*ssl_prefer_server_ciphers\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: 'ssl_prefer_server_ciphers\\s+(\\w+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'ssl_prefer_server_ciphers', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-client-max-body', name: 'client_max_body_size',
    description: '限制请求体大小，防止大文件DoS',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '1m', recommendedValue: '10m', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*client_max_body_size\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'client_max_body_size 1m'`,
    parseRegex: 'client_max_body_size\\s+(\\S+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'client_max_body_size', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-client-body-timeout', name: 'client_body_timeout',
    description: '请求体读取超时(秒)，防止慢速DoS',
    filePath: '/etc/nginx/nginx.conf', type: 'number',
    defaultValue: '60', recommendedValue: '10', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*client_body_timeout\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'client_body_timeout 60'`,
    parseRegex: 'client_body_timeout\\s+(\\d+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'client_body_timeout', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    validation: { min: 5, max: 300 },
  },
  {
    id: 'nginx-client-header-timeout', name: 'client_header_timeout',
    description: '请求头读取超时(秒)',
    filePath: '/etc/nginx/nginx.conf', type: 'number',
    defaultValue: '60', recommendedValue: '10', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*client_header_timeout\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'client_header_timeout 60'`,
    parseRegex: 'client_header_timeout\\s+(\\d+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'client_header_timeout', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    validation: { min: 5, max: 300 },
  },
  {
    id: 'nginx-keepalive-timeout', name: 'keepalive_timeout',
    description: 'Keep-Alive超时(秒)，过长会占用连接资源',
    filePath: '/etc/nginx/nginx.conf', type: 'number',
    defaultValue: '75', recommendedValue: '15', riskLevel: 'low',
    readCommand: `grep -rE '^\\s*keepalive_timeout\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'keepalive_timeout 75'`,
    parseRegex: 'keepalive_timeout\\s+(\\d+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'keepalive_timeout', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
    validation: { min: 5, max: 120 },
  },
  {
    id: 'nginx-limit-req-zone', name: 'limit_req_zone (限流)',
    description: '请求限流，防止CC攻击和暴力破解',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: '$binary_remote_addr zone=req:10m rate=30r/s', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*limit_req_zone\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: 'limit_req_zone\\s+(.+)',
    writeCommand: (v) => `grep -q 'limit_req_zone' /etc/nginx/nginx.conf || sed -i '/^http\\s*{/a\\    limit_req_zone ${v};' /etc/nginx/nginx.conf`,
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-access-log', name: 'access_log',
    description: '访问日志路径，应急响应必须开启',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '/var/log/nginx/access.log', recommendedValue: '/var/log/nginx/access.log combined', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*access_log\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: 'access_log\\s+(.+?)\\s*;',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'access_log', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-error-log', name: 'error_log',
    description: '错误日志级别，建议warn以上',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '/var/log/nginx/error.log', recommendedValue: '/var/log/nginx/error.log warn', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*error_log\\b' /etc/nginx/nginx.conf 2>/dev/null | head -1`,
    parseRegex: 'error_log\\s+(.+?)\\s*;',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'error_log', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-autoindex', name: 'autoindex',
    description: '禁止目录列表，防止信息泄露',
    filePath: '/etc/nginx/nginx.conf', type: 'enum',
    enumValues: ['on', 'off'],
    defaultValue: 'off', recommendedValue: 'off', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*autoindex\\b' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1 || echo 'autoindex off'`,
    parseRegex: 'autoindex\\s+(\\w+)',
    writeCommand: (v) => nginxSet('/etc/nginx/nginx.conf', 'autoindex', v),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-hsts', name: 'Strict-Transport-Security',
    description: 'HSTS强制HTTPS，防止降级攻击',
    filePath: '/etc/nginx/nginx.conf', type: 'string',
    defaultValue: '', recommendedValue: 'max-age=31536000; includeSubDomains', riskLevel: 'medium',
    readCommand: `grep -rE 'Strict-Transport-Security' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null | head -1`,
    parseRegex: "Strict-Transport-Security[\"']?\\s+[\"']?([^\";]+)",
    writeCommand: (v) => nginxServerSet('/etc/nginx/nginx.conf', `add_header Strict-Transport-Security "${v}" always;`),
    backupCommand: backup('/etc/nginx/nginx.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
];

// ═══════════════════════════════════════════════
// Nginx 漏洞修复
// ═══════════════════════════════════════════════

const nginxVulnFixItems: BaselineConfigItem[] = [
  {
    id: 'nginx-vuln-sqli-filter', name: 'SQL注入过滤规则',
    description: 'Nginx层面过滤SQL注入关键字(应急/比赛邪修)',
    filePath: '/etc/nginx/conf.d/waf.conf', type: 'string',
    defaultValue: '', recommendedValue: 'enabled', riskLevel: 'critical',
    readCommand: `grep -c 'union.*select' /etc/nginx/conf.d/waf.conf 2>/dev/null || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: () => `cat > /etc/nginx/conf.d/waf.conf << 'WAFEOF'
# SQL注入过滤
if ($query_string ~* "union.*select|select.*from|insert.*into|delete.*from|drop.*table|update.*set|concat\\(|group_concat|load_file|into.*outfile") {
    return 403;
}
# 文件包含过滤
if ($query_string ~* "\\.\\./|\\.\\.\\\\\\\\|/etc/passwd|/proc/self|php://|data://|expect://") {
    return 403;
}
# XSS过滤
if ($query_string ~* "<script|javascript:|onerror=|onload=|onclick=|onmouseover=") {
    return 403;
}
# 命令注入过滤
if ($query_string ~* ";|\\||\\$\\(|\\x60|%0[aAdD]|\\\\x[0-9a-fA-F]") {
    return 403;
}
WAFEOF`,
    backupCommand: backup('/etc/nginx/conf.d/waf.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-vuln-sensitive-files', name: '敏感文件访问拦截',
    description: '阻止访问备份文件、配置文件、版本控制目录等',
    filePath: '/etc/nginx/conf.d/security.conf', type: 'string',
    defaultValue: '', recommendedValue: 'enabled', riskLevel: 'critical',
    readCommand: `grep -c 'bak\\|sql\\|git' /etc/nginx/conf.d/security.conf 2>/dev/null || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: () => `cat > /etc/nginx/conf.d/security.conf << 'SECEOF'
# 拦截敏感文件
location ~* \\.(bak|sql|tar|gz|zip|rar|log|swp|old|orig|conf|cfg|ini|yml|yaml|env|htaccess|htpasswd)$ {
    return 403;
}
# 拦截版本控制目录
location ~ /\\.(git|svn|hg|bzr) {
    return 403;
}
# 拦截phpinfo和探针
location ~* (phpinfo|php_info|phpMyAdmin|phpmyadmin|pma|adminer) {
    return 403;
}
# 拦截常见扫描路径
location ~* (wp-admin|wp-login|xmlrpc|wp-content/uploads/.*\\.php) {
    return 403;
}
SECEOF`,
    backupCommand: backup('/etc/nginx/conf.d/security.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-vuln-upload-limit', name: '上传目录PHP执行拦截',
    description: '阻止上传目录中的PHP/脚本执行(防WebShell)',
    filePath: '/etc/nginx/conf.d/upload-security.conf', type: 'string',
    defaultValue: '', recommendedValue: 'enabled', riskLevel: 'critical',
    readCommand: `grep -c 'uploads.*php' /etc/nginx/conf.d/upload-security.conf 2>/dev/null || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: () => `cat > /etc/nginx/conf.d/upload-security.conf << 'UPEOF'
# 上传目录禁止执行脚本
location ~* ^/(uploads|upload|files|attachments|media|wp-content/uploads)/ {
    location ~ \\.php$ { return 403; }
    location ~ \\.jsp$ { return 403; }
    location ~ \\.py$  { return 403; }
    location ~ \\.pl$  { return 403; }
    location ~ \\.sh$  { return 403; }
}
UPEOF`,
    backupCommand: backup('/etc/nginx/conf.d/upload-security.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-vuln-rate-limit', name: 'CC攻击限流',
    description: '基于IP的请求频率限制，防CC/暴力破解',
    filePath: '/etc/nginx/conf.d/ratelimit.conf', type: 'string',
    defaultValue: '', recommendedValue: '30r/s', riskLevel: 'high',
    readCommand: `grep -c 'limit_req' /etc/nginx/conf.d/ratelimit.conf 2>/dev/null || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: (v) => `cat > /etc/nginx/conf.d/ratelimit.conf << 'RLEOF'
limit_req_zone $binary_remote_addr zone=general:10m rate=${v};
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
# 在server{}块中引用: limit_req zone=general burst=50 nodelay;
# 登录页面: limit_req zone=login burst=3 nodelay;
RLEOF`,
    backupCommand: backup('/etc/nginx/conf.d/ratelimit.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
  {
    id: 'nginx-vuln-ip-blacklist', name: 'IP黑名单',
    description: '批量封禁攻击IP',
    filePath: '/etc/nginx/conf.d/blacklist.conf', type: 'string',
    defaultValue: '', recommendedValue: 'deny ATTACKER_IP;', riskLevel: 'critical',
    readCommand: `cat /etc/nginx/conf.d/blacklist.conf 2>/dev/null | grep -c 'deny' || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: (v) => `echo 'deny ${v}' >> /etc/nginx/conf.d/blacklist.conf`,
    backupCommand: backup('/etc/nginx/conf.d/blacklist.conf'),
    restartCommand: 'nginx -t && systemctl reload nginx',
  },
];

// ═══════════════════════════════════════════════
// Apache 安全加固
// ═══════════════════════════════════════════════

const apacheSecurityItems: BaselineConfigItem[] = [
  {
    id: 'apache-server-tokens', name: 'ServerTokens',
    description: '隐藏Apache版本和OS信息',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'enum',
    enumValues: ['Full', 'OS', 'Minimal', 'Minor', 'Major', 'Prod'],
    defaultValue: 'OS', recommendedValue: 'Prod', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*ServerTokens\\b' /etc/httpd/conf/httpd.conf /etc/apache2/apache2.conf /etc/apache2/conf-enabled/ 2>/dev/null | head -1 || echo 'ServerTokens OS'`,
    parseRegex: 'ServerTokens\\s+(\\w+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'ServerTokens', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
    restartService: 'httpd',
    complianceRef: 'CIS Apache 3.2',
    distroOverrides: {
      ubuntu: { filePath: '/etc/apache2/conf-enabled/security.conf', writeCommand: (v) => apacheSet('/etc/apache2/conf-enabled/security.conf', 'ServerTokens', v), backupCommand: backup('/etc/apache2/conf-enabled/security.conf') },
      debian: { filePath: '/etc/apache2/conf-enabled/security.conf', writeCommand: (v) => apacheSet('/etc/apache2/conf-enabled/security.conf', 'ServerTokens', v), backupCommand: backup('/etc/apache2/conf-enabled/security.conf') },
    },
  },
  {
    id: 'apache-server-signature', name: 'ServerSignature',
    description: '关闭错误页面中的服务器签名',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'enum',
    enumValues: ['On', 'Off', 'EMail'],
    defaultValue: 'On', recommendedValue: 'Off', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*ServerSignature\\b' /etc/httpd/conf/httpd.conf /etc/apache2/conf-enabled/ 2>/dev/null | head -1 || echo 'ServerSignature On'`,
    parseRegex: 'ServerSignature\\s+(\\w+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'ServerSignature', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
    complianceRef: 'CIS Apache 3.3',
    distroOverrides: {
      ubuntu: { filePath: '/etc/apache2/conf-enabled/security.conf', writeCommand: (v) => apacheSet('/etc/apache2/conf-enabled/security.conf', 'ServerSignature', v) },
    },
  },
  {
    id: 'apache-trace', name: 'TraceEnable',
    description: '禁用TRACE方法，防止XST攻击',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'On', recommendedValue: 'Off', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*TraceEnable\\b' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1 || echo 'TraceEnable On'`,
    parseRegex: 'TraceEnable\\s+(\\w+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'TraceEnable', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
    complianceRef: 'CIS Apache 5.1',
  },
  {
    id: 'apache-directory-listing', name: 'Options -Indexes',
    description: '禁止目录列表浏览',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'enum',
    enumValues: ['Indexes', '-Indexes'],
    defaultValue: 'Indexes', recommendedValue: '-Indexes', riskLevel: 'high',
    readCommand: `grep -rE '^\\s*Options.*Indexes' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1 || echo 'Options Indexes'`,
    parseRegex: 'Options\\s+(.+?)\\s*$',
    writeCommand: () => `sed -i 's/Options Indexes/Options -Indexes/g' /etc/httpd/conf/httpd.conf 2>/dev/null; sed -i 's/Options Indexes/Options -Indexes/g' /etc/apache2/apache2.conf 2>/dev/null`,
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
    complianceRef: 'CIS Apache 4.4',
  },
  {
    id: 'apache-timeout', name: 'Timeout',
    description: '请求超时(秒)，防止慢速DoS',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'number',
    defaultValue: '300', recommendedValue: '60', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*Timeout\\b' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1 || echo 'Timeout 300'`,
    parseRegex: 'Timeout\\s+(\\d+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'Timeout', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
    validation: { min: 10, max: 600 },
  },
  {
    id: 'apache-max-keep-alive', name: 'MaxKeepAliveRequests',
    description: '单连接最大请求数',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'number',
    defaultValue: '100', recommendedValue: '100', riskLevel: 'low',
    readCommand: `grep -rE '^\\s*MaxKeepAliveRequests\\b' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1 || echo 'MaxKeepAliveRequests 100'`,
    parseRegex: 'MaxKeepAliveRequests\\s+(\\d+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'MaxKeepAliveRequests', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
  },
  {
    id: 'apache-limit-request-body', name: 'LimitRequestBody',
    description: '限制请求体大小(字节)，防止大文件DoS',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'number',
    defaultValue: '0', recommendedValue: '10485760', riskLevel: 'medium',
    readCommand: `grep -rE '^\\s*LimitRequestBody\\b' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1 || echo 'LimitRequestBody 0'`,
    parseRegex: 'LimitRequestBody\\s+(\\d+)',
    writeCommand: (v) => apacheSet('/etc/httpd/conf/httpd.conf', 'LimitRequestBody', v),
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
  },
  {
    id: 'apache-header-x-frame', name: 'Header X-Frame-Options',
    description: '防止点击劫持(需mod_headers)',
    filePath: '/etc/httpd/conf/httpd.conf', type: 'string',
    defaultValue: '', recommendedValue: 'SAMEORIGIN', riskLevel: 'high',
    readCommand: `grep -rE 'X-Frame-Options' /etc/httpd/conf/httpd.conf /etc/apache2/ 2>/dev/null | head -1`,
    parseRegex: "X-Frame-Options\\s+[\"']?(\\S+)",
    writeCommand: (v) => `grep -q 'X-Frame-Options' /etc/httpd/conf/httpd.conf 2>/dev/null || echo 'Header always set X-Frame-Options "${v}"' >> /etc/httpd/conf/httpd.conf`,
    backupCommand: backup('/etc/httpd/conf/httpd.conf'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
  },
  {
    id: 'apache-mod-rewrite-waf', name: 'mod_rewrite WAF规则',
    description: '.htaccess层面拦截SQL注入/XSS/文件包含(比赛邪修)',
    filePath: '/var/www/html/.htaccess', type: 'string',
    defaultValue: '', recommendedValue: 'enabled', riskLevel: 'critical',
    readCommand: `grep -c 'RewriteCond.*union\\|RewriteCond.*select' /var/www/html/.htaccess 2>/dev/null || echo '0'`,
    parseRegex: '(\\d+)',
    writeCommand: () => `cat > /var/www/html/.htaccess << 'HTEOF'
RewriteEngine On
# SQL注入
RewriteCond %{QUERY_STRING} union.*select [NC,OR]
RewriteCond %{QUERY_STRING} select.*from [NC,OR]
RewriteCond %{QUERY_STRING} insert.*into [NC,OR]
RewriteCond %{QUERY_STRING} drop.*table [NC,OR]
RewriteCond %{QUERY_STRING} concat\\( [NC,OR]
# 文件包含
RewriteCond %{QUERY_STRING} \\.\\./ [NC,OR]
RewriteCond %{QUERY_STRING} etc/passwd [NC,OR]
RewriteCond %{QUERY_STRING} proc/self [NC,OR]
# 命令注入
RewriteCond %{QUERY_STRING} ;.*/bin/ [NC,OR]
RewriteCond %{QUERY_STRING} \\$\\( [NC,OR]
# XSS
RewriteCond %{QUERY_STRING} <script [NC]
RewriteRule .* - [F,L]
HTEOF`,
    backupCommand: backup('/var/www/html/.htaccess'),
    restartCommand: 'systemctl restart httpd 2>/dev/null || systemctl restart apache2 2>/dev/null',
  },
];

// ═══════════════════════════════════════════════
// PHP 安全加固
// ═══════════════════════════════════════════════

const phpSecurityItems: BaselineConfigItem[] = [
  {
    id: 'php-disable-functions', name: 'disable_functions',
    description: '禁用危险函数(比赛第一步，直接封死命令执行)',
    filePath: '/etc/php.ini', type: 'string',
    defaultValue: '', recommendedValue: 'system,exec,passthru,shell_exec,popen,proc_open,pcntl_exec,eval,assert,preg_replace,create_function,call_user_func,call_user_func_array,putenv,dl,phpinfo,show_source,highlight_file', riskLevel: 'critical',
    readCommand: `php -i 2>/dev/null | grep disable_functions | head -1 || grep -E '^\\s*disable_functions' /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/cli/php.ini 2>/dev/null | head -1`,
    parseRegex: 'disable_functions\\s*[=>]+\\s*(.*)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/cli/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && (grep -q 'disable_functions' "$f" && sed -i 's/^\\s*;*\\s*disable_functions.*/disable_functions = ${v}/' "$f" || echo 'disable_functions = ${v}' >> "$f"); done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; systemctl restart httpd 2>/dev/null; systemctl restart apache2 2>/dev/null; true',
    complianceRef: 'CIS PHP 2.1',
  },
  {
    id: 'php-allow-url-include', name: 'allow_url_include',
    description: '禁止远程文件包含(RFI)',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'Off', recommendedValue: 'Off', riskLevel: 'critical',
    readCommand: `php -i 2>/dev/null | grep allow_url_include | head -1 || echo 'allow_url_include Off'`,
    parseRegex: 'allow_url_include\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/cli/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*allow_url_include.*/allow_url_include = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
    complianceRef: 'CIS PHP 2.2',
  },
  {
    id: 'php-allow-url-fopen', name: 'allow_url_fopen',
    description: '禁止fopen打开远程URL',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'On', recommendedValue: 'Off', riskLevel: 'high',
    readCommand: `php -i 2>/dev/null | grep allow_url_fopen | head -1 || echo 'allow_url_fopen On'`,
    parseRegex: 'allow_url_fopen\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*allow_url_fopen.*/allow_url_fopen = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
    complianceRef: 'CIS PHP 2.3',
  },
  {
    id: 'php-display-errors', name: 'display_errors',
    description: '关闭错误显示，防止信息泄露',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'On', recommendedValue: 'Off', riskLevel: 'high',
    readCommand: `php -i 2>/dev/null | grep 'display_errors =>' | head -1 || echo 'display_errors On'`,
    parseRegex: 'display_errors\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*display_errors.*/display_errors = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
    complianceRef: 'CIS PHP 3.1',
  },
  {
    id: 'php-expose', name: 'expose_php',
    description: '隐藏HTTP响应头中的PHP版本',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'On', recommendedValue: 'Off', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep expose_php | head -1 || echo 'expose_php On'`,
    parseRegex: 'expose_php\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*expose_php.*/expose_php = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-open-basedir', name: 'open_basedir',
    description: '限制PHP可访问的目录(沙箱)',
    filePath: '/etc/php.ini', type: 'string',
    defaultValue: '', recommendedValue: '/var/www/html:/tmp', riskLevel: 'critical',
    readCommand: `php -i 2>/dev/null | grep open_basedir | head -1 || echo 'open_basedir no value'`,
    parseRegex: 'open_basedir\\s*[=>]+\\s*(.*)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && (grep -q 'open_basedir' "$f" && sed -i 's|^\\s*;*\\s*open_basedir.*|open_basedir = ${v}|' "$f" || echo 'open_basedir = ${v}' >> "$f"); done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
    complianceRef: 'CIS PHP 2.5',
  },
  {
    id: 'php-upload-max-filesize', name: 'upload_max_filesize',
    description: '限制上传文件大小',
    filePath: '/etc/php.ini', type: 'string',
    defaultValue: '2M', recommendedValue: '2M', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep upload_max_filesize | head -1 || echo 'upload_max_filesize 2M'`,
    parseRegex: 'upload_max_filesize\\s*[=>]+\\s*(\\S+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*upload_max_filesize.*/upload_max_filesize = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-max-execution-time', name: 'max_execution_time',
    description: '脚本最大执行时间(秒)',
    filePath: '/etc/php.ini', type: 'number',
    defaultValue: '30', recommendedValue: '30', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep max_execution_time | head -1 || echo 'max_execution_time 30'`,
    parseRegex: 'max_execution_time\\s*[=>]+\\s*(\\d+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*max_execution_time.*/max_execution_time = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
    validation: { min: 5, max: 300 },
  },
  {
    id: 'php-session-httponly', name: 'session.cookie_httponly',
    description: 'Session Cookie设为HttpOnly，防XSS窃取',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['0', '1'],
    defaultValue: '0', recommendedValue: '1', riskLevel: 'high',
    readCommand: `php -i 2>/dev/null | grep 'session.cookie_httponly' | head -1 || echo 'session.cookie_httponly 0'`,
    parseRegex: 'session\\.cookie_httponly\\s*[=>]+\\s*(\\d)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*session.cookie_httponly.*/session.cookie_httponly = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-session-secure', name: 'session.cookie_secure',
    description: 'Session Cookie仅通过HTTPS传输',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['0', '1'],
    defaultValue: '0', recommendedValue: '1', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep 'session.cookie_secure' | head -1 || echo 'session.cookie_secure 0'`,
    parseRegex: 'session\\.cookie_secure\\s*[=>]+\\s*(\\d)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*session.cookie_secure.*/session.cookie_secure = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-session-use-strict', name: 'session.use_strict_mode',
    description: '启用严格Session模式，防止Session固定',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['0', '1'],
    defaultValue: '0', recommendedValue: '1', riskLevel: 'high',
    readCommand: `php -i 2>/dev/null | grep 'session.use_strict_mode' | head -1 || echo 'session.use_strict_mode 0'`,
    parseRegex: 'session\\.use_strict_mode\\s*[=>]+\\s*(\\d)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*session.use_strict_mode.*/session.use_strict_mode = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-log-errors', name: 'log_errors',
    description: '开启PHP错误日志(关闭display_errors后依然有日志)',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'Off', recommendedValue: 'On', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep 'log_errors =>' | head -1 || echo 'log_errors Off'`,
    parseRegex: 'log_errors\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*log_errors\\s*=.*/log_errors = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-error-reporting', name: 'error_reporting',
    description: '错误报告级别',
    filePath: '/etc/php.ini', type: 'string',
    defaultValue: 'E_ALL', recommendedValue: 'E_ALL & ~E_DEPRECATED & ~E_STRICT', riskLevel: 'low',
    readCommand: `php -i 2>/dev/null | grep 'error_reporting =>' | head -1 || echo 'error_reporting E_ALL'`,
    parseRegex: 'error_reporting\\s*[=>]+\\s*(\\S+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i "s/^\\s*;*\\s*error_reporting.*/error_reporting = ${v}/" "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-memory-limit', name: 'memory_limit',
    description: 'PHP进程内存限制',
    filePath: '/etc/php.ini', type: 'string',
    defaultValue: '128M', recommendedValue: '128M', riskLevel: 'low',
    readCommand: `php -i 2>/dev/null | grep memory_limit | head -1 || echo 'memory_limit 128M'`,
    parseRegex: 'memory_limit\\s*[=>]+\\s*(\\S+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*memory_limit.*/memory_limit = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
  {
    id: 'php-file-uploads', name: 'file_uploads',
    description: '是否允许文件上传(比赛中可直接关闭)',
    filePath: '/etc/php.ini', type: 'enum',
    enumValues: ['On', 'Off'],
    defaultValue: 'On', recommendedValue: 'On', riskLevel: 'medium',
    readCommand: `php -i 2>/dev/null | grep 'file_uploads =>' | head -1 || echo 'file_uploads On'`,
    parseRegex: 'file_uploads\\s*[=>]+\\s*(\\w+)',
    writeCommand: (v) => `for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i 's/^\\s*;*\\s*file_uploads.*/file_uploads = ${v}/' "$f" 2>/dev/null; done`,
    backupCommand: `for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && cp -n "$f" "$f"_bak_"$(date +%Y%m%d%H%M%S)"; done; true`,
    restartCommand: 'systemctl restart php-fpm 2>/dev/null; systemctl restart php*-fpm 2>/dev/null; true',
  },
];

// ═══════════════════════════════════════════════
// 导出为分类
// ═══════════════════════════════════════════════

export const webserverBaselineCategories: BaselineCategory[] = [
  {
    id: 'nginx-security',
    title: 'Nginx 安全加固',
    icon: 'Network',
    hint: '/etc/nginx/nginx.conf',
    items: nginxSecurityItems,
  },
  {
    id: 'nginx-vuln-fix',
    title: 'Nginx 漏洞修复 / WAF',
    icon: 'Shield',
    hint: 'SQL注入/XSS/文件包含/上传 过滤规则',
    items: nginxVulnFixItems,
  },
  {
    id: 'apache-security',
    title: 'Apache 安全加固',
    icon: 'Network',
    hint: '/etc/httpd/conf/httpd.conf | /etc/apache2/',
    items: apacheSecurityItems,
  },
  {
    id: 'php-security',
    title: 'PHP 安全加固',
    icon: 'Code',
    hint: 'php.ini | disable_functions | open_basedir | session',
    items: phpSecurityItems,
  },
];
