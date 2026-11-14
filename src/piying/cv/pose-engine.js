/**
 * 实现功能：MediaPipe PoseLandmarker 封装（身入影幕 / 人影动作同步 / QTE 视觉判定共用）
 * 来源：testdemo/CV/js/pose-engine.js（已测试完全），迁移改动：
 *   1) tasks-vision 与姿态模型的地址不再用 `new URL('../vendor/...', import.meta.url)`
 *      （打包后路径会变），改为 paths.js 的 CV_BASE —— 素材在 public/cv/vendor 下，运行时按 URL 加载；
 *   2) vision_bundle.mjs 用动态 import（public 里的文件不参与 Vite 打包），并做一次模块级缓存；
 *   3) 其余逻辑（GPU→CPU 回退、detectForVideo、状态回调）保持原样。
 */
import { CV_BASE, cvUrl } from '@/piying/paths.js';

const absolute = (path) => new URL(path, window.location.href).href;

const WASM_BASE = absolute(CV_BASE + 'vendor/tasks-vision/wasm/');
const MODEL_URLS = {
  full: absolute(cvUrl('vendor/models/pose_landmarker_full.task')),
  lite: absolute(cvUrl('vendor/models/pose_landmarker_lite.task')),
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let bundlePromise = null;
/** 动态加载 tasks-vision（只在第一次开启视觉检测时真正下载） */
function loadVisionBundle() {
  if (!bundlePromise) {
    bundlePromise = import(/* @vite-ignore */ absolute(CV_BASE + 'vendor/tasks-vision/vision_bundle.mjs')).catch((error) => {
      bundlePromise = null;
      throw new Error(`视觉模型运行时加载失败：${error?.message || error}`);
    });
  }
  return bundlePromise;
}

export class PoseEngine {
  constructor({ onStatus } = {}) {
    this.onStatus = onStatus ?? (() => {});
    this.landmarker = null;
    this.model = null;
    this.delegate = null;
    this.ready = false;
    this.loading = false;
    this._lastTimestamp = 0;
    this._inferenceCount = 0;
  }

  async init(model = 'full') {
    if (this.loading) return;
    this.loading = true;
    this.ready = false;
    this.onStatus({ state: 'loading', model, message: `正在加载 ${model} 姿态模型…` });
    const started = performance.now();
    try {
      const { FilesetResolver, PoseLandmarker } = await loadVisionBundle();
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      let landmarker;
      let delegate = 'GPU';
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URLS[model] || MODEL_URLS.full,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('[pose] GPU delegate failed, falling back to CPU:', gpuError);
        delegate = 'CPU';
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URLS[model] || MODEL_URLS.full,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
      this.close();
      this.landmarker = landmarker;
      this.model = model;
      this.delegate = delegate;
      this.ready = true;
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      this.onStatus({
        state: 'ready',
        model,
        delegate,
        message: `${model === 'full' ? 'Full' : 'Lite'} 模型就绪 · ${delegate} · ${seconds}s`,
      });
    } catch (error) {
      console.error('[pose] init failed', error);
      this.onStatus({
        state: 'error',
        model,
        message: `模型加载失败：${error?.message || error}`,
      });
      throw error;
    } finally {
      this.loading = false;
    }
  }

  /**
   * 对一帧画面推理。
   * @param {HTMLCanvasElement} canvas 当前画面
   * @param {number} timestamp 毫秒，必须单调递增
   */
  detect(canvas, timestamp) {
    if (!this.ready || !this.landmarker) return null;
    if (canvas.width < 8 || canvas.height < 8) return null;
    const ts = Math.max(timestamp, this._lastTimestamp + 1);
    this._lastTimestamp = ts;
    try {
      const result = this.landmarker.detectForVideo(canvas, ts);
      this._inferenceCount += 1;
      return {
        landmarks: result.landmarks?.[0] ?? null,
        worldLandmarks: result.worldLandmarks?.[0] ?? null,
        timestamp: ts,
      };
    } catch (error) {
      console.warn('[pose] detect failed', error);
      return null;
    }
  }

  get inferenceCount() {
    return this._inferenceCount;
  }

  close() {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        /* ignore */
      }
    }
    this.landmarker = null;
    this.ready = false;
  }
}

/** 等浏览器把媒体元数据准备好（摄像头/视频文件）。 */
export async function waitForMediaReady(media, timeout = 8000) {
  if (media.readyState >= 1 && media.videoWidth) return;
  await Promise.race([
    new Promise((resolve) => {
      media.addEventListener('loadedmetadata', resolve, { once: true });
      media.addEventListener('canplay', resolve, { once: true });
    }),
    wait(timeout),
  ]);
}
