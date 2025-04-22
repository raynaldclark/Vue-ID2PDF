<template>
  <main class="id-scanner-container">
    <h1>身份证扫描与PDF生成</h1>

    <section class="camera-section" aria-labelledby="camera-section-title">
      <h2 id="camera-section-title" class="section-title">摄像头控制</h2>
      
      <!-- 控制摄像头的按钮 -->
      <button 
        @click="toggleCamera" 
        :disabled="isProcessingCamera" 
        class="toggle-camera-button"
        :aria-label="isCameraOpen ? '关闭摄像头' : '打开摄像头'"
      >
        {{ isCameraOpen ? '关闭摄像头' : '打开摄像头' }}
      </button>

      <!-- 摄像头视频流 -->
      <div v-show="isCameraOpen" class="video-wrapper" aria-live="polite">
        <video ref="video" autoplay playsinline class="video-feed" aria-label="身份证扫描视频"></video>
        <!-- 添加检测框覆盖层 -->
        <canvas ref="overlayCanvas" class="overlay-canvas" v-if="isCameraOpen" aria-hidden="true"></canvas>
        <!-- 添加检测状态提示 -->
        <div class="detection-status" v-if="isCameraOpen && detectionStatus" aria-live="polite">
          {{ detectionStatus }}
        </div>
      </div>
      
      <!-- 摄像头关闭时的占位符 -->
      <div v-if="!isCameraOpen && !isProcessingCamera" class="video-placeholder" aria-live="polite">
        请点击"打开摄像头"开始扫描
      </div>
      
      <!-- 正在打开摄像头时的提示 -->
      <div v-if="isProcessingCamera && !isCameraOpen" class="video-placeholder" aria-live="polite">
        正在打开摄像头...
      </div>

      <!-- 拍摄按钮 - 仅在摄像头打开时启用 -->
      <div class="capture-buttons" v-if="isCameraOpen">
        <button 
          @click="toggleAutoDetect" 
          :class="{'active': autoDetectEnabled}"
          :aria-pressed="autoDetectEnabled ? 'true' : 'false'"
        >
          {{ autoDetectEnabled ? '关闭自动检测' : '开启自动检测' }}
        </button>
        <button 
          @click="captureFront" 
          :disabled="!stream"
          aria-label="手动拍摄身份证正面"
        >
          手动拍摄正面
        </button>
        <button 
          @click="captureBack" 
          :disabled="!stream"
          aria-label="手动拍摄身份证反面"
        >
          手动拍摄反面
        </button>
      </div>
    </section>

    <section class="preview-section" aria-labelledby="preview-section-title">
      <h2 id="preview-section-title" class="section-title">预览</h2>
      <div class="image-previews">
        <div class="preview-item">
          <div class="preview-box" role="img" aria-label="身份证正面预览">
            <img v-if="frontImage" :src="frontImage" alt="身份证正面" />
            <div v-else class="placeholder">正面预览</div>
          </div>
          <!-- 重新裁剪按钮 -->
          <button 
            v-if="frontImage" 
            @click="openCropper('front', frontImage)" 
            class="recrop-button"
            aria-label="编辑身份证正面图像"
          >
            编辑正面
          </button>
        </div>
        <div class="preview-item">
          <div class="preview-box" role="img" aria-label="身份证反面预览">
            <img v-if="backImage" :src="backImage" alt="身份证反面" />
            <div v-else class="placeholder">反面预览</div>
          </div>
          <!-- 重新裁剪按钮 -->
          <button 
            v-if="backImage" 
            @click="openCropper('back', backImage)" 
            class="recrop-button"
            aria-label="编辑身份证反面图像"
          >
            编辑反面
          </button>
        </div>
      </div>
    </section>

    <section class="canvas-section" aria-labelledby="a4-preview-title">
      <h2 id="a4-preview-title" class="section-title">A4预览</h2>
      <!-- A4 预览 Canvas -->
      <canvas ref="canvas" class="a4-canvas" aria-label="A4文档预览"></canvas>
    </section>

    <button 
      @click="generatePdf" 
      :disabled="!frontImage || !backImage" 
      class="generate-button"
      aria-label="生成并下载PDF文档"
    >
      生成并下载PDF
    </button>

    <!-- 裁剪器模态框 -->
    <transition name="modal-fade">
      <div 
        v-if="showCropper" 
        class="cropper-modal" 
        role="dialog" 
        aria-modal="true" 
        :aria-label="currentCroppingSide === 'front' ? '裁剪身份证正面' : '裁剪身份证反面'"
      >
        <div class="cropper-content">
          <h2 class="section-title">{{ currentCroppingSide === 'front' ? '裁剪身份证正面' : '裁剪身份证反面' }}</h2>
          <p class="cropper-tip">请调整图片位置和大小，确保身份证完整显示</p>
          <div class="cropper-image-container">
            <img ref="imageToCrop" :src="currentImageDataUrl" alt="待裁剪图片" style="max-width: 100%;">
          </div>
          <div class="cropper-actions">
            <button @click="confirmCrop" class="confirm-crop-button">确认裁剪</button>
            <button @click="closeCropper" class="cancel-crop-button">取消</button>
          </div>
        </div>
      </div>
    </transition>
  </main>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue';
