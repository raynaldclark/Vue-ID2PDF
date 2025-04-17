<template>
  <div>
    <h2>身份证扫描与PDF生成</h2>
    <!-- 摄像头视频流 -->
    <video ref="video" width="320" height="240" autoplay playsinline></video>
    <button @click="captureFront">拍摄正面</button>
    <button @click="captureBack">拍摄反面</button>

    <!-- 预览区域 -->
    <div>
      <h3>预览</h3>
      <img v-if="frontImage" :src="frontImage" alt="身份证正面" width="160" />
      <img v-if="backImage" :src="backImage" alt="身份证反面" width="160" />
    </div>

    <!-- A4 预览 Canvas -->
    <canvas ref="canvas" style="border: 1px solid black; margin-top: 10px;"></canvas>

    <button @click="generatePdf" :disabled="!frontImage || !backImage">生成并下载PDF</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
// import jsPDF from 'jspdf'; // 稍后安装并引入

const video = ref(null);
const canvas = ref(null);
const frontImage = ref(null);
const backImage = ref(null);
let stream = null;

// 初始化摄像头
const initCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (video.value) {
      video.value.srcObject = stream;
    }
  } catch (err) {
    console.error("无法访问摄像头: ", err);
    alert("无法访问摄像头，请检查权限或设备。");
  }
};

// 停止摄像头
const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  if (video.value) {
    video.value.srcObject = null;
  }
};

// 捕获图像
const captureImage = () => {
  if (!video.value) return null;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.value.videoWidth;
  tempCanvas.height = video.value.videoHeight;
  const context = tempCanvas.getContext('2d');
  context.drawImage(video.value, 0, 0, tempCanvas.width, tempCanvas.height);
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

  imgFront.onload = () => {
    // 简单布局：将身份证正面放在上半部分
    const scale = Math.min((a4Width * 0.8) / imgFront.width, (a4Height * 0.4) / imgFront.height);
    const drawWidth = imgFront.width * scale;
    const drawHeight = imgFront.height * scale;
    const x = (a4Width - drawWidth) / 2;
    const y = a4Height * 0.05; // 顶部留白
    ctx.drawImage(imgFront, x, y, drawWidth, drawHeight);

    // 加载反面图片（确保正面加载完再加载反面，避免竞争）
    imgBack.src = backImage.value;
  };

  imgBack.onload = () => {
    // 简单布局：将身份证反面放在下半部分
    const scale = Math.min((a4Width * 0.8) / imgBack.width, (a4Height * 0.4) / imgBack.height);
    const drawWidth = imgBack.width * scale;
    const drawHeight = imgBack.height * scale;
    const x = (a4Width - drawWidth) / 2;
    const y = a4Height * 0.5; // 从中间开始，留些间距
    ctx.drawImage(imgBack, x, y, drawWidth, drawHeight);
  };

  // 先加载正面图片
  imgFront.src = frontImage.value;
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

// 组件挂载时初始化摄像头
onMounted(() => {
  initCamera();
});

// 组件卸载前停止摄像头
onBeforeUnmount(() => {
  stopCamera();
});

</script>

<style scoped>
video {
  border: 1px solid #ccc;
  margin-bottom: 10px;
}
button {
  margin: 5px;
  padding: 8px 15px;
  cursor: pointer;
}
img {
  border: 1px solid #eee;
  margin: 5px;
}
div > div {
    margin-top: 15px;
}
</style>