/**
 * SSH终端命令提示管理器
 * 提供Linux命令的使用提示和帮助信息
 */

export interface CommandHint {
  command: string;
  description: string;
  usage: string;
  examples: string[];
  commonOptions?: string[];
  category: 'file' | 'system' | 'network' | 'process' | 'text' | 'archive' | 'permission' | 'security' | 'other';
}

export class CommandHintsManager {
  private hints: Map<string, CommandHint> = new Map();

  constructor() {
    this.initializeHints();
  }

  /**
   * 初始化命令提示数据
   */
  private initializeHints(): void {
    const commands: CommandHint[] = [
      // 文件操作命令
      {
        command: 'ls',
        description: '列出目录内容，显示文件和子目录信息',
        usage: 'ls [选项] [目录...]',
        examples: [
          'ls -la          # 显示详细信息包括隐藏文件',
          'ls -lh          # 以人类可读格式显示文件大小',
          'ls -lt          # 按修改时间排序',
          'ls -lS          # 按文件大小排序',
          'ls -lr          # 逆序排列',
          'ls --color=auto # 彩色显示',
          'ls -1           # 每行显示一个文件',
          'ls -d */        # 只显示目录',
          'ls -la | grep "^d" # 只显示目录详细信息'
        ],
        commonOptions: ['-l', '-a', '-h', '-t', '-r', '-S', '-1', '-d', '--color'],
        category: 'file'
      },
      {
        command: 'cd',
        description: '切换当前工作目录',
        usage: 'cd [目录]',
        examples: [
          'cd /home/user    # 切换到指定绝对路径',
          'cd ..            # 返回上级目录',
          'cd ~             # 返回用户主目录',
          'cd -             # 返回上一次所在目录',
          'cd ~/Documents   # 切换到用户文档目录',
          'cd /             # 切换到根目录',
          'cd               # 不带参数，返回主目录'
        ],
        category: 'file'
      },
      {
        command: 'pwd',
        description: '显示当前工作目录的完整路径',
        usage: 'pwd [选项]',
        examples: [
          'pwd              # 显示当前目录路径',
          'pwd -P           # 显示物理路径（解析符号链接）',
          'pwd -L           # 显示逻辑路径（默认）'
        ],
        commonOptions: ['-P', '-L'],
        category: 'file'
      },
      {
        command: 'mkdir',
        description: '创建一个或多个目录',
        usage: 'mkdir [选项] 目录名...',
        examples: [
          'mkdir mydir           # 创建单个目录',
          'mkdir dir1 dir2 dir3  # 创建多个目录',
          'mkdir -p a/b/c        # 递归创建多级目录',
          'mkdir -m 755 mydir    # 创建目录并设置权限',
          'mkdir -p -m 644 test/subdir # 递归创建并设置权限',
          'mkdir {dir1,dir2,dir3} # 使用大括号扩展创建多个目录'
        ],
        commonOptions: ['-p', '-m', '-v'],
        category: 'file'
      },
      {
        command: 'rmdir',
        description: '删除空目录',
        usage: 'rmdir [选项] 目录名...',
        examples: [
          'rmdir mydir         # 删除空目录',
          'rmdir -p a/b/c      # 递归删除空目录',
          'rmdir -v mydir      # 详细显示删除过程',
          'rmdir dir1 dir2     # 删除多个空目录'
        ],
        commonOptions: ['-p', '-v', '--ignore-fail-on-non-empty'],
        category: 'file'
      },
      {
        command: 'rm',
        description: '删除文件或目录',
        usage: 'rm [选项] 文件/目录...',
        examples: [
          'rm file.txt         # 删除文件',
          'rm -r mydir         # 递归删除目录',
          'rm -rf mydir        # 强制递归删除',
          'rm -i file.txt      # 交互式删除（询问确认）',
          'rm -v file.txt      # 详细显示删除过程',
          'rm *.tmp            # 删除所有.tmp文件',
          'rm -rf /tmp/*       # 清空临时目录',
          'rm -- -filename     # 删除以-开头的文件'
        ],
        commonOptions: ['-r', '-f', '-i', '-v', '--preserve-root'],
        category: 'file'
      },
      {
        command: 'cp',
        description: '复制文件或目录到指定位置',
        usage: 'cp [选项] 源文件... 目标',
        examples: [
          'cp file1.txt file2.txt     # 复制文件',
          'cp -r dir1 dir2            # 递归复制目录',
          'cp -p file1 file2          # 保持文件属性（时间戳、权限）',
          'cp -i file1 file2          # 交互式复制（覆盖前询问）',
          'cp -u file1 file2          # 只在源文件较新时复制',
          'cp -v file1 file2          # 详细显示复制过程',
          'cp -a dir1 dir2            # 归档模式（保持所有属性）',
          'cp *.txt backup/           # 复制所有txt文件到backup目录',
          'cp -l file1 file2          # 创建硬链接而不是复制',
          'cp -s file1 file2          # 创建符号链接'
        ],
        commonOptions: ['-r', '-p', '-i', '-u', '-v', '-a', '-l', '-s'],
        category: 'file'
      },
      {
        command: 'mv',
        description: '移动文件/目录或重命名',
        usage: 'mv [选项] 源文件... 目标',
        examples: [
          'mv old.txt new.txt         # 重命名文件',
          'mv file.txt /tmp/          # 移动文件到目录',
          'mv -i file1 file2          # 交互式移动（覆盖前询问）',
          'mv -u file1 file2          # 只在源文件较新时移动',
          'mv -v file1 file2          # 详细显示移动过程',
          'mv dir1 dir2               # 重命名目录',
          'mv *.log logs/             # 移动所有log文件到logs目录',
          'mv file{1,2}.txt backup/   # 移动多个文件'
        ],
        commonOptions: ['-i', '-u', '-v', '-f'],
        category: 'file'
      },
      {
        command: 'find',
        description: '在目录树中搜索文件和目录（网络安全必备工具）',
        usage: 'find [路径] [表达式]',
        examples: [
          // 基础查找
          'find . -name "*.txt"              # 查找当前目录下所有txt文件',
          'find /home -user john             # 查找john用户的文件',
          'find . -type f -size +1M          # 查找大于1MB的文件',
          'find . -mtime -7                  # 查找7天内修改的文件',

          // 安全审计专用查找
          'find / -perm -4000 2>/dev/null    # 查找所有SUID文件（提权漏洞）',
          'find / -perm -2000 2>/dev/null    # 查找所有SGID文件',
          'find / -perm -1000 2>/dev/null    # 查找所有sticky bit文件',
          'find / -perm -u=s 2>/dev/null     # 查找用户SUID文件',
          'find / -perm -g=s 2>/dev/null     # 查找组SGID文件',

          // 可疑文件查找
          'find / -name ".*" -type f 2>/dev/null # 查找隐藏文件',
          'find /tmp -type f -mtime -1       # 查找/tmp下24小时内修改的文件',
          'find /var/www -name "*.php" -mtime -1 # 查找最近修改的PHP文件',
          'find / -size +100M 2>/dev/null    # 查找大于100MB的可疑大文件',
          'find / -name "*.sh" -perm -u+x 2>/dev/null # 查找可执行shell脚本',

          // 按时间查找（应急响应）
          'find / -newermt "2023-12-25" 2>/dev/null # 查找指定日期后修改的文件',
          'find / -newerct "1 hour ago" 2>/dev/null # 查找1小时内创建的文件',
          'find / -mmin -60 2>/dev/null      # 查找60分钟内修改的文件',
          'find / -amin -30 2>/dev/null      # 查找30分钟内访问的文件',
          'find / -cmin -120 2>/dev/null     # 查找120分钟内状态改变的文件',

          // 按用户和权限查找
          'find / -user root -perm -4000 2>/dev/null # 查找root用户的SUID文件',
          'find / -nouser 2>/dev/null        # 查找没有所有者的文件（孤儿文件）',
          'find / -nogroup 2>/dev/null       # 查找没有所属组的文件',
          'find / -perm 777 2>/dev/null      # 查找权限为777的文件（安全风险）',
          'find / -perm -002 2>/dev/null     # 查找其他用户可写的文件',
          'find / -perm -o+w 2>/dev/null     # 查找其他用户可写的文件（另一种写法）',

          // 特定文件类型查找
          'find / -name "*.conf" 2>/dev/null # 查找配置文件',
          'find / -name "*.log" -size +10M 2>/dev/null # 查找大于10MB的日志文件',
          'find / -name "passwd" 2>/dev/null # 查找passwd文件',
          'find / -name "shadow" 2>/dev/null # 查找shadow文件',
          'find / -name "*.key" -o -name "*.pem" 2>/dev/null # 查找密钥文件',

          // 网络安全比赛常用
          'find / -name "*flag*" 2>/dev/null # CTF比赛查找flag文件',
          'find / -type f -executable 2>/dev/null | head -20 # 查找可执行文件',
          'find /home -name ".*history" 2>/dev/null # 查找历史记录文件',
          'find / -name "*.pcap" -o -name "*.cap" 2>/dev/null # 查找网络捕获文件',
          'find / -name "core" -type f 2>/dev/null # 查找核心转储文件',

          // 高级查找和执行
          'find . -name "*.tmp" -delete      # 查找并删除临时文件',
          'find . -name "*.log" -exec ls -la {} \\; # 查找并显示详细信息',
          'find / -perm -4000 -exec ls -la {} \\; 2>/dev/null # 查找SUID并显示详情',
          'find / -type f -name "*.php" -exec grep -l "eval" {} \\; # 查找包含eval的PHP文件',
          'find /var/log -name "*.log" -exec tail -5 {} \\; # 查看日志文件末尾',

          // 排除和过滤
          'find / -name "*.txt" ! -path "*/proc/*" 2>/dev/null # 排除proc目录',
          'find / -type f -size +1G ! -path "*/var/log/*" 2>/dev/null # 排除日志目录的大文件'
        ],
        commonOptions: ['-name', '-type', '-size', '-mtime', '-user', '-perm', '-exec', '-delete'],
        category: 'security'
      },
      {
        command: 'locate',
        description: '快速查找文件（基于数据库）',
        usage: 'locate [选项] 模式',
        examples: [
          'locate filename.txt        # 快速查找文件',
          'locate -i FILENAME         # 忽略大小写查找',
          'locate -c "*.pdf"          # 统计匹配文件数量',
          'locate -r ".*\\.log$"      # 使用正则表达式查找',
          'updatedb                   # 更新locate数据库'
        ],
        commonOptions: ['-i', '-c', '-r', '-n'],
        category: 'file'
      },

      // 文本处理命令
      {
        command: 'cat',
        description: '连接并显示文件内容',
        usage: 'cat [选项] [文件...]',
        examples: [
          'cat file.txt              # 显示文件内容',
          'cat -n file.txt           # 显示行号',
          'cat -b file.txt           # 只对非空行显示行号',
          'cat -s file.txt           # 压缩连续空行',
          'cat file1 file2 > merged  # 合并文件',
          'cat -A file.txt           # 显示所有非打印字符',
          'cat > newfile.txt         # 创建新文件（Ctrl+D结束）',
          'cat << EOF > file.txt     # 使用here document创建文件'
        ],
        commonOptions: ['-n', '-b', '-s', '-A', '-E', '-T'],
        category: 'text'
      },
      {
        command: 'less',
        description: '分页显示文件内容（可向前向后翻页）',
        usage: 'less [选项] [文件...]',
        examples: [
          'less file.txt             # 分页查看文件',
          'less +G file.txt          # 从文件末尾开始查看',
          'less -N file.txt          # 显示行号',
          'less -S file.txt          # 不换行显示长行',
          'less +/pattern file.txt   # 打开文件并搜索pattern',
          'less -i file.txt          # 搜索时忽略大小写',
          'command | less            # 分页显示命令输出'
        ],
        commonOptions: ['+G', '-N', '-S', '-i', '-F', '-X'],
        category: 'text'
      },
      {
        command: 'more',
        description: '分页显示文件内容（只能向前翻页）',
        usage: 'more [选项] [文件...]',
        examples: [
          'more file.txt             # 分页查看文件',
          'more +10 file.txt         # 从第10行开始显示',
          'more -s file.txt          # 压缩连续空行',
          'command | more            # 分页显示命令输出'
        ],
        commonOptions: ['-s', '-f', '-p'],
        category: 'text'
      },
      {
        command: 'head',
        description: '显示文件开头指定行数的内容',
        usage: 'head [选项] [文件...]',
        examples: [
          'head file.txt             # 显示前10行（默认）',
          'head -n 20 file.txt       # 显示前20行',
          'head -c 100 file.txt      # 显示前100个字符',
          'head -5 file.txt          # 显示前5行（简写）',
          'head -n -5 file.txt       # 显示除最后5行外的所有行',
          'head file1.txt file2.txt  # 显示多个文件的开头',
          'head -q file1.txt file2.txt # 不显示文件名标题'
        ],
        commonOptions: ['-n', '-c', '-q', '-v'],
        category: 'text'
      },
      {
        command: 'tail',
        description: '显示文件结尾指定行数的内容',
        usage: 'tail [选项] [文件...]',
        examples: [
          'tail file.txt             # 显示最后10行（默认）',
          'tail -n 20 file.txt       # 显示最后20行',
          'tail -f file.log          # 实时跟踪文件变化',
          'tail -F file.log          # 跟踪文件，即使文件被重命名',
          'tail -c 100 file.txt      # 显示最后100个字符',
          'tail +10 file.txt         # 从第10行开始显示到末尾',
          'tail -f /var/log/syslog   # 实时查看系统日志',
          'tail -n 50 -f app.log     # 显示最后50行并跟踪'
        ],
        commonOptions: ['-n', '-f', '-F', '-c', '-q', '-v'],
        category: 'text'
      },
      {
        command: 'grep',
        description: '在文件中搜索匹配指定模式的行',
        usage: 'grep [选项] 模式 [文件...]',
        examples: [
          'grep "error" file.log      # 搜索包含error的行',
          'grep -i "ERROR" file.log   # 忽略大小写搜索',
          'grep -r "pattern" dir/     # 递归搜索目录',
          'grep -n "pattern" file     # 显示行号',
          'grep -v "pattern" file     # 显示不匹配的行',
          'grep -c "pattern" file     # 统计匹配行数',
          'grep -l "pattern" *.txt    # 只显示包含模式的文件名',
          'grep -A 3 -B 3 "error" log # 显示匹配行前后3行',
          'grep -E "pattern1|pattern2" file # 使用扩展正则表达式',
          'grep -w "word" file        # 匹配完整单词'
        ],
        commonOptions: ['-i', '-r', '-n', '-v', '-c', '-l', '-A', '-B', '-E', '-w'],
        category: 'text'
      },
      {
        command: 'awk',
        description: '强大的文本处理工具，支持模式扫描和数据提取',
        usage: 'awk [选项] \'程序\' [文件...]',
        examples: [
          'awk \'{print $1}\' file.txt    # 打印第一列',
          'awk \'{print NF}\' file.txt     # 打印每行字段数',
          'awk \'NR==5\' file.txt          # 打印第5行',
          'awk \'/pattern/ {print}\' file  # 打印匹配模式的行',
          'awk \'{sum+=$1} END {print sum}\' file # 计算第一列总和',
          'awk -F: \'{print $1}\' /etc/passwd # 以:为分隔符打印第一列'
        ],
        commonOptions: ['-F', '-v'],
        category: 'text'
      },
      {
        command: 'sed',
        description: '流编辑器，用于过滤和转换文本',
        usage: 'sed [选项] \'命令\' [文件...]',
        examples: [
          'sed \'s/old/new/g\' file.txt   # 替换所有old为new',
          'sed -i \'s/old/new/g\' file    # 直接修改文件',
          'sed \'5d\' file.txt            # 删除第5行',
          'sed \'1,5d\' file.txt          # 删除1-5行',
          'sed -n \'5,10p\' file.txt      # 只打印5-10行',
          'sed \'/pattern/d\' file.txt    # 删除匹配模式的行'
        ],
        commonOptions: ['-i', '-n', '-e'],
        category: 'text'
      },
      {
        command: 'sort',
        description: '对文本文件的行进行排序',
        usage: 'sort [选项] [文件...]',
        examples: [
          'sort file.txt              # 按字母顺序排序',
          'sort -n file.txt           # 按数值排序',
          'sort -r file.txt           # 逆序排序',
          'sort -u file.txt           # 排序并去重',
          'sort -k2 file.txt          # 按第2列排序',
          'sort -t: -k3 /etc/passwd   # 以:分隔，按第3列排序'
        ],
        commonOptions: ['-n', '-r', '-u', '-k', '-t'],
        category: 'text'
      },
      {
        command: 'uniq',
        description: '报告或删除重复的行',
        usage: 'uniq [选项] [文件...]',
        examples: [
          'uniq file.txt              # 删除相邻重复行',
          'uniq -c file.txt           # 统计每行出现次数',
          'uniq -d file.txt           # 只显示重复行',
          'uniq -u file.txt           # 只显示唯一行',
          'sort file.txt | uniq       # 先排序再去重'
        ],
        commonOptions: ['-c', '-d', '-u', '-i'],
        category: 'text'
      },
      {
        command: 'wc',
        description: '统计文件的行数、单词数和字符数',
        usage: 'wc [选项] [文件...]',
        examples: [
          'wc file.txt                # 显示行数、单词数、字符数',
          'wc -l file.txt             # 只显示行数',
          'wc -w file.txt             # 只显示单词数',
          'wc -c file.txt             # 只显示字符数',
          'wc -m file.txt             # 显示字符数（多字节字符）',
          'ls | wc -l                 # 统计当前目录文件数'
        ],
        commonOptions: ['-l', '-w', '-c', '-m'],
        category: 'text'
      },

      // 系统信息命令
      {
        command: 'ps',
        description: '显示当前运行的进程信息',
        usage: 'ps [选项]',
        examples: [
          'ps aux                     # 显示所有进程详细信息',
          'ps -ef                     # 显示所有进程（另一种格式）',
          'ps -u username             # 显示指定用户的进程',
          'ps -p 1234                 # 显示指定PID的进程',
          'ps -C firefox              # 显示指定命令名的进程',
          'ps --forest               # 以树状格式显示进程',
          'ps aux | grep nginx        # 查找nginx进程',
          'ps -eo pid,ppid,cmd,%mem,%cpu # 自定义显示列'
        ],
        commonOptions: ['aux', '-ef', '-u', '-p', '-C', '--forest'],
        category: 'process'
      },
      {
        command: 'top',
        description: '实时显示系统进程信息',
        usage: 'top [选项]',
        examples: [
          'top                        # 实时显示进程',
          'top -u username            # 显示指定用户进程',
          'top -p 1234                # 监控指定PID',
          'top -n 1                   # 只刷新一次后退出',
          'top -d 5                   # 每5秒刷新一次',
          'top -o %CPU                # 按CPU使用率排序',
          'top -o %MEM                # 按内存使用率排序'
        ],
        commonOptions: ['-u', '-p', '-n', '-d', '-o'],
        category: 'process'
      },
      {
        command: 'htop',
        description: '交互式进程查看器（top的增强版）',
        usage: 'htop [选项]',
        examples: [
          'htop                       # 启动htop',
          'htop -u username           # 只显示指定用户进程',
          'htop -p 1234,5678          # 监控指定PID',
          'htop -t                    # 以树状显示进程',
          'htop -s PERCENT_CPU        # 按CPU排序启动'
        ],
        commonOptions: ['-u', '-p', '-t', '-s'],
        category: 'process'
      },
      {
        command: 'kill',
        description: '终止进程',
        usage: 'kill [选项] PID...',
        examples: [
          'kill 1234                  # 终止PID为1234的进程',
          'kill -9 1234               # 强制终止进程',
          'kill -TERM 1234            # 发送TERM信号',
          'kill -HUP 1234             # 发送HUP信号（重新加载配置）',
          'killall firefox            # 终止所有firefox进程',
          'pkill -f "python script"   # 根据命令行匹配终止进程'
        ],
        commonOptions: ['-9', '-TERM', '-HUP', '-KILL'],
        category: 'process'
      },
      {
        command: 'jobs',
        description: '显示当前shell的作业状态',
        usage: 'jobs [选项]',
        examples: [
          'jobs                       # 显示所有作业',
          'jobs -l                    # 显示作业PID',
          'jobs -p                    # 只显示PID',
          'jobs -r                    # 只显示运行中的作业',
          'jobs -s                    # 只显示停止的作业'
        ],
        commonOptions: ['-l', '-p', '-r', '-s'],
        category: 'process'
      },
      {
        command: 'nohup',
        description: '运行命令，忽略挂起信号',
        usage: 'nohup 命令 [参数...] &',
        examples: [
          'nohup python script.py &   # 后台运行脚本',
          'nohup ./long_task.sh > output.log 2>&1 & # 重定向输出',
          'nohup command > /dev/null 2>&1 & # 忽略所有输出'
        ],
        category: 'process'
      },

      {
        command: 'df',
        description: '显示文件系统磁盘空间使用情况',
        usage: 'df [选项] [文件系统...]',
        examples: [
          'df -h                      # 以人类可读格式显示',
          'df -i                      # 显示inode使用情况',
          'df -T                      # 显示文件系统类型',
          'df /home                   # 显示指定目录所在文件系统',
          'df -x tmpfs                # 排除tmpfs文件系统',
          'df --total                 # 显示总计',
          'df -h /dev/sda1            # 显示指定分区信息'
        ],
        commonOptions: ['-h', '-i', '-T', '-x', '--total'],
        category: 'system'
      },
      {
        command: 'du',
        description: '显示目录和文件的磁盘使用情况',
        usage: 'du [选项] [目录/文件...]',
        examples: [
          'du -h                      # 以人类可读格式显示',
          'du -s                      # 只显示总计',
          'du -sh *                   # 显示当前目录下各项大小',
          'du -a                      # 显示所有文件和目录',
          'du -d 1                    # 只显示1级深度',
          'du -h --max-depth=2        # 最大深度2级',
          'du -sh /var/log            # 显示日志目录大小',
          'du -h | sort -hr           # 按大小排序显示'
        ],
        commonOptions: ['-h', '-s', '-a', '-d', '--max-depth'],
        category: 'system'
      },
      {
        command: 'free',
        description: '显示系统内存使用情况',
        usage: 'free [选项]',
        examples: [
          'free -h                    # 以人类可读格式显示',
          'free -m                    # 以MB为单位显示',
          'free -g                    # 以GB为单位显示',
          'free -s 5                  # 每5秒刷新一次',
          'free -t                    # 显示总计行',
          'free -w                    # 显示宽格式输出'
        ],
        commonOptions: ['-h', '-m', '-g', '-s', '-t', '-w'],
        category: 'system'
      },
      {
        command: 'uptime',
        description: '显示系统运行时间和负载',
        usage: 'uptime [选项]',
        examples: [
          'uptime                     # 显示运行时间和负载',
          'uptime -p                  # 以友好格式显示运行时间',
          'uptime -s                  # 显示系统启动时间'
        ],
        commonOptions: ['-p', '-s'],
        category: 'system'
      },
      {
        command: 'uname',
        description: '显示系统信息',
        usage: 'uname [选项]',
        examples: [
          'uname -a                   # 显示所有信息',
          'uname -s                   # 显示内核名称',
          'uname -r                   # 显示内核版本',
          'uname -m                   # 显示机器架构',
          'uname -o                   # 显示操作系统'
        ],
        commonOptions: ['-a', '-s', '-r', '-m', '-o'],
        category: 'system'
      },
      {
        command: 'whoami',
        description: '显示当前用户名',
        usage: 'whoami',
        examples: [
          'whoami                     # 显示当前用户名'
        ],
        category: 'system'
      },
      {
        command: 'who',
        description: '显示当前登录的用户',
        usage: 'who [选项]',
        examples: [
          'who                        # 显示登录用户',
          'who -a                     # 显示所有信息',
          'who -b                     # 显示系统启动时间',
          'who -r                     # 显示运行级别'
        ],
        commonOptions: ['-a', '-b', '-r'],
        category: 'system'
      },
      {
        command: 'id',
        description: '显示用户和组ID',
        usage: 'id [选项] [用户名]',
        examples: [
          'id                         # 显示当前用户ID信息',
          'id username                # 显示指定用户ID信息',
          'id -u                      # 只显示用户ID',
          'id -g                      # 只显示组ID',
          'id -G                      # 显示所有组ID'
        ],
        commonOptions: ['-u', '-g', '-G', '-n'],
        category: 'system'
      },

      // 网络命令
      {
        command: 'ping',
        description: '测试网络连通性',
        usage: 'ping [选项] 主机',
        examples: [
          'ping google.com            # 测试连通性',
          'ping -c 4 host             # 发送4个包后停止',
          'ping -i 2 host             # 每2秒发送一个包',
          'ping -s 1024 host          # 设置包大小为1024字节',
          'ping -t 64 host            # 设置TTL为64',
          'ping -W 5 host             # 设置超时时间为5秒',
          'ping6 ipv6.google.com      # 测试IPv6连通性'
        ],
        commonOptions: ['-c', '-i', '-s', '-t', '-W'],
        category: 'network'
      },
      {
        command: 'wget',
        description: '从网络下载文件的命令行工具',
        usage: 'wget [选项] URL...',
        examples: [
          'wget http://example.com/file.zip # 下载文件',
          'wget -O newname.zip URL          # 指定保存文件名',
          'wget -c URL                      # 断点续传',
          'wget -r http://example.com/      # 递归下载整个网站',
          'wget -P /tmp/ URL                # 指定下载目录',
          'wget --limit-rate=200k URL       # 限制下载速度',
          'wget -t 3 URL                    # 重试3次',
          'wget -b URL                      # 后台下载',
          'wget --user-agent="Mozilla" URL  # 设置User-Agent',
          'wget --header="Cookie: name=value" URL # 设置HTTP头'
        ],
        commonOptions: ['-O', '-c', '-r', '-P', '--limit-rate', '-t', '-b'],
        category: 'network'
      },
      {
        command: 'curl',
        description: '传输数据的命令行工具，支持多种协议',
        usage: 'curl [选项] URL...',
        examples: [
          'curl http://example.com          # 获取网页内容',
          'curl -O URL                      # 下载文件（保持原名）',
          'curl -o filename URL             # 下载文件并指定名称',
          'curl -X POST -d "data" URL       # 发送POST请求',
          'curl -H "Content-Type: application/json" URL # 设置请求头',
          'curl -u user:pass URL            # HTTP基本认证',
          'curl -L URL                      # 跟随重定向',
          'curl -I URL                      # 只获取HTTP头',
          'curl -s URL                      # 静默模式',
          'curl -w "%{http_code}" URL       # 显示HTTP状态码'
        ],
        commonOptions: ['-O', '-o', '-X', '-d', '-H', '-u', '-L', '-I', '-s'],
        category: 'network'
      },
      {
        command: 'ssh',
        description: '安全Shell远程登录工具',
        usage: 'ssh [选项] [用户@]主机 [命令]',
        examples: [
          'ssh user@server.com             # 登录远程服务器',
          'ssh -p 2222 user@server         # 指定端口登录',
          'ssh -i ~/.ssh/key user@server   # 使用私钥登录',
          'ssh user@server "ls -la"        # 执行远程命令',
          'ssh -L 8080:localhost:80 server # 本地端口转发',
          'ssh -R 8080:localhost:80 server # 远程端口转发',
          'ssh -X user@server              # 启用X11转发',
          'ssh -N -L 8080:localhost:80 server # 只做端口转发'
        ],
        commonOptions: ['-p', '-i', '-L', '-R', '-X', '-N'],
        category: 'network'
      },
      {
        command: 'scp',
        description: '通过SSH安全复制文件',
        usage: 'scp [选项] 源 目标',
        examples: [
          'scp file.txt user@server:/path/ # 上传文件',
          'scp user@server:/path/file.txt . # 下载文件',
          'scp -r dir/ user@server:/path/  # 递归复制目录',
          'scp -P 2222 file user@server:/  # 指定端口',
          'scp -i key file user@server:/   # 使用私钥'
        ],
        commonOptions: ['-r', '-P', '-i', '-v'],
        category: 'network'
      },
      {
        command: 'rsync',
        description: '高效的文件同步工具',
        usage: 'rsync [选项] 源 目标',
        examples: [
          'rsync -av src/ dest/            # 同步目录',
          'rsync -av --delete src/ dest/   # 同步并删除目标多余文件',
          'rsync -av src/ user@server:dest/ # 远程同步',
          'rsync -av --exclude="*.tmp" src/ dest/ # 排除文件',
          'rsync -av --progress src/ dest/ # 显示进度',
          'rsync -n -av src/ dest/         # 干运行（不实际执行）'
        ],
        commonOptions: ['-a', '-v', '--delete', '--exclude', '--progress', '-n'],
        category: 'network'
      },
      {
        command: 'netstat',
        description: '显示网络连接、路由表和网络接口信息',
        usage: 'netstat [选项]',
        examples: [
          'netstat -tuln                   # 显示所有监听端口',
          'netstat -an                     # 显示所有连接',
          'netstat -rn                     # 显示路由表',
          'netstat -i                      # 显示网络接口',
          'netstat -p                      # 显示进程信息',
          'netstat -c                      # 连续显示'
        ],
        commonOptions: ['-t', '-u', '-l', '-n', '-a', '-r', '-i', '-p'],
        category: 'network'
      },

      // 权限命令
      {
        command: 'chmod',
        description: '修改文件和目录的访问权限',
        usage: 'chmod [选项] 权限 文件...',
        examples: [
          'chmod 755 file.sh              # 设置权限为755',
          'chmod +x file.sh               # 添加执行权限',
          'chmod -x file.sh               # 移除执行权限',
          'chmod u+w file.txt             # 给所有者添加写权限',
          'chmod g-r file.txt             # 移除组的读权限',
          'chmod o=r file.txt             # 设置其他用户只读',
          'chmod -R 644 dir/              # 递归设置目录权限',
          'chmod a+x script.sh            # 给所有用户添加执行权限',
          'chmod 4755 program             # 设置SUID位'
        ],
        commonOptions: ['-R', '-v', '-c'],
        category: 'permission'
      },
      {
        command: 'chown',
        description: '修改文件和目录的所有者和所属组',
        usage: 'chown [选项] [所有者][:组] 文件...',
        examples: [
          'chown user file.txt             # 修改所有者',
          'chown user:group file.txt       # 修改所有者和组',
          'chown :group file.txt           # 只修改组',
          'chown -R user:group dir/        # 递归修改',
          'chown --reference=ref file.txt  # 参考其他文件的所有权',
          'chown -v user file.txt          # 详细显示修改过程'
        ],
        commonOptions: ['-R', '-v', '--reference'],
        category: 'permission'
      },
      {
        command: 'chgrp',
        description: '修改文件和目录的所属组',
        usage: 'chgrp [选项] 组 文件...',
        examples: [
          'chgrp group file.txt            # 修改文件所属组',
          'chgrp -R group dir/             # 递归修改目录',
          'chgrp --reference=ref file.txt  # 参考其他文件的组'
        ],
        commonOptions: ['-R', '-v', '--reference'],
        category: 'permission'
      },
      {
        command: 'umask',
        description: '设置文件创建时的默认权限掩码',
        usage: 'umask [权限掩码]',
        examples: [
          'umask                           # 显示当前umask值',
          'umask 022                       # 设置umask为022',
          'umask -S                        # 以符号形式显示umask'
        ],
        commonOptions: ['-S'],
        category: 'permission'
      },

      // 压缩命令
      {
        command: 'tar',
        description: '打包和解包文件的归档工具',
        usage: 'tar [选项] [归档文件] [文件/目录...]',
        examples: [
          'tar -czf archive.tar.gz dir/    # 创建gzip压缩包',
          'tar -cjf archive.tar.bz2 dir/   # 创建bzip2压缩包',
          'tar -xzf archive.tar.gz         # 解压gzip压缩包',
          'tar -xjf archive.tar.bz2        # 解压bzip2压缩包',
          'tar -tzf archive.tar.gz         # 查看压缩包内容',
          'tar -xzf archive.tar.gz -C /tmp # 解压到指定目录',
          'tar -czf backup.tar.gz --exclude="*.log" dir/ # 排除文件',
          'tar -rf archive.tar newfile     # 向归档添加文件',
          'tar -df archive.tar             # 比较归档和文件系统'
        ],
        commonOptions: ['-c', '-x', '-t', '-z', '-j', '-f', '-v', '-C'],
        category: 'archive'
      },
      {
        command: 'zip',
        description: '创建ZIP格式的压缩文件',
        usage: 'zip [选项] 压缩文件名 文件/目录...',
        examples: [
          'zip archive.zip file1 file2     # 创建zip文件',
          'zip -r archive.zip dir/         # 递归压缩目录',
          'zip -u archive.zip newfile      # 更新zip文件',
          'zip -d archive.zip file         # 从zip中删除文件',
          'zip -x "*.log" -r archive.zip dir/ # 排除文件压缩',
          'zip -9 archive.zip file         # 最高压缩率',
          'zip -0 archive.zip file         # 不压缩（仅打包）',
          'zip -P password archive.zip file # 设置密码'
        ],
        commonOptions: ['-r', '-u', '-d', '-x', '-9', '-0', '-P'],
        category: 'archive'
      },
      {
        command: 'unzip',
        description: '解压ZIP格式的压缩文件',
        usage: 'unzip [选项] 压缩文件名 [文件...]',
        examples: [
          'unzip archive.zip              # 解压zip文件',
          'unzip -d /tmp/ archive.zip     # 解压到指定目录',
          'unzip -l archive.zip           # 列出压缩包内容',
          'unzip -t archive.zip           # 测试压缩包完整性',
          'unzip -o archive.zip           # 覆盖已存在文件',
          'unzip -n archive.zip           # 不覆盖已存在文件',
          'unzip archive.zip "*.txt"      # 只解压txt文件',
          'unzip -P password archive.zip  # 使用密码解压'
        ],
        commonOptions: ['-d', '-l', '-t', '-o', '-n', '-P'],
        category: 'archive'
      },
      {
        command: 'gzip',
        description: 'GNU zip压缩工具',
        usage: 'gzip [选项] [文件...]',
        examples: [
          'gzip file.txt                  # 压缩文件（原文件被替换）',
          'gzip -k file.txt               # 压缩文件（保留原文件）',
          'gzip -d file.txt.gz            # 解压文件',
          'gzip -9 file.txt               # 最高压缩率',
          'gzip -1 file.txt               # 最快压缩',
          'gzip -r dir/                   # 递归压缩目录中的文件',
          'gzip -t file.txt.gz            # 测试压缩文件完整性'
        ],
        commonOptions: ['-k', '-d', '-9', '-1', '-r', '-t'],
        category: 'archive'
      },
      {
        command: 'gunzip',
        description: '解压gzip压缩文件',
        usage: 'gunzip [选项] [文件...]',
        examples: [
          'gunzip file.txt.gz             # 解压文件',
          'gunzip -k file.txt.gz          # 解压文件（保留压缩文件）',
          'gunzip -t file.txt.gz          # 测试文件完整性',
          'gunzip -r dir/                 # 递归解压目录中的文件'
        ],
        commonOptions: ['-k', '-t', '-r'],
        category: 'archive'
      },

      // 其他常用命令
      {
        command: 'history',
        description: '显示和管理命令历史记录',
        usage: 'history [选项] [n]',
        examples: [
          'history                        # 显示所有命令历史',
          'history 10                     # 显示最近10条命令',
          'history -c                     # 清空当前会话历史',
          'history -w                     # 将历史写入文件',
          'history -r                     # 从文件读取历史',
          'history -d 100                 # 删除第100条历史记录',
          '!100                           # 执行第100条历史命令',
          '!!                             # 执行上一条命令',
          '!grep                          # 执行最近的grep命令'
        ],
        commonOptions: ['-c', '-w', '-r', '-d'],
        category: 'other'
      },
      {
        command: 'alias',
        description: '创建和管理命令别名',
        usage: 'alias [名称[=值]]',
        examples: [
          'alias ll="ls -la"              # 创建别名',
          'alias la="ls -A"               # 创建别名',
          'alias ..="cd .."               # 创建别名',
          'alias                          # 显示所有别名',
          'alias ll                       # 显示特定别名',
          'unalias ll                     # 删除别名',
          'unalias -a                     # 删除所有别名',
          '\\ll                           # 忽略别名执行原命令'
        ],
        category: 'other'
      },
      {
        command: 'which',
        description: '显示命令的完整路径',
        usage: 'which [选项] 命令...',
        examples: [
          'which ls                       # 显示ls命令路径',
          'which -a python                # 显示所有python路径',
          'which python java gcc          # 查找多个命令'
        ],
        commonOptions: ['-a'],
        category: 'other'
      },
      {
        command: 'whereis',
        description: '查找命令的二进制文件、源码和手册页',
        usage: 'whereis [选项] 命令...',
        examples: [
          'whereis ls                     # 查找ls相关文件',
          'whereis -b ls                  # 只查找二进制文件',
          'whereis -m ls                  # 只查找手册页',
          'whereis -s gcc                 # 只查找源码'
        ],
        commonOptions: ['-b', '-m', '-s'],
        category: 'other'
      },
      {
        command: 'type',
        description: '显示命令的类型和定义',
        usage: 'type [选项] 命令...',
        examples: [
          'type ls                        # 显示ls命令类型',
          'type -a ls                     # 显示所有ls定义',
          'type -t ls                     # 只显示类型',
          'type cd                        # 显示内建命令'
        ],
        commonOptions: ['-a', '-t'],
        category: 'other'
      },
      {
        command: 'man',
        description: '显示命令的手册页',
        usage: 'man [选项] [章节] 命令',
        examples: [
          'man ls                         # 显示ls手册',
          'man 5 passwd                   # 显示passwd文件格式手册',
          'man -k keyword                 # 搜索包含关键词的手册',
          'man -f command                 # 显示命令的简短描述',
          'man -a intro                   # 显示所有intro手册页'
        ],
        commonOptions: ['-k', '-f', '-a'],
        category: 'other'
      },
      {
        command: 'info',
        description: '显示GNU info文档',
        usage: 'info [选项] [主题]',
        examples: [
          'info ls                        # 显示ls的info文档',
          'info coreutils                 # 显示核心工具文档',
          'info --help                    # 显示info帮助'
        ],
        category: 'other'
      },
      {
        command: 'help',
        description: '显示内建命令的帮助信息',
        usage: 'help [命令]',
        examples: [
          'help                           # 显示所有内建命令',
          'help cd                        # 显示cd命令帮助',
          'help if                        # 显示if语句帮助'
        ],
        category: 'other'
      },
      {
        command: 'date',
        description: '显示或设置系统日期',
        usage: 'date [选项] [+格式] [日期]',
        examples: [
          'date                           # 显示当前日期时间',
          'date +"%Y-%m-%d"               # 格式化显示日期',
          'date +"%H:%M:%S"               # 显示时间',
          'date -d "yesterday"            # 显示昨天日期',
          'date -d "next week"            # 显示下周日期',
          'date -s "2023-12-25 10:30:00" # 设置系统时间'
        ],
        commonOptions: ['-d', '-s', '-u'],
        category: 'other'
      },
      {
        command: 'cal',
        description: '显示日历',
        usage: 'cal [选项] [月] [年]',
        examples: [
          'cal                            # 显示当前月日历',
          'cal 2023                       # 显示2023年日历',
          'cal 12 2023                    # 显示2023年12月日历',
          'cal -y                         # 显示当前年日历',
          'cal -3                         # 显示前后三个月'
        ],
        commonOptions: ['-y', '-3', '-m'],
        category: 'other'
      },
      {
        command: 'echo',
        description: '显示文本行',
        usage: 'echo [选项] [字符串...]',
        examples: [
          'echo "Hello World"             # 显示文本',
          'echo -n "No newline"           # 不换行输出',
          'echo -e "Line1\\nLine2"        # 解释转义字符',
          'echo $HOME                     # 显示环境变量',
          'echo "Current time: $(date)"   # 命令替换',
          'echo {1..5}                    # 大括号扩展'
        ],
        commonOptions: ['-n', '-e', '-E'],
        category: 'other'
      },
      {
        command: 'env',
        description: '显示环境变量或在修改的环境中运行命令',
        usage: 'env [选项] [变量=值...] [命令 [参数...]]',
        examples: [
          'env                            # 显示所有环境变量',
          'env | grep PATH                # 查找PATH变量',
          'env VAR=value command          # 设置变量运行命令',
          'env -i command                 # 在空环境中运行命令',
          'env -u VAR command             # 取消设置变量运行命令'
        ],
        commonOptions: ['-i', '-u'],
        category: 'other'
      },
      {
        command: 'export',
        description: '设置或显示环境变量',
        usage: 'export [选项] [变量[=值]...]',
        examples: [
          'export                         # 显示所有导出的变量',
          'export PATH=$PATH:/new/path    # 添加到PATH',
          'export EDITOR=vim              # 设置默认编辑器',
          'export -n VAR                  # 取消导出变量',
          'export -p                      # 显示所有导出变量'
        ],
        commonOptions: ['-n', '-p'],
        category: 'other'
      },
      {
        command: 'source',
        description: '在当前shell中执行脚本',
        usage: 'source 文件名 [参数...]',
        examples: [
          'source ~/.bashrc               # 重新加载配置文件',
          'source script.sh               # 执行脚本',
          '. ~/.profile                   # 等同于source'
        ],
        category: 'other'
      },
      {
        command: 'exit',
        description: '退出shell',
        usage: 'exit [退出码]',
        examples: [
          'exit                           # 正常退出',
          'exit 0                         # 成功退出',
          'exit 1                         # 错误退出'
        ],
        category: 'other'
      },

      // 应急响应和网络安全命令
      {
        command: 'netstat',
        description: '显示网络连接、路由表和网络接口统计信息',
        usage: 'netstat [选项]',
        examples: [
          'netstat -tuln                  # 显示所有TCP/UDP监听端口',
          'netstat -an                    # 显示所有网络连接',
          'netstat -rn                    # 显示路由表',
          'netstat -i                     # 显示网络接口统计',
          'netstat -p                     # 显示进程PID和名称',
          'netstat -c                     # 连续显示网络状态',
          'netstat -s                     # 显示网络统计信息',
          'netstat -tuln | grep :22       # 检查SSH端口是否开放',
          'netstat -an | grep ESTABLISHED # 显示已建立的连接',
          'netstat -an | grep TIME_WAIT   # 显示TIME_WAIT状态连接'
        ],
        commonOptions: ['-t', '-u', '-l', '-n', '-a', '-r', '-i', '-p', '-s', '-c'],
        category: 'security'
      },
      {
        command: 'ss',
        description: '现代化的网络连接查看工具（netstat的替代品）',
        usage: 'ss [选项] [过滤器]',
        examples: [
          'ss -tuln                       # 显示所有TCP/UDP监听端口',
          'ss -an                         # 显示所有套接字',
          'ss -p                          # 显示进程信息',
          'ss -s                          # 显示套接字统计',
          'ss -o state established        # 显示已建立的连接',
          'ss -t state listening          # 显示TCP监听端口',
          'ss dst :80                     # 显示连接到80端口的连接',
          'ss src 192.168.1.100           # 显示来自特定IP的连接',
          'ss -4 state close-wait         # 显示IPv4 CLOSE_WAIT状态',
          'ss -K dst 192.168.1.100        # 强制关闭到特定IP的连接'
        ],
        commonOptions: ['-t', '-u', '-l', '-n', '-a', '-p', '-s', '-o', '-4', '-6'],
        category: 'security'
      },
      {
        command: 'lsof',
        description: '列出打开的文件和网络连接',
        usage: 'lsof [选项] [文件/目录]',
        examples: [
          'lsof                           # 列出所有打开的文件',
          'lsof -i                        # 显示所有网络连接',
          'lsof -i :80                    # 显示80端口的连接',
          'lsof -i tcp:22                 # 显示SSH连接',
          'lsof -u username               # 显示用户打开的文件',
          'lsof -p 1234                   # 显示进程打开的文件',
          'lsof -c nginx                  # 显示nginx进程的文件',
          'lsof /var/log/messages         # 显示谁在使用日志文件',
          'lsof -i @192.168.1.100         # 显示与特定IP的连接',
          'lsof -t -i :80 | xargs kill    # 杀死占用80端口的进程'
        ],
        commonOptions: ['-i', '-u', '-p', '-c', '-t', '-n'],
        category: 'security'
      },
      {
        command: 'iptables',
        description: 'Linux防火墙规则管理工具',
        usage: 'iptables [选项] [链] [规则]',
        examples: [
          'iptables -L                    # 列出所有规则',
          'iptables -L -n                 # 以数字形式显示规则',
          'iptables -L -v                 # 详细显示规则和计数',
          'iptables -A INPUT -p tcp --dport 22 -j ACCEPT # 允许SSH',
          'iptables -A INPUT -s 192.168.1.0/24 -j ACCEPT # 允许内网',
          'iptables -A INPUT -p tcp --dport 80 -j DROP # 阻止HTTP',
          'iptables -D INPUT 1            # 删除INPUT链第1条规则',
          'iptables -F                    # 清空所有规则',
          'iptables -P INPUT DROP         # 设置INPUT链默认策略为DROP',
          'iptables-save > /tmp/rules     # 保存当前规则'
        ],
        commonOptions: ['-L', '-A', '-D', '-I', '-F', '-P', '-n', '-v'],
        category: 'security'
      },
      {
        command: 'tcpdump',
        description: '网络数据包捕获和分析工具',
        usage: 'tcpdump [选项] [过滤表达式]',
        examples: [
          'tcpdump -i eth0                # 捕获eth0接口数据包',
          'tcpdump -i any                 # 捕获所有接口数据包',
          'tcpdump host 192.168.1.100     # 捕获特定主机流量',
          'tcpdump port 80                # 捕获HTTP流量',
          'tcpdump -n port 22             # 捕获SSH流量（不解析主机名）',
          'tcpdump -w capture.pcap        # 保存到文件',
          'tcpdump -r capture.pcap        # 读取文件',
          'tcpdump -A port 80             # 以ASCII显示HTTP内容',
          'tcpdump -X icmp                # 以十六进制显示ICMP包',
          'tcpdump src 192.168.1.100 and dst port 443 # 复杂过滤'
        ],
        commonOptions: ['-i', '-n', '-w', '-r', '-A', '-X', '-v', '-c'],
        category: 'security'
      },
      {
        command: 'nmap',
        description: '网络发现和安全审计工具',
        usage: 'nmap [选项] [目标]',
        examples: [
          'nmap 192.168.1.1               # 扫描单个主机',
          'nmap 192.168.1.0/24            # 扫描整个网段',
          'nmap -sS 192.168.1.1           # SYN扫描（隐蔽扫描）',
          'nmap -sU 192.168.1.1           # UDP扫描',
          'nmap -O 192.168.1.1            # 操作系统检测',
          'nmap -sV 192.168.1.1           # 服务版本检测',
          'nmap -A 192.168.1.1            # 全面扫描（OS+版本+脚本）',
          'nmap -p 1-1000 192.168.1.1     # 扫描指定端口范围',
          'nmap -sn 192.168.1.0/24        # 主机发现（ping扫描）',
          'nmap --script vuln 192.168.1.1 # 漏洞扫描脚本'
        ],
        commonOptions: ['-sS', '-sU', '-O', '-sV', '-A', '-p', '-sn', '--script'],
        category: 'security'
      },
      {
        command: 'wireshark',
        description: '图形化网络协议分析器',
        usage: 'wireshark [选项] [文件]',
        examples: [
          'wireshark                      # 启动图形界面',
          'wireshark capture.pcap         # 打开捕获文件',
          'tshark -i eth0                 # 命令行版本实时捕获',
          'tshark -r capture.pcap         # 命令行版本读取文件',
          'tshark -i eth0 -w output.pcap  # 捕获并保存',
          'tshark -Y "http"               # 过滤HTTP流量',
          'tshark -Y "ip.addr==192.168.1.100" # 过滤特定IP'
        ],
        commonOptions: ['-i', '-r', '-w', '-Y', '-f'],
        category: 'security'
      },
      {
        command: 'fail2ban-client',
        description: 'Fail2ban入侵防护系统客户端',
        usage: 'fail2ban-client [命令] [选项]',
        examples: [
          'fail2ban-client status         # 显示服务状态',
          'fail2ban-client status sshd    # 显示SSH jail状态',
          'fail2ban-client set sshd banip 192.168.1.100 # 手动封禁IP',
          'fail2ban-client set sshd unbanip 192.168.1.100 # 解封IP',
          'fail2ban-client reload         # 重新加载配置',
          'fail2ban-client start          # 启动服务',
          'fail2ban-client stop           # 停止服务'
        ],
        category: 'security'
      },
      {
        command: 'chkrootkit',
        description: 'Rootkit检测工具',
        usage: 'chkrootkit [选项]',
        examples: [
          'chkrootkit                     # 执行完整rootkit检查',
          'chkrootkit -q                  # 静默模式，只显示可疑项',
          'chkrootkit -x                  # 专家模式，显示详细信息',
          'chkrootkit -r /mnt/suspect     # 检查挂载的可疑系统',
          'chkrootkit -n                  # 跳过NFS挂载检查'
        ],
        commonOptions: ['-q', '-x', '-r', '-n'],
        category: 'security'
      },
      {
        command: 'rkhunter',
        description: 'Rootkit Hunter - 另一个rootkit检测工具',
        usage: 'rkhunter [选项]',
        examples: [
          'rkhunter --check               # 执行完整系统检查',
          'rkhunter --update              # 更新数据库',
          'rkhunter --propupd             # 更新文件属性数据库',
          'rkhunter --check --sk          # 检查时跳过按键确认',
          'rkhunter --check --rwo         # 只报告警告',
          'rkhunter -c --enable all --disable none # 启用所有检查'
        ],
        commonOptions: ['--check', '--update', '--propupd', '--sk', '--rwo'],
        category: 'security'
      },
      {
        command: 'lynis',
        description: '系统安全审计工具',
        usage: 'lynis [模式] [选项]',
        examples: [
          'lynis audit system             # 执行系统安全审计',
          'lynis audit system --quick     # 快速审计',
          'lynis audit dockerfile Dockerfile # 审计Docker文件',
          'lynis show version             # 显示版本信息',
          'lynis show profiles            # 显示可用配置文件',
          'lynis update info              # 检查更新信息'
        ],
        commonOptions: ['audit', 'show', 'update', '--quick'],
        category: 'security'
      },
      {
        command: 'aide',
        description: '高级入侵检测环境 - 文件完整性检查',
        usage: 'aide [选项]',
        examples: [
          'aide --init                    # 初始化数据库',
          'aide --check                   # 检查文件完整性',
          'aide --update                  # 更新数据库',
          'aide --config=/etc/aide.conf --check # 指定配置文件检查',
          'aide --verbose --check         # 详细模式检查'
        ],
        commonOptions: ['--init', '--check', '--update', '--config', '--verbose'],
        category: 'security'
      },
      {
        command: 'last',
        description: '显示用户登录历史记录',
        usage: 'last [选项] [用户名] [终端]',
        examples: [
          'last                           # 显示所有登录记录',
          'last root                      # 显示root用户登录记录',
          'last -n 10                     # 显示最近10条记录',
          'last -t 20231225               # 显示指定日期前的记录',
          'last -f /var/log/wtmp          # 指定日志文件',
          'last -i                        # 显示IP地址而不是主机名',
          'last -w                        # 显示完整用户名和域名',
          'last reboot                    # 显示系统重启记录'
        ],
        commonOptions: ['-n', '-t', '-f', '-i', '-w'],
        category: 'security'
      },
      {
        command: 'lastlog',
        description: '显示所有用户的最后登录信息',
        usage: 'lastlog [选项]',
        examples: [
          'lastlog                        # 显示所有用户最后登录',
          'lastlog -u root                # 显示root用户最后登录',
          'lastlog -t 7                   # 显示7天内登录的用户',
          'lastlog -b 30                  # 显示30天前登录的用户'
        ],
        commonOptions: ['-u', '-t', '-b'],
        category: 'security'
      },
      {
        command: 'w',
        description: '显示当前登录用户及其活动',
        usage: 'w [选项] [用户名]',
        examples: [
          'w                              # 显示所有登录用户',
          'w root                         # 显示root用户活动',
          'w -h                           # 不显示标题',
          'w -s                           # 短格式显示',
          'w -f                           # 显示远程主机名',
          'w -i                           # 显示IP地址'
        ],
        commonOptions: ['-h', '-s', '-f', '-i'],
        category: 'security'
      },
      {
        command: 'ausearch',
        description: '搜索Linux审计日志',
        usage: 'ausearch [选项]',
        examples: [
          'ausearch -m LOGIN              # 搜索登录事件',
          'ausearch -m USER_LOGIN         # 搜索用户登录事件',
          'ausearch -ui 0                 # 搜索root用户活动',
          'ausearch -f /etc/passwd        # 搜索passwd文件访问',
          'ausearch -k password_change    # 搜索密码修改事件',
          'ausearch -ts today             # 搜索今天的事件',
          'ausearch -ts 10:00 -te 11:00   # 搜索时间范围内事件',
          'ausearch -x /bin/su            # 搜索su命令执行'
        ],
        commonOptions: ['-m', '-ui', '-f', '-k', '-ts', '-te', '-x'],
        category: 'security'
      },
      {
        command: 'aureport',
        description: '生成Linux审计报告',
        usage: 'aureport [选项]',
        examples: [
          'aureport                       # 生成总体审计报告',
          'aureport -au                   # 认证报告',
          'aureport -l                    # 登录报告',
          'aureport -f                    # 文件访问报告',
          'aureport -s                    # 系统调用报告',
          'aureport -u                    # 用户活动报告',
          'aureport -x                    # 可执行文件报告',
          'aureport --summary             # 摘要报告',
          'aureport -ts today             # 今天的报告'
        ],
        commonOptions: ['-au', '-l', '-f', '-s', '-u', '-x', '--summary', '-ts'],
        category: 'security'
      },

      // 日志分析和监控命令
      {
        command: 'journalctl',
        description: 'systemd日志查看工具',
        usage: 'journalctl [选项]',
        examples: [
          'journalctl                     # 查看所有日志',
          'journalctl -f                  # 实时跟踪日志',
          'journalctl -u sshd             # 查看SSH服务日志',
          'journalctl --since "1 hour ago" # 查看1小时内日志',
          'journalctl --until "2023-12-25" # 查看指定日期前日志',
          'journalctl -p err              # 只显示错误级别日志',
          'journalctl -n 50               # 显示最近50条日志',
          'journalctl --diusage        # 显示日志占用空间',
          'journalctl --vacuum-time=2d    # 清理2天前的日志',
          'journalctl -k                  # 显示内核日志'
        ],
        commonOptions: ['-f', '-u', '--since', '--until', '-p', '-n', '-k'],
        category: 'security'
      },
      {
        command: 'dmesg',
        description: '显示内核环形缓冲区消息',
        usage: 'dmesg [选项]',
        examples: [
          'dmesg                          # 显示所有内核消息',
          'dmesg -T                       # 显示人类可读的时间戳',
          'dmesg -w                       # 实时监控新消息',
          'dmesg -l err,warn              # 只显示错误和警告',
          'dmesg | grep -i error          # 搜索错误信息',
          'dmesg | grep -i "out of memory" # 搜索内存不足',
          'dmesg | tail -20               # 显示最近20条消息',
          'dmesg -c                       # 显示后清空缓冲区'
        ],
        commonOptions: ['-T', '-w', '-l', '-c'],
        category: 'security'
      },
      {
        command: 'sar',
        description: '系统活动报告工具',
        usage: 'sar [选项] [间隔] [次数]',
        examples: [
          'sar -u 1 5                     # 每秒显示CPU使用率，共5次',
          'sar -r 1 5                     # 每秒显示内存使用率',
          'sar -n DEV 1 5                 # 每秒显示网络接口统计',
          'sar -d 1 5                     # 每秒显示磁盘I/O统计',
          'sar -q 1 5                     # 每秒显示队列长度和负载',
          'sar -f /var/log/sa/sa25        # 读取历史数据文件',
          'sar -A                         # 显示所有统计信息',
          'sar -u -f /var/log/sa/sa25     # 显示历史CPU数据'
        ],
        commonOptions: ['-u', '-r', '-n', '-d', '-q', '-f', '-A'],
        category: 'security'
      },
      {
        command: 'iostat',
        description: 'I/O统计信息工具',
        usage: 'iostat [选项] [间隔] [次数]',
        examples: [
          'iostat                         # 显示CPU和I/O统计',
          'iostat -x 1 5                  # 每秒显示扩展I/O统计，共5次',
          'iostat -d 1                    # 每秒显示设备I/O统计',
          'iostat -c 1                    # 每秒显示CPU统计',
          'iostat -n 1                    # 每秒显示NFS统计',
          'iostat -p sda 1                # 监控特定磁盘分区'
        ],
        commonOptions: ['-x', '-d', '-c', '-n', '-p'],
        category: 'security'
      },
      {
        command: 'vmstat',
        description: '虚拟内存统计工具',
        usage: 'vmstat [选项] [间隔] [次数]',
        examples: [
          'vmstat                         # 显示系统统计信息',
          'vmstat 1 5                     # 每秒显示统计，共5次',
          'vmstat -d                      # 显示磁盘统计',
          'vmstat -s                      # 显示内存统计',
          'vmstat -f                      # 显示fork统计',
          'vmstat -a 1                    # 显示活跃/非活跃内存'
        ],
        commonOptions: ['-d', '-s', '-f', '-a'],
        category: 'security'
      },
      {
        command: 'strace',
        description: '跟踪系统调用和信号',
        usage: 'strace [选项] 命令 [参数...]',
        examples: [
          'strace ls                      # 跟踪ls命令的系统调用',
          'strace -p 1234                 # 跟踪运行中的进程',
          'strace -e open ls              # 只跟踪open系统调用',
          'strace -e trace=file ls        # 跟踪文件相关调用',
          'strace -e trace=network curl http://example.com # 跟踪网络调用',
          'strace -o output.txt ls        # 输出到文件',
          'strace -c ls                   # 统计系统调用',
          'strace -f -p 1234              # 跟踪进程及其子进程',
          'strace -t ls                   # 显示时间戳'
        ],
        commonOptions: ['-p', '-e', '-o', '-c', '-f', '-t'],
        category: 'security'
      },
      {
        command: 'ltrace',
        description: '跟踪库函数调用',
        usage: 'ltrace [选项] 命令 [参数...]',
        examples: [
          'ltrace ls                      # 跟踪ls的库函数调用',
          'ltrace -p 1234                 # 跟踪运行中的进程',
          'ltrace -e malloc ls            # 只跟踪malloc函数',
          'ltrace -o output.txt ls        # 输出到文件',
          'ltrace -c ls                   # 统计函数调用',
          'ltrace -f program              # 跟踪子进程',
          'ltrace -t ls                   # 显示时间戳'
        ],
        commonOptions: ['-p', '-e', '-o', '-c', '-f', '-t'],
        category: 'security'
      },
      {
        command: 'gdb',
        description: 'GNU调试器',
        usage: 'gdb [选项] [程序] [核心文件]',
        examples: [
          'gdb program                    # 调试程序',
          'gdb program core               # 分析核心转储',
          'gdb -p 1234                    # 附加到运行中的进程',
          'gdb --batch --ex run --ex bt --ex quit program # 批处理模式',
          'gdb -ex "set confirm off" -ex "run" program # 自动运行',
          'gdb --args program arg1 arg2   # 带参数调试'
        ],
        commonOptions: ['-p', '--batch', '--ex', '--args'],
        category: 'security'
      },
      {
        command: 'objdump',
        description: '显示目标文件信息',
        usage: 'objdump [选项] 文件...',
        examples: [
          'objdump -d program             # 反汇编程序',
          'objdump -t program             # 显示符号表',
          'objdump -h program             # 显示段头信息',
          'objdump -s program             # 显示所有段内容',
          'objdump -x program             # 显示所有头信息',
          'objdump -D program             # 反汇编所有段',
          'objdump -j .text -d program    # 只反汇编.text段'
        ],
        commonOptions: ['-d', '-t', '-h', '-s', '-x', '-D', '-j'],
        category: 'security'
      },
      {
        command: 'strings',
        description: '提取文件中的可打印字符串',
        usage: 'strings [选项] 文件...',
        examples: [
          'strings program                # 提取程序中的字符串',
          'strings -n 10 program          # 只显示长度>=10的字符串',
          'strings -a program             # 扫描整个文件',
          'strings -e l program           # 指定字符编码（little-endian）',
          'strings -t x program           # 显示十六进制偏移',
          'strings /dev/mem | grep password # 在内存中搜索密码',
          'strings suspicious_file | grep -i "http" # 查找URL'
        ],
        commonOptions: ['-n', '-a', '-e', '-t'],
        category: 'security'
      },
      {
        command: 'hexdump',
        description: '以十六进制格式显示文件内容',
        usage: 'hexdump [选项] 文件...',
        examples: [
          'hexdump file.bin               # 十六进制显示文件',
          'hexdump -C file.bin            # 规范格式（十六进制+ASCII）',
          'hexdump -x file.bin            # 两字节十六进制',
          'hexdump -d file.bin            # 两字节十进制',
          'hexdump -n 100 file.bin        # 只显示前100字节',
          'hexdump -s 1000 file.bin       # 从偏移1000开始',
          'echo "Hello" | hexdump -C      # 管道输入'
        ],
        commonOptions: ['-C', '-x', '-d', '-n', '-s'],
        category: 'security'
      },
      {
        command: 'file',
        description: '确定文件类型',
        usage: 'file [选项] 文件...',
        examples: [
          'file suspicious_file           # 检测文件类型',
          'file -b suspicious_file        # 简洁输出',
          'file -i suspicious_file        # 显示MIME类型',
          'file -z compressed.gz          # 查看压缩文件内容类型',
          'file -L symlink                # 跟随符号链接',
          'file -f filelist.txt           # 从文件列表读取',
          'file /dev/sda1                 # 检测设备类型'
        ],
        commonOptions: ['-b', '-i', '-z', '-L', '-f'],
        category: 'security'
      },
      {
        command: 'stat',
        description: '显示文件或文件系统状态',
        usage: 'stat [选项] 文件...',
        examples: [
          'stat file.txt                  # 显示文件详细信息',
          'stat -f /                      # 显示文件系统信息',
          'stat -c "%a %n" file.txt       # 自定义格式（权限和文件名）',
          'stat -c "%Y" file.txt          # 显示修改时间戳',
          'stat -c "%s" file.txt          # 显示文件大小',
          'stat -L symlink                # 跟随符号链接',
          'stat --format="%A %U:%G %n" file # 显示权限、所有者、文件名'
        ],
        commonOptions: ['-f', '-c', '-L', '--format'],
        category: 'security'
      },

      // 网络安全比赛和渗透测试专用命令
      {
        command: 'nc',
        description: 'netcat - 网络瑞士军刀，端口扫描和数据传输',
        usage: 'nc [选项] 主机 端口',
        examples: [
          'nc -l 1234                     # 监听1234端口',
          'nc target.com 80               # 连接到目标80端口',
          'nc -v target.com 22            # 详细模式连接SSH',
          'nc -z target.com 1-1000        # 端口扫描1-1000',
          'nc -u target.com 53            # UDP连接DNS端口',
          'nc -l 1234 < file.txt          # 通过网络传输文件',
          'nc target.com 1234 > received.txt # 接收文件',
          'nc -e /bin/bash target.com 1234 # 反向shell（危险）',
          'nc -l 1234 -e /bin/bash        # 绑定shell（危险）',
          'echo "GET / HTTP/1.0\\r\\n\\r\\n" | nc target.com 80 # HTTP请求'
        ],
        commonOptions: ['-l', '-v', '-z', '-u', '-e', '-n'],
        category: 'security'
      },
      {
        command: 'ncat',
        description: 'nmap项目的现代化netcat实现',
        usage: 'ncat [选项] 主机 端口',
        examples: [
          'ncat -l 1234                   # 监听端口',
          'ncat --ssl target.com 443      # SSL连接',
          'ncat --proxy proxy.com:8080 target.com 80 # 通过代理连接',
          'ncat -e /bin/bash -l 1234      # 绑定shell',
          'ncat --chat -l 1234            # 聊天服务器',
          'ncat --broker -l 1234          # 代理模式'
        ],
        commonOptions: ['-l', '--ssl', '--proxy', '-e', '--chat', '--broker'],
        category: 'security'
      },
      {
        command: 'socat',
        description: '高级的双向数据传输工具',
        usage: 'socat [选项] 地址1 地址2',
        examples: [
          'socat TCP-LISTEN:1234,fork TCP:target.com:80 # 端口转发',
          'socat TCP-LISTEN:1234,fork EXEC:/bin/bash # 绑定shell',
          'socat TCP:target.com:1234 EXEC:/bin/bash # 反向shell',
          'socat UDP-LISTEN:53,fork UDP:8.8.8.8:53 # UDP转发',
          'socat OPENSSL-LISTEN:443,cert=server.pem,fork TCP:localhost:80 # SSL代理',
          'socat PTY,link=/tmp/ptyp0,raw,echo=0 TCP:target.com:1234 # 伪终端'
        ],
        commonOptions: ['-d', '-v', '-x'],
        category: 'security'
      },
      {
        command: 'hydra',
        description: '网络登录破解工具',
        usage: 'hydra [选项] 目标 服务',
        examples: [
          'hydra -l admin -p password ssh://target.com # SSH暴力破解',
          'hydra -L users.txt -P pass.txt ssh://target.com # 字典攻击',
          'hydra -l admin -P rockyou.txt ftp://target.com # FTP破解',
          'hydra -L users.txt -P pass.txt http-get://target.com/admin # HTTP基本认证',
          'hydra -l admin -P pass.txt http-post-form://target.com/login.php:"user=^USER^&pass=^PASS^:Invalid" # HTTP表单',
          'hydra -t 4 -l admin -P pass.txt ssh://target.com # 限制线程数'
        ],
        commonOptions: ['-l', '-L', '-p', '-P', '-t', '-v'],
        category: 'security'
      },
      {
        command: 'john',
        description: 'John the Ripper - 密码破解工具',
        usage: 'john [选项] 密码文件',
        examples: [
          'john passwd.txt                # 破解密码文件',
          'john --wordlist=rockyou.txt passwd.txt # 使用字典',
          'john --rules passwd.txt        # 使用规则变换',
          'john --show passwd.txt         # 显示已破解密码',
          'john --incremental passwd.txt  # 增量模式',
          'john --single passwd.txt       # 单一模式',
          'unshadow /etc/passwd /etc/shadow > passwd.txt # 合并passwd和shadow'
        ],
        commonOptions: ['--wordlist', '--rules', '--show', '--incremental', '--single'],
        category: 'security'
      },
      {
        command: 'hashcat',
        description: '高级密码恢复工具',
        usage: 'hashcat [选项] 哈希文件 字典',
        examples: [
          'hashcat -m 0 hash.txt rockyou.txt # MD5破解',
          'hashcat -m 1000 hash.txt rockyou.txt # NTLM破解',
          'hashcat -m 1800 hash.txt rockyou.txt # SHA-512破解',
          'hashcat -a 3 -m 0 hash.txt ?d?d?d?d # 掩码攻击（4位数字）',
          'hashcat --show hash.txt        # 显示已破解密码',
          'hashcat -m 0 hash.txt -r rules/best64.rule rockyou.txt # 使用规则'
        ],
        commonOptions: ['-m', '-a', '--show', '-r', '-w'],
        category: 'security'
      },
      {
        command: 'sqlmap',
        description: 'SQL注入检测和利用工具',
        usage: 'sqlmap [选项]',
        examples: [
          'sqlmap -u "http://target.com/page.php?id=1" # 基本SQL注入测试',
          'sqlmap -u "http://target.com/page.php?id=1" --dbs # 枚举数据库',
          'sqlmap -u "http://target.com/page.php?id=1" -D database --tables # 枚举表',
          'sqlmap -u "http://target.com/page.php?id=1" -D db -T users --columns # 枚举列',
          'sqlmap -u "http://target.com/page.php?id=1" -D db -T users --dump # 导出数据',
          'sqlmap -r request.txt          # 使用HTTP请求文件',
          'sqlmap -u "http://target.com/page.php?id=1" --os-shell # 获取系统shell'
        ],
        commonOptions: ['-u', '--dbs', '--tables', '--columns', '--dump', '-r'],
        category: 'security'
      },
      {
        command: 'nikto',
        description: 'Web服务器漏洞扫描器',
        usage: 'nikto [选项]',
        examples: [
          'nikto -h http://target.com      # 扫描Web服务器',
          'nikto -h target.com -p 80,443  # 扫描指定端口',
          'nikto -h target.com -ssl       # 强制使用SSL',
          'nikto -h target.com -o report.html -Format html # 输出HTML报告',
          'nikto -h target.com -Tuning 1,2,3 # 指定扫描类型',
          'nikto -h target.com -evasion 1 # 使用规避技术'
        ],
        commonOptions: ['-h', '-p', '-ssl', '-o', '-Tuning', '-evasion'],
        category: 'security'
      },
      {
        command: 'dirb',
        description: 'Web目录暴力破解工具',
        usage: 'dirb URL [字典文件] [选项]',
        examples: [
          'dirb http://target.com/         # 使用默认字典扫描',
          'dirb http://target.com/ /usr/share/dirb/wordlists/common.txt # 指定字典',
          'dirb http://target.com/ -X .php,.html # 指定文件扩展名',
          'dirb http://target.com/ -o output.txt # 输出到文件',
          'dirb http://target.com/ -p proxy.com:8080 # 使用代理',
          'dirb http://target.com/ -c "COOKIE=value" # 使用Cookie'
        ],
        commonOptions: ['-X', '-o', '-p', '-c', '-r'],
        category: 'security'
      },
      {
        command: 'gobuster',
        description: '快速的目录/文件暴力破解工具',
        usage: 'gobuster [模式] [选项]',
        examples: [
          'gobuster dir -u http://target.com -w /usr/share/wordlists/dirb/common.txt # 目录扫描',
          'gobuster dir -u http://target.com -w wordlist.txt -x php,html,txt # 指定扩展名',
          'gobuster dns -d target.com -w subdomains.txt # 子域名扫描',
          'gobuster vhost -u http://target.com -w vhosts.txt # 虚拟主机扫描',
          'gobuster dir -u http://target.com -w wordlist.txt -s 200,204,301,302,307,401,403 # 指定状态码',
          'gobuster dir -u http://target.com -w wordlist.txt -t 50 # 指定线程数'
        ],
        commonOptions: ['dir', 'dns', 'vhost', '-u', '-w', '-x', '-t'],
        category: 'security'
      },
      {
        command: 'wfuzz',
        description: 'Web应用模糊测试工具',
        usage: 'wfuzz [选项] URL',
        examples: [
          'wfuzz -c -z file,wordlist.txt http://target.com/FUZZ # 目录模糊测试',
          'wfuzz -c -z range,1-100 http://target.com/page.php?id=FUZZ # 参数模糊测试',
          'wfuzz -c -z file,users.txt -z file,pass.txt http://target.com/login.php -d "user=FUZZ&pass=FUZ2Z" # POST数据模糊测试',
          'wfuzz -c --hc 404 -z file,wordlist.txt http://target.com/FUZZ # 隐藏404响应',
          'wfuzz -c --hw 0 -z file,wordlist.txt http://target.com/FUZZ # 隐藏0字响应',
          'wfuzz -c -H "User-Agent: FUZZ" -z file,useragents.txt http://target.com/ # 头部模糊测试'
        ],
        commonOptions: ['-c', '-z', '--hc', '--hw', '-H', '-d'],
        category: 'security'
      },
      {
        command: 'masscan',
        description: '高速端口扫描器',
        usage: 'masscan [选项] IP地址/范围',
        examples: [
          'masscan -p1-65535 192.168.1.0/24 --rate=1000 # 扫描整个网段',
          'masscan -p80,443 192.168.1.0/24 # 扫描特定端口',
          'masscan -p1-1000 target.com --rate=10000 # 高速扫描',
          'masscan --top-ports 100 192.168.1.0/24 # 扫描top 100端口',
          'masscan -p80 0.0.0.0/0 --rate=10000 --exclude 255.255.255.255 # 全网扫描',
          'masscan -p22 192.168.1.0/24 --banners # 获取banner信息'
        ],
        commonOptions: ['-p', '--rate', '--top-ports', '--banners', '--exclude'],
        category: 'security'
      },
      {
        command: 'zmap',
        description: '互联网级别的网络扫描器',
        usage: 'zmap [选项] [目标]',
        examples: [
          'zmap -p 80 192.168.1.0/24       # 扫描HTTP端口',
          'zmap -p 22 0.0.0.0/0 -o results.txt # 全网SSH扫描',
          'zmap -p 443 -B 10M 192.168.0.0/16 # 限制带宽扫描',
          'zmap -p 80 --probe-module=http_get 192.168.1.0/24 # HTTP探测',
          'zmap -p 53 --probe-module=dns 8.8.8.0/24 # DNS探测'
        ],
        commonOptions: ['-p', '-o', '-B', '--probe-module'],
        category: 'security'
      }

      ,

      // 更多网络安全和CTF常用命令
      {
        command: 'binwalk',
        description: '固件分析和文件提取工具',
        usage: 'binwalk [选项] 文件',
        examples: [
          'binwalk firmware.bin           # 分析固件文件',
          'binwalk -e firmware.bin        # 提取文件系统',
          'binwalk -M firmware.bin        # 递归提取',
          'binwalk --dd=".*" firmware.bin # 提取所有识别的文件',
          'binwalk -A firmware.bin        # 操作码扫描',
          'binwalk -E firmware.bin        # 熵分析',
          'binwalk -B firmware.bin        # 无效指令扫描'
        ],
        commonOptions: ['-e', '-M', '--dd', '-A', '-E', '-B'],
        category: 'security'
      },
      {
        command: 'foremost',
        description: '文件恢复和数据雕刻工具',
        usage: 'foremost [选项] 文件',
        examples: [
          'foremost -i disk.img           # 从磁盘镜像恢复文件',
          'foremost -t jpg,png -i image.dd # 恢复特定类型文件',
          'foremost -o output/ -i disk.img # 指定输出目录',
          'foremost -v -i disk.img        # 详细模式',
          'foremost -a -i disk.img        # 写入审计文件'
        ],
        commonOptions: ['-i', '-t', '-o', '-v', '-a'],
        category: 'security'
      },
      {
        command: 'volatility',
        description: '内存取证分析框架',
        usage: 'volatility [选项] 插件',
        examples: [
          'volatility -f memory.dmp imageinfo # 获取镜像信息',
          'volatility -f memory.dmp --profile=Win7SP1x64 pslist # 列出进程',
          'volatility -f memory.dmp --profile=Win7SP1x64 psscan # 扫描进程',
          'volatility -f memory.dmp --profile=Win7SP1x64 netscan # 网络连接',
          'volatility -f memory.dmp --profile=Win7SP1x64 filescan # 文件扫描',
          'volatility -f memory.dmp --profile=Win7SP1x64 hivelist # 注册表hive',
          'volatility -f memory.dmp --profile=Win7SP1x64 malfind # 恶意代码检测'
        ],
        commonOptions: ['-f', '--profile', '--output', '--output-file'],
        category: 'security'
      },
      {
        command: 'exiftool',
        description: '元数据读写工具',
        usage: 'exiftool [选项] 文件',
        examples: [
          'exiftool image.jpg             # 显示所有元数据',
          'exiftool -GPS* image.jpg       # 显示GPS信息',
          'exiftool -r -ext jpg .         # 递归处理jpg文件',
          'exiftool -all= image.jpg       # 删除所有元数据',
          'exiftool -overwrite_original -all= *.jpg # 批量删除元数据',
          'exiftool -csv -r . > metadata.csv # 导出为CSV',
          'exiftool -k -u -g1 image.jpg   # 显示未知标签'
        ],
        commonOptions: ['-r', '-ext', '-all=', '-overwrite_original', '-csv'],
        category: 'security'
      },
      {
        command: 'steghide',
        description: '隐写术工具',
        usage: 'steghide [命令] [选项]',
        examples: [
          'steghide embed -cf image.jpg -ef secret.txt # 隐藏文件',
          'steghide extract -sf image.jpg # 提取隐藏文件',
          'steghide info image.jpg        # 显示隐写信息',
          'steghide embed -cf image.jpg -ef secret.txt -p password # 使用密码',
          'steghide extract -sf image.jpg -xf output.txt # 指定输出文件'
        ],
        commonOptions: ['embed', 'extract', 'info', '-cf', '-ef', '-sf', '-p'],
        category: 'security'
      },
      {
        command: 'stegsolve',
        description: '图像隐写分析工具',
        usage: 'stegsolve [图像文件]',
        examples: [
          'stegsolve image.png            # 启动图形界面分析',
          'java -jar stegsolve.jar       # 启动工具'
        ],
        category: 'security'
      },
      {
        command: 'zsteg',
        description: 'PNG和BMP隐写检测工具',
        usage: 'zsteg [选项] 图像文件',
        examples: [
          'zsteg image.png                # 检测隐写内容',
          'zsteg -a image.png             # 尝试所有已知方法',
          'zsteg -E image.png             # 提取所有可能的数据',
          'zsteg -v image.png             # 详细输出',
          'zsteg --lsb image.png          # LSB分析'
        ],
        commonOptions: ['-a', '-E', '-v', '--lsb'],
        category: 'security'
      },
      {
        command: 'outguess',
        description: 'JPEG隐写工具',
        usage: 'outguess [选项] 输入文件 输出文件',
        examples: [
          'outguess -k "password" -d image.jpg output.txt # 提取隐藏数据',
          'outguess -k "password" -r secret.txt image.jpg stego.jpg # 隐藏数据',
          'outguess -s image.jpg          # 统计分析'
        ],
        commonOptions: ['-k', '-d', '-r', '-s'],
        category: 'security'
      },
      {
        command: 'base64',
        description: 'Base64编码解码工具',
        usage: 'base64 [选项] [文件]',
        examples: [
          'echo "hello" | base64          # 编码字符串',
          'echo "aGVsbG8K" | base64 -d    # 解码字符串',
          'base64 file.txt                # 编码文件',
          'base64 -d encoded.txt          # 解码文件',
          'base64 -w 0 file.txt           # 不换行编码'
        ],
        commonOptions: ['-d', '-w'],
        category: 'security'
      },
      {
        command: 'xxd',
        description: '十六进制转储和逆向工具',
        usage: 'xxd [选项] [文件]',
        examples: [
          'xxd file.bin                   # 十六进制显示文件',
          'xxd -r hexdump.txt binary.bin  # 从十六进制恢复二进制',
          'xxd -l 100 file.bin            # 只显示前100字节',
          'xxd -s 1000 file.bin           # 从偏移1000开始',
          'xxd -p file.bin                # 纯十六进制输出',
          'xxd -i file.bin                # C语言数组格式',
          'echo "48656c6c6f" | xxd -r -p  # 从十六进制字符串恢复'
        ],
        commonOptions: ['-r', '-l', '-s', '-p', '-i'],
        category: 'security'
      },
      {
        command: 'openssl',
        description: 'OpenSSL加密工具套件',
        usage: 'openssl 命令 [选项]',
        examples: [
          'openssl enc -aes-256-cbc -in file.txt -out file.enc # AES加密',
          'openssl enc -aes-256-cbc -d -in file.enc -out file.txt # AES解密',
          'openssl dgst -sha256 file.txt  # 计算SHA256哈希',
          'openssl passwd -1 password     # 生成MD5密码哈希',
          'openssl rand -hex 32           # 生成32字节随机数',
          'openssl genrsa -out private.key 2048 # 生成RSA私钥',
          'openssl rsa -in private.key -pubout -out public.key # 提取公钥',
          'openssl s_client -connect target.com:443 # SSL连接测试'
        ],
        commonOptions: ['enc', 'dgst', 'passwd', 'rand', 'genrsa', 'rsa', 's_client'],
        category: 'security'
      },
      {
        command: 'gpg',
        description: 'GNU Privacy Guard加密工具',
        usage: 'gpg [选项] [文件]',
        examples: [
          'gpg --gen-key                  # 生成密钥对',
          'gpg --list-keys                # 列出公钥',
          'gpg --list-secret-keys         # 列出私钥',
          'gpg -c file.txt                # 对称加密文件',
          'gpg -d file.txt.gpg            # 解密文件',
          'gpg -e -r recipient file.txt   # 公钥加密',
          'gpg --sign file.txt            # 数字签名',
          'gpg --verify file.txt.sig      # 验证签名'
        ],
        commonOptions: ['-c', '-d', '-e', '-r', '--sign', '--verify'],
        category: 'security'
      },
      {
        command: 'hashsum',
        description: '各种哈希算法计算工具',
        usage: 'hashsum [选项] [文件]',
        examples: [
          'md5sum file.txt                # 计算MD5哈希',
          'sha1sum file.txt               # 计算SHA1哈希',
          'sha256sum file.txt             # 计算SHA256哈希',
          'sha512sum file.txt             # 计算SHA512哈希',
          'md5sum -c checksums.md5        # 验证哈希值',
          'sha256sum * > checksums.sha256 # 批量计算哈希',
          'echo -n "password" | md5sum    # 计算字符串哈希'
        ],
        category: 'security'
      }

    ];

    // 将命令添加到Map中
    commands.forEach(hint => {
      this.hints.set(hint.command, hint);
    });
  }