import Cropper from 'cropperjs';
import '../assets/css/cropper.css';

// ==================== 常量定义 ====================
const ID_ASPECT_RATIO = 85.6 / 54; // 身份证标准宽高比 (mm)
const DETECTION_INTERVAL_MS = 200; // 自动检测间隔(毫秒)
const REQUIRED_STABLE_DETECTIONS = 10; // 需要连续检测到相同结果的次数
const AUTO_CAPTURE_AREA_THRESHOLD = 10000; // 最小检测面积阈值
const ID_ASPECT_RATIO_TOLERANCE = 0.3; // 身份证宽高比容许误差

// ==================== 状态管理 ====================
// 基本引用
const video = ref(null);
const canvas = ref(null);
const overlayCanvas = ref(null);
const frontImage = ref(null);
const backImage = ref(null);
const stream = ref(null);
const isCameraOpen = computed(() => !!stream.value);
const isProcessingCamera = ref(false);

// 自动检测相关状态
const autoDetectEnabled = ref(false);
const detectionStatus = ref('');
const detectionInProgress = ref(false);
const detectionInterval = ref(null);
const frontDetected = ref(false);
const backDetected = ref(false);
const lastDetectionResult = ref(null);
const stableDetectionCount = ref(0);

// 裁剪相关状态
const showCropper = ref(false);
const imageToCrop = ref(null);
const cropperInstance = ref(null);
const currentCroppingSide = ref(null);
const currentImageDataUrl = ref(null);

// OpenCV 相关状态
const cvReady = ref(false);

// ==================== 生命周期钩子 ====================
// 监听 OpenCV 加载完成事件
onMounted(() => {
  // 添加调整窗口大小时重新绘制A4预览的功能
  window.addEventListener('resize', handleWindowResize);
  
  // OpenCV 加载检测
  if (window.cvReady) {
    cvReady.value = true;
    console.log('OpenCV.js 已加载');
  } else {
    window.addEventListener('opencv-ready', () => {
      cvReady.value = true;
      console.log('OpenCV.js 已加载');
    });
    
    // 如果60秒后仍未加载完成，显示提示
    setTimeout(() => {
      if (!cvReady.value) {
        console.warn('OpenCV.js 加载时间过长，可能影响自动检测功能');
      }
    }, 60000);
  }
});

// 组件卸载前清理资源
onBeforeUnmount(() => {
  stopCamera();
  closeCropper();
  window.removeEventListener('resize', handleWindowResize);
});

// 窗口大小调整处理函数
const handleWindowResize = () => {
  if (frontImage.value && backImage.value) {
    // 在下一个渲染周期重新绘制A4预览
    nextTick(() => {
      drawImagesOnCanvas();
    });
  }
};

