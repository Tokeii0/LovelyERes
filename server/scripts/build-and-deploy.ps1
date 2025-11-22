# LovelyRes 本地构建并部署到服务器
# 使用方法: .\scripts\build-and-deploy.ps1

param(
    [string]$ServerIP = "110.42.47.180",
    [string]$ServerUser = "root",
    [string]$ServerPath = "/var/www/LovelyRes/server"
)

Write-Host "🚀 开始构建并部署 LovelyRes API 服务器..." -ForegroundColor Green
Write-Host ""

# 1. 清理旧的构建
Write-Host "🧹 清理旧的构建..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# 2. 安装依赖
Write-Host "📦 安装依赖..." -ForegroundColor Yellow
npm install

# 3. 构建项目
Write-Host "🔨 构建项目..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败！" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 构建成功！" -ForegroundColor Green
Write-Host ""

# 4. 创建部署目录
Write-Host "📁 创建部署目录..." -ForegroundColor Yellow
$deployDir = "deploy-temp"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# 5. 复制必要文件
Write-Host "📋 复制必要文件..." -ForegroundColor Yellow

# 复制 dist 目录
Copy-Item -Recurse dist $deployDir\

# 复制 package.json 和 package-lock.json
Copy-Item package.json $deployDir\
Copy-Item package-lock.json $deployDir\

# 复制 ecosystem.config.js
Copy-Item ecosystem.config.js $deployDir\

# 复制 .env.production
Copy-Item .env.production $deployDir\

# 复制 keys 目录（如果存在）
if (Test-Path "keys") {
    Copy-Item -Recurse keys $deployDir\
} else {
    Write-Host "⚠️  keys 目录不存在，将在服务器上生成" -ForegroundColor Yellow
}

# 复制 scripts 目录
New-Item -ItemType Directory -Path $deployDir\scripts | Out-Null
Copy-Item scripts\*.sh $deployDir\scripts\

Write-Host "✅ 文件复制完成！" -ForegroundColor Green
Write-Host ""

# 6. 上传到服务器
Write-Host "📤 上传到服务器 $ServerUser@$ServerIP..." -ForegroundColor Yellow
Write-Host "目标路径: $ServerPath" -ForegroundColor Cyan

# 使用 scp 上传
scp -r $deployDir\* ${ServerUser}@${ServerIP}:${ServerPath}/

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 上传失败！" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 上传成功！" -ForegroundColor Green
Write-Host ""

# 7. 清理临时目录
Write-Host "🧹 清理临时文件..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $deployDir

# 8. 在服务器上执行部署命令
Write-Host "🔧 在服务器上执行部署命令..." -ForegroundColor Yellow
Write-Host ""

$remoteCommands = @"
cd $ServerPath
echo '📦 安装生产依赖...'
npm install --production

echo '⚙️  配置环境变量...'
if [ ! -f .env ]; then
    cp .env.production .env
    echo '✅ 已创建 .env 文件，请修改配置'
else
    echo '⚠️  .env 文件已存在，跳过'
fi

echo '🔐 检查 RSA 密钥对...'
if [ ! -f keys/private.pem ]; then
    echo '生成 RSA 密钥对...'
    mkdir -p keys
    openssl genrsa -out keys/private.pem 2048
    openssl rsa -in keys/private.pem -pubout -out keys/public.pem
    chmod 600 keys/private.pem
    chmod 644 keys/public.pem
    echo '✅ RSA 密钥对生成完成'
else
    echo '✅ RSA 密钥对已存在'
fi

echo '🗄️  初始化数据库...'
npm run db:init 2>/dev/null || echo '⚠️  数据库可能已初始化'

echo '🚀 重启应用...'
pm2 delete lovelyres-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

echo ''
echo '✅ 部署完成！'
echo ''
echo '📊 应用状态:'
pm2 status

echo ''
echo '🌐 访问地址:'
echo '  - API: http://110.42.47.180:3000'
echo '  - 健康检查: http://110.42.47.180:3000/health'
"@

ssh ${ServerUser}@${ServerIP} $remoteCommands

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 服务器部署失败！" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 部署成功！" -ForegroundColor Green
Write-Host ""
Write-Host "📝 下一步:" -ForegroundColor Cyan
Write-Host "  1. 修改服务器上的 .env 文件配置" -ForegroundColor White
Write-Host "  2. 重启应用: ssh $ServerUser@$ServerIP 'cd $ServerPath && pm2 restart lovelyres-api'" -ForegroundColor White
Write-Host "  3. 查看日志: ssh $ServerUser@$ServerIP 'pm2 logs lovelyres-api'" -ForegroundColor White
Write-Host ""

