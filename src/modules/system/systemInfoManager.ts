/**
 * 系统信息管理器
 * 负责获取和管理Linux系统信息
 */

import { wrapCommandWithBash } from '../utils/shellUtils'
import { sshConnectionManager } from '../remote/sshConnectionManager';

export interface SystemInfo {
  hostname: string;
  uptime: string;
  loadAverage: string[];
  memoryUsage: {
    total: string;
    used: string;
    free: string;
    available: string;
  };
  diskUsage: {
    total: string;
    used: string;
    available: string;
    percentage: string;
  };
  partitions: Array<{
    filesystem: string;
    size: string;
    used: string;
    available: string;
    percentage: string;
    mountpoint: string;
  }>;
  cpuInfo: {
    model: string;
    cores: number;
    usage: string;
  };
  networkInfo: {
    interfaces: Array<{
      name: string;
      ip: string;
      status: string;
    }>;
    dns: string[];
    gateway: string;
    rxBytes: number;
    txBytes: number;
  };
  networkConnections: number;
  processCount: number;
  userCount: number;
  lastUpdate: Date;
  // 详细系统信息
  detailedInfo?: {
    processes: Array<{
      pid: string;
      user: string;
      cpu: string;
      memory: string;
      command: string;
    }>;
    networkDetails: Array<{
      protocol: string;
      localAddress: string;
      foreignAddress: string;
      state: string;
      process: string;
    }>;
    services: Array<{
      name: string;
      status: string;
      enabled: string;
      description: string;
    }>;
    users: Array<{
      username: string;
      uid: string;
      gid: string;
      home: string;
      shell: string;
    }>;
    autostart: Array<{
      name: string;
      command: string;
      status: string;
      type: string;
    }>;
    cronJobs: Array<{
      user: string;
      schedule: string;
      command: string;
    }>;
    firewallRules: Array<{
      chain: string;
      target: string;
      protocol: string;
      source: string;
      destination: string;
      options: string;
    }>;
  };
}

export class SystemInfoManager {
  private systemInfo?: SystemInfo;
  private updateInterval?: number;
  private isUpdating = false;
  private detailedInfo?: any; // 缓存详细信息
  private currentSessionId?: string; // 多服务器支持：当前会话ID

  constructor() {
    // 构造函数保持简单
  }

  /**
   * 设置当前会话ID（用于多服务器支持）
   */
  setSessionId(sessionId: string | undefined): void {
    console.log(`🔄 [SystemInfoManager] setSessionId 被调用: 旧ID='${this.currentSessionId}' -> 新ID='${sessionId}'`);
    if (this.currentSessionId !== sessionId) {
      this.currentSessionId = sessionId;
      // 切换会话时清除所有缓存数据
      this.systemInfo = undefined;
      this.detailedInfo = undefined;
      console.log(`✅ [SystemInfoManager] 会话已切换，缓存已清除`);
    } else {
      console.log(`⚠️ [SystemInfoManager] 会话ID相同，跳过缓存清除`);
    }
  }

