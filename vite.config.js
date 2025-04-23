import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 设置打包路径
  server: {
    host: true, // 允许通过 IP 访问
    https: true, // 启用 HTTPS
    port: 3000, // 指定开发服务器端口
    open: true // 自动打开浏览器
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src') // 设置路径别名
    }
  },
  build: {
    target: 'es2015', // 指定编译目标
    minify: 'terser', // 使用terser压缩
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境去除console
        drop_debugger: true // 生产环境去除debugger
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue'], // 第三方库单独打包
          'cropperjs': ['cropperjs'], // Cropper.js单独打包
          'jspdf': ['jspdf'] // jsPDF单独打包
        }
      }
    },
    chunkSizeWarningLimit: 1000 // 调整块大小警告限制
  },
  plugins: [
    vue(),
    mkcert()
  ],
})
