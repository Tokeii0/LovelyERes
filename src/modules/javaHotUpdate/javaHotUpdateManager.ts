/**
 * Java 热更新管理器
 * 通过 SSH 管理远程服务器上的 Java 应用，支持进程管理、热更新、JVM 诊断、服务管理和部署管理
 */

import { invoke } from '@tauri-apps/api/core';
import { sshConnectionManager } from '../remote/sshConnectionManager';

// ────── 类型定义 ──────

export interface JavaProcess {
  pid: number;
  mainClass: string;
  jvmArgs: string;
  classpath: string;
  user: string;
  cpuPercent: string;
  memPercent: string;
  uptime: string;
  javaVersion: string;
  heapUsed: string;
  heapMax: string;
}

export interface JavaService {
  name: string;
  type: 'systemd' | 'jar' | 'war' | 'tomcat' | 'spring-boot';
  status: 'running' | 'stopped' | 'unknown';
  pid?: number;
  port?: number;
  path?: string;
}

export interface DeployTarget {
  name: string;
  type: 'tomcat' | 'springboot' | 'jar';
  basePath: string;
  webappsDir?: string;
  status: 'running' | 'stopped' | 'unknown';
}

export interface DockerJavaContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  javaVersion: string;
  jars: string[];      // JAR paths found inside
  pid?: number;        // Java PID inside container
}

export type JhuTab = 'processes' | 'hotupdate' | 'diagnostics' | 'services' | 'deploy' | 'docker';

// ────── 管理器 ──────

class JavaHotUpdateManager {
  private currentTab: JhuTab = 'processes';
  private processes: JavaProcess[] = [];
  private services: JavaService[] = [];
  private deployTargets: DeployTarget[] = [];
  private dockerContainers: DockerJavaContainer[] = [];
  private selectedContainer: string | null = null;  // container id
  private initialized = false;
  private loading = false;
  private eventsBound = false;
  private selectedPid: number | null = null;

  // ──── 生命周期 ────

  initialize(): void {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.refresh();
  }

  deactivate(): void {
    // 保留数据缓存，仅标记不再接收事件
  }

  // ──── 事件绑定 ────

  private bindEvents(): void {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-jhu-action]') as HTMLElement;
      if (!target) return;

      const action = target.getAttribute('data-jhu-action') || '';
      const param = target.getAttribute('data-jhu-param') || '';

