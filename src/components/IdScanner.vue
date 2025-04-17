<template>
  <div class="id-scanner-container">
    <h2>身份证扫描与PDF生成</h2>

    <div class="camera-section">
      <!-- 新增：控制摄像头的按钮 -->
      <button @click="toggleCamera" :disabled="isProcessingCamera" class="toggle-camera-button">
        {{ isCameraOpen ? '关闭摄像头' : '打开摄像头' }}
      </button>

      <!-- 摄像头视频流 - 使用 v-show 保持DOM结构，避免重新渲染 -->
      <div v-show="isCameraOpen" class="video-wrapper"> <!-- 添加一个包装器以便控制显示 -->
        <video ref="video" autoplay playsinline class="video-feed"></video>
      </div>
      <!-- 可选：摄像头关闭时的占位符 -->
      <div v-if="!isCameraOpen && !isProcessingCamera" class="video-placeholder">
        请点击“打开摄像头”开始扫描
      </div>
       <!-- 可选：正在打开摄像头时的提示 -->
      <div v-if="isProcessingCamera && !isCameraOpen" class="video-placeholder">
        正在打开摄像头...
      </div>


      <!-- 拍摄按钮 - 仅在摄像头打开时启用 -->
      <div class="capture-buttons" v-if="isCameraOpen">
        <button @click="captureFront" :disabled="!stream">拍摄正面</button>
        <button @click="captureBack" :disabled="!stream">拍摄反面</button>
      </div>
    </div>

    <div class="preview-section">
      <h3>预览</h3>
      <div class="image-previews">
        <div class="preview-box">
          <img v-if="frontImage" :src="frontImage" alt="身份证正面" />
          <div v-else class="placeholder">正面预览</div>
        </div>
        <div class="preview-box">
          <img v-if="backImage" :src="backImage" alt="身份证反面" />
          <div v-else class="placeholder">反面预览</div>
        </div>
      </div>
    </div>

    <div class="canvas-section">
       <h3>A4预览</h3>
      <!-- A4 预览 Canvas -->
      <canvas ref="canvas" class="a4-canvas"></canvas>
    </div>

    <button 
      @click="generatePdf" 
      :disabled="!frontImage || !backImage" 
      class="generate-button"
    >
      生成并下载PDF
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'; // 导入 computed

const video = ref(null);
const canvas = ref(null);
const frontImage = ref(null);
const backImage = ref(null);
let stream = ref(null); // 使用 ref 以便在模板中检查
const isCameraOpen = computed(() => !!stream.value); // 计算属性判断摄像头状态
const isProcessingCamera = ref(false); // 防止重复点击

// 初始化摄像头
const initCamera = async () => {
  if (isProcessingCamera.value) return; // 防止重复执行
  isProcessingCamera.value = true;
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    stream.value = mediaStream; // 更新 ref 的值
    if (video.value) {
      video.value.srcObject = mediaStream;
      // 确保视频开始播放 (某些浏览器可能需要)
      await video.value.play(); 
    }
  } catch (err) {
    console.error("无法访问摄像头: ", err);
    alert("无法访问摄像头，请检查权限或设备。");
    stream.value = null; // 发生错误时重置
  } finally {
    isProcessingCamera.value = false; // 完成处理
  }
};

// 停止摄像头
const stopCamera = () => {
  if (isProcessingCamera.value && !stream.value) return; // 如果正在打开，则不执行关闭
  isProcessingCamera.value = true; // 标记开始处理
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }
  if (video.value) {
    video.value.srcObject = null;
  }
  stream.value = null; // 重置 ref
  // 清空预览，可选
  // frontImage.value = null;
  // backImage.value = null;
  isProcessingCamera.value = false; // 标记处理结束
};

// 新增：切换摄像头状态的函数
const toggleCamera = async () => {
  if (isCameraOpen.value) {
    stopCamera();
  } else {
    await initCamera();
  }
};


