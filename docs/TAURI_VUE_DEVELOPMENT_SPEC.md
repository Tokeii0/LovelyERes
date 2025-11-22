# Tauri + Vue 开发规范

> **项目**: LovelyRes - Linux Emergency Response Tool  
> **技术栈**: Tauri V2 + Vue 3 + TypeScript + Rust  
> **版本**: 1.0.0  
> **更新日期**: 2025-09-29

---

## 📋 目录

1. [项目架构](#1-项目架构)
2. [前端开发规范](#2-前端开发规范)
3. [后端开发规范](#3-后端开发规范)
4. [前后端通信规范](#4-前后端通信规范)
5. [状态管理规范](#5-状态管理规范)
6. [UI/UX 规范](#6-uiux-规范)
7. [构建与部署](#7-构建与部署)
8. [最佳实践](#8-最佳实践)

---

## 1. 项目架构

### 1.1 目录结构

```
LovelyRes/
├── src/                          # 前端源码
│   ├── components/               # Vue 组件
│   │   └── SSHTerminal.vue      # SSH 终端组件
│   ├── modules/                  # 功能模块
│   │   ├── core/                # 核心模块（app, stateManager）
│   │   ├── ssh/                 # SSH 相关模块
│   │   ├── docker/              # Docker 管理模块
│   │   ├── remote/              # 远程操作模块
│   │   ├── settings/            # 设置管理模块
│   │   ├── system/              # 系统信息模块
│   │   ├── ui/                  # UI 渲染模块
│   │   └── utils/               # 工具函数
│   ├── css/                     # 样式文件
│   ├── types/                   # TypeScript 类型定义
│   ├── main.ts                  # 主入口
│   ├── container-terminal.ts    # 容器终端入口
│   └── vite-env.d.ts           # Vite 环境类型
├── src-tauri/                   # Rust 后端
│   ├── src/
│   │   ├── lib.rs              # 库入口，定义所有 Tauri 命令
│   │   ├── main.rs             # 应用入口
│   │   ├── types.rs            # 类型定义
│   │   ├── ssh_manager.rs      # SSH 管理器
│   │   ├── ssh_client.rs       # SSH 客户端
│   │   ├── docker_manager.rs   # Docker 管理器
│   │   ├── settings.rs         # 设置管理
│   │   ├── theme_manager.rs    # 主题管理
│   │   └── window_manager.rs   # 窗口管理
│   ├── Cargo.toml              # Rust 依赖配置
│   └── tauri.conf.json         # Tauri 配置
├── index.html                   # 主页面
├── ssh-terminal.html           # SSH 终端页面
├── container-terminal.html     # 容器终端页面
├── package.json                # Node.js 依赖
├── vite.config.ts              # Vite 配置
└── tsconfig.json               # TypeScript 配置
```

### 1.2 架构原则

1. **模块化设计**: 按功能划分模块，每个模块职责单一
2. **分层架构**: UI 层 → 管理器层 → 服务层 → 数据层
3. **前后端分离**: 前端负责 UI 和交互，后端负责业务逻辑和系统调用
4. **事件驱动**: 使用 Tauri 事件系统实现实时通信
5. **类型安全**: 前后端都使用强类型系统（TypeScript + Rust）

---

## 2. 前端开发规范

### 2.1 技术栈

- **框架**: Vue 3.5.13 (Composition API)
- **语言**: TypeScript 5.6.2
- **构建工具**: Vite 6.0.3
- **UI 库**: 自定义 UI + @icon-park/vue-next
- **终端**: xterm.js 5.3.0 + xterm-addon-fit

### 2.2 Vue 组件规范

#### 2.2.1 组件结构

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入依赖
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 2. 定义接口和类型
interface ComponentProps {
  // ...
}

// 3. 定义 props 和 emits
const props = defineProps<ComponentProps>()
const emit = defineEmits<{
  (e: 'event-name', value: string): void
}>()

// 4. 响应式状态
const state = ref<StateType>({})

// 5. 计算属性
const computed = computed(() => {})

// 6. 方法定义
const method = () => {}

// 7. 生命周期钩子
onMounted(() => {})
onUnmounted(() => {})
</script>

<style scoped>
/* 组件样式 */
</style>
```

#### 2.2.2 命名规范

- **组件文件**: PascalCase，如 `SSHTerminal.vue`
- **组件名**: 与文件名一致
- **Props**: camelCase
- **Events**: kebab-case
- **变量**: camelCase
- **常量**: UPPER_SNAKE_CASE
- **类型/接口**: PascalCase

### 2.3 TypeScript 规范

#### 2.3.1 类型定义

```typescript
// 优先使用 interface 定义对象类型
interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
}

// 使用 type 定义联合类型、交叉类型等
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

// 导出类型供其他模块使用
export type { SSHConnection, ConnectionStatus }
```

#### 2.3.2 类型注解

```typescript
// 函数参数和返回值必须有类型注解
async function connectSSH(connection: SSHConnection): Promise<void> {
  // ...
}

// 变量类型可以推断时可省略，复杂类型必须注解
const connections = ref<SSHConnection[]>([])
const status = ref<ConnectionStatus>('disconnected')
```

### 2.4 模块开发规范

#### 2.4.1 管理器模式

所有功能模块应实现管理器模式：

```typescript
// src/modules/feature/featureManager.ts
class FeatureManager {
  private state: FeatureState
  private listeners: Set<() => void>

  constructor() {
    this.state = this.getInitialState()
    this.listeners = new Set()
  }

  // 初始化方法
  async initialize(): Promise<void> {
    // 初始化逻辑
  }

  // 公共 API 方法
  async doSomething(): Promise<void> {
    // 业务逻辑
    this.notifyListeners()
  }

  // 状态订阅
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }

  // 清理方法
  cleanup(): void {
    this.listeners.clear()
  }
}

// 导出单例
export const featureManager = new FeatureManager()
```

#### 2.4.2 模块导出

```typescript
// 每个模块应有清晰的导出
export { featureManager } from './featureManager'
export type { FeatureState, FeatureConfig } from './types'
export { FeatureComponent } from './FeatureComponent.vue'
```

### 2.5 Tauri API 调用规范

#### 2.5.1 命令调用

```typescript
import { invoke } from '@tauri-apps/api/core'

// 使用 try-catch 处理错误
async function callTauriCommand() {
  try {
    const result = await invoke<ResultType>('command_name', {
      param1: value1,
      param2: value2
    })
    return result
  } catch (error) {
    console.error('命令执行失败:', error)
    throw error
  }
}
```

#### 2.5.2 事件监听

```typescript
import { listen } from '@tauri-apps/api/event'

// 在组件挂载时监听，卸载时清理
let unlisten: (() => void) | undefined

onMounted(async () => {
  unlisten = await listen<PayloadType>('event-name', (event) => {
    console.log('收到事件:', event.payload)
    // 处理事件
  })
})

onUnmounted(() => {
  if (unlisten) {
    unlisten()
  }
})
```

### 2.6 样式规范

#### 2.6.1 CSS 变量

使用 CSS 变量定义主题：

```css
:root {
  /* 颜色 */
  --primary-color: #3b82f6;
  --background-color: #1a1a1a;
  --text-color: #ffffff;
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* 字体 */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'Cascadia Code', 'Fira Code', monospace;
}
```

#### 2.6.2 组件样式

```vue
<style scoped>
/* 使用 scoped 避免样式污染 */
.component {
  /* 使用 CSS 变量 */
  color: var(--text-color);
  padding: var(--spacing-md);
  font-family: var(--font-family);
}

/* 使用 BEM 命名规范 */
.component__element {
  /* ... */
}

.component--modifier {
  /* ... */
}
</style>
```

---

## 3. 后端开发规范

### 3.1 技术栈

- **语言**: Rust (Edition 2021)
- **框架**: Tauri 2.1
- **异步运行时**: Tokio 1.x
- **SSH**: ssh2 0.9
- **序列化**: serde + serde_json

### 3.2 项目结构

```rust
// src-tauri/src/lib.rs
pub mod ssh_manager;
pub mod docker_manager;
pub mod settings;
// ... 其他模块

pub struct AppState {
    pub settings: Mutex<settings::AppSettings>,
    pub ssh_manager: Mutex<ssh_manager::SSHManager>,
    // ... 其他状态
}
```

### 3.3 模块开发规范

#### 3.3.1 模块结构

```rust
// src-tauri/src/feature_manager.rs

use crate::types::{LovelyResError, LovelyResResult};
use std::sync::{Arc, Mutex};

/// 功能管理器
pub struct FeatureManager {
    state: Arc<Mutex<FeatureState>>,
}

impl FeatureManager {
    /// 创建新实例
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(FeatureState::default())),
        }
    }

    /// 公共 API 方法
    pub fn do_something(&mut self, param: String) -> LovelyResResult<String> {
        // 业务逻辑
        Ok("result".to_string())
    }
}
```

#### 3.3.2 错误处理

```rust
// src-tauri/src/types.rs

use thiserror::Error;

#[derive(Error, Debug)]
pub enum LovelyResError {
    #[error("SSH 错误: {0}")]
    SSHError(String),
    
    #[error("网络错误: {0}")]
    NetworkError(String),
    
    #[error("认证失败: {0}")]
    AuthenticationError(String),
    
    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),
}

pub type LovelyResResult<T> = Result<T, LovelyResError>;
```


