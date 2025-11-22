import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';
// @ts-expect-error Node.js modules
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
// @ts-expect-error Node.js modules
import { join } from 'path';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// 自定义插件：复制src目录到dist
function copySrcPlugin() {
  return {
    name: 'copy-src',
    writeBundle() {
      const srcDir = 'src';
      const distSrcDir = 'dist/src';

      function copyDir(src: string, dest: string) {
        if (!existsSync(dest)) {
          mkdirSync(dest, { recursive: true });
        }

        const entries = readdirSync(src);
        for (const entry of entries) {
          const srcPath = join(src, entry);
          const destPath = join(dest, entry);

          if (statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        }
      }

      if (existsSync(srcDir)) {
        copyDir(srcDir, distSrcDir);
        console.log('✅ src目录已复制到dist/src');
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5174,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 5175,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // 配置多页面应用
  build: {
    sourcemap: true, // 启用source map便于调试
    minify: 'esbuild' as const, // 使用 esbuild 进行基本压缩（更快，不混淆）
    rollupOptions: {
      input: {
        main: 'index.html',
        'ssh-terminal': 'ssh-terminal.html',
        'container-terminal': 'container-terminal.html',

        // 可以在这里添加更多页面
      },
      onwarn(warning: any, warn: any) {
        // 忽略source map相关警告
        if (warning.code === 'SOURCEMAP_ERROR') return;
        if (warning.message && warning.message.includes('source map')) return;
        warn(warning);
      },
      output: {
        // 标准文件名格式
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // 代码分块优化
        manualChunks(id: string) {
          if (id.indexOf('node_modules') !== -1) {
            return 'vendor';
          }
        },
      },
    },
  },

  // 使用自定义插件
  plugins: [
    vue(),
    copySrcPlugin(),
    // JavaScript 混淆插件（仅在生产构建时启用）
    vitePluginBundleObfuscator({
      enable: true, // 启用混淆
      log: true, // 显示混淆日志
      autoExcludeNodeModules: true, // 自动排除 node_modules
      // 混淆选项 - 使用保守配置避免破坏代码
      options: {
        compact: true, // 压缩代码
        controlFlowFlattening: false, // 不使用控制流扁平化（可能破坏代码）
        deadCodeInjection: false, // 不注入死代码（可能破坏代码）
        debugProtection: false, // 不启用调试保护（可能影响开发）
        debugProtectionInterval: 0,
        disableConsoleOutput: true, // 禁用 console 输出
        identifierNamesGenerator: 'hexadecimal', // 使用十六进制标识符
        log: false,
        numbersToExpressions: false, // 不转换数字为表达式（可能破坏代码）
        renameGlobals: false, // 不重命名全局变量（避免破坏外部引用）
        selfDefending: false, // 不启用自我防御（可能破坏代码）
        simplify: true, // 简化代码
        splitStrings: false, // 不分割字符串（可能破坏代码）
        stringArray: true, // 使用字符串数组
        stringArrayCallsTransform: false, // 不转换字符串数组调用（避免性能问题）
        stringArrayEncoding: ['base64'], // 使用 base64 编码字符串
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 2,
        stringArrayWrappersType: 'variable',
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false, // 不使用 Unicode 转义（保持可读性）
      }
    })
  ],
}));