// 捕获图像
const captureImage = () => {
  if (!video.value || !stream.value) return null; // 检查 stream.value

  const videoEl = video.value;
  const targetAspectRatio = 85.6 / 54; // 目标宽高比（身份证）
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;
  const videoAspectRatio = videoWidth / videoHeight;

  let sx = 0, sy = 0, sWidth = videoWidth, sHeight = videoHeight;

  // 计算需要从源视频中裁剪的区域
  if (videoAspectRatio > targetAspectRatio) {
    // 视频比目标更宽，需要裁剪左右两边
    sWidth = videoHeight * targetAspectRatio;
    sx = (videoWidth - sWidth) / 2;
  } else if (videoAspectRatio < targetAspectRatio) {
    // 视频比目标更高，需要裁剪上下两边
    sHeight = videoWidth / targetAspectRatio;
    sy = (videoHeight - sHeight) / 2;
  }
  // 如果比例相同，则无需裁剪，使用原始 sx, sy, sWidth, sHeight

  const tempCanvas = document.createElement('canvas');
  // 设置画布尺寸为裁剪后的尺寸
  tempCanvas.width = sWidth;
  tempCanvas.height = sHeight;

  const context = tempCanvas.getContext('2d');
  // 从视频源的计算区域绘制到画布上
  context.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

  return tempCanvas.toDataURL('image/png');
};


const captureFront = () => {
  frontImage.value = captureImage();
  if (frontImage.value && backImage.value) {
    drawImagesOnCanvas();
  }
};

const captureBack = () => {
  backImage.value = captureImage();
  if (frontImage.value && backImage.value) {
    drawImagesOnCanvas();
  }
};

// 将图像绘制到Canvas上 (模拟A4布局)
const drawImagesOnCanvas = () => {
  if (!frontImage.value || !backImage.value || !canvas.value) return;

  const ctx = canvas.value.getContext('2d');
  const a4Width = 595; // A4 像素宽度 (72 dpi)
  const a4Height = 842; // A4 像素高度 (72 dpi)
  canvas.value.width = a4Width;
  canvas.value.height = a4Height;

  ctx.fillStyle = 'white'; // 设置背景色为白色
  ctx.fillRect(0, 0, a4Width, a4Height);

  const imgFront = new Image();
  const imgBack = new Image();

  // 定义绘制图片的辅助函数
  const drawScaledImage = (img, yPos) => {
    const scale = Math.min((a4Width * 0.8) / img.width, (a4Height * 0.4) / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const x = (a4Width - drawWidth) / 2;
    ctx.drawImage(img, x, yPos, drawWidth, drawHeight);
  };

  imgFront.onload = () => {
    // 绘制正面图片
    drawScaledImage(imgFront, a4Height * 0.05); // 顶部留白

    // 正面加载并绘制完成后，开始加载反面图片
    if (backImage.value) {
      imgBack.src = backImage.value;
    }
  };

  imgBack.onload = () => {
    // 绘制反面图片
    drawScaledImage(imgBack, a4Height * 0.5); // 从中间开始，留些间距
  };
  
  // 先加载正面图片
  if (frontImage.value) {
    imgFront.src = frontImage.value;
  }
  // 注意：不再需要之前的 drawImage 辅助函数和那两行调用
};


// 生成PDF
const generatePdf = async () => {
  if (!canvas.value) return;

  // 动态导入 jsPDF
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4'
  });

  const imgData = canvas.value.toDataURL('image/jpeg', 0.9); // 使用JPEG以减小文件大小
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save('身份证件.pdf');
};


// 组件挂载时不再初始化摄像头
// onMounted(() => {
//   initCamera();
// });

// 组件卸载前仍然需要停止摄像头，以防万一
onBeforeUnmount(() => {
  stopCamera();
});
</script>

<style scoped>
.id-scanner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  font-family: sans-serif;
  max-width: 800px; /* 桌面端最大宽度 */
  width: 100%; /* 默认宽度为100% */
  min-height: 100vh; /* 确保容器至少占满屏幕高度 */
  box-sizing: border-box; /* 让 padding 包含在 width 内 */
  margin: 0 auto; /* 居中 */
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2, h3 {
  color: #333;
  margin-bottom: 15px;
}

