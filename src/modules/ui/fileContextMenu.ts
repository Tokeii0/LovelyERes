/**
 * 文件右键菜单和安全分析
 */

import { invoke } from '@tauri-apps/api/core'
import { marked } from 'marked'
import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

interface CommandHistory {
  timestamp: string
  action: string
  actionName: string
  filePath: string
  fileName: string
  command: string
  result: string
}

export class FileContextMenu extends BaseContextMenu {
  private currentFilePath: string = ''
  private currentAnalysisContent: string = ''
  private currentAnalysisTitle: string = ''
  private commandHistory: CommandHistory[] = []

  constructor() {
    super('file')
  }

  protected onShowContextMenu(filePath: string) {
    this.currentFilePath = filePath
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FileText({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="file-hash">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件哈希值</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-signature">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件类型识别</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-size">
            <span class="menu-label">
              ${IconPark.DataFile({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件大小详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-permissions">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件权限分析</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-timestamps">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件时间戳</span>
            </span>
          </div>
          <div class="menu-item" data-action="inode">
            <span class="menu-label">
              ${IconPark.Info({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Inode 信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="mime-type">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>MIME 类型</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Search({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>内容分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="file-strings">
            <span class="menu-label">
              ${IconPark.TextMessage({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>字符串提取</span>
            </span>
          </div>
          <div class="menu-item" data-action="hex-dump">
            <span class="menu-label">
              ${IconPark.Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>HEX 十六进制</span>
            </span>
          </div>
          <div class="menu-item" data-action="line-count">
            <span class="menu-label">
              ${IconPark.DataFile({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>行数统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="archive-list">
            <span class="menu-label">
              ${IconPark.FolderClose({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>压缩文件列表</span>
            </span>
          </div>
          <div class="menu-item" data-action="elf-header">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>ELF 头解析</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Connection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>系统关联</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="file-processes">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>关联进程</span>
            </span>
          </div>
          <div class="menu-item" data-action="package-owner">
            <span class="menu-label">
              ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>所属包查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="hard-links">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>硬链接查找</span>
            </span>
          </div>
          <div class="menu-item" data-action="process-maps">
            <span class="menu-label">
              ${IconPark.DataAll({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>进程内存映射</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Setting({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>元数据与签名</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="xattr">
            <span class="menu-label">
              ${IconPark.Tag({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>扩展属性</span>
            </span>
          </div>
          <div class="menu-item" data-action="capabilities">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件能力</span>
            </span>
          </div>
          <div class="menu-item" data-action="selinux-context">
            <span class="menu-label">
              ${IconPark.Protection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>SELinux 标签</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.TreeDiagram({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>文件关系</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="dynamic-deps">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>动态依赖分析</span>
            </span>
          </div>
          <div class="menu-item" data-action="config-references">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>配置文件引用</span>
            </span>
          </div>
          <div class="menu-item" data-action="symlink-analysis">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>符号链接分析</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全检测</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="suspicious-path">
            <span class="menu-label">
              ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可疑路径检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="hidden-file">
            <span class="menu-label">
              ${IconPark.Ghost({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>隐藏文件检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="suid-sgid">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>SUID/SGID 检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="webshell-detection">
            <span class="menu-label">
              ${IconPark.Bug({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Webshell 特征检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="backdoor-detection">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>后门特征检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="crypto-mining-detection">
            <span class="menu-label">
              ${IconPark.Bitcoin({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>挖矿程序检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="reverse-shell-detection">
            <span class="menu-label">
              ${IconPark.Lightning({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>反弹Shell检测</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const actions: Record<string, MenuAction> = {
      'file-hash': { command: 'hash', title: '文件哈希值', actionName: '哈希值' },
      'file-signature': { command: 'signature', title: '文件类型识别', actionName: '文件类型' },
      'file-size': { command: 'file-size', title: '文件大小详情', actionName: '大小' },
      'file-permissions': { command: 'permissions', title: '文件权限分析', actionName: '权限' },
      'file-timestamps': { command: 'timestamps', title: '文件时间戳', actionName: '时间戳' },
      'inode': { command: 'inode', title: 'Inode 信息', actionName: 'Inode' },
      'mime-type': { command: 'mime-type', title: 'MIME 类型', actionName: 'MIME' },
      'file-strings': { command: 'strings', title: '字符串提取', actionName: '字符串' },
      'hex-dump': { command: 'hex-dump', title: 'HEX 十六进制', actionName: 'HEX' },
      'line-count': { command: 'line-count', title: '行数统计', actionName: '行数' },
      'archive-list': { command: 'archive-list', title: '压缩文件列表', actionName: '压缩列表' },
      'elf-header': { command: 'elf-header', title: 'ELF 头解析', actionName: 'ELF头' },
      'file-processes': { command: 'processes', title: '关联进程', actionName: '进程' },
      'package-owner': { command: 'package-owner', title: '所属包查询', actionName: '所属包' },
      'hard-links': { command: 'hard-links', title: '硬链接查找', actionName: '硬链接' },
      'process-maps': { command: 'process-maps', title: '进程内存映射', actionName: '内存映射' },
      'xattr': { command: 'xattr', title: '扩展属性', actionName: '扩展属性' },
      'capabilities': { command: 'capabilities', title: '文件能力', actionName: '能力' },
      'selinux-context': { command: 'selinux-context', title: 'SELinux 标签', actionName: 'SELinux' },
      'dynamic-deps': { command: 'dynamic-deps', title: '动态依赖分析', actionName: '动态依赖' },
      'config-references': { command: 'config-references', title: '配置文件引用', actionName: '配置引用' },
      'symlink-analysis': { command: 'symlink-analysis', title: '符号链接分析', actionName: '符号链接' },
      'suspicious-path': { command: 'suspicious-path', title: '可疑路径检测', actionName: '可疑路径' },
      'hidden-file': { command: 'hidden-file', title: '隐藏文件检测', actionName: '隐藏文件' },
      'suid-sgid': { command: 'suid-sgid', title: 'SUID/SGID 检测', actionName: 'SUID/SGID' },
      'webshell-detection': { command: 'webshell', title: 'Webshell 特征检测', actionName: 'Webshell' },
      'backdoor-detection': { command: 'backdoor', title: '后门特征检测', actionName: '后门' },
      'crypto-mining-detection': { command: 'crypto-mining', title: '挖矿程序检测', actionName: '挖矿' },
      'reverse-shell-detection': { command: 'reverse-shell', title: '反弹Shell检测', actionName: '反弹Shell' },
    }

    return actions[action] || null
  }

  /**
   * 处理菜单项点击（公共 API，供外部调用如 sftpContextMenuHandler）
   */
  public async handleAction(action: string, filePath: string) {
    this.currentFilePath = filePath
    await this.executeAction(action)
  }

  /**
   * 文件分析使用独立 session (sftp_file_analysis_independent)，
   * 覆盖默认的 ssh_execute_command_direct 执行流程
   */
  protected async handleSpecialAction(action: string): Promise<boolean> {
    const resolved = this.resolveAction(action)
    if (!resolved) return false

    const { command: analysisAction, title } = resolved
    const filePath = this.currentFilePath

    this.showModal('正在分析...', '请稍候...')

    try {
      const result = await this.executeAnalysis(analysisAction, filePath)

      // 保存当前分析信息，供 AI 解释使用
      this.currentAnalysisTitle = title
      this.currentAnalysisContent = result

      this.showModal(title, result)
      window.showNotification?.(`${title}完成`, 'success')
    } catch (error) {
      this.showModal('错误', `${error}`)
      console.error('文件分析失败:', error)
      window.showNotification?.(`${title}失败: ${error}`, 'error')
    }

    return true
  }

  /**
   * 覆盖基类的 AI 解释，使用文件安全分析专用提示词和 Markdown 渲染
   */
  protected async explainWithAI() {
    const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)
    const explanationContentEl = document.getElementById(`${this.prefix}-ai-explanation-content`)

    if (!explanationEl || !explanationContentEl) return

    explanationEl.style.display = 'block'
    explanationContentEl.textContent = '🤖 正在分析...'

    try {
      const settingsContent = await invoke('read_settings_file') as string
      let settings: any = {}

      if (settingsContent) {
        settings = JSON.parse(settingsContent)
      }

      if (!settings.ai) {
        settings.ai = {
          currentProvider: 'openai',
          providers: {
            openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' },
            deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKey: '' }
          }
        }
      }

      if (!settings.ai || !settings.ai.currentProvider) {
        throw new Error('AI配置异常，请在设置中配置AI')
      }

      const currentProvider = settings.ai.currentProvider
      const providerConfig = settings.ai.providers[currentProvider]

      if (!providerConfig) {
        throw new Error('AI提供商配置不存在')
      }

      if (!providerConfig.apiKey && currentProvider !== 'ollama') {
        throw new Error('AI API Key 未配置')
      }

      const systemPrompt = `你是一个 Linux 安全专家和应急响应专家。

# 任务
分析以下文件安全分析结果，并提供专业的解释和建议。

# 文件信息
- 文件路径：${this.currentFilePath}
- 分析类型：${this.currentAnalysisTitle}

# 分析结果
${this.currentAnalysisContent}

# 输出要求
请按照以下顺序提供分析：
1. **结果概要**：简要总结分析结果
2. **关键发现**：列出重要的发现和特征
3. **安全评估**：评估潜在的安全风险（如果适用）
4. **建议操作**：提供具体的操作建议（如果适用）

请使用清晰的 Markdown 格式，确保内容结构化、易读。`

      explanationContentEl.innerHTML = ''

      let accumulatedContent = ''
      let updateTimer: number | null = null

      await this.callFileAIAPI(systemPrompt, providerConfig, (chunk: string) => {
        accumulatedContent += chunk

        if (updateTimer) {
          clearTimeout(updateTimer)
        }

        updateTimer = window.setTimeout(() => {
          explanationContentEl.innerHTML = this.renderMarkdown(accumulatedContent)
        }, 100)
      })

      if (updateTimer) {
        clearTimeout(updateTimer)
      }
      explanationContentEl.innerHTML = this.renderMarkdown(accumulatedContent)
    } catch (error) {
      explanationContentEl.textContent = `❌ AI解释失败: ${error}\n\n提示：请在设置中配置AI，或者检查AI服务是否可用。`
    }
  }

  // ===== 文件分析专用方法 =====

  /**
   * 执行文件分析命令（使用独立 session）
   */
  private async executeAnalysis(action: string, filePath: string) {
    try {
      const result = await invoke('sftp_file_analysis_independent', {
        action,
        filePath
      }) as any

      this.addToHistory(result)

      return result.result as string
    } catch (error) {
      throw new Error(`分析失败: ${error}`)
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(data: any) {
    const actionName = this.getActionName(data.action)
    const fileName = data.file_path.split('/').pop() || data.file_path

    const historyItem: CommandHistory = {
      timestamp: data.timestamp,
      action: data.action,
      actionName: actionName,
      filePath: data.file_path,
      fileName: fileName,
      command: this.getCommandForAction(data.action, data.file_path),
      result: data.result
    }

    this.commandHistory.unshift(historyItem)

    if (this.commandHistory.length > 50) {
      this.commandHistory.pop()
    }
  }

  /**
   * 获取动作对应的命令
   */
  private getCommandForAction(action: string, filePath: string): string {
    const commands: Record<string, string> = {
      'hash': `md5sum "${filePath}" && sha1sum "${filePath}" && sha256sum "${filePath}"`,
      'signature': `file -b "${filePath}"`,
      'permissions': `ls -lh "${filePath}" && stat -c '%A %a %U:%G' "${filePath}"`,
      'timestamps': `stat "${filePath}"`,
      'inode': `stat -c 'Inode: %i\\nLinks: %h\\nDevice: %d\\nSize: %s bytes' "${filePath}"`,
      'mime-type': `file -b --mime-type "${filePath}"`,
      'file-size': `du -h "${filePath}" && ls -lh "${filePath}"`,
      'strings': `strings -n 8 "${filePath}" | head -100`,
      'hex-dump': `xxd "${filePath}" | head -50`,
      'line-count': `wc -l "${filePath}"`,
      'archive-list': `tar -tzf "${filePath}" 2>/dev/null || unzip -l "${filePath}" 2>/dev/null`,
      'elf-header': `readelf -h "${filePath}"`,
      'processes': `lsof "${filePath}" 2>/dev/null || fuser -v "${filePath}" 2>/dev/null`,
      'package-owner': `dpkg -S "${filePath}" 2>/dev/null || rpm -qf "${filePath}" 2>/dev/null`,
      'hard-links': `find / -samefile "${filePath}" 2>/dev/null`,
      'process-maps': `grep "${filePath}" /proc/*/maps 2>/dev/null`,
      'xattr': `getfattr -d "${filePath}" 2>/dev/null || xattr -l "${filePath}" 2>/dev/null`,
      'capabilities': `getcap "${filePath}"`,
      'selinux-context': `ls -Z "${filePath}"`,
      'dynamic-deps': `ldd "${filePath}" 2>/dev/null`,
      'config-references': `grep -r "${filePath}" /etc/ 2>/dev/null | head -20`,
      'symlink-analysis': `ls -l "${filePath}" && readlink -f "${filePath}"`,
      'suspicious-path': `echo "${filePath}" | grep -E '(/tmp/|/dev/shm/|/var/tmp/|\\.\\.)'`,
      'hidden-file': `basename "${filePath}" | grep '^\\.'`,
      'suid-sgid': `find "${filePath}" -perm /6000 -ls`,
      'webshell': `grep -E '(eval|base64_decode|system|exec|shell_exec|passthru)' "${filePath}"`,
      'backdoor': `grep -E '(nc -e|/bin/bash|/bin/sh.*-i)' "${filePath}"`,
      'crypto-mining': `grep -E '(xmrig|stratum|cryptonight|monero)' "${filePath}"`,
      'reverse-shell': `grep -E '(bash -i|sh -i|nc.*-e|/dev/tcp/)' "${filePath}"`
    }
    return commands[action] || `未知命令: ${action}`
  }

  /**
   * 显示历史记录模态框
   */
  public showHistoryModal() {
    const modal = this.modal
    const titleEl = document.getElementById(`${this.prefix}-modal-title`)
    const contentEl = document.getElementById(`${this.prefix}-modal-content`)
    const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)

    if (!modal || !titleEl || !contentEl || !explanationEl) {
      console.error('模态框元素不存在')
      return
    }

    titleEl.textContent = '📜 命令执行历史'

    explanationEl.style.display = 'none'

    let historyHTML = ''

    if (this.commandHistory.length === 0) {
      historyHTML = '<div style="text-align: center; padding: 40px; color: var(--text-tertiary);">暂无历史记录</div>'
    } else {
      historyHTML = `
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 8px;
          max-height: 600px;
          overflow-y: auto;
          padding: 2px;
        ">
          ${this.commandHistory.map((item, index) => `
            <div style="
              padding: 4px 6px;
              background: var(--bg-secondary);
              border-radius: 4px;
              border-left: 2px solid var(--primary-color);
              line-height: 1.3;
            ">
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2px;
                padding-bottom: 2px;
                border-bottom: 1px solid var(--border-color);
              ">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="
                    color: var(--text-tertiary);
                    font-size: 10px;
                    background: var(--bg-tertiary);
                    padding: 0px 4px;
                    border-radius: 2px;
                  ">#${this.commandHistory.length - index}</span>
                  <span style="color: var(--primary-color); font-weight: 600; font-size: 12px;">${item.actionName}</span>
                </div>
                <span style="color: var(--text-tertiary); font-size: 10px;">${item.timestamp}</span>
              </div>

              <div style="
                color: var(--text-secondary);
                margin-bottom: 2px;
                font-size: 11px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              " title="${this.escapeHtml(item.filePath)}">📄 ${item.fileName}</div>

              <details style="margin-bottom: 2px;">
                <summary style="
                  cursor: pointer;
                  color: var(--text-tertiary);
                  font-size: 11px;
                  padding: 0;
                  user-select: none;
                ">💻 命令</summary>
                <div style="
                  font-family: 'Consolas', 'Monaco', monospace;
                  font-size: 11px;
                  padding: 4px;
                  margin-top: 2px;
                  background: var(--bg-tertiary);
                  border-radius: 3px;
                  color: var(--text-primary);
                  overflow-x: auto;
                  white-space: pre-wrap;
                  word-break: break-all;
                  max-height: 80px;
                  overflow-y: auto;
                  line-height: 1.4;
                ">${this.escapeHtml(item.command)}</div>
              </details>

              <details>
                <summary style="
                  cursor: pointer;
                  color: var(--text-tertiary);
                  font-size: 11px;
                  padding: 0;
                  user-select: none;
                ">📋 结果</summary>
                <div style="
                  font-family: 'Consolas', 'Monaco', monospace;
                  font-size: 11px;
                  padding: 4px;
                  margin-top: 2px;
                  background: var(--bg-tertiary);
                  border-radius: 3px;
                  color: var(--text-primary);
                  max-height: 120px;
                  overflow-y: auto;
                  white-space: pre-wrap;
                  word-break: break-all;
                  line-height: 1.4;
                ">${this.escapeHtml(item.result)}</div>
              </details>
            </div>
          `).join('')}
        </div>
      `
    }

    contentEl.innerHTML = historyHTML

    modal.style.display = 'flex'
  }

  /**
   * 获取动作的中文名称
   */
  private getActionName(action: string): string {
    const actionNames: Record<string, string> = {
      'hash': '哈希值',
      'signature': '文件类型',
      'permissions': '权限',
      'timestamps': '时间戳',
      'inode': 'Inode',
      'mime-type': 'MIME',
      'file-size': '大小',
      'strings': '字符串',
      'hex-dump': 'HEX',
      'line-count': '行数',
      'archive-list': '压缩列表',
      'elf-header': 'ELF头',
      'processes': '进程',
      'package-owner': '所属包',
      'hard-links': '硬链接',
      'process-maps': '内存映射',
      'xattr': '扩展属性',
      'capabilities': '能力',
      'selinux-context': 'SELinux',
      'dynamic-deps': '动态依赖',
      'config-references': '配置引用',
      'symlink-analysis': '符号链接',
      'suspicious-path': '可疑路径',
      'hidden-file': '隐藏文件',
      'suid-sgid': 'SUID/SGID',
      'webshell': 'Webshell',
      'backdoor': '后门',
      'crypto-mining': '挖矿',
      'reverse-shell': '反弹Shell'
    }
    return actionNames[action] || action
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 调用 AI API（流式输出）- 文件分析专用
   */
  private async callFileAIAPI(prompt: string, config: any, onChunk?: (chunk: string) => void): Promise<string> {
    try {
      console.log('🤖 调用AI API (流式模式):', config.name, config.baseUrl)

      const requestBody = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      }

      console.log('📤 AI请求体:', requestBody)

      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ AI API响应错误:', response.status, errorText)
        throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                fullContent += content
                if (onChunk) {
                  onChunk(content)
                }
              }
            } catch (e) {
              console.warn('解析流式数据失败:', e, data)
            }
          }
        }
      }

      console.log('✅ AI生成的解释:', fullContent)
      return fullContent.trim()
    } catch (error) {
      console.error('❌ AI API调用失败:', error)
      throw error
    }
  }

  /**
   * Markdown 渲染器（使用 marked.js）
   */
  private renderMarkdown(markdown: string): string {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
      })

      const rawHtml = marked.parse(markdown) as string

      const styledHtml = rawHtml
        .replace(/<h1>/g, '<h1 style="margin: 18px 0 14px 0; color: var(--primary-color); font-size: 18px; font-weight: 700; line-height: 1.4;">')
        .replace(/<h2>/g, '<h2 style="margin: 16px 0 12px 0; color: var(--primary-color); font-size: 16px; font-weight: 600; line-height: 1.4;">')
        .replace(/<h3>/g, '<h3 style="margin: 14px 0 10px 0; color: var(--text-primary); font-size: 15px; font-weight: 600; line-height: 1.4;">')
        .replace(/<h4>/g, '<h4 style="margin: 12px 0 8px 0; color: var(--text-primary); font-size: 14px; font-weight: 600; line-height: 1.4;">')
        .replace(/<h5>/g, '<h5 style="margin: 10px 0 6px 0; color: var(--text-primary); font-size: 13px; font-weight: 600; line-height: 1.4;">')
        .replace(/<h6>/g, '<h6 style="margin: 8px 0 4px 0; color: var(--text-primary); font-size: 12px; font-weight: 600; line-height: 1.4;">')
        .replace(/<p>/g, '<p style="margin: 8px 0; color: var(--text-primary); line-height: 1.6; font-size: 13px;">')
        .replace(/<ul>/g, '<ul style="margin: 8px 0; padding-left: 24px; list-style-type: disc;">')
        .replace(/<ol>/g, '<ol style="margin: 8px 0; padding-left: 24px;">')
        .replace(/<li>/g, '<li style="margin: 4px 0; color: var(--text-primary); line-height: 1.5;">')
        .replace(/<code>/g, '<code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 3px; font-family: \'Consolas\', \'Monaco\', monospace; font-size: 12px; color: var(--primary-color);">')
        .replace(/<pre><code/g, '<pre style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 12px 0;"><code style="font-family: \'Consolas\', \'Monaco\', monospace; font-size: 12px; color: var(--text-primary); background: transparent; padding: 0;"')
        .replace(/<a /g, '<a style="color: var(--primary-color); text-decoration: underline;" target="_blank" ')
        .replace(/<hr>/g, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;">')
        .replace(/<hr \/>/g, '<hr style="border: none; border-top: 1px solid var(--border-color); margin: 16px 0;" />')
        .replace(/<blockquote>/g, '<blockquote style="margin: 12px 0; padding: 8px 16px; border-left: 4px solid var(--primary-color); background: var(--bg-secondary); color: var(--text-secondary); font-style: italic;">')
        .replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px;">')
        .replace(/<th>/g, '<th style="border: 1px solid var(--border-color); padding: 8px; background: var(--bg-secondary); color: var(--text-primary); font-weight: 600; text-align: left;">')
        .replace(/<td>/g, '<td style="border: 1px solid var(--border-color); padding: 8px; color: var(--text-primary);">')
        .replace(/<strong>/g, '<strong style="color: var(--text-primary); font-weight: 600;">')
        .replace(/<em>/g, '<em style="color: var(--text-secondary);">')

      return styledHtml
    } catch (error) {
      console.error('Markdown 渲染失败:', error)
      return markdown
    }
  }
}