// ==================== 摄像头控制 ====================
// 初始化摄像头
const initCamera = async () => {
  if (isProcessingCamera.value) return;
  isProcessingCamera.value = true;
  detectionStatus.value = '正在打开摄像头...';
  
  try {
    const constraints = {
      video: {
        facingMode: 'environment', // 优先使用后置摄像头
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    
    // 尝试获取媒体流
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.value = mediaStream;
    
    if (video.value) {
      video.value.srcObject = mediaStream;
      
      try {
        await video.value.play();
        
        // 初始化覆盖层 Canvas
        if (overlayCanvas.value) {
          overlayCanvas.value.width = video.value.videoWidth;
          overlayCanvas.value.height = video.value.videoHeight;
        }
        
        detectionStatus.value = '摄像头已准备就绪';
      } catch (playError) {
        console.error("视频播放失败: ", playError);
        throw new Error("视频播放失败，请检查浏览器设置");
      }
    }
  } catch (err) {
    console.error("无法访问摄像头: ", err);
    let errorMessage = "无法访问摄像头";
    
    // 提供更具体的错误信息
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage = "摄像头访问被拒绝，请检查权限设置";
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage = "未找到摄像头设备，请确认设备连接正常";
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage = "摄像头可能被其他应用占用，请关闭其他使用摄像头的应用";
    } else if (err.name === 'OverconstrainedError') {
      errorMessage = "摄像头不支持请求的分辨率，正在尝试替代设置";
      // 可以在这里实现分辨率降级策略
    }
    
    alert(errorMessage);
    stream.value = null;
  } finally {
    isProcessingCamera.value = false;
    if (!stream.value) {
      detectionStatus.value = '';
    }
  }
};

// 停止摄像头
const stopCamera = () => {
  if (isProcessingCamera.value && !stream.value) return;
  isProcessingCamera.value = true;
  
  // 停止自动检测
  if (autoDetectEnabled.value) {
    stopAutoDetect();
  }
  
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
  }
  if (video.value) {
    video.value.srcObject = null;
  }
  
  stream.value = null;
  isProcessingCamera.value = false;
  detectionStatus.value = '';
};

// 切换摄像头状态
const toggleCamera = async () => {
  if (isCameraOpen.value) {
    stopCamera();
  } else {
    await initCamera();
  }
};

// ==================== 自动检测控制 ====================
// 切换自动检测
const toggleAutoDetect = () => {
  if (!cvReady.value) {
    alert('OpenCV.js 尚未加载完成，请稍后再试');
    return;
  }
  
  if (autoDetectEnabled.value) {
    stopAutoDetect();
  } else {
    startAutoDetect();
  }
};

// 开始自动检测
const startAutoDetect = () => {
  if (!isCameraOpen.value || !cvReady.value) return;
  
  autoDetectEnabled.value = true;
  detectionStatus.value = '正在检测身份证...';
  
  // 重置检测状态
  frontDetected.value = false;
  backDetected.value = false;
  stableDetectionCount.value = 0;
  lastDetectionResult.value = null;
  
  // 设置检测间隔
  detectionInterval.value = setInterval(() => {
    if (!detectionInProgress.value) {
      detectIdCard();
    }
  }, DETECTION_INTERVAL_MS);
};

// 停止自动检测
const stopAutoDetect = () => {
  autoDetectEnabled.value = false;
  detectionStatus.value = '';
  
  if (detectionInterval.value) {
    clearInterval(detectionInterval.value);
    detectionInterval.value = null;
  }
  
  // 清除覆盖层
  if (overlayCanvas.value) {
    const ctx = overlayCanvas.value.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height);
  }
};

