/**
 * SFTP 文件详情侧栏（右侧常驻可收缩面板）
 *
 * 点击文件行 → 在 #sftp-side-body 渲染详情（基本信息 / 时间 / SHA-256 / 快速预览 /
 * 调查标记 / 操作），并异步拉取哈希、预览、访问/创建时间。
 */

import { invoke } from '@tauri-apps/api/core';

const I_COPY = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const I_DOWN = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>`;

let currentFile: any = null;

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtSize(bytes: number): string {
  if (bytes == null || isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function shellQuote(p: string): string {
  return `'${String(p).replace(/'/g, `'\\''`)}'`;
}

function riskBadge(file: any): string {
  const perms = parseInt(file.permissions || '0', 8) || 0;
  if ((perms & 0o4000) || (perms & 0o2000) || ((perms & 0o777) === 0o777)) return '<span class="pd-rbadge high">可疑</span>';
  const n = (file.name || '').toLowerCase();
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(n) || /\.(pem|key)$/.test(n) || (n.startsWith('.') && file.file_type === 'file')) return '<span class="pd-rbadge warn">敏感</span>';
  return '';
}

function fileTags(file: any, path: string): string[] {
  const tags: string[] = [];
  const n = (file.name || '').toLowerCase();
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(n) || /(authorized_keys|known_hosts)/.test(n) || /\.(pem|key|pub)$/.test(n) || path.includes('/.ssh')) tags.push('SSH密钥');
  if (path.includes('cron') || path.includes('init.d') || path.includes('/.ssh') || /\.service$/.test(n)) tags.push('持久化');
  return tags;
}

function detailHTML(file: any): string {
  const path = file.path || '';
  const isDir = file.file_type === 'directory';
  const tags = fileTags(file, path);
  return `
    <div class="sftp-detail-id">
      <span class="sftp-detail-fileicon">${isDir ? '📁' : '📄'}</span>
      <div class="sftp-detail-idtext">
        <div class="sftp-detail-name" title="${esc(file.name)}">${esc(file.name)}</div>
        <div class="sftp-detail-sub">${isDir ? '文件夹' : '文件'}</div>
      </div>
      ${riskBadge(file)}
    </div>

    <div class="pd-section">基本信息</div>
    <div class="pd-kv">
      <div class="pd-k">路径</div><div class="pd-v">${esc(path)}</div>
      <div class="pd-k">大小</div><div class="pd-v">${isDir ? '-' : esc(fmtSize(file.size))}</div>
      <div class="pd-k">所有者</div><div class="pd-v">${esc(file.owner || '-')}${file.group ? ':' + esc(file.group) : ''}</div>
      <div class="pd-k">权限</div><div class="pd-v">${esc(file.permissions || '-')}</div>
    </div>

    <div class="pd-section">时间信息</div>
    <div class="pd-kv">
      <div class="pd-k">修改</div><div class="pd-v">${esc(file.modified || '-')}</div>
      <div class="pd-k">访问</div><div class="pd-v" id="sftp-detail-atime">-</div>
      <div class="pd-k">创建</div><div class="pd-v" id="sftp-detail-ctime">-</div>
    </div>

    <div class="pd-section">文件摘要</div>
    <div class="pd-code">
      <code id="sftp-detail-hash">${isDir ? '—（目录）' : '计算中…'}</code>
      <button class="pd-copy" title="复制" onclick="window.sftpCopyHash && window.sftpCopyHash()">${I_COPY}</button>
    </div>

    ${!isDir ? `
    <div class="pd-section">快速预览</div>
    <pre class="sftp-detail-preview" id="sftp-detail-preview">加载中…</pre>` : ''}

    ${tags.length ? `
    <div class="pd-section">调查标记</div>
    <div class="sftp-detail-tags">${tags.map(t => `<span class="sftp-detail-tag">${esc(t)}</span>`).join('')}</div>` : ''}

    <div class="sftp-detail-actions">
      <button class="pd-action" onclick="window.sftpDetailCopyPath && window.sftpDetailCopyPath()">${I_COPY} 复制路径</button>
      <button class="pd-action" onclick="window.sftpDetailHash && window.sftpDetailHash()">计算哈希</button>
      <button class="pd-action primary" onclick="window.sftpDetailDownload && window.sftpDetailDownload()">${I_DOWN} 下载</button>
    </div>
  `;
}

