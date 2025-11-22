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

async function updateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始更新数据库...\n');
    
    // 1. 添加 qq_id 字段到 users 表
    console.log('1. 添加 qq_id 字段到 users 表...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS qq_id VARCHAR(20);
    `);
    console.log('   ✅ qq_id 字段添加成功\n');
    
    // 2. 添加完整的索引
    console.log('2. 创建完整的索引...');
    await client.query(`
      -- users 表索引
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      CREATE INDEX IF NOT EXISTS idx_users_qq_id ON users(qq_id);
      
      -- user_devices 表索引
      CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_devices_device_code ON user_devices(device_code);
      CREATE INDEX IF NOT EXISTS idx_user_devices_bind_status ON user_devices(bind_status);
      CREATE INDEX IF NOT EXISTS idx_user_devices_bound_at ON user_devices(bound_at);
      
      -- device_bind_history 表索引
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_user_id ON device_bind_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_action_type ON device_bind_history(action_type);
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_created_at ON device_bind_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_old_device ON device_bind_history(old_device_code);
      CREATE INDEX IF NOT EXISTS idx_device_bind_history_new_device ON device_bind_history(new_device_code);
      
      -- offline_license_history 表索引
      CREATE INDEX IF NOT EXISTS idx_offline_license_user_id ON offline_license_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_offline_license_device_id ON offline_license_history(device_id);
      CREATE INDEX IF NOT EXISTS idx_offline_license_device_code ON offline_license_history(device_code);
      CREATE INDEX IF NOT EXISTS idx_offline_license_status ON offline_license_history(status);
      CREATE INDEX IF NOT EXISTS idx_offline_license_created_at ON offline_license_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_offline_license_valid_until ON offline_license_history(valid_until);
    `);
    console.log('   ✅ 索引创建成功\n');
    
    // 3. 添加表注释
    console.log('3. 添加表和列注释...');
    await client.query(`
      -- users 表注释
      COMMENT ON TABLE users IS '用户基本信息表';
      COMMENT ON COLUMN users.id IS '用户ID，主键';
      COMMENT ON COLUMN users.username IS '用户名，用于登录，唯一';
      COMMENT ON COLUMN users.nickname IS '用户昵称，用于显示';
      COMMENT ON COLUMN users.email IS '用户邮箱，唯一';
      COMMENT ON COLUMN users.password_hash IS '密码哈希值，使用 bcrypt 加密';
      COMMENT ON COLUMN users.qq_id IS 'QQ号，用于获取QQ头像';
      COMMENT ON COLUMN users.is_vip IS '是否为VIP用户';
      COMMENT ON COLUMN users.vip_expire_date IS 'VIP过期时间';
      COMMENT ON COLUMN users.max_devices IS '最大设备绑定数量';
      COMMENT ON COLUMN users.device_rebind_count IS '累计设备换绑次数';
      COMMENT ON COLUMN users.max_rebind_count IS '最大允许换绑次数，超过后需要联系管理员';
      COMMENT ON COLUMN users.status IS '账户状态：active-激活, suspended-暂停, deleted-已删除';
      COMMENT ON COLUMN users.email_verified IS '邮箱是否已验证';
      COMMENT ON COLUMN users.created_at IS '创建时间';
      COMMENT ON COLUMN users.updated_at IS '更新时间';
      COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
      
      -- user_devices 表注释
      COMMENT ON TABLE user_devices IS '用户设备绑定表';
      COMMENT ON COLUMN user_devices.id IS '设备ID，主键';
      COMMENT ON COLUMN user_devices.user_id IS '用户ID，外键关联users表';
      COMMENT ON COLUMN user_devices.device_code IS '设备唯一标识码';
      COMMENT ON COLUMN user_devices.device_name IS '设备名称';
      COMMENT ON COLUMN user_devices.device_type IS '设备类型';
      COMMENT ON COLUMN user_devices.device_fingerprint IS '设备指纹信息（JSON格式）';
      COMMENT ON COLUMN user_devices.is_active IS '是否激活';
      COMMENT ON COLUMN user_devices.bind_status IS '绑定状态：active-激活中, unbound-已解绑, expired-已过期';
      COMMENT ON COLUMN user_devices.offline_license_key IS '离线授权密钥';
      COMMENT ON COLUMN user_devices.license_expire_date IS '授权过期时间';
      COMMENT ON COLUMN user_devices.last_license_update IS '最后授权更新时间';
      COMMENT ON COLUMN user_devices.bound_at IS '绑定时间';
      COMMENT ON COLUMN user_devices.unbound_at IS '解绑时间';
      COMMENT ON COLUMN user_devices.last_active_at IS '最后活跃时间';
      
      -- device_bind_history 表注释
      COMMENT ON TABLE device_bind_history IS '设备绑定/换绑历史记录表';
      COMMENT ON COLUMN device_bind_history.id IS '历史记录ID，主键';
      COMMENT ON COLUMN device_bind_history.user_id IS '用户ID，外键关联users表';
      COMMENT ON COLUMN device_bind_history.action_type IS '操作类型：bind-绑定, unbind-解绑, rebind-换绑';
      COMMENT ON COLUMN device_bind_history.old_device_code IS '旧设备码（仅换绑时有值）';
      COMMENT ON COLUMN device_bind_history.new_device_code IS '新设备码';
      COMMENT ON COLUMN device_bind_history.device_name IS '设备名称';
      COMMENT ON COLUMN device_bind_history.reason IS '操作原因';
      COMMENT ON COLUMN device_bind_history.ip_address IS '操作IP地址';
      COMMENT ON COLUMN device_bind_history.user_agent IS '用户代理信息';
      COMMENT ON COLUMN device_bind_history.created_at IS '创建时间';
      
      -- offline_license_history 表注释
      COMMENT ON TABLE offline_license_history IS '离线授权更新历史表';
      COMMENT ON COLUMN offline_license_history.id IS '历史记录ID，主键';
      COMMENT ON COLUMN offline_license_history.user_id IS '用户ID，外键关联users表';
      COMMENT ON COLUMN offline_license_history.device_id IS '设备ID，外键关联user_devices表';
      COMMENT ON COLUMN offline_license_history.device_code IS '设备码';
      COMMENT ON COLUMN offline_license_history.license_key IS '授权密钥';
      COMMENT ON COLUMN offline_license_history.license_type IS '授权类型：offline-离线, online-在线, trial-试用';
      COMMENT ON COLUMN offline_license_history.valid_from IS '授权生效时间';
      COMMENT ON COLUMN offline_license_history.valid_until IS '授权过期时间';
      COMMENT ON COLUMN offline_license_history.update_method IS '更新方式：manual-手动, auto-自动, admin-管理员操作';
      COMMENT ON COLUMN offline_license_history.update_reason IS '更新原因';
      COMMENT ON COLUMN offline_license_history.status IS '授权状态：active-有效, expired-已过期, revoked-已撤销';
      COMMENT ON COLUMN offline_license_history.ip_address IS '操作IP地址';
      COMMENT ON COLUMN offline_license_history.user_agent IS '用户代理信息';
      COMMENT ON COLUMN offline_license_history.created_at IS '创建时间';
    `);
    console.log('   ✅ 注释添加成功\n');
    
    // 4. 确保触发器存在
    console.log('4. 创建/更新触发器...');
    await client.query(`
      -- 创建更新时间戳的函数
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- 为 users 表添加触发器
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('   ✅ 触发器创建成功\n');
    
    // 查询更新后的表结构
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 users 表结构：\n');
    const columns = await client.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.table(columns.rows);
    
    // 查询索引信息
    console.log('\n📑 users 表索引：\n');
    const indexes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'users'
      ORDER BY indexname;
    `);
    console.table(indexes.rows);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 数据库更新完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ 数据库更新失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行更新
updateDatabase()
  .then(() => {
    console.log('✅ 脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