// ==================== 身份证检测功能 ====================
// 检测身份证
const detectIdCard = async () => {
  if (!video.value || !stream.value || !cvReady.value || detectionInProgress.value) return;
  
  detectionInProgress.value = true;
  
  try {
    // 从视频中捕获一帧
    const videoEl = video.value;
    const videoWidth = videoEl.videoWidth;
    const videoHeight = videoEl.videoHeight;
    
    // 创建临时 Canvas 用于捕获视频帧
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoWidth;
    tempCanvas.height = videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoEl, 0, 0, videoWidth, videoHeight);
    
    // 获取图像数据
    const imageData = tempCtx.getImageData(0, 0, videoWidth, videoHeight);
    
    // 使用 OpenCV 处理图像
    const src = cv.matFromImageData(imageData);
    const dst = new cv.Mat();
    
    // 转换为灰度图
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
    
    // 应用高斯模糊减少噪声
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(dst, dst, ksize, 0);
    
    // 应用 Canny 边缘检测
    const edges = new cv.Mat();
    cv.Canny(dst, edges, 50, 150);
    
    // 查找轮廓
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    // 查找最大的矩形轮廓
    let maxArea = 0;
    let maxContourIndex = -1;
    let maxRect = null;
    
    for (let i = 0; i < contours.size(); ++i) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      
      // 只考虑面积足够大的轮廓
      if (area > AUTO_CAPTURE_AREA_THRESHOLD) {
        // 计算轮廓的周长
        const perimeter = cv.arcLength(contour, true);
        // 多边形近似
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
        
        // 如果近似后的多边形有4个顶点，可能是矩形
        if (approx.rows === 4) {
          // 计算宽高比，判断是否接近身份证比例
          const rect = cv.boundingRect(approx);
          const aspectRatio = rect.width / rect.height;
          
          // 允许一定的误差范围
          if (Math.abs(aspectRatio - ID_ASPECT_RATIO) < ID_ASPECT_RATIO_TOLERANCE && area > maxArea) {
            maxArea = area;
            maxContourIndex = i;
            maxRect = rect;
          }
        }
        
        approx.delete();
      }
    }
    
    // 在覆盖层上绘制检测结果
    const overlayCtx = overlayCanvas.value.getContext('2d');
    overlayCtx.clearRect(0, 0, overlayCanvas.value.width, overlayCanvas.value.height);
    
    if (maxContourIndex !== -1) {
      // 绘制检测到的矩形
      overlayCtx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      overlayCtx.lineWidth = 3;
      overlayCtx.strokeRect(maxRect.x, maxRect.y, maxRect.width, maxRect.height);
      
      // 计算当前检测结果的特征
      const result = {
        x: maxRect.x,
        y: maxRect.y,
        width: maxRect.width,
        height: maxRect.height,
        area: maxArea
      };
      
      // 检查是否与上次检测结果相似
      if (lastDetectionResult.value) {
        const xDiff = Math.abs(result.x - lastDetectionResult.value.x);
        const yDiff = Math.abs(result.y - lastDetectionResult.value.y);
        const widthDiff = Math.abs(result.width - lastDetectionResult.value.width);
        const heightDiff = Math.abs(result.height - lastDetectionResult.value.height);
        
        // 如果位置和大小变化不大，认为是稳定的检测
        if (xDiff < 10 && yDiff < 10 && widthDiff < 10 && heightDiff < 10) {
          stableDetectionCount.value++;
          
          // 显示稳定度
          detectionStatus.value = `检测到身份证 (稳定度: ${stableDetectionCount.value}/${REQUIRED_STABLE_DETECTIONS})`;
          
          // 如果连续多次检测结果稳定，自动捕获
          if (stableDetectionCount.value >= REQUIRED_STABLE_DETECTIONS) {
            // 根据当前已捕获的状态决定捕获正面还是反面
            if (!frontDetected.value) {
              // 捕获正面
              const capturedImage = captureDetectedCard(maxRect);
              if (capturedImage) {
                frontImage.value = capturedImage;
                frontDetected.value = true;
                detectionStatus.value = '正面已捕获，请翻转身份证...';
                stableDetectionCount.value = 0;
              }
            } else if (!backDetected.value) {
              // 捕获反面
              const capturedImage = captureDetectedCard(maxRect);
              if (capturedImage) {
                backImage.value = capturedImage;
                backDetected.value = true;
                detectionStatus.value = '反面已捕获，扫描完成！';
                
                // 绘制到 A4 预览
                if (frontImage.value && backImage.value) {
                  drawImagesOnCanvas();
                }
                
                // 停止自动检测
                stopAutoDetect();
              }
            }
          }
        } else {
          // 如果检测结果不稳定，重置计数
          stableDetectionCount.value = 0;
          detectionStatus.value = '检测到身份证 (请保持稳定)';
        }
      } else {
        stableDetectionCount.value = 1;
        detectionStatus.value = '检测到身份证 (请保持稳定)';
      }
      
      // 更新上次检测结果
      lastDetectionResult.value = result;
    } else {
      // 未检测到身份证
      stableDetectionCount.value = 0;
      lastDetectionResult.value = null;
      detectionStatus.value = '未检测到身份证，请调整位置...';
    }
    
    // 释放 OpenCV 资源
    src.delete();
    dst.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    
  } catch (error) {
    console.error('身份证检测错误:', error);
    detectionStatus.value = '检测出错，请重试';
  } finally {
    detectionInProgress.value = false;
  }
};