      switch (action) {
        case 'switch-tab':
          this.switchTab(param as JhuTab);
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'select-process':
          this.selectProcess(parseInt(param));
          break;
        case 'thread-dump':
          this.threadDump(parseInt(param));
          break;
        case 'heap-dump':
          this.heapDump(parseInt(param));
          break;
        case 'gc-run':
          this.runGC(parseInt(param));
          break;
        case 'kill-process':
          this.killProcess(parseInt(param));
          break;
        case 'graceful-stop':
          this.gracefulStop(parseInt(param));
          break;
        case 'hot-swap':
          this.showHotSwapDialog(parseInt(param));
          break;
        case 'arthas-attach':
          this.arthasAttach(parseInt(param));
          break;
        case 'jvm-info':
          this.showJvmInfo(parseInt(param));
          break;
        case 'restart-service':
          this.restartService(param);
          break;
        case 'stop-service':
          this.stopService(param);
          break;
        case 'start-service':
          this.startService(param);
          break;
        case 'detect-services':
          this.detectServices();
          break;
        case 'detect-tomcat':
          this.detectTomcat();
          break;
        case 'deploy-jar':
          this.showDeployDialog('jar');
          break;
        case 'deploy-war':
          this.showDeployDialog('war');
          break;
        case 'scan-processes':
          this.refresh();
          break;
        case 'class-decompile':
          this.showDecompileDialog(parseInt(param));
          break;
        case 'env-info':
          this.showEnvInfo();
          break;
        // ── jar uf 热更新 ──
        case 'jar-list':
          this.jarList(param);
          break;
        case 'jar-extract-class':
          this.jarExtractClass(param);
          break;
        case 'jar-update':
          this.jarUpdate();
          break;
        case 'jar-update-guide':
          this.showJarUpdateGuide(param);
          break;
        case 'jar-backup':
          this.jarBackup(param);
          break;
        // ── 反编译 ──
        case 'decompile-javap':
          this.decompileJavap(param);
          break;
        case 'decompile-cfr':
          this.decompileCfr(param);
          break;
        case 'decompile-procyon':
          this.decompileProcyon();
          break;
        case 'install-cfr':
          this.installCfr();
          break;
        case 'install-procyon':
          this.installProcyon();
          break;
        case 'browse-jar':
          this.browseJar();
          break;
        case 'search-class-in-jar':
          this.searchClassInJar();
          break;
        case 'jar-diff':
          this.jarDiff();
          break;
        case 'compile-class':
          this.showCompileGuide();
          break;
        // ── Docker 容器 ──
        case 'docker-scan':
          this.scanDockerJava();
          break;
        case 'docker-select':
          this.selectContainer(param);
          break;
        case 'docker-jar-list':
          this.dockerJarList();
          break;
        case 'docker-jar-browse':
          this.dockerJarBrowse();
          break;
        case 'docker-jar-extract':
          this.dockerJarExtractToHost();
          break;
        case 'docker-jar-update':
          this.dockerJarUpdate();
          break;
        case 'docker-jar-backup':
          this.dockerJarBackup();
          break;
        case 'docker-class-search':
          this.dockerClassSearch();
          break;
        case 'docker-decompile':
          this.dockerDecompile();
          break;
        case 'docker-cp-in':
          this.dockerCpIn();
          break;
        case 'docker-cp-out':
          this.dockerCpOut();
          break;
        case 'docker-restart':
          this.dockerRestartContainer(param);
          break;
        case 'docker-exec-shell':
          this.dockerShowExecGuide(param);
          break;
        case 'docker-env':
          this.dockerShowEnv(param);
          break;
        case 'docker-full-guide':
          this.dockerFullUpdateGuide();
          break;
      }
    });
  }

  // ──── Tab 切换 ────

  switchTab(tab: JhuTab): void {
    this.currentTab = tab;
    document.querySelectorAll('.jhu-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-jhu-action="switch-tab"][data-jhu-param="${tab}"]`)?.classList.add('active');
    this.renderContent();
  }

  // ──── 数据加载 ────

  async refresh(): Promise<void> {
    if (!sshConnectionManager.isConnected() || this.loading) return;
    this.loading = true;
    this.renderContent();

    try {
      await this.loadProcesses();
      if (this.currentTab === 'services') {
        await this.detectServices();
      } else if (this.currentTab === 'deploy') {
        await this.detectTomcat();
      } else if (this.currentTab === 'docker') {
        await this.scanDockerJava();
      }
    } catch (e) {
      console.error('加载 Java 数据失败:', e);
    } finally {
      this.loading = false;
      this.renderContent();
    }
  }

  private async execSSH(command: string): Promise<string> {
    try {
      const result = await invoke('ssh_execute_command_direct', { command }) as any;
      return result?.output || '';
    } catch (e) {
      console.warn('SSH命令执行失败:', command, e);
      return '';
    }
  }

  // ──── Java 进程列表 ────

  async loadProcesses(): Promise<void> {
    // 使用 jps + ps 获取 Java 进程信息
    const jpsOutput = await this.execSSH(
      `(jps -lvm 2>/dev/null || ps aux | grep '[j]ava' | awk '{printf "%s %s\\n", $2, $11}') | head -50`
    );
    const psOutput = await this.execSSH(
      `ps aux | grep '[j]ava' | awk '{printf "%s|%s|%s|%s|%s\\n", $2, $1, $3, $4, $10}' | head -50`
    );

    const psMap = new Map<number, { user: string; cpu: string; mem: string; time: string }>();
    psOutput.split('\n').filter(Boolean).forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 5) {
        psMap.set(parseInt(parts[0]), {
          user: parts[1],
          cpu: parts[2],
          mem: parts[3],
          time: parts[4],
        });
      }
    });

    this.processes = [];
    jpsOutput.split('\n').filter(Boolean).forEach(line => {
      const match = line.match(/^(\d+)\s+(.+)/);
      if (!match) return;
      const pid = parseInt(match[1]);
      if (pid <= 1) return; // 排除 Jps 自身

      const fullLine = match[2];
      // 解析 main class (第一个非 - 开头的词)
      const parts = fullLine.split(/\s+/);
      let mainClass = parts[0] || 'unknown';
      // 简化 class 名
      if (mainClass.includes('.')) {
        mainClass = mainClass.split('.').pop() || mainClass;
      }

      const ps = psMap.get(pid);
      const jvmArgs = parts.slice(1).filter(p => p.startsWith('-')).join(' ');

      this.processes.push({
        pid,
        mainClass,
        jvmArgs: jvmArgs.substring(0, 200),
        classpath: '',
        user: ps?.user || 'unknown',
        cpuPercent: ps?.cpu || '0',
        memPercent: ps?.mem || '0',
        uptime: ps?.time || '-',
        javaVersion: '',
        heapUsed: '',
        heapMax: '',
      });
    });

    // 尝试获取 JVM 堆信息
    for (const proc of this.processes.slice(0, 10)) {
      try {
        const heapInfo = await this.execSSH(
          `jstat -gc ${proc.pid} 2>/dev/null | tail -1 | awk '{printf "%.0f|%.0f", ($3+$4+$6+$8)/1024, ($1+$2+$5+$7)/1024}'`
        );
        if (heapInfo && heapInfo.includes('|')) {
          const [used, max] = heapInfo.split('|');
          proc.heapUsed = `${used}MB`;
          proc.heapMax = `${max}MB`;
        }
      } catch { /* ignore */ }
    }
  }

  // ──── 进程操作 ────

  selectProcess(pid: number): void {
    this.selectedPid = pid;
    document.querySelectorAll('.jhu-process-row').forEach(row => {
      row.classList.toggle('selected', row.getAttribute('data-pid') === String(pid));
    });
  }

  async threadDump(pid: number): Promise<void> {
    this.showOutput('正在生成线程转储...');
    const output = await this.execSSH(`jstack ${pid} 2>&1 | head -500`);
    this.showOutput(output || '无法获取线程转储（可能缺少 jstack 或权限不足）');
  }

  async heapDump(pid: number): Promise<void> {
    const dumpPath = `/tmp/heapdump_${pid}_${Date.now()}.hprof`;
    this.showOutput(`正在生成堆转储到 ${dumpPath}...`);
    const output = await this.execSSH(`jmap -dump:format=b,file=${dumpPath} ${pid} 2>&1`);
    this.showOutput(output || '堆转储完成');
  }

  async runGC(pid: number): Promise<void> {
    const output = await this.execSSH(`jcmd ${pid} GC.run 2>&1`);
    this.showOutput(output || 'GC 触发完成');
    window.showNotification?.('GC 触发完成', 'success');
  }

  async killProcess(pid: number): Promise<void> {
    const output = await this.execSSH(`kill -9 ${pid} 2>&1 && echo "进程 ${pid} 已终止"`);
    this.showOutput(output);
    window.showNotification?.(`进程 ${pid} 已终止`, 'success');
    setTimeout(() => this.refresh(), 1000);
  }

  async gracefulStop(pid: number): Promise<void> {
    const output = await this.execSSH(`kill -15 ${pid} 2>&1 && echo "已发送 SIGTERM 到进程 ${pid}"`);
    this.showOutput(output);
    window.showNotification?.(`已发送停止信号`, 'success');
    setTimeout(() => this.refresh(), 2000);
  }

  // ──── 热更新 ────

  showHotSwapDialog(pid: number): void {
    const dialog = document.getElementById('jhu-output-panel');
    if (!dialog) return;
    dialog.innerHTML = `
      <div class="jhu-dialog">
        <h4>🔥 热更新 — PID ${pid}</h4>
        <div class="jhu-dialog-section">
          <h5>方式一：使用 Arthas 热更新</h5>
          <p class="jhu-hint">Arthas 是阿里巴巴开源的 Java 诊断工具，支持在线热替换 class 文件。</p>
          <div class="jhu-cmd-box">
            <code>curl -O https://arthas.aliyun.com/arthas-boot.jar && java -jar arthas-boot.jar ${pid}</code>
          </div>
          <p class="jhu-hint">进入 Arthas 后，使用 <code>redefine /path/to/MyClass.class</code> 替换类文件。</p>
        </div>
        <div class="jhu-dialog-section">
          <h5>方式二：使用 Instrumentation API</h5>
          <p class="jhu-hint">通过 JVM Attach API 替换类文件（需要 agent jar）：</p>
          <div class="jhu-cmd-box">
            <code>jcmd ${pid} VM.class_hierarchy 2>/dev/null | head -20</code>
          </div>
        </div>
        <div class="jhu-dialog-section">
          <h5>方式三：Spring Boot DevTools Remote</h5>
          <p class="jhu-hint">适用于 Spring Boot 应用，支持远程热重载：</p>
          <div class="jhu-cmd-box">
            <code># 在 application.properties 中启用:<br>spring.devtools.remote.secret=mysecret</code>
          </div>
        </div>
        <div class="jhu-dialog-actions">
          <button class="jhu-btn primary" data-jhu-action="arthas-attach" data-jhu-param="${pid}">一键安装 Arthas</button>
          <button class="jhu-btn secondary" data-jhu-action="class-decompile" data-jhu-param="${pid}">查看已加载类</button>
        </div>
      </div>
    `;
  }

  async arthasAttach(pid: number): Promise<void> {
    this.showOutput('正在下载并启动 Arthas...');
    const output = await this.execSSH(
      `if [ ! -f /tmp/arthas-boot.jar ]; then curl -sL -o /tmp/arthas-boot.jar https://arthas.aliyun.com/arthas-boot.jar 2>&1; fi && echo "Arthas 已准备就绪。请在终端中执行: java -jar /tmp/arthas-boot.jar ${pid}"`
    );
    this.showOutput(output);
  }

  async showDecompileDialog(pid: number): Promise<void> {
    this.showOutput('正在获取已加载类列表...');
    const output = await this.execSSH(`jcmd ${pid} VM.classloader_stats 2>/dev/null | head -30`);
    this.showOutput(output || '无法获取类信息（可能缺少 jcmd 或权限不足）');
  }

  // ──── jar uf 热更新 ────

  async jarList(jarPath: string): Promise<void> {
    if (!jarPath) {
      // 从输入框读取
      jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    }
    if (!jarPath) {
      window.showNotification?.('请输入 JAR 文件路径', 'warning');
      return;
    }
    this.showOutput(`正在列出 JAR 内容: ${jarPath}...`);
    const output = await this.execSSH(`jar tf "${jarPath}" 2>&1 | head -200`);
    this.showOutput(output || 'JAR 文件为空或路径无效');
  }

  async jarExtractClass(classPath: string): Promise<void> {
    if (!classPath) {
      classPath = (document.getElementById('jhu-class-name') as HTMLInputElement)?.value?.trim() || '';
    }
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    if (!jarPath || !classPath) {
      window.showNotification?.('请输入 JAR 路径和类路径', 'warning');
      return;
    }
    this.showOutput(`正在提取 class 文件: ${classPath}...`);
    const output = await this.execSSH(
      `cd /tmp && mkdir -p jhu_extract_${Date.now()} && cd $_ && jar xf "${jarPath}" "${classPath}" 2>&1 && echo "已提取到 $(pwd)/${classPath}" && ls -la "${classPath}" 2>/dev/null`
    );
    this.showOutput(output);
  }

  async jarUpdate(): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    const classPath = (document.getElementById('jhu-class-name') as HTMLInputElement)?.value?.trim() || '';
    const classFilePath = (document.getElementById('jhu-class-file') as HTMLInputElement)?.value?.trim() || '';
    if (!jarPath || !classPath) {
      window.showNotification?.('请填写 JAR 路径和类路径', 'warning');
      return;
    }
    const srcFile = classFilePath || classPath;
    this.showOutput(`正在执行 jar uf 更新...\nJAR: ${jarPath}\n类: ${classPath}\n源文件: ${srcFile}`);
    const output = await this.execSSH(
      `# 备份原始 JAR\ncp "${jarPath}" "${jarPath}.bak.$(date +%Y%m%d%H%M%S)" 2>&1 && echo "✅ 已备份原始 JAR" && \\\n# 执行 jar uf 更新\ncd /tmp && jar uf "${jarPath}" "${classPath}" 2>&1 && echo "✅ jar uf 更新成功: ${classPath}" || echo "❌ jar uf 更新失败"`
    );
    this.showOutput(output);
  }

  showJarUpdateGuide(jarPath: string): void {
    if (!jarPath) {
      jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '/path/to/app.jar';
    }
    const panel = document.getElementById('jhu-output-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="jhu-dialog">
        <h4>📦 jar uf 热更新完整流程</h4>
        <div class="jhu-dialog-section">
          <h5>步骤 1: 备份原始 JAR</h5>
          <div class="jhu-cmd-box"><code>cp ${this.escapeHtml(jarPath)} ${this.escapeHtml(jarPath)}.bak</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>步骤 2: 提取需要修改的 class</h5>
          <div class="jhu-cmd-box"><code>mkdir -p /tmp/jar_patch && cd /tmp/jar_patch
jar xf ${this.escapeHtml(jarPath)} com/example/MyClass.class</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>步骤 3: 反编译 → 修改 → 重新编译</h5>
          <div class="jhu-cmd-box"><code># 反编译查看（使用 javap 或 cfr）
javap -c -p com/example/MyClass.class

# 编写修改后的 .java 源文件，然后编译
# 注意：需要把原 JAR 加入 classpath
javac -cp ${this.escapeHtml(jarPath)} com/example/MyClass.java</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>步骤 4: 用 jar uf 替换 class 文件</h5>
          <div class="jhu-cmd-box"><code>cd /tmp/jar_patch
jar uf ${this.escapeHtml(jarPath)} com/example/MyClass.class</code></div>
          <p class="jhu-hint">⚠️ jar uf 会原地修改 JAR 文件，将指定的 class 文件更新到 JAR 中</p>
        </div>
        <div class="jhu-dialog-section">
          <h5>步骤 5: 重启应用使更新生效</h5>
          <div class="jhu-cmd-box"><code># 找到进程并重启
PID=$(pgrep -f "${this.escapeHtml(jarPath)}")
kill -15 $PID && sleep 2
nohup java -jar ${this.escapeHtml(jarPath)} > /dev/null 2>&1 &</code></div>
          <p class="jhu-hint">💡 如果使用 Spring Boot 的 devtools，文件变更会自动触发重载，无需手动重启</p>
        </div>
        <div class="jhu-dialog-section">
          <h5>步骤 6: 验证更新</h5>
          <div class="jhu-cmd-box"><code># 检查 JAR 中的 class 是否已更新
jar tf ${this.escapeHtml(jarPath)} | grep MyClass
# 对比新旧 JAR
diff <(jar tf ${this.escapeHtml(jarPath)}.bak | sort) <(jar tf ${this.escapeHtml(jarPath)} | sort)</code></div>
        </div>
      </div>
    `;
  }

  async jarBackup(jarPath: string): Promise<void> {
    if (!jarPath) {
      jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    }
    if (!jarPath) { window.showNotification?.('请输入 JAR 路径', 'warning'); return; }
    this.showOutput(`正在备份 ${jarPath}...`);
    const output = await this.execSSH(
      `cp "${jarPath}" "${jarPath}.bak.$(date +%Y%m%d%H%M%S)" 2>&1 && echo "✅ 备份完成: ${jarPath}.bak.$(date +%Y%m%d%H%M%S)" && ls -lh "${jarPath}"* | tail -5`
    );
    this.showOutput(output);
    window.showNotification?.('JAR 备份完成', 'success');
  }

  async browseJar(): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    if (!jarPath) { window.showNotification?.('请输入 JAR 路径', 'warning'); return; }
    this.showOutput(`正在分析 JAR 结构: ${jarPath}...`);
    const output = await this.execSSH(
      `echo "═══ JAR 基本信息 ═══" && ls -lh "${jarPath}" 2>&1 && echo "\\n═══ MANIFEST.MF ═══" && unzip -p "${jarPath}" META-INF/MANIFEST.MF 2>/dev/null | head -20 && echo "\\n═══ 目录结构（前 100 条）═══" && jar tf "${jarPath}" 2>/dev/null | head -100 && echo "\\n═══ class 文件统计 ═══" && jar tf "${jarPath}" 2>/dev/null | grep '\\.class$' | wc -l | xargs -I{} echo "{} 个 class 文件" && echo "\\n═══ 依赖 JAR（lib/）═══" && jar tf "${jarPath}" 2>/dev/null | grep 'BOOT-INF/lib/\\|lib/' | head -30`
    );
    this.showOutput(output);
  }

  async searchClassInJar(): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    const keyword = (document.getElementById('jhu-class-name') as HTMLInputElement)?.value?.trim() || '';
    if (!jarPath || !keyword) { window.showNotification?.('请输入 JAR 路径和类名关键字', 'warning'); return; }
    this.showOutput(`正在搜索: ${keyword}...`);
    const output = await this.execSSH(
      `jar tf "${jarPath}" 2>/dev/null | grep -i "${keyword}" | head -50`
    );
    this.showOutput(output || `未找到匹配 "${keyword}" 的文件`);
  }

  async jarDiff(): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim() || '';
    if (!jarPath) { window.showNotification?.('请输入 JAR 路径', 'warning'); return; }
    // 查找最近的备份
    this.showOutput('正在对比 JAR 与最新备份...');
    const output = await this.execSSH(
      `BACKUP=$(ls -t "${jarPath}".bak.* 2>/dev/null | head -1) && if [ -z "$BACKUP" ]; then echo "未找到备份文件"; else echo "对比: ${jarPath} vs $BACKUP" && echo "\\n═══ 文件大小对比 ═══" && ls -lh "${jarPath}" "$BACKUP" && echo "\\n═══ 内容差异（class 文件）═══" && diff <(jar tf "${jarPath}" | sort) <(jar tf "$BACKUP" | sort) | head -50 && echo "\\n═══ MD5 校验 ═══" && md5sum "${jarPath}" "$BACKUP"; fi`
    );
    this.showOutput(output);
  }

  // ──── 反编译 ────

  async decompileJavap(classRef: string): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim()
      || (document.getElementById('jhu-decompile-jar') as HTMLInputElement)?.value?.trim() || '';
    const className = classRef
      || (document.getElementById('jhu-decompile-class') as HTMLInputElement)?.value?.trim() || '';
    if (!className) { window.showNotification?.('请输入类名', 'warning'); return; }

    this.showOutput(`正在反编译（javap）: ${className}...`);
    let cmd: string;
    if (jarPath) {
      // 先提取再反编译
      cmd = `cd /tmp && mkdir -p jhu_dec && cd jhu_dec && jar xf "${jarPath}" "${className}" 2>/dev/null ; javap -c -p -s "${className}" 2>&1 | head -300`;
    } else {
      cmd = `javap -c -p -s "${className}" 2>&1 | head -300`;
    }
    const output = await this.execSSH(cmd);
    this.showOutput(output || 'javap 反编译失败（类名可能需要包含完整包路径，如 com/example/MyClass.class）');
  }

  async decompileCfr(classRef: string): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim()
      || (document.getElementById('jhu-decompile-jar') as HTMLInputElement)?.value?.trim() || '';
    const className = classRef
      || (document.getElementById('jhu-decompile-class') as HTMLInputElement)?.value?.trim() || '';

    if (!jarPath && !className) {
      window.showNotification?.('请输入 JAR 路径或类名', 'warning');
      return;
    }
    this.showOutput('正在使用 CFR 反编译...');

    // 检查 cfr 是否存在
    const cfrCheck = await this.execSSH('ls /tmp/cfr.jar 2>/dev/null && echo "EXISTS"');
    if (!cfrCheck.includes('EXISTS')) {
      this.showOutput('CFR 反编译器未安装。正在下载...');
      await this.installCfr();
      return;
    }

    let cmd: string;
    if (jarPath && className) {
      // 反编译 JAR 中指定的类
      const classNameDot = className.replace(/\//g, '.').replace(/\.class$/, '');
      cmd = `java -jar /tmp/cfr.jar "${jarPath}" --methodname "" 2>/dev/null | head -500 ; java -jar /tmp/cfr.jar "${jarPath}" "${classNameDot}" 2>&1 | head -500`;
    } else if (jarPath) {
      // 反编译整个 JAR（只显示前 500 行）
      cmd = `java -jar /tmp/cfr.jar "${jarPath}" 2>&1 | head -500`;
    } else {
      cmd = `java -jar /tmp/cfr.jar "${className}" 2>&1 | head -500`;
    }
    const output = await this.execSSH(cmd);
    this.showOutput(output || 'CFR 反编译失败');
  }

  async installCfr(): Promise<void> {
    this.showOutput('正在下载 CFR 反编译器...');
    const output = await this.execSSH(
      `curl -sL -o /tmp/cfr.jar "https://github.com/leibnitz27/cfr/releases/download/0.152/cfr-0.152.jar" 2>&1 && java -jar /tmp/cfr.jar --version 2>&1 && echo "\\n✅ CFR 反编译器安装完成 (/tmp/cfr.jar)"`
    );
    this.showOutput(output);
    window.showNotification?.('CFR 安装完成', 'success');
  }

  async decompileProcyon(): Promise<void> {
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim()
      || (document.getElementById('jhu-decompile-jar') as HTMLInputElement)?.value?.trim() || '';
    const className = (document.getElementById('jhu-decompile-class') as HTMLInputElement)?.value?.trim() || '';
    this.showOutput('正在使用 Procyon 反编译...');

    const procCheck = await this.execSSH('ls /tmp/procyon.jar 2>/dev/null && echo "EXISTS"');
    if (!procCheck.includes('EXISTS')) {
      this.showOutput('Procyon 反编译器未安装。正在下载...');
      await this.installProcyon();
      return;
    }

    let cmd: string;
    if (jarPath) {
      cmd = `java -jar /tmp/procyon.jar -jar "${jarPath}" ${className ? `"${className}"` : ''} 2>&1 | head -500`;
    } else if (className) {
      cmd = `java -jar /tmp/procyon.jar "${className}" 2>&1 | head -500`;
    } else {
      window.showNotification?.('请输入 JAR 路径或类文件路径', 'warning');
      return;
    }
    const output = await this.execSSH(cmd);
    this.showOutput(output || 'Procyon 反编译失败');
  }

  async installProcyon(): Promise<void> {
    this.showOutput('正在下载 Procyon 反编译器...');
    const output = await this.execSSH(
      `curl -sL -o /tmp/procyon.jar "https://github.com/mstrobel/procyon/releases/download/v0.6.0/procyon-decompiler-0.6.0.jar" 2>&1 && echo "\\n✅ Procyon 反编译器安装完成 (/tmp/procyon.jar)"`
    );
    this.showOutput(output);
    window.showNotification?.('Procyon 安装完成', 'success');
  }

  showCompileGuide(): void {
    const panel = document.getElementById('jhu-output-panel');
    if (!panel) return;
    const jarPath = (document.getElementById('jhu-jar-path') as HTMLInputElement)?.value?.trim()
      || (document.getElementById('jhu-decompile-jar') as HTMLInputElement)?.value?.trim()
      || '/path/to/app.jar';
    panel.innerHTML = `
      <div class="jhu-dialog">
        <h4>🔨 重新编译 Class 文件</h4>
        <div class="jhu-dialog-section">
          <h5>1. 准备工作目录</h5>
          <div class="jhu-cmd-box"><code>mkdir -p /tmp/jar_patch && cd /tmp/jar_patch</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>2. 从 JAR 提取原始 class</h5>
          <div class="jhu-cmd-box"><code>jar xf ${this.escapeHtml(jarPath)} com/example/MyClass.class</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>3. 反编译为 .java 源文件</h5>
          <div class="jhu-cmd-box"><code># 使用 CFR（推荐，输出可直接编译）
java -jar /tmp/cfr.jar com/example/MyClass.class > com/example/MyClass.java

# 或使用 javap（仅查看字节码，不能直接编译）
javap -c -p com/example/MyClass.class</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>4. 修改 .java 源文件</h5>
          <div class="jhu-cmd-box"><code>vi com/example/MyClass.java
# 或使用 sed 进行批量替换
# sed -i 's/oldMethod/newMethod/g' com/example/MyClass.java</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>5. 重新编译（需要原 JAR 作为 classpath）</h5>
          <div class="jhu-cmd-box"><code>javac -cp ${this.escapeHtml(jarPath)} -d . com/example/MyClass.java</code></div>
          <p class="jhu-hint">⚠️ 如果是 Spring Boot fat jar，需要指定 BOOT-INF/classes 和 BOOT-INF/lib 下的依赖</p>
          <div class="jhu-cmd-box"><code># Spring Boot fat jar 编译
LIBS=$(jar tf ${this.escapeHtml(jarPath)} | grep 'BOOT-INF/lib/' | sed 's|^|${this.escapeHtml(jarPath)}!/|' | tr '\\n' ':')
javac -cp "$LIBS" -d . com/example/MyClass.java</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>6. 更新到 JAR（jar uf）</h5>
          <div class="jhu-cmd-box"><code>jar uf ${this.escapeHtml(jarPath)} com/example/MyClass.class</code></div>
        </div>
        <div class="jhu-dialog-section">
          <h5>7. 验证 & 重启</h5>
          <div class="jhu-cmd-box"><code># 验证 class 已更新
jar tf ${this.escapeHtml(jarPath)} | grep MyClass

# 重启应用
PID=$(pgrep -f "${this.escapeHtml(jarPath)}")
[ -n "$PID" ] && kill -15 $PID && sleep 2
nohup java -jar ${this.escapeHtml(jarPath)} &</code></div>
        </div>
      </div>
    `;
  }

  // ──── JVM 诊断 ────

  async showJvmInfo(pid: number): Promise<void> {
    this.showOutput('正在收集 JVM 信息...');
    const commands = [
      `echo "═══ JVM 版本 ═══" && jcmd ${pid} VM.version 2>/dev/null`,
      `echo "\\n═══ JVM 参数 ═══" && jcmd ${pid} VM.flags 2>/dev/null | head -20`,
      `echo "\\n═══ 系统属性 ═══" && jcmd ${pid} VM.system_properties 2>/dev/null | grep -E 'java\\.version|java\\.home|os\\.' | head -10`,
      `echo "\\n═══ 线程信息 ═══" && jcmd ${pid} Thread.print 2>/dev/null | head -5`,
      `echo "\\n═══ GC 统计 ═══" && jstat -gcutil ${pid} 2>/dev/null | head -2`,
    ];
    const output = await this.execSSH(commands.join(' ; '));
    this.showOutput(output || '无法获取 JVM 信息');
  }

  // ──── 服务管理 ────

  async detectServices(): Promise<void> {
    this.services = [];

    // 检测 systemd 中的 Java 服务
    const systemdOutput = await this.execSSH(
      `systemctl list-units --type=service --all 2>/dev/null | grep -iE 'java|tomcat|spring|jenkins|elasticsearch|kafka|zookeeper|nexus|sonar|maven|gradle|wildfly|jboss|jetty|flink|hadoop|hbase|spark' | awk '{print $1, $3, $4}' | head -20`
    );
    systemdOutput.split('\n').filter(Boolean).forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        this.services.push({
          name: parts[0].replace('.service', ''),
          type: 'systemd',
          status: parts[2] === 'running' ? 'running' : 'stopped',
        });
      }
    });

    // 检测独立运行的 JAR
    const jarOutput = await this.execSSH(
      `ps aux | grep '[j]ava.*\\.jar' | awk '{for(i=11;i<=NF;i++) if($i ~ /\\.jar$/) {print $2"|"$i; break}}' | head -10`
    );
    jarOutput.split('\n').filter(Boolean).forEach(line => {
      const [pid, jar] = line.split('|');
      if (pid && jar) {
        this.services.push({
          name: jar.split('/').pop() || jar,
          type: 'jar',
          status: 'running',
          pid: parseInt(pid),
          path: jar,
        });
      }
    });

    this.renderContent();
  }

  async restartService(name: string): Promise<void> {
    this.showOutput(`正在重启服务 ${name}...`);
    const output = await this.execSSH(`sudo systemctl restart ${name} 2>&1 && systemctl status ${name} --no-pager 2>&1 | head -15`);
    this.showOutput(output);
    window.showNotification?.(`服务 ${name} 已重启`, 'success');
    setTimeout(() => this.detectServices(), 1500);
  }

  async stopService(name: string): Promise<void> {
    const output = await this.execSSH(`sudo systemctl stop ${name} 2>&1 && echo "服务 ${name} 已停止"`);
    this.showOutput(output);
    setTimeout(() => this.detectServices(), 1000);
  }

  async startService(name: string): Promise<void> {
    const output = await this.execSSH(`sudo systemctl start ${name} 2>&1 && echo "服务 ${name} 已启动"`);
    this.showOutput(output);
    setTimeout(() => this.detectServices(), 1000);
  }

  // ──── 部署管理 ────

  async detectTomcat(): Promise<void> {
    this.deployTargets = [];
    const tomcatOutput = await this.execSSH(
      `for d in /opt/tomcat* /usr/share/tomcat* /var/lib/tomcat* /home/*/tomcat* $CATALINA_HOME 2>/dev/null; do [ -d "$d/webapps" ] && echo "$d"; done | head -5`
    );
    tomcatOutput.split('\n').filter(Boolean).forEach(path => {
      this.deployTargets.push({
        name: path.split('/').pop() || 'Tomcat',
        type: 'tomcat',
        basePath: path,
        webappsDir: `${path}/webapps`,
        status: 'unknown',
      });
    });

    // 检测运行中的 Spring Boot JAR
    const springOutput = await this.execSSH(
      `ps aux | grep '[j]ava.*spring-boot\\|[j]ava.*-jar' | awk '{for(i=11;i<=NF;i++) if($i ~ /\\.jar$/) print $i}' | head -5`
    );
    springOutput.split('\n').filter(Boolean).forEach(jar => {
      this.deployTargets.push({
        name: jar.split('/').pop() || 'SpringBoot App',
        type: 'springboot',
        basePath: jar.substring(0, jar.lastIndexOf('/')),
        status: 'running',
      });
    });

    this.renderContent();
  }

  showDeployDialog(type: 'jar' | 'war'): void {
    const panel = document.getElementById('jhu-output-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="jhu-dialog">
        <h4>📦 部署 ${type.toUpperCase()} 文件</h4>
        <div class="jhu-dialog-section">
          <h5>操作步骤</h5>
          <ol class="jhu-steps">
            <li>通过 SFTP 上传 ${type.toUpperCase()} 文件到目标服务器</li>
            <li>使用下方命令部署:</li>
          </ol>
          ${type === 'war' ? `
          <div class="jhu-cmd-box">
            <code># 部署 WAR 到 Tomcat<br>
cp /path/to/app.war $CATALINA_HOME/webapps/<br>
# 或者重新部署<br>
rm -rf $CATALINA_HOME/webapps/app && cp /path/to/app.war $CATALINA_HOME/webapps/</code>
          </div>` : `
          <div class="jhu-cmd-box">
            <code># 停止旧版本<br>
kill -15 $(pgrep -f 'java.*myapp.jar')<br>
# 备份旧版本<br>
cp /opt/myapp/app.jar /opt/myapp/app.jar.bak<br>
# 部署新版本<br>
cp /path/to/new-app.jar /opt/myapp/app.jar<br>
# 启动<br>
nohup java -jar /opt/myapp/app.jar > /opt/myapp/app.log 2>&1 &</code>
          </div>`}
        </div>
        <p class="jhu-hint">💡 提示：建议先在 SFTP 页面上传文件，再回到此处执行部署命令。</p>
      </div>
    `;
  }

  // ──── 环境信息 ────

  async showEnvInfo(): Promise<void> {
    this.showOutput('正在检测 Java 环境...');
    const output = await this.execSSH(
      `echo "═══ Java 版本 ═══" && java -version 2>&1 && echo "\\n═══ JAVA_HOME ═══" && echo $JAVA_HOME && echo "\\n═══ JDK 工具 ═══" && which jps jstack jmap jstat jcmd 2>&1 && echo "\\n═══ Maven ═══" && mvn -v 2>/dev/null | head -3 && echo "\\n═══ Gradle ═══" && gradle -v 2>/dev/null | head -3 && echo "\\n═══ 环境变量 ═══" && env | grep -iE 'java|jdk|jre|maven|gradle|catalina|tomcat' 2>/dev/null | head -15`
    );
    this.showOutput(output || '未检测到 Java 环境');
  }

  // ──── UI 辅助 ────

  private showOutput(text: string): void {
    const panel = document.getElementById('jhu-output-panel');
    if (panel) {
      panel.innerHTML = `<pre class="jhu-output-pre">${this.escapeHtml(text)}</pre>`;
    }
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ──── 渲染 ────

  renderContent(): void {
    const content = document.getElementById('jhu-content');
    if (!content) return;

    if (!sshConnectionManager.isConnected()) {
      content.innerHTML = '<div class="jhu-empty">请先连接服务器</div>';
      return;
    }

    if (this.loading) {
      content.innerHTML = '<div class="jhu-loading"><div class="jhu-spinner"></div>正在扫描 Java 进程...</div>';
      return;
    }

    switch (this.currentTab) {
      case 'processes':
        content.innerHTML = this.renderProcessesTab();
        break;
      case 'hotupdate':
        content.innerHTML = this.renderHotUpdateTab();
        break;
      case 'diagnostics':
        content.innerHTML = this.renderDiagnosticsTab();
        break;
      case 'services':
        content.innerHTML = this.renderServicesTab();
        break;
      case 'deploy':
        content.innerHTML = this.renderDeployTab();
        break;
      case 'docker':
        content.innerHTML = this.renderDockerTab();
        break;
    }
  }

  private renderProcessesTab(): string {
    if (this.processes.length === 0) {
      return `
        <div class="jhu-empty">
          <div class="jhu-empty-icon">☕</div>
          <p>未检测到 Java 进程</p>
          <button class="jhu-btn primary" data-jhu-action="scan-processes">重新扫描</button>
          <button class="jhu-btn secondary" data-jhu-action="env-info">检测 Java 环境</button>
        </div>
        <div id="jhu-output-panel" class="jhu-output-panel"></div>
      `;
    }

    const rows = this.processes.map(p => `
      <tr class="jhu-process-row ${this.selectedPid === p.pid ? 'selected' : ''}" data-pid="${p.pid}"
          data-jhu-action="select-process" data-jhu-param="${p.pid}">
        <td class="jhu-cell-pid">${p.pid}</td>
        <td class="jhu-cell-class" title="${this.escapeHtml(p.jvmArgs)}">${this.escapeHtml(p.mainClass)}</td>
        <td class="jhu-cell-user">${p.user}</td>
        <td class="jhu-cell-cpu">${p.cpuPercent}%</td>
        <td class="jhu-cell-mem">${p.memPercent}%</td>
        <td class="jhu-cell-heap">${p.heapUsed || '-'} / ${p.heapMax || '-'}</td>
        <td class="jhu-cell-actions">
          <button class="jhu-action-btn" data-jhu-action="jvm-info" data-jhu-param="${p.pid}" title="JVM详情">📋</button>
          <button class="jhu-action-btn" data-jhu-action="thread-dump" data-jhu-param="${p.pid}" title="线程转储">🧵</button>
          <button class="jhu-action-btn" data-jhu-action="hot-swap" data-jhu-param="${p.pid}" title="热更新">🔥</button>
          <button class="jhu-action-btn danger" data-jhu-action="graceful-stop" data-jhu-param="${p.pid}" title="优雅停止">⏹</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="jhu-table-wrapper">
        <table class="jhu-table">
          <thead>
            <tr>
              <th>PID</th><th>主类</th><th>用户</th><th>CPU</th><th>内存</th><th>堆</th><th>操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  private renderHotUpdateTab(): string {
    const pidOptions = this.processes.length > 0
      ? this.processes.map(p => `<option value="${p.pid}">${p.pid} — ${this.escapeHtml(p.mainClass)}</option>`).join('')
      : '<option value="">无 Java 进程</option>';

    return `
      <!-- ═══ jar uf 热更新工作台 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header"><h4>📦 JAR 热更新工作台（jar uf）</h4></div>
        <div class="jhu-form-row">
          <label>JAR 路径</label>
          <input id="jhu-jar-path" class="jhu-input" placeholder="/opt/app/myapp.jar" />
          <button class="jhu-btn secondary" data-jhu-action="browse-jar">浏览 JAR</button>
          <button class="jhu-btn secondary" data-jhu-action="jar-list" data-jhu-param="">列出内容</button>
          <button class="jhu-btn secondary" data-jhu-action="jar-backup" data-jhu-param="">备份</button>
        </div>
        <div class="jhu-form-row">
          <label>Class 路径</label>
          <input id="jhu-class-name" class="jhu-input" placeholder="com/example/MyClass.class（在 JAR 内的路径）" />
          <button class="jhu-btn secondary" data-jhu-action="search-class-in-jar">搜索类</button>
          <button class="jhu-btn secondary" data-jhu-action="jar-extract-class" data-jhu-param="">提取</button>
        </div>
        <div class="jhu-form-row">
          <label>新 Class 文件</label>
          <input id="jhu-class-file" class="jhu-input" placeholder="/tmp/jar_patch/com/example/MyClass.class（编译后的新文件）" />
          <button class="jhu-btn primary" data-jhu-action="jar-update">执行 jar uf</button>
        </div>
        <div class="jhu-form-actions">
          <button class="jhu-btn secondary" data-jhu-action="jar-update-guide" data-jhu-param="">完整流程向导</button>
          <button class="jhu-btn secondary" data-jhu-action="compile-class">编译指南</button>
          <button class="jhu-btn secondary" data-jhu-action="jar-diff">对比备份</button>
        </div>
      </div>

      <!-- ═══ 反编译工具 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header"><h4>🔍 反编译工具</h4></div>
        <div class="jhu-form-row">
          <label>目标 JAR</label>
          <input id="jhu-decompile-jar" class="jhu-input" placeholder="可复用上方 JAR 路径，或单独指定" />
        </div>
        <div class="jhu-form-row">
          <label>类名 / Class 文件</label>
          <input id="jhu-decompile-class" class="jhu-input" placeholder="com/example/MyClass.class 或 com.example.MyClass" />
        </div>
        <div class="jhu-cards">
          <div class="jhu-card compact">
            <div class="jhu-card-icon">📋</div>
            <h5>javap（JDK 自带）</h5>
            <p>查看字节码指令、方法签名、常量池。适合快速分析。</p>
            <button class="jhu-btn primary" data-jhu-action="decompile-javap" data-jhu-param="">javap -c -p</button>
          </div>
          <div class="jhu-card compact">
            <div class="jhu-card-icon">🔬</div>
            <h5>CFR（推荐）</h5>
            <p>高质量 Java 反编译器，输出接近原始源码，支持 Java 8-21 语法。</p>
            <div class="jhu-card-btn-group">
              <button class="jhu-btn primary" data-jhu-action="decompile-cfr" data-jhu-param="">反编译</button>
              <button class="jhu-btn secondary" data-jhu-action="install-cfr">安装 CFR</button>
            </div>
          </div>
          <div class="jhu-card compact">
            <div class="jhu-card-icon">🧪</div>
            <h5>Procyon</h5>
            <p>另一款高质量反编译器，对泛型和 lambda 支持较好。</p>
            <div class="jhu-card-btn-group">
              <button class="jhu-btn primary" data-jhu-action="decompile-procyon">反编译</button>
              <button class="jhu-btn secondary" data-jhu-action="install-procyon">安装 Procyon</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 运行时热替换 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header">
          <h4>⚡ 运行时热替换（不停机）</h4>
          <select id="jhu-target-pid" class="jhu-select">${pidOptions}</select>
        </div>
        <div class="jhu-cards">
          <div class="jhu-card compact">
            <div class="jhu-card-icon">🔧</div>
            <h5>Arthas redefine</h5>
            <p>阿里开源诊断工具，<code>redefine</code> 命令可运行时替换已加载的 class，无需重启 JVM。</p>
            <button class="jhu-btn primary" onclick="
              var pid = document.getElementById('jhu-target-pid')?.value;
              if(pid) this.setAttribute('data-jhu-param', pid);
            " data-jhu-action="arthas-attach" data-jhu-param="${this.processes[0]?.pid || ''}">安装 Arthas</button>
          </div>
          <div class="jhu-card compact">
            <div class="jhu-card-icon">🔥</div>
            <h5>Instrumentation API</h5>
            <p>通过 JVM Attach + <code>retransformClasses()</code> 实现热替换，需要 agent jar。</p>
            <button class="jhu-btn primary" onclick="
              var pid = document.getElementById('jhu-target-pid')?.value;
              if(pid) this.setAttribute('data-jhu-param', pid);
            " data-jhu-action="hot-swap" data-jhu-param="${this.processes[0]?.pid || ''}">热替换向导</button>
          </div>
          <div class="jhu-card compact">
            <div class="jhu-card-icon">🔄</div>
            <h5>Spring DevTools</h5>
            <p>Spring Boot DevTools 自动检测 classpath 变更并热重载。</p>
            <div class="jhu-cmd-box"><code>&lt;!-- pom.xml --&gt;
&lt;dependency&gt;
  &lt;groupId&gt;org.springframework.boot&lt;/groupId&gt;
  &lt;artifactId&gt;spring-boot-devtools&lt;/artifactId&gt;
&lt;/dependency&gt;</code></div>
          </div>
        </div>
      </div>

      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  private renderDiagnosticsTab(): string {
    if (this.processes.length === 0) {
      return '<div class="jhu-empty">暂无 Java 进程，请先扫描进程列表</div>';
    }
    const options = this.processes.map(p =>
      `<option value="${p.pid}">${p.pid} — ${this.escapeHtml(p.mainClass)}</option>`
    ).join('');

    return `
      <div class="jhu-section">
        <div class="jhu-section-header">
          <h4>JVM 诊断工具</h4>
          <select id="jhu-diag-pid" class="jhu-select">${options}</select>
        </div>

        <div class="jhu-tool-grid">
          <button class="jhu-tool-btn" onclick="
            var pid = document.getElementById('jhu-diag-pid')?.value;
            if(pid) this.setAttribute('data-jhu-param', pid);
          " data-jhu-action="thread-dump" data-jhu-param="${this.processes[0]?.pid}">
            <span class="jhu-tool-icon">🧵</span>
            <span>线程转储</span>
            <small>jstack</small>
          </button>
          <button class="jhu-tool-btn" onclick="
            var pid = document.getElementById('jhu-diag-pid')?.value;
            if(pid) this.setAttribute('data-jhu-param', pid);
          " data-jhu-action="heap-dump" data-jhu-param="${this.processes[0]?.pid}">
            <span class="jhu-tool-icon">💾</span>
            <span>堆转储</span>
            <small>jmap</small>
          </button>
          <button class="jhu-tool-btn" onclick="
            var pid = document.getElementById('jhu-diag-pid')?.value;
            if(pid) this.setAttribute('data-jhu-param', pid);
          " data-jhu-action="gc-run" data-jhu-param="${this.processes[0]?.pid}">
            <span class="jhu-tool-icon">♻️</span>
            <span>触发 GC</span>
            <small>jcmd GC.run</small>
          </button>
          <button class="jhu-tool-btn" onclick="
            var pid = document.getElementById('jhu-diag-pid')?.value;
            if(pid) this.setAttribute('data-jhu-param', pid);
          " data-jhu-action="jvm-info" data-jhu-param="${this.processes[0]?.pid}">
            <span class="jhu-tool-icon">📊</span>
            <span>JVM 详情</span>
            <small>jcmd VM</small>
          </button>
          <button class="jhu-tool-btn" data-jhu-action="env-info">
            <span class="jhu-tool-icon">🌍</span>
            <span>Java 环境</span>
            <small>java -version</small>
          </button>
        </div>
      </div>
      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  private renderServicesTab(): string {
    if (this.services.length === 0) {
      return `
        <div class="jhu-empty">
          <p>未检测到 Java 相关服务</p>
          <button class="jhu-btn primary" data-jhu-action="detect-services">检测服务</button>
        </div>
        <div id="jhu-output-panel" class="jhu-output-panel"></div>
      `;
    }

    const rows = this.services.map(s => `
      <tr>
        <td><span class="jhu-status-dot ${s.status}"></span>${this.escapeHtml(s.name)}</td>
        <td><span class="jhu-tag">${s.type}</span></td>
        <td><span class="jhu-status-badge ${s.status}">${s.status === 'running' ? '运行中' : '已停止'}</span></td>
        <td>${s.pid || '-'}</td>
        <td class="jhu-cell-actions">
          ${s.type === 'systemd' ? `
            <button class="jhu-action-btn" data-jhu-action="restart-service" data-jhu-param="${s.name}" title="重启">🔄</button>
            <button class="jhu-action-btn" data-jhu-action="${s.status === 'running' ? 'stop' : 'start'}-service" data-jhu-param="${s.name}" title="${s.status === 'running' ? '停止' : '启动'}">${s.status === 'running' ? '⏹' : '▶️'}</button>
          ` : `
            ${s.pid ? `<button class="jhu-action-btn danger" data-jhu-action="graceful-stop" data-jhu-param="${s.pid}" title="停止">⏹</button>` : ''}
          `}
        </td>
      </tr>
    `).join('');

    return `
      <div class="jhu-section">
        <div class="jhu-section-header">
          <h4>Java 服务列表</h4>
          <button class="jhu-btn secondary" data-jhu-action="detect-services">刷新</button>
        </div>
        <table class="jhu-table">
          <thead><tr><th>服务名</th><th>类型</th><th>状态</th><th>PID</th><th>操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  private renderDeployTab(): string {
    const targets = this.deployTargets.length > 0
      ? this.deployTargets.map(t => `
        <div class="jhu-deploy-card">
          <div class="jhu-deploy-icon">${t.type === 'tomcat' ? '🐱' : '🍃'}</div>
          <div class="jhu-deploy-info">
            <h5>${this.escapeHtml(t.name)}</h5>
            <small>${this.escapeHtml(t.basePath)}</small>
          </div>
          <span class="jhu-status-badge ${t.status}">${t.status === 'running' ? '运行中' : t.status}</span>
        </div>
      `).join('')
      : '<p class="jhu-hint">未检测到 Tomcat 或 Spring Boot 部署实例</p>';

    return `
      <div class="jhu-section">
        <div class="jhu-section-header">
          <h4>部署目标</h4>
          <button class="jhu-btn secondary" data-jhu-action="detect-tomcat">检测</button>
        </div>
        ${targets}
      </div>

      <div class="jhu-section">
        <div class="jhu-section-header"><h4>部署操作</h4></div>
        <div class="jhu-cards">
          <div class="jhu-card compact">
            <div class="jhu-card-icon">📦</div>
            <h5>部署 WAR</h5>
            <p>上传 WAR 文件到 Tomcat webapps 目录</p>
            <button class="jhu-btn primary" data-jhu-action="deploy-war">WAR 部署向导</button>
          </div>
          <div class="jhu-card compact">
            <div class="jhu-card-icon">☕</div>
            <h5>部署 JAR</h5>
            <p>替换 JAR 并重启 Java 应用</p>
            <button class="jhu-btn primary" data-jhu-action="deploy-jar">JAR 部署向导</button>
          </div>
        </div>
      </div>
      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  // ════════════════════════════════════════════════════
  // Docker 容器 Java 热更新
  // ════════════════════════════════════════════════════

  private async dockerExec(containerId: string, cmd: string): Promise<string> {
    return this.execSSH(`docker exec ${containerId} sh -c '${cmd.replace(/'/g, "'\\''")}'`);
  }

  private getSelectedContainerId(): string {
    return (document.getElementById('jhu-docker-container') as HTMLSelectElement)?.value
      || this.selectedContainer || '';
  }

  private getDockerJarPath(): string {
    return (document.getElementById('jhu-docker-jar') as HTMLInputElement)?.value?.trim() || '';
  }

  private getDockerClassName(): string {
    return (document.getElementById('jhu-docker-class') as HTMLInputElement)?.value?.trim() || '';
  }

  selectContainer(id: string): void {
    this.selectedContainer = id;
    // 自动扫描该容器内的 Java 进程和 JAR
    this.dockerScanContainer(id);
  }

  async scanDockerJava(): Promise<void> {
    this.dockerContainers = [];
    const raw = await this.execSSH(
      `docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null`
    );
    if (!raw.trim()) {
      this.renderContent();
      return;
    }

    const containers = raw.split('\n').filter(Boolean);
    for (const line of containers.slice(0, 20)) {
      const [id, name, image, status] = line.split('|');
      if (!id) continue;
      // 检测容器内是否有 Java
      const javaCheck = await this.execSSH(
        `docker exec ${id} sh -c 'which java 2>/dev/null || ls /usr/bin/java 2>/dev/null || ls /opt/java*/bin/java 2>/dev/null' 2>/dev/null | head -1`
      );
      const hasJava = javaCheck.trim().length > 0;
      // 检测容器内是否有运行的 Java 进程
      const javaProc = await this.execSSH(
        `docker exec ${id} sh -c 'ps aux 2>/dev/null | grep "[j]ava" | head -1' 2>/dev/null`
      );
      if (hasJava || javaProc.trim()) {
        // 扫描 JAR 文件
        const jarScan = await this.execSSH(
          `docker exec ${id} sh -c 'find / -maxdepth 4 -name "*.jar" -type f 2>/dev/null | grep -v "/proc/" | head -10' 2>/dev/null`
        );
        const jars = jarScan.split('\n').filter(Boolean);
        // Java 版本
        const jv = await this.execSSH(
          `docker exec ${id} sh -c 'java -version 2>&1 | head -1' 2>/dev/null`
        );
        // PID
        const pidStr = await this.execSSH(
          `docker exec ${id} sh -c 'pgrep -f java | head -1' 2>/dev/null`
        );
        this.dockerContainers.push({
          id: id.substring(0, 12),
          name: name || id.substring(0, 12),
          image: image || '',
          status: status || '',
          javaVersion: jv.trim().substring(0, 60),
          jars,
          pid: parseInt(pidStr) || undefined,
        });
      }
    }
    this.renderContent();
  }

  private async dockerScanContainer(containerId: string): Promise<void> {
    this.showOutput('正在扫描容器内的 Java 信息...');
    const output = await this.execSSH(
      `echo "=== Java Version ===" && docker exec ${containerId} java -version 2>&1 && echo "\\n=== Java Processes ===" && docker exec ${containerId} ps aux 2>/dev/null | grep '[j]ava' && echo "\\n=== JAR Files ===" && docker exec ${containerId} find / -maxdepth 5 -name '*.jar' -type f 2>/dev/null | grep -v /proc/ | head -20 && echo "\\n=== JDK Tools ===" && docker exec ${containerId} sh -c 'which jps jstack jmap javap jar 2>/dev/null'`
    );
    this.showOutput(output || '该容器内无 Java 环境信息');
  }

  async dockerJarList(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    if (!cid || !jar) { window.showNotification?.('请选择容器并输入 JAR 路径', 'warning'); return; }
    this.showOutput(`正在列出容器 ${cid} 内 JAR 内容...`);
    const output = await this.dockerExec(cid, `jar tf "${jar}" 2>&1 | head -200`);
    this.showOutput(output || 'JAR 文件不存在或无法读取');
  }

  async dockerJarBrowse(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    if (!cid || !jar) { window.showNotification?.('请选择容器并输入 JAR 路径', 'warning'); return; }
    this.showOutput(`正在分析容器内 JAR 结构...`);
    const output = await this.dockerExec(cid,
      `echo "=== JAR Info ===" && ls -lh "${jar}" 2>&1 && echo "\\n=== MANIFEST ===" && unzip -p "${jar}" META-INF/MANIFEST.MF 2>/dev/null | head -20 && echo "\\n=== Class Count ===" && jar tf "${jar}" 2>/dev/null | grep "\\.class$" | wc -l | xargs -I{} echo "{} class files" && echo "\\n=== Structure (top 80) ===" && jar tf "${jar}" 2>/dev/null | head -80`
    );
    this.showOutput(output);
  }

  async dockerJarExtractToHost(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    const cls = this.getDockerClassName();
    if (!cid || !jar) { window.showNotification?.('请选择容器并输入 JAR 路径', 'warning'); return; }
    const ts = Date.now();
    this.showOutput('正在从容器提取文件到宿主机...');

    if (cls) {
      // 先在容器内提取 class，再 docker cp 到宿主机
      const output = await this.execSSH(
        `docker exec ${cid} sh -c 'mkdir -p /tmp/jhu_${ts} && cd /tmp/jhu_${ts} && jar xf "${jar}" "${cls}" 2>&1 && echo "容器内提取完成"' && mkdir -p /tmp/jhu_docker_${ts} && docker cp ${cid}:/tmp/jhu_${ts}/. /tmp/jhu_docker_${ts}/ 2>&1 && echo "已复制到宿主机: /tmp/jhu_docker_${ts}/" && ls -la /tmp/jhu_docker_${ts}/${cls} 2>/dev/null`
      );
      this.showOutput(output);
    } else {
      // 整个 JAR 复制到宿主机
      const output = await this.execSSH(
        `mkdir -p /tmp/jhu_docker_${ts} && docker cp ${cid}:${jar} /tmp/jhu_docker_${ts}/ 2>&1 && echo "已复制到宿主机: /tmp/jhu_docker_${ts}/" && ls -lh /tmp/jhu_docker_${ts}/`
      );
      this.showOutput(output);
    }
  }

  async dockerJarUpdate(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    const cls = this.getDockerClassName();
    const hostFile = (document.getElementById('jhu-docker-host-file') as HTMLInputElement)?.value?.trim() || '';
    if (!cid || !jar || !cls) { window.showNotification?.('请填写容器、JAR路径、Class路径', 'warning'); return; }
    const ts = Date.now();

    this.showOutput('正在执行 Docker 内 jar uf 更新...');
    let cmd: string;

    if (hostFile) {
      // 宿主机上有编译好的 class，先 docker cp 进容器，再 jar uf
      cmd = `echo "1. 备份容器内原始 JAR..." && docker exec ${cid} cp "${jar}" "${jar}.bak.${ts}" 2>&1 && echo "2. 复制新 class 到容器..." && docker cp ${hostFile} ${cid}:/tmp/jhu_patch_${ts}.class 2>&1 && echo "3. 在容器内执行 jar uf..." && docker exec ${cid} sh -c 'mkdir -p /tmp/jhu_work_${ts} && cd /tmp/jhu_work_${ts} && mkdir -p $(dirname "${cls}") && cp /tmp/jhu_patch_${ts}.class "${cls}" && jar uf "${jar}" "${cls}" 2>&1' && echo "=== jar uf 完成 ==="`;
    } else {
      // 直接在容器内操作（class 已经在容器内）
      cmd = `echo "1. 备份容器内原始 JAR..." && docker exec ${cid} cp "${jar}" "${jar}.bak.${ts}" 2>&1 && echo "2. 在容器内执行 jar uf..." && docker exec ${cid} sh -c 'cd /tmp && jar uf "${jar}" "${cls}" 2>&1' && echo "=== jar uf 完成 ==="`;
    }

    const output = await this.execSSH(cmd);
    this.showOutput(output);
  }

  async dockerJarBackup(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    if (!cid || !jar) { window.showNotification?.('请选择容器并输入 JAR 路径', 'warning'); return; }
    this.showOutput('正在备份容器内 JAR...');
    const ts = Date.now();
    // 同时备份到容器内和宿主机
    const output = await this.execSSH(
      `echo "=== 容器内备份 ===" && docker exec ${cid} cp "${jar}" "${jar}.bak.${ts}" 2>&1 && docker exec ${cid} ls -lh "${jar}"* 2>/dev/null | tail -5 && echo "\\n=== 复制到宿主机 ===" && mkdir -p /tmp/jhu_backups && docker cp ${cid}:${jar} /tmp/jhu_backups/$(basename ${jar}).bak.${ts} 2>&1 && ls -lh /tmp/jhu_backups/ | tail -5`
    );
    this.showOutput(output);
    window.showNotification?.('JAR 备份完成(容器内+宿主机)', 'success');
  }

  async dockerClassSearch(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    const cls = this.getDockerClassName();
    if (!cid || !jar || !cls) { window.showNotification?.('请填写容器、JAR路径、类名关键字', 'warning'); return; }
    this.showOutput(`正在容器内搜索: ${cls}...`);
    const output = await this.dockerExec(cid, `jar tf "${jar}" 2>/dev/null | grep -i "${cls}" | head -50`);
    this.showOutput(output || `未找到匹配 "${cls}" 的文件`);
  }

  async dockerDecompile(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const jar = this.getDockerJarPath();
    const cls = this.getDockerClassName();
    if (!cid || !jar || !cls) { window.showNotification?.('请填写容器、JAR路径、类路径', 'warning'); return; }
    this.showOutput('正在容器内反编译...');
    // 先提取 class 再 javap
    const output = await this.dockerExec(cid,
      `cd /tmp && mkdir -p jhu_dec && cd jhu_dec && jar xf "${jar}" "${cls}" 2>/dev/null && javap -c -p "${cls}" 2>&1 | head -300`
    );
    if (output.trim()) {
      this.showOutput(output);
    } else {
      // javap 失败, 尝试直接将文件复制到宿主机用 CFR
      this.showOutput('容器内 javap 不可用，尝试复制到宿主机反编译...');
      const ts = Date.now();
      const out2 = await this.execSSH(
        `docker exec ${cid} sh -c 'cd /tmp && mkdir -p jhu_dec_${ts} && cd jhu_dec_${ts} && jar xf "${jar}" "${cls}" 2>/dev/null' && mkdir -p /tmp/jhu_dec_host_${ts} && docker cp ${cid}:/tmp/jhu_dec_${ts}/. /tmp/jhu_dec_host_${ts}/ 2>&1 && echo "已提取到宿主机: /tmp/jhu_dec_host_${ts}/" && if [ -f /tmp/cfr.jar ]; then echo "\\n=== CFR Decompile ===" && java -jar /tmp/cfr.jar /tmp/jhu_dec_host_${ts}/${cls} 2>&1 | head -300; else javap -c -p /tmp/jhu_dec_host_${ts}/${cls} 2>&1 | head -300; fi`
      );
      this.showOutput(out2);
    }
  }

  async dockerCpIn(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const hostPath = (document.getElementById('jhu-docker-host-file') as HTMLInputElement)?.value?.trim() || '';
    const containerPath = (document.getElementById('jhu-docker-container-path') as HTMLInputElement)?.value?.trim() || '/tmp/';
    if (!cid || !hostPath) { window.showNotification?.('请填写容器ID和宿主机文件路径', 'warning'); return; }
    this.showOutput(`正在复制 ${hostPath} -> 容器 ${cid}:${containerPath}...`);
    const output = await this.execSSH(`docker cp "${hostPath}" ${cid}:${containerPath} 2>&1 && echo "复制完成"`);
    this.showOutput(output);
  }

  async dockerCpOut(): Promise<void> {
    const cid = this.getSelectedContainerId();
    const containerPath = (document.getElementById('jhu-docker-container-path') as HTMLInputElement)?.value?.trim() || '';
    if (!cid || !containerPath) { window.showNotification?.('请填写容器ID和容器内路径', 'warning'); return; }
    const ts = Date.now();
    this.showOutput(`正在复制容器 ${cid}:${containerPath} -> 宿主机...`);
    const output = await this.execSSH(`mkdir -p /tmp/jhu_docker_out_${ts} && docker cp ${cid}:${containerPath} /tmp/jhu_docker_out_${ts}/ 2>&1 && echo "已复制到: /tmp/jhu_docker_out_${ts}/" && ls -lh /tmp/jhu_docker_out_${ts}/`);
    this.showOutput(output);
  }

  async dockerRestartContainer(cid: string): Promise<void> {
    if (!cid) cid = this.getSelectedContainerId();
    if (!cid) return;
    this.showOutput(`正在重启容器 ${cid}...`);
    const output = await this.execSSH(`docker restart ${cid} 2>&1 && docker ps --filter id=${cid} --format '{{.Names}} {{.Status}}'`);
    this.showOutput(output);
    window.showNotification?.('容器已重启', 'success');
    setTimeout(() => this.scanDockerJava(), 2000);
  }

  async dockerShowExecGuide(cid: string): Promise<void> {
    if (!cid) cid = this.getSelectedContainerId();
    const panel = document.getElementById('jhu-output-panel');
    if (!panel) return;
    panel.innerHTML = `<div class="jhu-dialog">
      <h4>进入容器交互 Shell</h4>
      <div class="jhu-dialog-section">
        <h5>在终端中执行:</h5>
        <div class="jhu-cmd-box"><code>docker exec -it ${this.escapeHtml(cid)} /bin/bash\n# 或\ndocker exec -it ${this.escapeHtml(cid)} /bin/sh</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>容器内常用操作:</h5>
        <div class="jhu-cmd-box"><code># 查看 Java 进程\nps aux | grep java\n\n# 查找 JAR 文件\nfind / -name '*.jar' -type f 2>/dev/null | grep -v proc\n\n# 查看 JAR 内容\njar tf /path/to/app.jar | head -50\n\n# 提取并反编译\nmkdir -p /tmp/patch && cd /tmp/patch\njar xf /path/to/app.jar com/example/MyClass.class\njavap -c -p com/example/MyClass.class\n\n# 更新 JAR\njar uf /path/to/app.jar com/example/MyClass.class\n\n# 重启 Java 进程\nkill -15 $(pgrep -f java) && sleep 2\njava -jar /path/to/app.jar &</code></div>
      </div>
    </div>`;
  }

  async dockerShowEnv(cid: string): Promise<void> {
    if (!cid) cid = this.getSelectedContainerId();
    if (!cid) return;
    this.showOutput('正在检测容器 Java 环境...');
    const output = await this.execSSH(
      `echo "=== Container Info ===" && docker inspect ${cid} --format='Name: {{.Name}}  Image: {{.Config.Image}}  Cmd: {{.Config.Cmd}}' 2>/dev/null && echo "\\n=== Java Version ===" && docker exec ${cid} java -version 2>&1 && echo "\\n=== JDK Tools ===" && docker exec ${cid} sh -c 'which java jar javac javap jps jstack jmap 2>&1' && echo "\\n=== Java Processes ===" && docker exec ${cid} ps aux 2>/dev/null | grep '[j]ava' && echo "\\n=== Environment ===" && docker exec ${cid} sh -c 'env | grep -iE "java|jdk|jre|classpath|spring|catalina" 2>/dev/null | head -15' && echo "\\n=== JAR Files ===" && docker exec ${cid} find / -maxdepth 5 -name '*.jar' -type f 2>/dev/null | grep -v /proc/ | head -20`
    );
    this.showOutput(output);
  }

  dockerFullUpdateGuide(): void {
    const cid = this.getSelectedContainerId() || 'CONTAINER_ID';
    const jar = this.getDockerJarPath() || '/app/app.jar';
    const panel = document.getElementById('jhu-output-panel');
    if (!panel) return;
    panel.innerHTML = `<div class="jhu-dialog">
      <h4>Docker 容器 Java 热更新完整流程</h4>
      <div class="jhu-dialog-section">
        <h5>步骤 1: 备份原始 JAR (容器内 + 宿主机)</h5>
        <div class="jhu-cmd-box"><code>docker exec ${this.escapeHtml(cid)} cp ${this.escapeHtml(jar)} ${this.escapeHtml(jar)}.bak\ndocker cp ${this.escapeHtml(cid)}:${this.escapeHtml(jar)} /tmp/app.jar.bak</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>步骤 2: 从容器提取需要修改的 class 到宿主机</h5>
        <div class="jhu-cmd-box"><code># 在容器内提取\ndocker exec ${this.escapeHtml(cid)} sh -c 'mkdir -p /tmp/patch && cd /tmp/patch && jar xf ${this.escapeHtml(jar)} com/example/MyClass.class'\n\n# 复制到宿主机\nmkdir -p /tmp/docker_patch\ndocker cp ${this.escapeHtml(cid)}:/tmp/patch/. /tmp/docker_patch/</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>步骤 3: 在宿主机反编译 + 修改 + 编译</h5>
        <div class="jhu-cmd-box"><code># 反编译(需要宿主机有 CFR 或 javap)\njava -jar /tmp/cfr.jar /tmp/docker_patch/com/example/MyClass.class > /tmp/docker_patch/com/example/MyClass.java\n\n# 修改源码\nvi /tmp/docker_patch/com/example/MyClass.java\n\n# 编译(需要原始 JAR 作为 classpath)\ncd /tmp/docker_patch\ndocker cp ${this.escapeHtml(cid)}:${this.escapeHtml(jar)} /tmp/app_classpath.jar\njavac -cp /tmp/app_classpath.jar com/example/MyClass.java</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>步骤 4: 将新 class 复制回容器并 jar uf</h5>
        <div class="jhu-cmd-box"><code># 复制编译好的 class 回容器\ndocker cp /tmp/docker_patch/com/example/MyClass.class ${this.escapeHtml(cid)}:/tmp/MyClass.class\n\n# 在容器内执行 jar uf\ndocker exec ${this.escapeHtml(cid)} sh -c 'cd /tmp && mkdir -p com/example && cp MyClass.class com/example/ && jar uf ${this.escapeHtml(jar)} com/example/MyClass.class'</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>步骤 5: 重启容器使更新生效</h5>
        <div class="jhu-cmd-box"><code># 方法1: 重启整个容器\ndocker restart ${this.escapeHtml(cid)}\n\n# 方法2: 只重启容器内的 Java 进程\ndocker exec ${this.escapeHtml(cid)} sh -c 'kill -15 $(pgrep -f java) && sleep 2 && java -jar ${this.escapeHtml(jar)} &'\n\n# 方法3: 用 Arthas 热替换(不重启)\ndocker exec -it ${this.escapeHtml(cid)} sh -c 'cd /tmp && curl -sO https://arthas.aliyun.com/arthas-boot.jar && java -jar arthas-boot.jar'\n# 然后在 Arthas 中: redefine /tmp/com/example/MyClass.class</code></div>
      </div>
      <div class="jhu-dialog-section">
        <h5>步骤 6: 验证</h5>
        <div class="jhu-cmd-box"><code>docker exec ${this.escapeHtml(cid)} jar tf ${this.escapeHtml(jar)} | grep MyClass\ndocker logs --tail 20 ${this.escapeHtml(cid)}</code></div>
      </div>
    </div>`;
  }

  // ──── Docker Tab 渲染 ────

  private renderDockerTab(): string {
    const containerOptions = this.dockerContainers.length > 0
      ? this.dockerContainers.map(c =>
          `<option value="${c.id}" ${c.id === this.selectedContainer ? 'selected' : ''}>${this.escapeHtml(c.name)} (${this.escapeHtml(c.image.substring(0, 30))})</option>`
        ).join('')
      : '<option value="">未检测到 Java 容器</option>';

    // 容器列表卡片
    const containerCards = this.dockerContainers.length > 0
      ? this.dockerContainers.map(c => `
          <div class="jhu-deploy-card ${this.selectedContainer === c.id ? 'jhu-selected' : ''}"
               data-jhu-action="docker-select" data-jhu-param="${c.id}" style="cursor:pointer">
            <div class="jhu-deploy-icon">[D]</div>
            <div class="jhu-deploy-info">
              <h5>${this.escapeHtml(c.name)}</h5>
              <small>${this.escapeHtml(c.image)} | ${this.escapeHtml(c.javaVersion || 'Java version unknown')}</small>
              <small>${c.jars.length} JAR files${c.pid ? ' | PID ' + c.pid : ''}</small>
            </div>
            <div class="jhu-cell-actions">
              <button class="jhu-action-btn" data-jhu-action="docker-env" data-jhu-param="${c.id}" title="环境详情">i</button>
              <button class="jhu-action-btn" data-jhu-action="docker-exec-shell" data-jhu-param="${c.id}" title="Shell指引">&gt;_</button>
              <button class="jhu-action-btn" data-jhu-action="docker-restart" data-jhu-param="${c.id}" title="重启容器">R</button>
            </div>
          </div>
        `).join('')
      : '';

    return `
      <!-- ═══ 容器列表 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header">
          <h4>Docker Java 容器</h4>
          <button class="jhu-btn primary" data-jhu-action="docker-scan">扫描容器</button>
        </div>
        ${this.dockerContainers.length === 0
          ? '<div class="jhu-empty"><p>点击"扫描容器"检测包含 Java 的 Docker 容器</p></div>'
          : containerCards}
      </div>

      <!-- ═══ 容器内 JAR 操作 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header"><h4>容器内 JAR 热更新</h4></div>
        <div class="jhu-form-row">
          <label>目标容器</label>
          <select id="jhu-docker-container" class="jhu-select">${containerOptions}</select>
        </div>
        <div class="jhu-form-row">
          <label>JAR 路径</label>
          <input id="jhu-docker-jar" class="jhu-input" placeholder="容器内 JAR 路径，如 /app/app.jar" />
          <button class="jhu-btn secondary" data-jhu-action="docker-jar-browse">浏览</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-jar-list">列出内容</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-jar-backup">备份</button>
        </div>
        <div class="jhu-form-row">
          <label>Class 路径</label>
          <input id="jhu-docker-class" class="jhu-input" placeholder="com/example/MyClass.class" />
          <button class="jhu-btn secondary" data-jhu-action="docker-class-search">搜索</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-decompile">反编译</button>
        </div>
        <div class="jhu-form-row">
          <label>宿主机文件</label>
          <input id="jhu-docker-host-file" class="jhu-input" placeholder="宿主机上编译好的 .class 文件路径 (可选)" />
          <button class="jhu-btn primary" data-jhu-action="docker-jar-update">执行 jar uf</button>
        </div>
      </div>

      <!-- ═══ docker cp 文件传输 ═══ -->
      <div class="jhu-section">
        <div class="jhu-section-header"><h4>docker cp 文件传输</h4></div>
        <div class="jhu-form-row">
          <label>容器内路径</label>
          <input id="jhu-docker-container-path" class="jhu-input" placeholder="/app/target.jar 或 /tmp/MyClass.class" />
        </div>
        <div class="jhu-form-actions">
          <button class="jhu-btn secondary" data-jhu-action="docker-cp-out">容器 -> 宿主机</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-cp-in">宿主机 -> 容器</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-jar-extract">提取 Class 到宿主机</button>
          <button class="jhu-btn secondary" data-jhu-action="docker-full-guide">完整流程向导</button>
        </div>
      </div>

      <div id="jhu-output-panel" class="jhu-output-panel"></div>
    `;
  }

  // ──── Getters ────
  getCurrentTab(): JhuTab { return this.currentTab; }
  getProcesses(): JavaProcess[] { return this.processes; }
}

export const javaHotUpdateManager = new JavaHotUpdateManager();
