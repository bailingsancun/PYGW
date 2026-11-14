/**
 * 实现功能：摄像头 / 视频 / 图片统一成「可绘制的一帧」
 * 来源：testdemo/CV/js/feed.js（已测试完全），逻辑原样迁移。
 */
/**
 * 摄像头 / 视频文件 / 图片输入统一成“可绘制的一帧”。
 * 画面按 contain 方式绘制到 feed canvas，识别与显示使用同一张 canvas，
 * 因此 33 点坐标可以 1:1 叠在画面上，不需要再做 letterbox 校正。
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitMetadata(media, timeout = 8000) {
  if (media.readyState >= 1 && media.videoWidth) return true;
  await Promise.race([
    new Promise((resolve) => {
      media.addEventListener('loadedmetadata', resolve, { once: true });
      media.addEventListener('canplay', resolve, { once: true });
      media.addEventListener('error', resolve, { once: true });
    }),
    wait(timeout),
  ]);
  return media.readyState >= 1 && media.videoWidth > 0;
}

export class FeedSource {
  constructor() {
    this.kind = 'none'; // camera | video | image | none
    this.label = '';
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.loop = true;
    this.video.setAttribute('playsinline', '');
    this.image = null;
    this._stream = null;
    this._objectUrl = null;
    this._width = 0;
    this._height = 0;
  }

  get ready() {
    if (this.kind === 'image') return Boolean(this.image?.complete && this.image.naturalWidth);
    if (this.kind === 'camera' || this.kind === 'video') {
      return this.video.readyState >= 2 && this.video.videoWidth > 0;
    }
    return false;
  }

  get aspect() {
    if (this.kind === 'image') {
      return this.image?.naturalWidth ? this.image.naturalWidth / this.image.naturalHeight : 16 / 9;
    }
    return this.video.videoWidth ? this.video.videoWidth / this.video.videoHeight : 16 / 9;
  }

  async openCamera(deviceId) {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头（需要 https 或 localhost）。');
    }
    const constraints = {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };
    try {
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      throw new Error(this._cameraErrorMessage(error));
    }
    this.kind = 'camera';
    this.label = '摄像头';
    this.video.srcObject = this._stream;
    await this.video.play().catch(() => {});
    await waitMetadata(this.video);
  }

  async openFile(file) {
    this.stop();
    this._objectUrl = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      const image = new Image();
      image.src = this._objectUrl;
      try {
        await image.decode();
      } catch {
        if (!image.complete) {
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('图片解码失败'));
          });
        }
      }
      this.image = image;
      this.kind = 'image';
      this.label = file.name;
      this._width = image.naturalWidth;
      this._height = image.naturalHeight;
      return;
    }
    this.kind = 'video';
    this.label = file.name;
    this.video.src = this._objectUrl;
    this.video.loop = true;
    try {
      await this.video.play();
    } catch {
      /* 用户未交互相簿可能被拦截，检测循环里会再尝试 */
    }
    const ok = await waitMetadata(this.video);
    if (!ok) {
      throw new Error('视频无法解码，请换 mp4 / webm 格式。');
    }
  }

  /** 把当前帧绘制到 canvas（含 contain 居中与镜像）。 */
  draw(ctx, width, height, mirror = false) {
    const media = this.kind === 'image' ? this.image : this.video;
    const mw = this.kind === 'image' ? this.image?.naturalWidth : this.video.videoWidth;
    const mh = this.kind === 'image' ? this.image?.naturalHeight : this.video.videoHeight;
    if (!media || !mw || !mh) return false;
    if (this.kind !== 'image' && this.video.readyState < 2) return false;

    const scale = Math.min(width / mw, height / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;

    ctx.save();
    if (mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    try {
      ctx.drawImage(media, dx, dy, dw, dh);
    } catch {
      ctx.restore();
      return false;
    }
    ctx.restore();
    return true;
  }

  stop() {
    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop();
      this._stream = null;
    }
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = null;
    }
    try {
      this.video.pause();
    } catch {
      /* ignore */
    }
    this.video.srcObject = null;
    this.video.removeAttribute('src');
    this.video.load();
    this.image = null;
    this.kind = 'none';
    this.label = '';
  }

  _cameraErrorMessage(error) {
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return '摄像头权限被拒绝。请在地址栏允许摄像头，或改用「模拟人物」。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '没有找到摄像头。可以用「模拟人物」或选择视频/图片文件。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '摄像头被其他程序占用，请关闭会议/相机软件后重试。';
    }
    if (name === 'OverconstrainedError') {
      return '摄像头不支持当前分辨率，试试换一个摄像头。';
    }
    return `摄像头启动失败：${error?.message || error}`;
  }
}

export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `摄像头 ${index + 1}`,
    }));
}