// 捕获检测到的身份证
const captureDetectedCard = (rect) => {
  if (!video.value) return null;
  
  try {
    // 创建临时 Canvas
    const tempCanvas = document.createElement('canvas');
    
    // 设置 Canvas 大小为检测到的矩形大小
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;
    
    // 从视频中裁剪出检测到的矩形区域
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(
      video.value,
      rect.x, rect.y, rect.width, rect.height,  // 源矩形
      0, 0, rect.width, rect.height             // 目标矩形
    );
    
    // 转换为 Data URL
    return tempCanvas.toDataURL('image/png');
  } catch (error) {
    console.error('捕获身份证图像失败:', error);
    return null;
  }
};

// ==================== 手动捕获功能 ====================
// 手动捕获图像
const captureImage = () => {
  if (!video.value || !stream.value) return null;

  const videoEl = video.value;
  const targetAspectRatio = ID_ASPECT_RATIO;
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

  const tempCanvas = document.createElement('canvas');
  // 设置画布尺寸为裁剪后的尺寸
  tempCanvas.width = sWidth;
  tempCanvas.height = sHeight;

  const context = tempCanvas.getContext('2d');
  // 从视频源的计算区域绘制到画布上
  context.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

  return tempCanvas.toDataURL('image/png');
};

// 手动拍摄正面
const captureFront = () => {
  const imgData = captureImage();
  if (imgData) {
    openCropper('front', imgData);
  }
};

// 手动拍摄反面
const captureBack = () => {
  const imgData = captureImage();
  if (imgData) {
    openCropper('back', imgData);
  }
};

// ==================== 裁剪功能 ====================
// 打开裁剪器
const openCropper = (side, imageDataUrl) => {
  currentCroppingSide.value = side;
  currentImageDataUrl.value = imageDataUrl;
  showCropper.value = true;

  // 如果摄像头开着，暂停视频流
  if (video.value && isCameraOpen.value) {
    video.value.pause(); // 暂停视频播放
  }

  nextTick(() => {
    if (imageToCrop.value) {
      // 如果已存在裁剪实例，先销毁
      if (cropperInstance.value) {
        cropperInstance.value.destroy();
      }
      
      // 创建新的裁剪实例
      cropperInstance.value = new Cropper(imageToCrop.value, {
        aspectRatio: ID_ASPECT_RATIO, // 设置裁剪框比例
        viewMode: 1, // 限制裁剪框不超出图片范围
        dragMode: 'move', // 拖动模式为移动图片
        background: false, // 不显示背景网格
        autoCropArea: 0.9, // 初始裁剪区域占图片90%
        zoomable: true, // 允许缩放图片
        movable: true, // 允许移动图片
        rotatable: false, // 禁止旋转
        scalable: false, // 禁止缩放图片本身
      });
    }
  });
};

// 确认裁剪
const confirmCrop = () => {
  if (!cropperInstance.value) return;

  try {
    const croppedCanvas = cropperInstance.value.getCroppedCanvas({
      maxWidth: 4096,
      maxHeight: 4096,
      fillColor: '#fff'
    });
    
    if (!croppedCanvas) return;

    const croppedImageDataUrl = croppedCanvas.toDataURL('image/png');

    if (currentCroppingSide.value === 'front') {
      frontImage.value = croppedImageDataUrl;
      frontDetected.value = true;
    } else if (currentCroppingSide.value === 'back') {
      backImage.value = croppedImageDataUrl;
      backDetected.value = true;
    }

    // 检查是否两张图片都已准备好，然后绘制到A4 canvas
    if (frontImage.value && backImage.value) {
      drawImagesOnCanvas();
    }
    
    closeCropper();
  } catch (error) {
    console.error('裁剪失败:', error);
    alert('裁剪失败，请重试');
    closeCropper();
  }
};