  /**
   * 获取系统信息
   */
  async fetchSystemInfo(force: boolean = false): Promise<SystemInfo> {
    if (this.isUpdating && !force) {
      throw new Error('系统信息正在更新中');
    }

    this.isUpdating = true;

    try {
      console.log(`📊 正在获取系统信息，使用会话 ID: ${this.currentSessionId || '(默认)'}`);


      // 并行执行所有命令获取系统信息和详细信息
      const [
        hostname,
        uptime,
        loadAvg,
        memInfo,
        diskInfo,
        cpuInfo,
        cpuUsage,
        netConnections,
        processCount,
        userCount,
        networkInterfaces,
        dnsInfo,
        gatewayInfo,
        // 详细信息命令
        processesData,
        networkDetailsData,
        servicesData,
        usersData,
        autostartData,
        cronJobsData,
        firewallRulesData,
        networkTraffic
      ] = await Promise.all([
        // 基础系统信息
        this.executeCommand('hostname'),
        this.executeCommand('uptime'),
        this.executeCommand('cat /proc/loadavg'),
        this.executeCommand('cat /proc/meminfo'),
        this.executeCommand('df -hP'), // 获取所有分区信息
        this.executeCommand('cat /proc/cpuinfo | grep "model name" | head -1 && nproc'),
        this.executeCommand('top -bn2 -d0.5 | grep "Cpu(s)" | tail -1 | awk \'{print 100-$8"%"}\' || echo "0%"'),
        this.getNetworkConnectionCount(),
        this.executeCommand('ps aux | wc -l'),
        this.executeCommand('who | wc -l'),
        this.executeCommand('ip addr show | grep -E "inet |UP|DOWN"'),
        this.executeCommand('cat /etc/resolv.conf | grep nameserver'),
        this.executeCommand('ip route | grep default'),
        // 详细信息 - 添加STAT列，使用完整命令
        this.executeCommand('ps aux --no-headers | awk \'BEGIN{OFS=","} {cmd=""; for(i=11;i<=NF;i++) cmd=cmd $i" "; print $2,$1,$8,$3,$4,cmd}\''),
        this.getNetworkConnectionDetails(),
        this.executeCommand('systemctl list-units --type=service --no-pager --no-legend | awk \'BEGIN{OFS=","} {print $1,$3,$4,$5" "$6" "$7" "$8" "$9}\''),
        this.executeCommand('getent passwd | awk -F: \'BEGIN{OFS=","} {print $1,$3,$4,$6,$7}\''),
        this.executeCommand('systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend | awk \'BEGIN{OFS=","} {print $1,$2,"enabled","systemd"}\''),
        this.getCronJobs(),
        this.getFirewallRules(),
        this.getNetworkTraffic()
      ]);

      // 解析基础系统信息
      this.systemInfo = this.parseSystemInfo({
        hostname: hostname.trim(),
        uptime: uptime.trim(),
        loadAvg: loadAvg.trim(),
        memInfo: memInfo.trim(),
        diskInfo: diskInfo.trim(),
        cpuInfo: cpuInfo.trim(),
        cpuUsage: cpuUsage.trim(),
        netConnections: netConnections.trim(),
        processCount: processCount.trim(),
        userCount: userCount.trim(),
        networkInterfaces: networkInterfaces.trim(),
        dnsInfo: dnsInfo.trim(),
        gatewayInfo: gatewayInfo.trim(),
        networkTraffic
      });

      // 解析详细信息并缓存
      this.detailedInfo = {
        processes: this.parseProcesses(processesData),
        networkDetails: this.parseNetworkDetails(networkDetailsData),
        services: this.parseServices(servicesData),
        users: this.parseUsers(usersData),
        autostart: this.parseAutostart(autostartData),
        cronJobs: this.parseCronJobs(cronJobsData),
        firewallRules: this.parseFirewallRules(firewallRulesData)
      };

      // 将详细信息附加到系统信息对象中
      if (this.systemInfo) {
        this.systemInfo.detailedInfo = this.detailedInfo;
      }

      console.log('✅ 系统信息和详细信息获取完成');
      return this.systemInfo;

    } catch (error) {
      console.error('❌ 获取系统信息失败:', error);
      throw new Error(`获取系统信息失败: ${error}`);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 执行SSH命令 - 使用统一的SSH连接系统
   * 仪表盘命令使用快速执行方法
   */
  private async executeCommand(command: string): Promise<string> {
    try {
      // 使用带Sudo重试的执行器
      const sessionId = this.currentSessionId || null;
      
      // 自动包裹bash -c以支持sudo下的复杂命令（如if/else, for循环, 管道），并处理单引号转义
      // 使用工具函数安全包裹命令
      const execCommand = wrapCommandWithBash(command);

      const result = await sshConnectionManager.executeCommandWithSudoRetry(
        'ssh_execute_dashboard_command_direct', 
        { 
          command: execCommand,
          sessionId 
        },
        sessionId
      );

      // 确保返回值是字符串类型
      if (typeof result === 'string') {
        return result;
      } else if (result && typeof result === 'object' && 'output' in result) {
        // 如果返回的是对象，尝试获取output字段
        return String((result as any).output || '');
      } else {
        // 其他情况转换为字符串
        return String(result || '');
      }
    } catch (error) {
      console.error(`❌ 命令执行失败: ${command}`, error);
      throw new Error(`命令执行失败: ${error}`);
    }
  }

  /**
   * 解析系统信息
   */
  private parseSystemInfo(rawData: any): SystemInfo {
    // 解析内存信息
    const memLines = rawData.memInfo.split('\n');
    const memTotal = this.extractMemoryValue(memLines[0]);
    const memFree = this.extractMemoryValue(memLines[1]);
    const memAvailable = this.extractMemoryValue(memLines[2]);
    const memUsed = memTotal - memFree;

    // 解析磁盘信息
    const diskLines = rawData.diskInfo.trim().split('\n');
    const partitions = [];
    let rootDisk = { total: '0', used: '0', available: '0', percentage: '0%' };

    // 跳过标题行 (Filesystem Size Used Avail Use% Mounted on)
    for (let i = 1; i < diskLines.length; i++) {
      const line = diskLines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;

      const filesystem = parts[0];
      const size = parts[1];
      const used = parts[2];
      const available = parts[3];
      const percentage = parts[4];
      const mountpoint = parts.slice(5).join(' '); // 处理挂载点可能有空格的情况

      // 过滤掉非物理文件系统
      if (filesystem.includes('tmpfs') || 
          filesystem.includes('overlay') || 
          filesystem.includes('loop') || 
          filesystem.includes('cdrom') ||
          filesystem.includes('udev') ||
          mountpoint.startsWith('/boot') || // 可选：隐藏boot分区
          mountpoint.startsWith('/snap')) {
        continue;
      }

      const partition = {
        filesystem,
        size,
        used,
        available,
        percentage,
        mountpoint
      };

      partitions.push(partition);

      // 查找根分区作为主要磁盘信息
      if (mountpoint === '/') {
        rootDisk = {
          total: size,
          used: used,
          available: available,
          percentage: percentage
        };
      }
    }

    // 如果没有找到根分区，使用第一个分区作为默认值
    if (rootDisk.total === '0' && partitions.length > 0) {
      rootDisk = {
        total: partitions[0].size,
        used: partitions[0].used,
        available: partitions[0].available,
        percentage: partitions[0].percentage
      };
    }

    // 解析CPU信息
    const cpuLines = rawData.cpuInfo.split('\n');
    const cpuModel = cpuLines[0]?.split(':')[1]?.trim() || 'Unknown';
    const cpuCores = parseInt(cpuLines[1]) || 1;

    // 解析负载平均值
    const loadParts = rawData.loadAvg.split(' ');
    const loadAverage = [loadParts[0] || '0', loadParts[1] || '0', loadParts[2] || '0'];

    // 解析网络信息
    const networkInfo = this.parseNetworkInfo(rawData.networkInterfaces, rawData.dnsInfo, rawData.gatewayInfo);

    // 添加流量数据
    const networkInfoWithTraffic = {
      ...networkInfo,
      rxBytes: rawData.networkTraffic?.rx || 0,
      txBytes: rawData.networkTraffic?.tx || 0
    };

    return {
      hostname: rawData.hostname,
      uptime: this.parseUptime(rawData.uptime),
      loadAverage,
      memoryUsage: {
        total: this.formatBytes(memTotal * 1024),
        used: this.formatBytes(memUsed * 1024),
        free: this.formatBytes(memFree * 1024),
        available: this.formatBytes(memAvailable * 1024)
      },
      diskUsage: {
        total: rootDisk.total,
        used: rootDisk.used,
        available: rootDisk.available,
        percentage: rootDisk.percentage
      },
      partitions: partitions,
      cpuInfo: {
        model: cpuModel,
        cores: cpuCores,
        usage: rawData.cpuUsage || '0%'
      },
      networkInfo: networkInfoWithTraffic,
      networkConnections: parseInt(rawData.netConnections) || 0,
      processCount: parseInt(rawData.processCount) || 0,
      userCount: parseInt(rawData.userCount) || 0,
      lastUpdate: new Date()
    };
  }

  /**
   * 解析网络信息
   */
  private parseNetworkInfo(interfacesData: string, dnsData: string, gatewayData: string) {
    // 解析网络接口
    const interfaces = [];
    const lines = interfacesData.split('\n');
    let currentInterface = '';

    for (const line of lines) {
      if (line.includes('UP') || line.includes('DOWN')) {
        // 接口状态行，如：2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP>
        const match = line.match(/\d+:\s*(\w+):/);
        if (match) {
          currentInterface = match[1];
          const status = line.includes('UP') ? 'up' : 'down';
          if (currentInterface !== 'lo') { // 跳过回环接口
            interfaces.push({
              name: currentInterface,
              ip: '获取中...',
              status
            });
          }
        }
      } else if (line.includes('inet ') && currentInterface) {
        // IP地址行，如：inet 192.168.1.100/24
        const match = line.match(/inet\s+([^\s\/]+)/);
        if (match && interfaces.length > 0) {
          const lastInterface = interfaces[interfaces.length - 1];
          if (lastInterface.name === currentInterface) {
            lastInterface.ip = match[1];
          }
        }
      }
    }

    // 解析DNS服务器
    const dns = [];
    const dnsLines = dnsData.split('\n');
    for (const line of dnsLines) {
      const match = line.match(/nameserver\s+([^\s]+)/);
      if (match) {
        dns.push(match[1]);
      }
    }

    // 解析网关
    let gateway = '未知';
    const gatewayMatch = gatewayData.match(/default\s+via\s+([^\s]+)/);
    if (gatewayMatch) {
      gateway = gatewayMatch[1];
    }

    return {
      interfaces: interfaces.length > 0 ? interfaces : [{ name: 'eth0', ip: '获取失败', status: 'unknown' }],
      dns: dns.length > 0 ? dns : ['获取失败'],
      gateway
    };
  }

  /**
   * 提取内存值（KB）
   */
  private extractMemoryValue(line: string): number {
    const match = line.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 解析运行时间
   */
  private parseUptime(uptimeStr: string): string {
    // 简化的运行时间解析
    const match = uptimeStr.match(/up\s+(.+?),/);
    return match ? match[1].trim() : uptimeStr;
  }

  /**
   * 获取当前系统信息
   */
  getSystemInfo(): SystemInfo | undefined {
    return this.systemInfo;
  }



  /**
   * 开始自动更新系统信息
   */
  startAutoUpdate(intervalMs: number = 30000): void {
    this.stopAutoUpdate();

    this.updateInterval = window.setInterval(async () => {
      try {
        await this.fetchSystemInfo();
      } catch (error) {
        console.error('❌ 自动更新系统信息失败:', error);
      }
    }, intervalMs);

    console.log(`✅ 系统信息自动更新已启动，间隔: ${intervalMs}ms`);
  }

  /**
   * 停止自动更新系统信息
   */
  stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
      console.log('✅ 系统信息自动更新已停止');
    }
  }

  /**
   * 获取CPU使用率
   */
  async getCpuUsage(): Promise<string> {
    try {
      const result = await this.executeCommand(
        "grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4)} END {print usage \"%\"}'"
      );
      return result.trim();
    } catch (error) {
      console.error('❌ 获取CPU使用率失败:', error);
      return '0%';
    }
  }

  /**
   * 获取详细系统信息
   * 如果已经缓存，直接返回缓存的数据
   */
  async getDetailedSystemInfo(): Promise<any> {
    try {
      // 如果已经有缓存的详细信息，直接返回
      if (this.detailedInfo) {
        console.log('✅ 返回缓存的详细系统信息');
        return this.detailedInfo;
      }

      // 如果没有缓存，重新获取（这种情况应该很少发生，因为在 fetchSystemInfo 中已经获取了）
      console.log('🔍 缓存未命中，重新获取详细系统信息...');

      const [
        processesData,
        networkDetailsData,
        servicesData,
        usersData,
        autostartData,
        cronJobsData,
        firewallRulesData
      ] = await Promise.all([
        this.executeCommand('ps aux --no-headers | awk \'BEGIN{OFS=","} {cmd=""; for(i=11;i<=NF;i++) cmd=cmd $i" "; print $2,$1,$8,$3,$4,cmd}\''),
        this.getNetworkConnectionDetails(),
        this.executeCommand('systemctl list-units --type=service --no-pager --no-legend | awk \'BEGIN{OFS=","} {print $1,$3,$4,$5" "$6" "$7" "$8" "$9}\''),
        this.executeCommand('getent passwd | awk -F: \'BEGIN{OFS=","} {print $1,$3,$4,$6,$7}\''),
        this.executeCommand('systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend | awk \'BEGIN{OFS=","} {print $1,$2,"enabled","systemd"}\''),
        this.getCronJobs(),
        this.getFirewallRules()
      ]);

      this.detailedInfo = {
        processes: this.parseProcesses(processesData),
        networkDetails: this.parseNetworkDetails(networkDetailsData),
        services: this.parseServices(servicesData),
        users: this.parseUsers(usersData),
        autostart: this.parseAutostart(autostartData),
        cronJobs: this.parseCronJobs(cronJobsData),
        firewallRules: this.parseFirewallRules(firewallRulesData)
      };

      console.log('✅ 详细系统信息获取完成');
      return this.detailedInfo;

    } catch (error) {
      console.error('❌ 获取详细系统信息失败:', error);
      return this.getDefaultDetailedInfo();
    }
  }

  /**
   * 获取网络连接数量（支持ss和netstat命令fallback）
   */
  private async getNetworkConnectionCount(): Promise<string> {
    try {
      // 先尝试使用ss命令
      const ssResult = await this.executeCommand('ss -tuln | wc -l');
      if (ssResult && ssResult.trim()) {
        console.log('✅ 使用ss命令获取网络连接数量');
        return ssResult;
      }
    } catch (error) {
      console.log('⚠️ ss命令失败，尝试使用netstat命令获取连接数量');
    }

    try {
      // 如果ss命令失败，使用netstat命令
      const netstatResult = await this.executeCommand('netstat -tuln | wc -l');
      console.log('✅ 使用netstat命令获取网络连接数量');
      return netstatResult;
    } catch (error) {
      console.error('❌ ss和netstat命令都失败了，无法获取网络连接数量:', error);
      return '0';
    }
  }

  /**
   * 获取网络连接详情（支持ss和netstat命令fallback）
   */
  private async getNetworkConnectionDetails(): Promise<string> {
    try {
      // 先尝试使用ss命令（显示所有TCP和UDP连接，包括监听和已建立的连接）
      // -t: TCP, -u: UDP, -a: 所有状态, -n: 数字格式, -p: 显示进程信息
      // ss输出格式: Netid State Recv-Q Send-Q Local_Address:Port Peer_Address:Port Process
      // 使用简化的 awk 命令避免复杂引号嵌套导致的解析问题
      const ssResult = await this.executeCommand(`ss -tunap 2>/dev/null | grep -v "State" | grep -v "Netid" | awk '{print $1","$5","$6","$1","$7",""-"}'`);
      if (ssResult && ssResult.trim()) {
        console.log('✅ 使用ss命令获取网络连接详情');
        console.log('📊 网络连接数据:', ssResult.split('\n').length, '条');
        return ssResult;
      }
    } catch (error) {
      console.log('⚠️ ss命令失败，尝试使用netstat命令获取连接详情');
    }

    try {
      // 如果ss命令失败，使用netstat命令
      // netstat输出格式: Proto Recv-Q Send-Q Local Address Foreign Address State [PID/Program]
      // 使用简化的 awk 命令避免复杂引号嵌套导致的解析问题
      const netstatResult = await this.executeCommand(`netstat -tunap 2>/dev/null | grep -v "Active" | grep -v "Proto" | awk '{print $1","$4","$5","$6","$7}'`);
      if (netstatResult && netstatResult.trim()) {
        console.log('✅ 使用netstat命令获取网络连接详情');
        console.log('📊 网络连接数据:', netstatResult.split('\n').length, '条');
        return netstatResult;
      }
    } catch (error) {
      console.log('⚠️ netstat命令失败，尝试使用简化命令');
    }

    try {
      // 最后的fallback：使用简化的ss命令（不显示进程信息）
      const simpleSsResult = await this.executeCommand(`ss -tuna | grep -v "State" | grep -v "Netid" | awk '{print $1","$5","$6","$1",unknown"}'`);
      console.log('✅ 使用简化ss命令获取网络连接详情（无进程信息）');
      return simpleSsResult;
    } catch (error) {
      console.error('❌ 所有命令都失败了，无法获取网络连接详情:', error);
      return '';
    }
  }

  /**
   * 获取网络流量统计 (Raw Bytes)
   */
  private async getNetworkTraffic(): Promise<{ rx: number; tx: number }> {
    try {
      // Sum up all non-loopback interfaces
      const result = await this.executeCommand(
        "cat /proc/net/dev | grep -v lo | awk 'NR>2 {rx+=$2; tx+=$10} END {print rx \" \" tx}'"
      );
      const parts = result.trim().split(' ');
      return {
        rx: parseInt(parts[0]) || 0,
        tx: parseInt(parts[1]) || 0
      };
    } catch (error) {
      console.error('❌ 获取网络流量失败:', error);
      return { rx: 0, tx: 0 };
    }
  }

  /**
   * 获取网络流量统计 (Formatted)
   */
  async getNetworkStats(): Promise<{ rx: string; tx: string }> {
    try {
      const traffic = await this.getNetworkTraffic();
      return {
        rx: this.formatBytes(traffic.rx),
        tx: this.formatBytes(traffic.tx)
      };
    } catch (error) {
      console.error('❌ 获取网络统计失败:', error);
      return { rx: '0 B', tx: '0 B' };
    }
  }

  /**
   * 获取磁盘IO统计
   */
  async getDiskIOStats(): Promise<{ read: string; write: string }> {
    try {
      const result = await this.executeCommand(
        "cat /proc/diskstats | grep -E '(sda|nvme)' | awk '{print $6*512 \" \" $10*512}' | head -1"
      );
      const parts = result.trim().split(' ');
      return {
        read: this.formatBytes(parseInt(parts[0]) || 0),
        write: this.formatBytes(parseInt(parts[1]) || 0)
      };
    } catch (error) {
      console.error('❌ 获取磁盘IO统计失败:', error);
      return { read: '0 B', write: '0 B' };
    }
  }

  /**
   * 获取系统服务状态
   */
  async getServiceStatus(serviceName: string): Promise<{ status: string; active: boolean }> {
    try {
      const result = await this.executeCommand(`systemctl is-active ${serviceName}`);
      const status = result.trim();
      return {
        status,
        active: status === 'active'
      };
    } catch (error) {
      console.error(`❌ 获取服务状态失败: ${serviceName}`, error);
      return { status: 'unknown', active: false };
    }
  }

  /**
   * 解析进程信息
   */
  private parseProcesses(data: string): Array<{ pid: string; user: string; stat: string; cpu: string; memory: string; command: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        pid: parts[0] || '',
        user: parts[1] || '',
        stat: parts[2] || '',
        cpu: parts[3] || '0',
        memory: parts[4] || '0',
        command: (parts[5] || '').trim()
      };
    }).filter(p => p.pid);
  }

  /**
   * 解析网络连接详情
   */
  private parseNetworkDetails(data: string): Array<{ protocol: string; localAddress: string; foreignAddress: string; state: string; process: string; pid: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        protocol: parts[0] || '',
        localAddress: parts[1] || '',
        foreignAddress: parts[2] || '',
        state: parts[3] || '',
        process: parts[4] || 'unknown',
        pid: parts[5] || '-'
      };
    }).filter(n => n.protocol);
  }

  /**
   * 解析系统服务
   */
  private parseServices(data: string): Array<{ name: string; status: string; enabled: string; description: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        name: parts[0] || '',
        status: parts[1] || '',
        enabled: parts[2] || '',
        description: parts[3] || ''
      };
    }).filter(s => s.name);
  }

  /**
   * 解析用户列表
   */
  private parseUsers(data: string): Array<{ username: string; uid: string; gid: string; home: string; shell: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        username: parts[0] || '',
        uid: parts[1] || '',
        gid: parts[2] || '',
        home: parts[3] || '',
        shell: parts[4] || ''
      };
    }).filter(u => u.username);
  }

  /**
   * 解析自启动服务
   */
  private parseAutostart(data: string): Array<{ name: string; command: string; status: string; type: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        name: parts[0] || '',
        command: parts[0] || '',
        status: parts[1] || '',
        type: parts[3] || 'systemd'
      };
    }).filter(a => a.name);
  }

  /**
   * 获取所有计划任务（包括系统和用户的）
   */
  private async getCronJobs(): Promise<string> {
    try {
      const commands = [
        // 1. 获取所有用户的crontab
        `for user in $(cut -f1 -d: /etc/passwd); do sudo crontab -u $user -l 2>/dev/null | grep -v "^#" | grep -v "^$" | awk -v u="$user" 'BEGIN{OFS=","} {schedule=$1" "$2" "$3" "$4" "$5; $1=$2=$3=$4=$5=""; print u,schedule,substr($0,6),"crontab:"u}'; done`,

        // 2. 系统级 /etc/crontab
        `grep -v "^#" /etc/crontab 2>/dev/null | grep -v "^$" | grep -v "^[A-Z]" | awk 'BEGIN{OFS=","} {schedule=$1" "$2" "$3" "$4" "$5; user=$6; $1=$2=$3=$4=$5=$6=""; print user,schedule,substr($0,7),"/etc/crontab"}'`,

        // 3. /etc/cron.d/* 目录下的任务
        `find /etc/cron.d -type f 2>/dev/null | xargs grep -H -v "^#" 2>/dev/null | grep -v "^$" | sed 's/:/,/' | awk -F, 'BEGIN{OFS=","} {source=$1; $1=""; line=$0; split(line,a," "); schedule=a[2]" "a[3]" "a[4]" "a[5]" "a[6]; user=a[7]; cmd=substr(line, length(schedule)+length(user)+4); print user,schedule,cmd,source}'`,

        // 4. /etc/cron.hourly
        `ls /etc/cron.hourly/ 2>/dev/null | awk 'BEGIN{OFS=","} {print "root","@hourly",$0,"/etc/cron.hourly/"$0}'`,

        // 5. /etc/cron.daily
        `ls /etc/cron.daily/ 2>/dev/null | awk 'BEGIN{OFS=","} {print "root","@daily",$0,"/etc/cron.daily/"$0}'`,

        // 6. /etc/cron.weekly
        `ls /etc/cron.weekly/ 2>/dev/null | awk 'BEGIN{OFS=","} {print "root","@weekly",$0,"/etc/cron.weekly/"$0}'`,

        // 7. /etc/cron.monthly
        `ls /etc/cron.monthly/ 2>/dev/null | awk 'BEGIN{OFS=","} {print "root","@monthly",$0,"/etc/cron.monthly/"$0}'`
      ];

      // 将所有命令组合成一个，用 ; 分隔
      const combinedCommand = commands.join(' ; ');
      const result = await this.executeCommand(combinedCommand);

      return result;
    } catch (error) {
      console.error('❌ 获取计划任务失败:', error);
      return '';
    }
  }

  /**
   * 解析计划任务
   */
  private parseCronJobs(data: string): Array<{ user: string; schedule: string; command: string; source: string }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      // 简单的逗号分割可能会破坏包含逗号的命令，但这是目前系统的实现方式
      // 我们尝试倒序解析以获取source，或者假设最后一部分是source
      // 但为了保持兼容性，我们先按逗号分割
      const parts = line.split(',');
      
      // 如果parts长度大于4，说明command中包含逗号
      // 重新组合command: parts[2] 到 parts[length-2]
      let user = parts[0] || 'root';
      let schedule = parts[1] || '';
      let source = parts[parts.length - 1] || '';
      let command = '';

      if (parts.length > 4) {
        command = parts.slice(2, parts.length - 1).join(',');
      } else {
        command = parts[2] || '';
      }

      return {
        user,
        schedule,
        command,
        source
      };
    }).filter(c => c.schedule);
  }

  /**
   * 获取防火墙规则
   */
  private async getFirewallRules(): Promise<string> {
    try {
      // 尝试多种防火墙工具
      const commands = [
        // 1. iptables - 最常见的防火墙工具
        `if command -v iptables >/dev/null 2>&1; then
          iptables -L -n -v --line-numbers 2>/dev/null | awk '
            /^Chain/ {chain=$2; next}
            /^num/ {next}
            /^$/ {next}
            NF>0 && $1 ~ /^[0-9]+$/ {
              target=$4
              prot=$5
              opt=$6
              source=$9
              destination=$10
              options=""
              for(i=11;i<=NF;i++) options=options $i" "
              if(prot=="") prot="all"
              if(source=="") source="0.0.0.0/0"
              if(destination=="") destination="0.0.0.0/0"
              print chain","target","prot","source","destination","options
            }
          '
        fi`,

        // 2. firewalld - RHEL/CentOS 常用
        `if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
          firewall-cmd --list-all 2>/dev/null | grep -E "services:|ports:|rich rules:" | awk 'BEGIN{OFS=","} {print "firewalld","ACCEPT","all","0.0.0.0/0","0.0.0.0/0",$0}'
        fi`,

        // 3. ufw - Ubuntu常用
        `if command -v ufw >/dev/null 2>&1; then
          ufw status numbered 2>/dev/null | grep -E "^\[" | awk 'BEGIN{OFS=","} {
            action=$4
            if(action=="ALLOW") action="ACCEPT"
            if(action=="DENY") action="DROP"
            print "ufw",action,"all",$3,"0.0.0.0/0",$0
          }'
        fi`
      ];

      // 将所有命令组合成一个，用 ; 分隔
      const combinedCommand = commands.join(' ; ');
      const result = await this.executeCommand(combinedCommand);

      return result;
    } catch (error) {
      console.error('❌ 获取防火墙规则失败:', error);
      return '';
    }
  }

  /**
   * 解析防火墙规则
   */
  private parseFirewallRules(data: string): Array<{
    chain: string;
    target: string;
    protocol: string;
    source: string;
    destination: string;
    options: string;
  }> {
    if (!data.trim()) return [];

    return data.trim().split('\n').map(line => {
      const parts = line.split(',');
      return {
        chain: parts[0] || 'INPUT',
        target: parts[1] || 'ACCEPT',
        protocol: parts[2] || 'all',
        source: parts[3] || '0.0.0.0/0',
        destination: parts[4] || '0.0.0.0/0',
        options: parts.slice(5).join(',') || ''
      };
    }).filter(r => r.chain);
  }

  /**
   * 获取默认详细信息
   */
  private getDefaultDetailedInfo(): any {
    return {
      processes: [],
      networkDetails: [],
      services: [],
      users: [],
      autostart: [],
      cronJobs: [],
      firewallRules: []
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.systemInfo = undefined;
    this.detailedInfo = undefined;
    console.log('🧹 [SystemInfoManager] 系统信息和详细信息缓存已清除');
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopAutoUpdate();
    this.systemInfo = undefined;
  }
}
