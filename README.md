# Vue-ID2PDF

一个基于Vue 3的身份证扫描与PDF生成工具，提供了高效的身份证信息采集解决方案。

## 功能特性

- 📷 支持实时摄像头采集身份证正反面图像
- 🤖 基于OpenCV.js的智能身份证边缘检测与自动捕获
- ✂️ 灵活的图像裁剪与调整功能
- 📄 一键生成标准A4格式PDF文档
- 📱 响应式设计，同时支持桌面端和移动端设备

## 技术栈

- Vue 3 + Composition API
- Vite 构建工具
- OpenCV.js 用于图像处理和检测
- jsPDF 用于PDF生成
- Cropper.js 用于图像裁剪

## 快速开始

### 安装依赖

```bash
# 使用npm
npm install

# 或使用yarn
yarn

# 或使用pnpm
pnpm install
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 使用指南

1. 点击"打开摄像头"按钮启动相机
2. 可选择"开启自动检测"或手动拍摄身份证
3. 拍摄完成后可以编辑和调整图像
4. 当正反面都准备就绪后，点击"生成并下载PDF"按钮

## 注意事项

- 使用Chrome或Edge等现代浏览器获得最佳体验
- 在移动设备上使用时，请确保授予相机权限
- 为保护隐私，所有图像处理均在本地进行，不会上传到任何服务器

## 许可

[MIT 许可证](LICENSE)