// 关闭裁剪器
const closeCropper = () => {
  if (cropperInstance.value) {
    cropperInstance.value.destroy();
    cropperInstance.value = null;
  }
  showCropper.value = false;
  currentCroppingSide.value = null;
  currentImageDataUrl.value = null;
  
  // 如果摄像头开着，恢复视频流
  if (video.value && isCameraOpen.value) {
    video.value.play(); // 恢复视频播放
  }
};

// ==================== PDF 生成功能 ====================
// 绘制图像到 Canvas
const drawImagesOnCanvas = () => {
  if (!canvas.value || !frontImage.value) return;

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

  // 添加错误处理
  const handleImageError = (side) => {
    console.error(`加载${side}图像失败`);
    alert(`加载${side}图像失败，请重新拍摄`);
  };

  imgFront.onload = () => {
    // 绘制正面图片
    drawScaledImage(imgFront, a4Height * 0.05); // 顶部留白

    // 正面加载并绘制完成后，开始加载反面图片
    if (backImage.value) {
      imgBack.src = backImage.value;
    }
  };

  imgFront.onerror = () => handleImageError('正面');
  imgBack.onerror = () => handleImageError('反面');

  imgBack.onload = () => {
    // 绘制反面图片
    drawScaledImage(imgBack, a4Height * 0.5); // 从中间开始，留些间距
  };
  
  // 先加载正面图片
  if (frontImage.value) {
    imgFront.src = frontImage.value;
  }
};

// 生成PDF
const generatePdf = async () => {
  if (!canvas.value || !frontImage.value || !backImage.value) {
    alert('请先完成正反面拍摄');
    return;
  }

  // 确保 canvas 上有内容
  if (canvas.value.toDataURL() === document.createElement('canvas').toDataURL()) {
    console.warn("Canvas is empty, attempting to redraw before generating PDF.");
    drawImagesOnCanvas(); // 尝试重新绘制
    // 等待绘制完成可能需要一点时间，但这里简化处理
    await nextTick(); // 等待DOM更新和可能的绘制
  }

  try {
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
    
    // 创建文件名 - 当前时间戳
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `身份证件_${timestamp}.pdf`;
    
    pdf.save(filename);
  } catch (e) {
    console.error("Error generating PDF:", e);
    alert("生成PDF失败，请重试");
  }
};
</script>

<style scoped>
.id-scanner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  max-width: 800px; /* 桌面端最大宽度 */
  width: 100%; /* 默认宽度为100% */
  min-height: 100vh; /* 确保容器至少占满屏幕高度 */
  box-sizing: border-box; /* 让 padding 包含在 width 内 */
  margin: 0 auto; /* 居中 */
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  color: #333;
  line-height: 1.5;
}

h1, .section-title {
  color: #1a73e8;
  margin-bottom: 1rem;
  text-align: center;
  width: 100%;
}

h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 500;
  margin-bottom: 1rem;
  position: relative;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 2px;
  background-color: #1a73e8;
  border-radius: 1px;
}

.camera-section, .preview-section, .canvas-section {
  width: 100%;
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background-color: #fff; /* 为每个部分添加白色背景 */
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
}

.camera-section:hover, .preview-section:hover, .canvas-section:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.09);
}

.camera-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 切换摄像头按钮样式 */
.toggle-camera-button {
  margin-bottom: 1rem; /* 与下方元素保持间距 */
  min-width: 160px;
}

/* 视频包装器 */
.video-wrapper {
  width: 100%; /* 继承或设置宽度 */
  max-width: 600px; /* 限制最大宽度，根据需要调整 */
  aspect-ratio: 85.6 / 54; /* 保持身份证比例 */
  margin-bottom: 1rem; /* 与下方按钮间距 */
  position: relative; /* 用于定位覆盖层 */
  background-color: #f0f0f0; /* 可以给个背景色 */
  display: flex; /* 用于内部 video 居中等 */
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 隐藏超出部分 */
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

/* 覆盖层 Canvas */
.overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 允许点击穿透到下面的视频 */
  z-index: 10;
}

/* 检测状态提示 */
.detection-status {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px;
  font-size: 0.875rem;
  z-index: 20;
  border-radius: 0 0 6px 6px;
  font-weight: 500;
  backdrop-filter: blur(2px);
}

