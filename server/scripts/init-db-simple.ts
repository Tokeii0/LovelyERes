import { Pool } from 'pg';
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
    
    // 1. 创建 users 表
    console.log('1. 创建 users 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        nickname VARCHAR(100),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_vip BOOLEAN DEFAULT FALSE,
        vip_expire_date TIMESTAMP,
        max_devices INTEGER DEFAULT 1,
        device_rebind_count INTEGER DEFAULT 0,
        max_rebind_count INTEGER DEFAULT 5,
        status VARCHAR(20) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        CONSTRAINT chk_status CHECK (status IN ('active', 'suspended', 'deleted'))
      );
    `);
    console.log('   ✅ users 表创建成功\n');
    
    // 2. 创建 user_devices 表
    console.log('2. 创建 user_devices 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_code VARCHAR(255) NOT NULL,
        device_name VARCHAR(100),
        device_type VARCHAR(50),
        device_fingerprint JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        bind_status VARCHAR(20) DEFAULT 'active',
        offline_license_key TEXT,
        license_expire_date TIMESTAMP,
        last_license_update TIMESTAMP,
        bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unbound_at TIMESTAMP,
        last_active_at TIMESTAMP,
        CONSTRAINT uk_user_device UNIQUE(user_id, device_code),
        CONSTRAINT chk_bind_status CHECK (bind_status IN ('active', 'unbound', 'expired'))
      );
    `);
    console.log('   ✅ user_devices 表创建成功\n');
    
    // 3. 创建 device_bind_history 表
    console.log('3. 创建 device_bind_history 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_bind_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(20) NOT NULL,
        old_device_code VARCHAR(255),
        new_device_code VARCHAR(255),
        device_name VARCHAR(100),
        reason VARCHAR(500),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_action_type CHECK (action_type IN ('bind', 'unbind', 'rebind'))
      );
    `);
    console.log('   ✅ device_bind_history 表创建成功\n');
    
    // 4. 创建 offline_license_history 表
    console.log('4. 创建 offline_license_history 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS offline_license_history (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id BIGINT REFERENCES user_devices(id) ON DELETE SET NULL,
        device_code VARCHAR(255) NOT NULL,
        license_key TEXT NOT NULL,
        license_type VARCHAR(50) DEFAULT 'offline',
        valid_from TIMESTAMP NOT NULL,
        valid_until TIMESTAMP NOT NULL,
        update_method VARCHAR(50),
        update_reason VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_license_type CHECK (license_type IN ('offline', 'online', 'trial')),
        CONSTRAINT chk_license_status CHECK (status IN ('active', 'expired', 'revoked'))
      );
    `);
    console.log('   ✅ offline_license_history 表创建成功\n');
    
    // 5. 创建索引
    console.log('5. 创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_user_id ON device_bind_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_offline_license_user_id ON offline_license_history(user_id);
    `);
    console.log('   ✅ 索引创建成功\n');
    
    // 6. 创建触发器函数
    console.log('6. 创建触发器...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('   ✅ 触发器创建成功\n');
    
    // 7. 插入测试数据
    console.log('7. 插入测试数据...');
    await client.query(`
      INSERT INTO users (username, nickname, email, password_hash, is_vip, vip_expire_date, max_devices, max_rebind_count)
      VALUES 
        ('admin', '系统管理员', 'admin@lovelyres.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, '2099-12-31 23:59:59', 10, 999),
        ('demo', '演示用户', 'demo@lovelyres.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', TRUE, '2025-12-31 23:59:59', 3, 5)
      ON CONFLICT (username) DO NOTHING;
    `);
    console.log('   ✅ 测试数据插入成功\n');
    
    // 查询表信息
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
      const users = await client.query('SELECT id, username, nickname, email, is_vip FROM users');
      console.log('\n📋 用户列表：\n');
      console.table(users.rows);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 数据库初始化完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📝 测试账号信息：');
    console.log('   用户名: admin / demo');
    console.log('   密码: password123');
    console.log('');
    
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