async function fetchDetail(file: any): Promise<void> {
  const path = file.path || '';
  const q = shellQuote(path);

  if (file.file_type !== 'directory') {
    invoke('ssh_execute_dashboard_command_direct', { command: `sha256sum ${q} 2>/dev/null | awk '{print $1}'` })
      .then((res: any) => {
        const hash = String(res?.output || '').trim().split('\n')[0];
        const el = document.getElementById('sftp-detail-hash');
        if (el) el.textContent = hash || '无法计算';
      }).catch(() => { const el = document.getElementById('sftp-detail-hash'); if (el) el.textContent = '无法计算'; });

    invoke('ssh_execute_dashboard_command_direct', { command: `head -c 4000 ${q} 2>/dev/null` })
      .then((res: any) => {
        const el = document.getElementById('sftp-detail-preview');
        if (el) el.textContent = String(res?.output || '').slice(0, 4000) || '（空）';
      }).catch(() => { const el = document.getElementById('sftp-detail-preview'); if (el) el.textContent = '无法预览'; });
  }

  invoke('ssh_execute_dashboard_command_direct', { command: `stat -c '%x|%w' ${q} 2>/dev/null` })
    .then((res: any) => {
      const [atime, ctime] = String(res?.output || '').trim().split('|');
      const a = document.getElementById('sftp-detail-atime');
      if (a && atime && atime !== '-') a.textContent = atime.split('.')[0];
      const c = document.getElementById('sftp-detail-ctime');
      if (c && ctime && ctime !== '-' && ctime !== '') c.textContent = ctime.split('.')[0];
    }).catch(() => { /* stat 不可用 */ });
}

function openSftpDetail(index: number): void {
  const files = (window as any).sftpManager?.getCurrentFiles?.() || [];
  const f = files[index];
  if (!f) return;
  currentFile = f;

  document.querySelectorAll('#sftp-file-list .sftp-file-row').forEach((r) => r.classList.remove('selected'));
  document.querySelector(`#sftp-file-list .sftp-file-row[data-file-index="${index}"]`)?.classList.add('selected');

  const body = document.getElementById('sftp-side-body');
  if (!body) return;
  body.innerHTML = detailHTML(f);

  const side = document.getElementById('sftp-side');
  if (side?.classList.contains('collapsed')) {
    side.classList.remove('collapsed');
    try { localStorage.setItem('sftp-side-collapsed', 'false'); } catch { /* ignore */ }
  }

  void fetchDetail(f);
}

function toggleSftpSide(): void {
  const side = document.getElementById('sftp-side');
  if (!side) return;
  const collapsed = side.classList.toggle('collapsed');
  try { localStorage.setItem('sftp-side-collapsed', collapsed ? 'true' : 'false'); } catch { /* ignore */ }
}

function sftpToggleAll(checked: boolean): void {
  document.querySelectorAll('#sftp-file-list .sftp-row-check').forEach((cb) => { (cb as HTMLInputElement).checked = checked; });
}

function copyText(t: string): void {
  if (!t) return;
  navigator.clipboard.writeText(t)
    .then(() => (window as any).showNotification?.('已复制', 'success'))
    .catch(() => (window as any).showNotification?.('复制失败', 'error'));
}

export function initSftpDetailPanel(): void {
  const w = window as any;
  w.openSftpDetail = openSftpDetail;
  w.toggleSftpSide = toggleSftpSide;
  w.sftpToggleAll = sftpToggleAll;
  w.sftpDetailCopyPath = () => { if (currentFile) copyText(currentFile.path); };
  w.sftpCopyHash = () => copyText(document.getElementById('sftp-detail-hash')?.textContent || '');
  w.sftpDetailHash = () => { if (currentFile) void fetchDetail(currentFile); };
  w.sftpDetailDownload = () => {
    if (!currentFile) return;
    if (w.sftpDownloadSelected) { w.sftpDownloadSelected(); return; }
    invoke('sftp_download', { remotePath: currentFile.path }).catch(() => {});
    w.showNotification?.('开始下载…', 'info');
  };
}

initSftpDetailPanel();