.video-feed {
  display: block;
  height: 100%; /* 填充 wrapper 高度 */
  width: 100%; /* 填充 wrapper 宽度 */
  object-fit: cover;
}

/* 视频占位符样式 */
.video-placeholder {
  width: 100%;
  max-width: 600px; /* 与 video-wrapper 保持一致 */
  aspect-ratio: 85.6 / 54; /* 保持身份证比例 */
  background-color: #f5f5f5;
  color: #757575;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  border: 1px dashed #ccc;
  margin-bottom: 1rem; /* 与下方按钮间距 */
  padding: 1rem;
  box-sizing: border-box;
  border-radius: 6px;
  font-size: 0.9375rem;
}

.capture-buttons {
  display: flex; /* 让按钮并排 */
  justify-content: center; /* 居中按钮 */
  flex-wrap: wrap; /* 空间不足时换行 */
  gap: 0.625rem; /* 按钮间距 */
  width: 100%;
  max-width: 600px;
}

.capture-buttons button {
  margin: 0; /* 移除外边距，使用gap控制 */
  flex: 1; /* 按钮平分空间 */
  min-width: 120px; /* 确保按钮不会太窄 */
}

.capture-buttons button.active {
  background-color: #28a745; /* 激活状态为绿色 */
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.25);
}

.image-previews {
  display: flex;
  justify-content: space-around;
  gap: 1rem; /* 调整间距 */
  flex-wrap: wrap; /* 允许换行 */
  align-items: flex-start; /* 顶部对齐 */
}

/* 包裹预览和编辑按钮 */
.preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem; /* 预览框和按钮的间距 */
  flex: 1;
  max-width: 160px;
  transition: transform 0.2s ease;
}

.preview-item:hover {
  transform: translateY(-2px);
}

.preview-box {
  width: 100%;
  aspect-ratio: 1.585; /* 身份证宽高比 */
  border: 1px dashed #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-color: #f5f5f5;
  border-radius: 6px;
  transition: border-color 0.3s ease;
}

.preview-box:hover {
  border-color: #1a73e8;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain; /* 保持图片比例 */
}

.placeholder {
  color: #9e9e9e;
  font-size: 0.875rem;
}

/* 重新裁剪按钮样式 */
.recrop-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  background-color: #6c757d; /* 灰色 */
  border-radius: 4px;
  width: 100%;
}

.recrop-button:hover:not(:disabled) {
  background-color: #5a6268;
}

/* A4 Canvas 样式 */
.a4-canvas {
  width: 100%;
  max-width: 595px; /* A4宽度，72dpi */
  height: auto;
  aspect-ratio: 1 / 1.414; /* A4比例 */
  border: 1px solid #e0e0e0;
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

/* Cropper Modal 样式 */
.cropper-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9); /* 增加不透明度从0.7到0.9 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* 确保在最上层 */
  backdrop-filter: blur(5px); /* 添加模糊效果增强分离感 */
}

.cropper-content {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.35);
  max-width: 90vw; /* 最大宽度 */
  max-height: 90vh; /* 最大高度 */
  display: flex;
  flex-direction: column;
  color: #333; /* 设置文字颜色 */
  width: 100%;
}

.cropper-image-container {
  flex-grow: 1; /* 占据剩余空间 */
  overflow: hidden; /* 隐藏超出部分 */
  margin-bottom: 1rem;
  /* 限制 cropperjs 容器大小 */
  max-height: calc(80vh - 150px); /* 限制最大高度 */
}

.cropper-image-container img {
  display: block;
  max-width: 100%;
}

.cropper-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.confirm-crop-button {
  background-color: #28a745; /* 绿色 */
  flex: 1;
}
.confirm-crop-button:hover:not(:disabled) {
  background-color: #218838;
}

.cancel-crop-button {
  background-color: #dc3545; /* 红色 */
  flex: 1;
}
.cancel-crop-button:hover:not(:disabled) {
  background-color: #c82333;
}

/* 通用按钮样式 */
button {
  cursor: pointer;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  color: white;
  background-color: #1a73e8; /* 使用Google蓝 */
  transition: all 0.3s ease;
  font-size: 0.9375rem;
  font-weight: 500;
  min-height: 40px;
}

