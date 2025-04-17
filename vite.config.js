import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert' // 1. 引入插件

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // 允许通过 IP 访问
    https: true // 2. 启用 HTTPS
  },
  plugins: [
    vue(),
    mkcert() // 3. 使用插件
  ],
})
