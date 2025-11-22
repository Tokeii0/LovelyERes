/**
 * 更新数据库：修改 max_devices 默认值为 1
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lovelyres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function updateMaxDevices() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 开始更新数据库...\n');

    // 1. 修改 users 表的 max_devices 默认值
    console.log('1. 修改 users 表的 max_devices 默认值...');
    await client.query(`
      ALTER TABLE users 
      ALTER COLUMN max_devices SET DEFAULT 1;
    `);
    console.log('   ✅ 默认值已修改为 1\n');

    // 2. 可选：更新现有用户的 max_devices（如果需要）
    console.log('2. 是否需要更新现有用户的 max_devices？');
    console.log('   提示：这将影响所有现有用户');
    console.log('   如果需要更新，请取消注释以下代码：\n');
    
    // 取消注释以下代码以更新现有用户
    /*
    await client.query(`
      UPDATE users 
      SET max_devices = 1 
      WHERE max_devices = 3 AND is_vip = FALSE;
    `);
    console.log('   ✅ 已更新非 VIP 用户的 max_devices 为 1\n');
    */

    console.log('✅ 数据库更新完成！\n');
    console.log('📝 说明：');
    console.log('   - 新注册用户的 max_devices 默认值为 1');
    console.log('   - 现有用户的 max_devices 保持不变（除非手动更新）');
    console.log('   - VIP 用户可以通过升级 VIP 来增加设备数量\n');

  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行更新
updateMaxDevices()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