button:hover:not(:disabled) {
  background-color: #1765cc; /* 悬停时深蓝色 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

button:disabled {
  background-color: #e0e0e0; /* 禁用时浅灰色 */
  color: #9e9e9e;
  cursor: not-allowed;
  box-shadow: none;
}

.generate-button {
  margin-top: 1.25rem; /* 与上方内容保持距离 */
  background-color: #28a745; /* 绿色背景 */
  padding: 0.625rem 1.5rem;
  font-size: 1rem;
  min-width: 200px;
  box-shadow: 0 2px 5px rgba(40, 167, 69, 0.3);
}

.generate-button:hover:not(:disabled) {
  background-color: #218838; /* 悬停时深绿色 */
  box-shadow: 0 4px 8px rgba(40, 167, 69, 0.4);
  transform: translateY(-1px);
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

.cropper-tip {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  text-align: center;
}

/* 移动端适配媒体查询 */
@media (max-width: 600px) {
  .id-scanner-container {
    padding: 0.75rem; /* 减小内边距 */
    border-radius: 0; /* 移动端通常不需要圆角 */
    box-shadow: none; /* 移除阴影 */
    background-color: #fff;
  }

  h1 {
    font-size: 1.5rem; /* 调整标题大小 */
    margin-bottom: 1.25rem;
  }

  .section-title {
     font-size: 1.125rem;
     margin-bottom: 0.875rem;
  }

  .camera-section, .preview-section, .canvas-section {
    padding: 0.75rem; /* 减小内边距 */
    margin-bottom: 1rem; /* 减小间距 */
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .video-wrapper, .video-placeholder {
     max-width: 100%; /* 移动端可以更宽 */
     margin-bottom: 0.75rem;
  }

  .toggle-camera-button {
    width: 100%;
    margin: 0 auto 0.75rem auto; /* 居中并添加底部间距 */
  }

  .capture-buttons {
    flex-direction: column;
    width: 100%;
  }

  .capture-buttons button {
    width: 100%;
    margin-bottom: 0.5rem;
    flex: none;
  }

  .image-previews {
    flex-direction: row; /* 维持水平排列 */
    justify-content: space-between; /* 分散对齐 */
    gap: 0.625rem; /* 调整间距 */
  }

  .preview-item {
     max-width: 48%; /* 调整容器宽度，两列布局 */
  }

  .preview-box {
    width: 100%; /* 预览框占满容器 */
  }

  .recrop-button {
    width: 100%; /* 按钮宽度与预览框一致 */
    font-size: 0.75rem;
    padding: 0.375rem 0.5rem;
  }

  .cropper-content {
    padding: 1rem;
    max-width: 95vw;
    max-height: 95vh;
  }

  .cropper-image-container {
     max-height: calc(85vh - 120px);
  }

  .cropper-actions {
    flex-direction: column;
    gap: 0.625rem;
  }

  .cropper-actions button {
    width: 100%;
  }

  button {
    padding: 0.625rem 0.875rem; /* 调整按钮大小 */
    font-size: 0.9375rem;
  }

  .generate-button {
    width: 100%; /* 设置按钮宽度 */
    margin: 1rem auto 0.625rem auto; /* 调整外边距并居中 */
    min-width: 0;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .id-scanner-container {
    background-color: #121212;
    color: #e0e0e0;
  }
  
  h1, .section-title {
    color: #8ab4f8;
  }
  
  .section-title::after {
    background-color: #8ab4f8;
  }
  
  .camera-section, .preview-section, .canvas-section {
    background-color: #1e1e1e;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }
  
  .video-placeholder, .preview-box {
    background-color: #2d2d2d;
    border-color: #444;
    color: #aaa;
  }
  
  .placeholder {
    color: #888;
  }
  
  .a4-canvas {
    border-color: #444;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .cropper-content {
    background-color: #1e1e1e;
    color: #e0e0e0;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
  }
  
  button:disabled {
    background-color: #333;
    color: #777;
  }
  
  .cropper-tip {
    color: #aaa;
  }
  
  @media (max-width: 600px) {
    .id-scanner-container {
      background-color: #121212;
    }
  }
}
</style>