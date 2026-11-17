/**
 * 实现功能：《影刃交锋》打斗过场的播放控制器
 * 职责：把 canvas 渲染器、BGM 与时间轴串成一个「只能看、不能拖、不能跳」的过场播放器，
 *       并在三个 QTE 节点处暂停等待校准结果；校准失败时提供回到上一检查点的能力。
 *
 * 来源与差异：时钟模型沿用 testdemo/piying-rig/battle/player.js（对白段用 performance.now，
 * 配乐段以 audio.currentTime 为准，二者在 DIALOGUE_END 处交接），但：
 *   - 去掉所有用户可操作的播放/进度/章节控件（页面上不会出现进度条，也不响应 seek）；
 *   - 新增 QTE 窗口调度：动画不暂停，提前 QTE_LEAD_SECONDS 通知页面弹角落引导，
 *     到节点时刻结算（通过则继续 / 未通过则暂停并让页面播黑屏回退），见 onWindow / onFail / rollbackTo；
 *   - 新增兜底：配乐被浏览器拦截或音频提前结束时，自动切到无声时钟继续播，不卡住过场。
 */
import { sample, DIALOGUE_END, DURATION, MUSIC_DURATION } from './score.js';
import { createRenderer } from './renderer.js';
import { QTE_NODES, QTE_LEAD_SECONDS, QTE_RESOLVE_SECONDS, musicToTime } from './qteTimeline.js';
import { BATTLE_BGM_URL } from '../paths.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class BattlePlayback {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {HTMLElement} options.mounts 隐藏的 rig 挂载容器（部件图由渲染器从里面取）
   * @param {HTMLAudioElement} options.audio
   * @param {object} [options.hero] 主角形象（当前选中角色）：{ manifest, baseUrl }，缺省用默认将官
   * @param {(node:object)=>void} options.onWindow 进入校准窗口（提前量见 QTE_LEAD_SECONDS）
   * @param {(node:object)=>void} options.onCleared 节点时刻已通过
   * @param {(node:object)=>void} options.onFail 节点时刻未通过（播放器已暂停）
   * @param {()=>void} options.onEnd 动画播完
   * @param {(state:object)=>void} [options.onTick] 每帧回调（页面用来同步章节标题）
   * @param {(message:string)=>void} [options.onNotice] 提示（配乐被拦截等）
   * @param {(error:Error)=>void} [options.onError]
   */
  constructor(options = {}) {
    this.canvas = options.canvas;
    this.mounts = options.mounts;
    this.audio = options.audio;
    this.hero = options.hero || null;
    this.onWindow = options.onWindow || (() => {});
    this.onCleared = options.onCleared || (() => {});
    this.onFail = options.onFail || (() => {});
    this.onEnd = options.onEnd || (() => {});
    this.onTick = options.onTick || (() => {});
    this.onNotice = options.onNotice || (() => {});
    this.onError = options.onError || (() => {});

    this.renderer = null;
    this.running = false;
    this.started = false;
    this.finished = false;
    this.time = 0;
    this.epoch = 0;
    this.startTime = 0;
    this.musicStart = 0;
    this.raf = 0;
    this.version = 0;
    this.startingAudio = false;
    this.useClock = false;
    this.audioBlocked = false;
    /** 已经过关的 QTE 节点 id —— 回退重播时不再重复拦截 */
    this.passed = new Set();
    /** 已经弹出过引导的节点 id（回退时清空，让引导重新出现） */
    this.windowed = new Set();
    this.activeWindow = null;
    this.lastState = sample(0);
    this._onAudioEnded = () => {
      // 音频比时间轴短（或解码抖动）：改用内部时钟推进，过场不会停在半路
      this.useClock = true;
    };
    this._onAudioError = () => {
      this.useClock = true;
      this.onNotice('配乐读取失败，本段以无声方式继续。');
    };
  }

  get duration() {
    return DURATION;
  }

  get music() {
    return Math.max(0, this.time - DIALOGUE_END);
  }

  /** 加载渲染器与音频元数据（不含自动播放） */
  async load() {
    this.renderer = await createRenderer(this.canvas, this.mounts, { hero: this.hero });
    this.audio.src = BATTLE_BGM_URL;
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.audio.addEventListener('ended', this._onAudioEnded);
    this.audio.addEventListener('error', this._onAudioError);
    await this._waitMetadata();
    this.renderAt(0);
    return this;
  }

  _waitMetadata() {
    return new Promise((resolve) => {
      if (this.audio.readyState >= 1) return resolve();
      const done = () => {
        this.audio.removeEventListener('loadedmetadata', done);
        this.audio.removeEventListener('error', done);
        resolve();
      };
      this.audio.addEventListener('loadedmetadata', done);
      this.audio.addEventListener('error', done);
      // 音频迟迟不来也别卡住过场：3 秒后按无声时钟起演
      setTimeout(done, 3000);
    });
  }

  renderAt(time) {
    const state = sample(time);
    this.lastState = state;
    if (this.renderer) this.renderer.render(state);
    return state;
  }

  /** 开始 / 继续播放 */
  async play() {
    if (this.running) return;
    if (this.finished) return;
    this.started = true;
    this.running = true;
    this.epoch = performance.now();
    this.startTime = this.time;
    if (this.time >= DIALOGUE_END) await this._startMusicAt(this.music);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** 主动暂停（页面切后台、打开面板等） */
  pause() {
    if (!this.running) return;
    this.time = this.readTime();
    this.running = false;
    this.version += 1;
    this.startingAudio = false;
    try {
      this.audio.pause();
    } catch {
      /* 无视 */
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  readTime() {
    if (!this.running) return this.time;
    if (this.time < DIALOGUE_END && this.startTime < DIALOGUE_END) {
      return Math.min(DIALOGUE_END, this.startTime + (performance.now() - this.epoch) / 1000);
    }
    if (this.useClock) {
      return Math.min(DURATION, DIALOGUE_END + this.musicStart + (performance.now() - this.epoch) / 1000);
    }
    return Math.min(DURATION, DIALOGUE_END + (this.audio.currentTime || 0));
  }

  async _startMusicAt(music) {
    const value = clamp(Number(music) || 0, 0, Math.max(0, MUSIC_DURATION - 0.2));
    this.musicStart = value;
    this.startingAudio = true;
    const request = ++this.version;
    try {
      if (Math.abs((this.audio.currentTime || 0) - value) > 0.08) this.audio.currentTime = value;
    } catch {
      /* 元数据未就绪时赋值会抛错，播放开始后由浏览器从 0 起播 */
    }
    try {
      await this.audio.play();
      if (request !== this.version) return;
      this.startingAudio = false;
      this.useClock = false;
    } catch (error) {
      if (request !== this.version) return;
      this.startingAudio = false;
      // 浏览器自动播放策略拦截：改无声时钟继续，过场照常播完
      this.useClock = true;
      if (!this.audioBlocked) {
        this.audioBlocked = true;
        this.onNotice('配乐被浏览器拦截，先以无声方式播放；点一下画面即可开启配乐。');
      }
    }
  }

  frame = () => {
    if (!this.running) return;
    const wasDialogue = this.time < DIALOGUE_END;
    this.time = this.readTime();

    // 对白段 → 配乐段交接：配乐从 0 开始
    if (wasDialogue && this.time >= DIALOGUE_END && !this.startingAudio) {
      try {
        this.audio.currentTime = 0;
      } catch {
        /* 无视 */
      }
      this._startMusicAt(0);
    }

    // 校准引导：不暂停动画，提前 QTE_LEAD_SECONDS 弹出角落引导
    const opening = this.pendingWindow();
    if (opening) this._openWindow(opening);

    // 节点时刻结算：已通过则继续；未通过则停下交给页面做黑屏回退
    const due = this.dueNode();
    if (due) {
      this._resolveNode(due);
      return;
    }

    this.renderAt(this.time);
    this.onTick(this.time, this.lastState);
    if (this.time >= DURATION - 0.001) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** 下一个该弹引导的节点：节点前 3.3 秒出现（看图 1.3s + 判定前半 2s），未通过且还没弹过 */
  pendingWindow() {
    if (this.activeWindow) return null;
    return (
      QTE_NODES.find(
        (node) =>
          !this.passed.has(node.id) &&
          !this.windowed.has(node.id) &&
          this.time >= node.time - QTE_LEAD_SECONDS &&
          this.time < node.time + QTE_RESOLVE_SECONDS,
      ) || null
    );
  }

  _openWindow(node) {
    this.windowed.add(node.id);
    this.activeWindow = node.id;
    this.onWindow(node);
  }

  /** 判定已结束（节点后 2 秒）但还没通过的节点 */
  dueNode() {
    return (
      QTE_NODES.find((node) => !this.passed.has(node.id) && this.time >= node.time + QTE_RESOLVE_SECONDS) ||
      null
    );
  }

  /**
   * 判定结算（节点后 2 秒）。
   * 通过 → 什么都不用做，动画本来就在播；未通过 → 暂停并通知页面播黑屏回退，
   * 回退后这一式会重新出现（windowed 在回退时清空）。
   */
  _resolveNode(node) {
    this.activeWindow = null;
    if (this.passed.has(node.id)) {
      this.onCleared(node);
      return;
    }
    this.pause();
    this.time = Math.min(this.time, node.time + QTE_RESOLVE_SECONDS + 0.02);
    this.renderAt(this.time);
    this.onFail(node);
  }

  /** 由 QTE 角标在判定成功时调用：只记一笔，动画不中断 */
  markPassed(id) {
    if (!id) return;
    this.passed.add(id);
    this.activeWindow = null;
    this.renderAt(this.time);
  }

  /** QTE 失败：回到该检查点重播（页面负责先播完黑屏闪回） */
  async rollbackTo(node) {
    const target = node || QTE_NODES[0];
    this.activeWindow = null;
    // 回退后这一式要重新出现引导；已通过的节点不会重开（passed 里还在）
    this.windowed.clear();
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.version += 1;
    this.startingAudio = false;

    const music = Math.max(0, Number(target.resumeMusic) || 0);
    this.time = musicToTime(music);
    this.musicStart = music;
    this.useClock = false;
    this.finished = false;
    try {
      this.audio.currentTime = music;
    } catch {
      /* 无视 */
    }
    this.renderAt(this.time);
    await this.play();
  }

  /** 点击画面恢复配乐（自动播放被拦截时用） */
  async resumeAudio() {
    if (!this.audioBlocked) return false;
    try {
      if (this.time >= DIALOGUE_END) {
        const music = this.readTime() - DIALOGUE_END;
        this.audio.currentTime = Math.max(0, music);
      }
      await this.audio.play();
      this.audioBlocked = false;
      this.useClock = false;
      this.epoch = performance.now();
      this.musicStart = this.music;
      return true;
    } catch {
      return false;
    }
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.time = DURATION;
    try {
      this.audio.pause();
    } catch {
      /* 无视 */
    }
    this.renderAt(DURATION);
    this.onEnd();
  }

  destroy() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.audio.removeEventListener('ended', this._onAudioEnded);
    this.audio.removeEventListener('error', this._onAudioError);
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch {
      /* 无视 */
    }
    if (this.renderer) this.renderer.destroy();
    this.renderer = null;
  }
}