.camera-section, .preview-section, .canvas-section {
  width: 100%;
  margin-bottom: 25px;
  padding: 15px;
  background-color: #fff; /* 为每个部分添加白色背景 */
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.camera-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 新增：切换摄像头按钮样式 */
.toggle-camera-button {
  margin-bottom: 15px; /* 与下方元素保持间距 */
  /* 可以继承通用按钮样式或自定义 */
}

/* 新增：视频包装器 */
.video-wrapper {
  width: 100%; /* 继承或设置宽度 */
  max-width: 600px; /* 限制最大宽度，根据需要调整 */
  aspect-ratio: 85.6 / 54; /* 保持身份证比例 */
  margin-bottom: 15px; /* 与下方按钮间距 */
  position: relative; /* 如果需要叠加元素 */
  background-color: #eee; /* 可以给个背景色 */
  display: flex; /* 用于内部 video 居中等 */
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 隐藏超出部分 */
}


.video-feed {
  /* border: 1px solid #ccc; */ /* 边框移到 wrapper */
  /* margin-bottom: 15px; */ /* 移到 wrapper */
  display: block;
  /* max-width: 100%; */ /* 由 wrapper 控制 */
  height: 100%; /* 填充 wrapper 高度 */
  width: 100%; /* 填充 wrapper 宽度 */
  /* aspect-ratio: 85.6 / 54; */ /* 比例由 wrapper 控制 */
  object-fit: cover;
}

/* 新增：视频占位符样式 */
.video-placeholder {
  width: 100%;
  max-width: 600px; /* 与 video-wrapper 保持一致 */
  aspect-ratio: 85.6 / 54; /* 保持身份证比例 */
  background-color: #f0f0f0;
  color: #888;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  border: 1px dashed #ccc;
  margin-bottom: 15px; /* 与下方按钮间距 */
  padding: 10px;
  box-sizing: border-box;
}


.capture-buttons {
  display: flex; /* 让按钮并排 */
  justify-content: center; /* 居中按钮 */
  flex-wrap: wrap; /* 空间不足时换行 */
  gap: 10px; /* 按钮间距 */
  /* margin-top: 15px; */ /* 如果视频隐藏，这个间距可能不需要了 */
}

.capture-buttons button {
  margin: 0; /* 移除外边距，使用gap控制 */
}

.image-previews {
  display: flex;
  justify-content: space-around;
  gap: 15px; /* 调整间距 */
  flex-wrap: wrap; /* 允许换行 */
}

.preview-box {
  width: 120px; /* 稍微减小预览框 */
  height: 75px;
  border: 1px dashed #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-color: #f0f0f0;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* 保持图片比例 */
}

.placeholder {
  color: #aaa;
  font-size: 14px;
}

.canvas-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.a4-canvas {
  border: 1px solid black;
  max-width: 100%; /* Canvas 响应式 */
  height: auto;
  width: 90%; /* 调整默认宽度 */
  max-height: 400px; /* 限制最大高度 */
  object-fit: contain;
}

button {
  margin: 8px 5px; /* 增加垂直间距 */
  padding: 12px 18px; /* 调整按钮大小 */
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  transition: background-color 0.3s ease;
  flex-shrink: 0; /* 防止按钮在flex布局中被过度压缩 */
}

button:hover:not(:disabled) {
  background-color: #0056b3; /* 悬停时深蓝色 */
}

button:disabled {
  background-color: #ccc; /* 禁用时灰色 */
  cursor: not-allowed;
  opacity: 0.7;
}

.generate-button {
  margin-top: 20px; /* 与上方内容保持距离 */
  background-color: #28a745; /* 绿色背景 */
}

.generate-button:hover:not(:disabled) {
  background-color: #218838; /* 悬停时深绿色 */
}

/* 移动端适配媒体查询 (例如：屏幕宽度小于 600px) */
@media (max-width: 600px) {
  .id-scanner-container {
    padding: 10px; /* 减小内边距 */
    border-radius: 0; /* 移动端通常不需要圆角 */
    box-shadow: none; /* 移除阴影 */
    min-height: 100vh; /* 确保占满屏幕 */
  }

  h2 {
    font-size: 1.2em; /* 调整标题大小 */
    margin-bottom: 10px;
  }

  h3 {
     font-size: 1.1em;
     margin-bottom: 10px;
  }

  .camera-section, .preview-section, .canvas-section {
    padding: 10px; /* 减小内边距 */
    margin-bottom: 15px; /* 减小间距 */
  }

  .video-wrapper, .video-placeholder {
     max-width: 95%; /* 移动端可以更宽 */
     margin-bottom: 10px;
  }

  .toggle-camera-button {
    width: 80%;
    margin: 0 auto 10px auto; /* 居中并添加底部间距 */
  }

  .image-previews {
    flex-direction: column; /* 垂直堆叠预览框 */
    align-items: center; /* 居中对齐 */
    gap: 10px;
  }

  .preview-box {
    width: 150px; /* 可以适当调整大小 */
    height: 94px;
  }

  .a4-canvas {
    width: 100%; /* 占满宽度 */
    max-height: 350px; /* 进一步限制高度 */
  }

  button {
    padding: 10px 15px; /* 调整按钮大小 */
    font-size: 15px;
  }

  .generate-button {
    width: 80%; /* 设置按钮宽度 */
    margin: 15px auto 10px auto; /* 调整外边距并居中 */
  }
}
</style>