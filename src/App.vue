<script setup>
import IdScanner from './components/IdScanner.vue';
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <div class="logo-container">
        <img src="/favicon.svg" alt="Vue-ID2PDF Logo" class="app-logo" />
        <h1 class="app-title">Vue-ID2PDF</h1>
      </div>
    </header>

    <main class="app-content">
      <IdScanner />
    </main>

    <footer class="app-footer">
      <p>&copy; {{ new Date().getFullYear() }} Vue-ID2PDF | <a href="https://github.com/Vue-ID2PDF" target="_blank" rel="noopener noreferrer">GitHub</a></p>
      <p class="privacy-note">所有图像均在本地处理，不会上传到任何服务器</p>
    </footer>
  </div>
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f5f5;
  color: #333;
  line-height: 1.6;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #1a73e8;
  color: white;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.app-logo {
  width: 2.5rem;
  height: 2.5rem;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.app-content {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.app-footer {
  background-color: #f0f0f0;
  color: #666;
  text-align: center;
  padding: 1rem;
  font-size: 0.875rem;
  margin-top: auto;
  border-top: 1px solid #e0e0e0;
}

.app-footer a {
  color: #1a73e8;
  text-decoration: none;
}

.app-footer a:hover {
  text-decoration: underline;
}

.privacy-note {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #888;
}

/* 暗色模式适配 */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #121212;
    color: #e0e0e0;
  }
  
  .app-header {
    background-color: #1a73e8;
  }
  
  .app-footer {
    background-color: #1e1e1e;
    color: #aaa;
    border-top-color: #333;
  }
  
  .app-footer a {
    color: #8ab4f8;
  }
  
  .privacy-note {
    color: #777;
  }
}

/* 移动适配 */
@media (max-width: 600px) {
  .app-header {
    padding: 0.75rem;
  }
  
  .app-logo {
    width: 2rem;
    height: 2rem;
  }
  
  .app-title {
    font-size: 1.25rem;
  }
}
</style>
