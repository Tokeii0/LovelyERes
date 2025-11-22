import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 创建数据库连接池
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lovelyres',
  user: process.env.DB_USER || 'lovelyres',
  password: process.env.DB_PASSWORD || '',
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始初始化数据库...\n');
    
    // 读取 SQL 文件
    const sqlFilePath = path.join(__dirname, '../../doc/init-database.sql');
    let sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    
    // 移除 psql 特定命令
    sqlContent = sqlContent.replace(/\\c lovelyres;/g, '');
    sqlContent = sqlContent.replace(/\\echo .*/g, '');
    
    // 分割 SQL 语句（按分号分割，但保留函数定义）
    const statements = sqlContent
      .split(/;(?=\s*(?:CREATE|INSERT|DROP|COMMENT|SELECT|ALTER|GRANT))/gi)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 共有 ${statements.length} 条 SQL 语句需要执行\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 执行每条 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // 跳过注释
      if (statement.startsWith('--')) {
        continue;
      }
      
      try {
        // 显示正在执行的语句类型
        const statementType = statement.split(/\s+/)[0].toUpperCase();
        process.stdout.write(`[${i + 1}/${statements.length}] 执行 ${statementType}... `);
        
        await client.query(statement + ';');
        
        console.log('✅');
        successCount++;
      } catch (error: any) {
        // 忽略 "already exists" 错误
        if (error.message.includes('already exists')) {
          console.log('⚠️  (已存在)');
          successCount++;
        } else {
          console.log('❌');
          console.error(`   错误: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 成功: ${successCount} 条`);
    console.log(`❌ 失败: ${errorCount} 条`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 查询表信息
    console.log('📊 数据库表统计：\n');
    const result = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    console.table(result.rows);
    
    // 查询用户数量
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`\n👥 用户数量: ${userCount.rows[0].count}`);
    
    if (parseInt(userCount.rows[0].count) > 0) {
      const users = await client.query('SELECT id, username, nickname, email, is_vip FROM users LIMIT 5');
      console.log('\n📋 用户列表（前5个）：\n');
      console.table(users.rows);
    }
    
    console.log('\n🎉 数据库初始化完成！\n');
    
  } catch (error) {
    console.error('\n❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行初始化
initDatabase()
  .then(() => {
    console.log('✅ 脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

