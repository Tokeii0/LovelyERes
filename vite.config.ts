import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vitePluginBundleObfuscator from 'vite-plugin-bundle-obfuscator';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isProd = process.env.NODE_ENV === 'production' || process.env.TAURI_ENV_DEBUG !== 'true';
// @ts-expect-error process is a nodejs global
const isDebugBuild = process.env.TAURI_ENV_DEBUG === 'true' || process.env.VITE_DEBUG_SOURCEMAP === 'true';

// https://vite.dev/config/
export default defineConfig(async ({ command }) => ({
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
  esbuild: isProd
    ? {
        drop: ['console', 'debugger'],
      }
    : undefined,
  // 配置多页面应用
  build: {
    sourcemap: isDebugBuild,
    minify: 'esbuild' as const, // 使用 esbuild 进行基本压缩（更快，不混淆）
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      treeshake: isProd
        ? {
            manualPureFunctions: [
              'console.debug',
              'console.error',
              'console.info',
              'console.log',
              'console.warn',
            ],
          }
        : undefined,
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
        // 代码分块优化：按重型库单独拆分 chunk, 降低首屏体积
        manualChunks(id: string) {
          if (id.indexOf('node_modules') === -1) return undefined;
          if (/[\\/]node_modules[\\/](xterm|xterm-addon-)/.test(id)) return 'xterm';
          if (/[\\/]node_modules[\\/]@tauri-apps[\\/]/.test(id)) return 'tauri';
          if (/[\\/]node_modules[\\/]@icon-park[\\/]/.test(id)) return 'icons';
          if (/[\\/]node_modules[\\/]monaco-editor[\\/]/.test(id)) return 'monaco';
          if (/[\\/]node_modules[\\/](vue|@vue|pinia)[\\/]/.test(id)) return 'vue';
          return 'vendor';
        },
      },
    },
  },

  // 使用自定义插件
  plugins: [
    vue(),
    // JavaScript 混淆插件: 仅在 `vite build` (production) 启用
    // dev 与 `tauri dev` 场景禁用以保证 sourcemap 可调试 + 构建速度
    ...(command === 'build' && isProd ? [
      vitePluginBundleObfuscator({
        enable: true,
        log: false,
        autoExcludeNodeModules: true,
        options: {
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: false,
          debugProtectionInterval: 0,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: false,
          renameGlobals: false,
          selfDefending: false,
          simplify: true,
          splitStrings: false,
          stringArray: true,
          stringArrayCallsTransform: false,
          stringArrayEncoding: ['base64'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 2,
          stringArrayWrappersType: 'variable',
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false,
        }
      })
    ] : [])
  ],
}));