  /**
   * 获取命令提示
   */
  getHint(command: string): CommandHint | undefined {
    return this.hints.get(command.toLowerCase());
  }

  /**
   * 搜索命令（支持前缀匹配和模糊匹配）
   */
  searchCommands(query: string): CommandHint[] {
    const lowerQuery = query.toLowerCase();

    // 首先查找前缀匹配的命令（优先级最高）
    const prefixMatches: CommandHint[] = [];
    const fuzzyMatches: CommandHint[] = [];

    this.hints.forEach(hint => {
      const commandLower = hint.command.toLowerCase();
      const descriptionLower = hint.description.toLowerCase();

      if (commandLower.startsWith(lowerQuery)) {
        // 前缀匹配，优先级最高
        prefixMatches.push(hint);
      } else if (commandLower.includes(lowerQuery) || descriptionLower.includes(lowerQuery)) {
        // 模糊匹配，优先级较低
        fuzzyMatches.push(hint);
      }
    });

    // 按命令长度排序前缀匹配结果（短的优先）
    prefixMatches.sort((a, b) => a.command.length - b.command.length);

    // 合并结果，前缀匹配在前
    const results = [...prefixMatches, ...fuzzyMatches];

    return results.slice(0, 8); // 限制返回结果数量
  }

  /**
   * 获取指定分类的命令
   */
  getCommandsByCategory(category: CommandHint['category']): CommandHint[] {
    const results: CommandHint[] = [];
    
    this.hints.forEach(hint => {
      if (hint.category === category) {
        results.push(hint);
      }
    });

    return results;
  }

  /**
   * 获取所有命令列表
   */
  getAllCommands(): string[] {
    return Array.from(this.hints.keys()).sort();
  }

  /**
   * 添加自定义命令提示
   */
  addCustomHint(hint: CommandHint): void {
    this.hints.set(hint.command.toLowerCase(), hint);
  }

  /**
   * 删除命令提示
   */
  removeHint(command: string): boolean {
    return this.hints.delete(command.toLowerCase());
  }
}

// 创建全局实例
export const commandHintsManager = new CommandHintsManager();
