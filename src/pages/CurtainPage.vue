<!--
  实现功能：光影互动 · 身入影幕（打斗过场 + 三处 QTE 校准 + 幕后四入口）
  职责：
    1) 进入页面即播放《影刃交锋》打斗动画（canvas 渲染 + BGM），没有进度条、不能拖动、不能跳过；
    2) 在主角「招架弹反 / 蓄力刺击 / 斩断流矢」三个节点暂停，做 X 交叉 / 前突刺 / 下劈 的校准判定，
       判定来自 CV 的视觉识别（摄像头），无摄像头时可用鼠标/触摸划出动作；
    3) 校准失败 → 黑屏闪回微转场 → 动画与 BGM 一起退回上一个判定节点之后（第一处退回阶段一开头）；
    4) 动画播完 → 主角恢复「持剑驻地」并保持呼吸摆动，右侧「决战将启」位置换成四个按钮：
       开始游戏 / 切换本地皮影 / AI 图片转皮影 / 人影动作同步。
  素材来源：public/piying（角色、砌末、BGM）与 public/cv（MediaPipe 运行时与姿态模型）。
-->
<template>
  <ArtPageShell
    :bg="artAssets.game.bg"
    with-bottom-nav
    overlay="linear-gradient(180deg, rgba(8, 4, 2, 0.72), rgba(8, 4, 2, 0.88))"
  >
    <div class="curtain-page">
      <ArtTopBar title="身入影幕" theme="dark" back-text="返回" />

      <div class="curtain-stage">
        <canvas ref="canvasEl" class="battle-canvas" width="1600" height="900" aria-label="将领与徐鸿儒的皮影打斗过场"></canvas>
        <div ref="mountsEl" class="battle-mounts" aria-hidden="true"></div>

        <!-- 加载中 -->
        <div v-if="phase === 'loading'" class="curtain-mask">
          <p class="mask-title">正在装配影人与砌末</p>
          <p class="mask-desc">皮影部件、战场砌末与配乐就位后自动开演</p>
        </div>

        <!-- 装配失败 -->
        <div v-else-if="phase === 'error'" class="curtain-mask">
          <p class="mask-title">过场装配失败</p>
          <p class="mask-desc">{{ errorText }}</p>
          <button type="button" class="mask-btn" @click="reload">重新装配</button>
        </div>

        <!-- 播放中的轻 HUD：只报校准进度（章节标题画布内部已有，不再重复） -->
        <div v-if="phase === 'playing'" class="curtain-hud">
          <span class="hud-score">校准 {{ passedCount }} / {{ totalQte }}</span>
        </div>

        <!-- 幕后：主角持剑驻地 + 四个入口 -->
        <CurtainHub
          v-if="phase === 'hub'"
          ref="hubRef"
          :character="currentCharacter"
          :busy="busy"
          :syncing="syncing"
          :leaving="hubLeaving"
          @start-game="handleStartGame"
          @switch-local="openCharacterPicker"
          @ai-character="handleAiCharacter"
          @sync-motion="handleSyncMotion"
        />

        <!-- 结束后的提示条（配乐被拦截 / 动作同步状态） -->
        <div v-if="notice" class="curtain-notice" @click="dismissNotice">{{ notice }}</div>

        <!-- 人影动作同步面板 -->
        <div v-if="syncing" class="curtain-sync">
          <div class="sync-head">
            <span>人影动作同步</span>
            <button type="button" class="sync-close" @click="stopSync">结束同步</button>
          </div>
          <canvas ref="syncCanvas" class="sync-canvas"></canvas>
          <p class="sync-status">{{ visionStatus || '正在开启摄像头…' }}</p>
        </div>

        <!-- 校准引导：角落角标，动画继续播放，不做暗屏、不暂停 -->
        <CurtainQte
          v-if="qteNode"
          ref="qteRef"
          :node="qteNode"
          :playback="playback"
          :vision="vision"
          :vision-ready="visionReady"
          :vision-status="visionStatus"
          @done="handleQteDone"
          @enable-camera="enableCamera"
        />
      </div>

      <CurtainFlash />

      <!-- 切换本地皮影：先出「已注册角色」选择窗口，右下角再进文件夹导入 -->
      <CurtainCharacterPicker
        v-if="pickerOpen"
        :characters="pickerList"
        :current="currentCharacter?.id || ''"
        :busy="pickerBusy"
        @select="handlePickCharacter"
        @import="handleImportNew"
        @close="pickerOpen = false"
      />

      <!-- AI 图片转皮影工坊（懒加载：只有点开时才下载图像处理代码） -->
      <component
        :is="aiPanel"
        v-if="aiOpen && aiPanel"
        @close="aiOpen = false"
        @created="handleAiCreated"
      />

      <!-- 通用提示弹窗：导入失败 / 生成失败时说明具体原因 -->
      <div v-if="dialog" class="curtain-dialog-mask" @click.self="dialog = null">
        <div class="curtain-dialog" role="dialog" aria-modal="true">
          <h3>{{ dialog.title }}</h3>
          <p>{{ dialog.body }}</p>
          <ul v-if="dialog.details?.length">
            <li v-for="(item, index) in dialog.details.slice(0, 6)" :key="index">{{ item }}</li>
          </ul>
          <button type="button" class="mask-btn" @click="dialog = null">知道了</button>
        </div>
      </div>
    </div>

    <ArtBottomNav current-tab="interactive" :region="currentRegion" />
  </ArtPageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import CurtainQte from '@/components/art-v2/CurtainQte.vue';
import CurtainHub from '@/components/art-v2/CurtainHub.vue';
import CurtainFlash from '@/components/art-v2/CurtainFlash.vue';
import CurtainCharacterPicker from '@/components/art-v2/CurtainCharacterPicker.vue';
import { artAssets } from '@/config/artAssets.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';
import { showToast } from '@/utils/toast.js';
import { cancelFlashBack, playFlashBack } from '@/utils/pageFlashBack.js';
import { BattlePlayback } from '@/piying/battle/playback.js';
import { QTE_NODES, QTE_RESOLVE_SECONDS } from '@/piying/battle/qteTimeline.js';
import { CharacterLibrary, applyHeroWeapon, cloneManifest, partSrc } from '@/piying/hub/characters.js';
import { importFromDirectoryPicker, importFromFileList } from '@/piying/hub/importFolder.js';
import { VisionService } from '@/piying/cv/vision.js';
import { PoseTracker } from '@/piying/cv/tracker.js';

const route = useRoute();
const router = useRouter();

const canvasEl = ref(null);
const mountsEl = ref(null);
const qteRef = ref(null);
const hubRef = ref(null);
const syncCanvas = ref(null);

const phase = ref('loading');
const errorText = ref('');
const chapterIndex = ref(0);
const passedCount = ref(0);
const qteNode = ref(null);
const currentRegion = ref(getCurrentRegion());
const notice = ref('');
const dialog = ref(null);
const busy = ref(false);
const syncing = ref(false);
const aiOpen = ref(false);
const aiPanel = shallowRef(null);
const pickerOpen = ref(false);
const pickerBusy = ref(false);
const pickerList = ref([]);
/** 「开始游戏」触发的退场位移：角色/背景板左移、右侧按钮右移，结束后才开演 */
const hubLeaving = ref(false);

const vision = ref(null);
const visionReady = ref(false);
const visionStatus = ref('');

const library = new CharacterLibrary();
const characters = ref([]);
const currentCharacter = ref(null);
let heroWeapon = null;
let playback = null;
let audioEl = null;
let tracker = null;
let noticeTimer = 0;
let importInput = null;
/** 切到后台时暂停过场，回到前台自动续播（否则会永远停住） */
let hiddenPaused = false;
/** 卸载后异步回调（摄像头启动、素材加载）一律作废，避免离开页面后摄像头长开 */
let disposed = false;

const totalQte = QTE_NODES.length;

/* ------------------------------------------------------------------ */
/* 提示                                                                */
/* ------------------------------------------------------------------ */

const showNotice = (message, duration = 4200) => {
  notice.value = message;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.value = '';
  }, duration);
};

const dismissNotice = () => {
  window.clearTimeout(noticeTimer);
  notice.value = '';
};

/* ------------------------------------------------------------------ */
/* 过场播放                                                            */
/* ------------------------------------------------------------------ */

const buildPlayback = async () => {
  phase.value = 'loading';
  errorText.value = '';
  audioEl = new Audio();
  audioEl.preload = 'auto';
  audioEl.crossOrigin = 'anonymous';

  playback = new BattlePlayback({
    canvas: canvasEl.value,
    mounts: mountsEl.value,
    audio: audioEl,
    /*
     * 主角形象跟随角色页当前选中的皮影：
     * 过场里 general 位置改用它自己的 manifest 与部件图装配，
     * 动作角度仍复用 general 那套（换的只是皮肤）。未选角色时回落默认将官。
     */
    hero: currentCharacter.value,
    // 引导窗口：动画不暂停，只在角落弹出角标
    onWindow: (node) => {
      qteNode.value = node;
      passedCount.value = playback?.passed?.size || 0;
    },
    // 节点时刻结算：已通过 → 收起角标继续演武
    onCleared: () => {
      passedCount.value = playback?.passed?.size || 0;
    },
    // 未通过 → 黑屏闪回 + 回退到上一检查点
    onFail: (node) => {
      handleQteFail(node);
    },
    onEnd: () => {
      phase.value = 'hub';
      qteNode.value = null;
      passedCount.value = playback?.passed?.size || 0;
    },
    onTick: (time, state) => {
      chapterIndex.value = state.phase === 'dialogue' ? 0 : state.chapter || 0;
    },
    onNotice: (message) => showNotice(message),
    onError: (error) => showNotice(error?.message || String(error)),
  });

  try {
    await playback.load();
    phase.value = 'playing';
    await playback.play();
    // 配乐若被自动播放策略拦截，playback 会通过 onNotice 提示「点一下画面开启配乐」
  } catch (error) {
    console.error('[curtain] 装配失败', error);
    errorText.value = error?.message || String(error);
    phase.value = 'error';
  }
};

const reload = () => {
  if (playback) {
    playback.destroy();
    playback = null;
  }
  buildPlayback();
};

/* ------------------------------------------------------------------ */
/* QTE                                                                 */
/* ------------------------------------------------------------------ */

/** 角标成功展示完毕：收起角标（passed 已由角标写入 playback，动画一直在播，无需恢复） */
const handleQteDone = () => {
  qteNode.value = null;
  passedCount.value = playback?.passed?.size || 0;
};

/** 节点时刻仍未通过：黑屏闪回微转场 + 动画与 BGM 一起退回上一检查点 */
const handleQteFail = async (node) => {
  qteNode.value = null;
  const label = node ? `校准未过 · 退回${node.resumeLabel}` : '校准未过 · 退回上一处';
  await playFlashBack(async () => {
    try {
      await playback?.rollbackTo(node);
    } catch (error) {
      console.warn('[curtain] 回退失败', error);
    }
  }, label);
  passedCount.value = playback?.passed?.size || 0;
  showNotice('校准未通过，动画已退回上一节点重来');
};

/* ------------------------------------------------------------------ */
/* 视觉检测                                                            */
/* ------------------------------------------------------------------ */

const ensureVision = () => {
  if (vision.value) return vision.value;
  const service = new VisionService({
    onStatus: (status) => {
      if (disposed) return;
      visionStatus.value = status?.message || '';
      if (status?.state === 'ready') visionReady.value = true;
      if (status?.state === 'idle' || status?.state === 'error') visionReady.value = false;
      if (status?.state === 'error') showToast(status.message || '视觉模型加载失败', 6000);
    },
    onGesture: (event) => {
      qteRef.value?.handleGesture?.(event);
    },
    onPose: (frame) => {
      if (syncing.value && tracker) tracker.update(frame);
    },
    onNotice: (message) => {
      if (!disposed) showNotice(message);
    },
  });
  vision.value = service;
  return service;
};

const enableCamera = async () => {
  try {
    const service = ensureVision();
    await service.start({ model: 'lite' });
    if (disposed) return;
    visionReady.value = true;
    visionStatus.value = '视觉识别已就绪';
  } catch (error) {
    if (disposed) return;
    visionReady.value = false;
    showToast(error?.message || '摄像头启动失败', 6000);
  }
};

/* ------------------------------------------------------------------ */
/* 形象与武器                                                          */
/* ------------------------------------------------------------------ */

const prepareCharacter = async (record) => {
  const manifest = cloneManifest(record.manifest);
  if (!heroWeapon) {
    try {
      heroWeapon = await library.loadHeroWeapon();
    } catch (error) {
      console.warn('[curtain] 读取主角宝剑失败', error);
    }
  }
  if (heroWeapon) applyHeroWeapon(manifest, heroWeapon);
  return {
    id: record.id,
    title: record.title,
    kind: record.kind,
    manifest,
    baseUrl: record.baseUrl,
    resolveSrc: record.resolveSrc,
  };
};

const applyCharacter = async (record) => {
  try {
    currentCharacter.value = await prepareCharacter(record);
    return true;
  } catch (error) {
    showToast(error?.message || '形象装配失败', 6000);
    return false;
  }
};

const loadCharacters = async () => {
  await library.loadRegistry();
  characters.value = library.list();
  try {
    const general = await library.get('general');
    if (general) await applyCharacter(general);
  } catch (error) {
    console.warn('[curtain] 默认形象加载失败', error);
  }
};

/* ------------------------------------------------------------------ */
/* 幕后入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * 「开始游戏」：先把幕后舞台演一出台式退场（角色与背景板向左移出、右侧入口向右移出），
 * 等位移结束再装配并播放过场。过场播完 onEnd 会回到 hub，可在角色页重新选人或再次开演。
 */
const HUB_LEAVE_MS = 640;

const handleStartGame = () => {
  if (hubLeaving.value) return;
  hubLeaving.value = true;
  window.setTimeout(() => {
    hubLeaving.value = false;
    buildPlayback();
  }, HUB_LEAVE_MS);
};

/** AI 皮影工坊生成完成：注册进角色库并立刻换上 */
const handleAiCreated = async (record) => {
  aiOpen.value = false;
  if (!record) return;
  library.register(record);
  characters.value = library.list();
  if (await applyCharacter(record)) {
    showToast(`AI 皮影已生成并注册：${record.title}（武器仍是主角的宝剑）`, 5200);
  }
};

/**
 * 「切换本地皮影」：先弹已注册角色选择窗口（角色图 + 名字 + 单选），
 * 选中即换上；真正导入新文件夹放在窗口右下角的「导入其他文件」。
 */
const openCharacterPicker = async () => {
  if (busy.value) return;
  pickerBusy.value = true;
  try {
    await library.loadRegistry();
    characters.value = library.list();
    const items = [];
    for (const item of characters.value) {
      let thumb = '';
      try {
        const record = await library.get(item.id);
        thumb = partSrc(record, 'head') || partSrc(record, 'torso');
      } catch (error) {
        console.warn('[curtain] 角色缩略图加载失败', item.id, error);
      }
      items.push({ ...item, thumb });
    }
    pickerList.value = items;
    pickerOpen.value = true;
  } finally {
    pickerBusy.value = false;
  }
};

/** 在角色窗口里点了某个已注册角色 */
const handlePickCharacter = async (id) => {
  if (pickerBusy.value || busy.value) return;
  pickerBusy.value = true;
  try {
    const record = await library.get(id);
    if (record && (await applyCharacter(record))) {
      pickerOpen.value = false;
      showToast(`已换上 ${record.title}（武器仍是主角的宝剑）`);
    }
  } catch (error) {
    showToast(error?.message || '形象装配失败', 6000);
  } finally {
    pickerBusy.value = false;
  }
};

/** 角色窗口右下角「导入其他文件」：走原来的文件夹导入流程 */
const handleImportNew = async () => {
  if (busy.value) return;
  if (!window.showDirectoryPicker) {
    // 浏览器不支持文件夹句柄时，退回 <input webkitdirectory>
    openFolderInput();
    return;
  }
  busy.value = true;
  try {
    const record = await importFromDirectoryPicker();
    if (!record) return; // 用户取消
    library.register(record);
    characters.value = library.list();
    if (await applyCharacter(record)) {
      pickerOpen.value = false;
      showToast(`已换上 ${record.title}（武器仍是主角的宝剑）`);
    }
  } catch (error) {
    if (error?.code === 'INVALID_SAVE_MANIFEST' || error?.details) {
      dialog.value = {
        title: '这个文件夹不能作为皮影形象',
        body: '导入已拒绝：人物文件夹需要包含 manifest.json 与全部零件图，且关节树必须完整。',
        details: error.details || [error.message],
      };
    } else {
      dialog.value = {
        title: '导入失败',
        body: error?.message || '未知错误',
        details: [],
      };
    }
  } finally {
    busy.value = false;
  }
};

function openFolderInput() {
  if (!importInput) {
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.webkitdirectory = true;
    importInput.multiple = true;
    importInput.style.display = 'none';
    importInput.addEventListener('change', async () => {
      const files = importInput.files;
      importInput.value = '';
      if (!files || !files.length) return;
      busy.value = true;
      try {
        const record = await importFromFileList(files);
        if (!record) return;
        library.register(record);
        characters.value = library.list();
        if (await applyCharacter(record)) {
          pickerOpen.value = false;
          showToast(`已换上 ${record.title}（武器仍是主角的宝剑）`);
        }
      } catch (error) {
        dialog.value = {
          title: '这个文件夹不能作为皮影形象',
          body: '导入已拒绝：请确认所选文件夹就是人物目录本身（含 manifest.json 与 assets）。',
          details: error?.details || [error?.message || '未知错误'],
        };
      } finally {
        busy.value = false;
      }
    });
    document.body.appendChild(importInput);
  }
  importInput.click();
}

const handleAiCharacter = async () => {
  if (busy.value) return;
  if (!aiPanel.value) {
    try {
      const module = await import('@/components/art-v2/CurtainAi.vue');
      aiPanel.value = module.default;
    } catch (error) {
      showToast(`AI 皮影工坊加载失败：${error?.message || error}`, 6000);
      return;
    }
  }
  aiOpen.value = true;
};

const handleSyncMotion = async () => {
  if (syncing.value) {
    stopSync();
    return;
  }
  try {
    const service = ensureVision();
    syncing.value = true;
    await service.start({ model: 'lite' });
    if (disposed || !syncing.value) {
      service.stop();
      return;
    }
    visionReady.value = true;
    if (syncCanvas.value) service.attachPreview(syncCanvas.value);
    // 等一帧，确保幕后舞台的 DOM 皮影已经装配完毕再开始驱动
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (disposed || !syncing.value) return;
    tracker = new PoseTracker({ rig: hubRef.value?.getRig?.() || null, mirror: true });
    tracker.reset();
    showToast('动作同步已开启 · 站远一点让上半身入镜');
  } catch (error) {
    if (disposed) return;
    syncing.value = false;
    visionReady.value = false;
    showToast(error?.message || '摄像头启动失败', 6000);
  }
};

const stopSync = () => {
  syncing.value = false;
  tracker?.reset();
  tracker = null;
  vision.value?.detachPreview?.();
  if (vision.value) {
    vision.value.stop();
    visionReady.value = false;
    visionStatus.value = '';
  }
};

/* ------------------------------------------------------------------ */
/* 生命周期                                                            */
/* ------------------------------------------------------------------ */

const leave = () => {
  disposed = true;
  hiddenPaused = false;
  cancelFlashBack();
  stopSync();
  vision.value?.close?.();
  vision.value = null;
  playback?.destroy();
  playback = null;
};

const onStagePointer = async () => {
  // 自动播放被拦截时，任意一次点击恢复配乐
  if (playback) {
    const resumed = await playback.resumeAudio();
    if (resumed) dismissNotice();
  }
};

const onVisibility = () => {
  if (document.hidden) {
    if (playback?.running) {
      playback.pause();
      hiddenPaused = true;
      showNotice('页面切到后台，过场已暂停');
    }
    return;
  }
  // 回到前台时接着播（不能只暂停不恢复，否则过场会一直停在原地）
  if (hiddenPaused) {
    hiddenPaused = false;
    dismissNotice();
    playback?.play().catch((error) => console.warn('[curtain] 恢复播放失败', error));
  }
};

/**
 * 开发期调试钩子（仅 DEV 构建暴露，正式页面没有任何「跳过」入口）：
 * 自动化验证需要快速到达某个 QTE 节点 / 直接看幕后状态，避免每轮都等 84 秒。
 */
function installDebugHooks() {
  if (!import.meta.env.DEV) return;
  window.__CURTAIN__ = {
    get phase() {
      return phase.value;
    },
    get time() {
      return playback?.time ?? 0;
    },
    get music() {
      return playback ? Math.max(0, playback.time - 17) : 0;
    },
    get passed() {
      return [...(playback?.passed || [])];
    },
    get qte() {
      return qteNode.value ? qteNode.value.id : null;
    },
    /** 当前校准角标的位置与结算时刻（自动化验收用） */
    get qteWindow() {
      const node = qteNode.value;
      if (!node) return null;
      return {
        id: node.id,
        placement: node.placement,
        endAt: node.time + QTE_RESOLVE_SECONDS,
        remain: Math.max(0, node.time + QTE_RESOLVE_SECONDS - (playback?.time || 0)),
      };
    },
    get character() {
      return currentCharacter.value ? { id: currentCharacter.value.id, title: currentCharacter.value.title } : null;
    },
    get vision() {
      return { ready: visionReady.value, status: visionStatus.value };
    },
    get audioBlocked() {
      return Boolean(playback?.audioBlocked);
    },
    get chapter() {
      return chapterIndex.value;
    },
    /** 跳到某个配乐时间点（测试用） */
    async seekMusic(music) {
      if (!playback) return;
      playback.pause();
      playback.time = Math.max(17, 17 + Number(music || 0));
      playback.renderAt(playback.time);
      await playback.play();
    },
    /** 直接结束过场进入幕后 */
    toHub() {
      playback?.finish();
    },
    /** 手动弹出某式校准角标（测试用；动画照常播） */
    forceQte(id) {
      const node = QTE_NODES.find((item) => item.id === id);
      if (node) qteNode.value = node;
    },
  };
}

watch(syncing, (on) => {
  if (!on) {
    tracker?.reset();
    tracker = null;
  }
});

onMounted(async () => {
  const region = normalizeRegion(route.query.region) || getCurrentRegion();
  currentRegion.value = region;
  saveRegion(region);

  await loadCharacters();
  if (disposed) return;
  // 先停在角色页：装配与开演交给「开始游戏」，播完 onEnd 会回到这里
  phase.value = 'hub';
  installDebugHooks();

  window.addEventListener('pointerdown', onStagePointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
  leave();
  window.removeEventListener('pointerdown', onStagePointer);
  document.removeEventListener('visibilitychange', onVisibility);
  window.clearTimeout(noticeTimer);
  importInput?.remove();
});
</script>

<style scoped>
.curtain-page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 40%, rgba(30, 16, 8, 0.9) 0%, rgba(6, 3, 1, 0.98) 72%);
}

.curtain-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(6 * var(--rpx)) calc(12 * var(--rpx)) calc(78 * var(--rpx));
  box-sizing: border-box;
}

/*
 * 过场画布固定 1600×900 绘制，靠 object-fit: contain 适配任意视口：
 * 宽屏铺满宽度，窄屏只缩小不裁切，两侧留出灯幕黑边。
 */
.battle-canvas {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: calc(6 * var(--rpx));
  box-shadow: 0 0 0 calc(1 * var(--rpx)) rgba(180, 140, 70, 0.28), 0 calc(20 * var(--rpx)) calc(60 * var(--rpx)) rgba(0, 0, 0, 0.6);
  background: #f2e3c4;
}

/* 装配引擎的 rig 挂载点：必须留在渲染树里（图片要能解码），但完全不参与布局 */
.battle-mounts {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.curtain-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(14 * var(--rpx));
  background: rgba(6, 3, 1, 0.92);
  text-align: center;
  padding: 0 calc(60 * var(--rpx));
}

.mask-title {
  margin: 0;
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(38 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
}

.mask-desc {
  margin: 0;
  color: rgba(255, 227, 163, 0.62);
  font-size: calc(23 * var(--rpx));
  line-height: 1.6;
}

.mask-btn {
  margin-top: calc(8 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(34 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.6);
  border-radius: calc(10 * var(--rpx));
  background: linear-gradient(#c98a3a, #a5641a);
  color: #fff8e1;
  font-family: inherit;
  font-size: calc(24 * var(--rpx));
  cursor: pointer;
}

.curtain-hud {
  position: absolute;
  right: calc(40 * var(--rpx));
  top: calc(10 * var(--rpx));
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: calc(21 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  color: rgba(255, 227, 163, 0.66);
  text-shadow: 0 calc(2 * var(--rpx)) calc(8 * var(--rpx)) rgba(0, 0, 0, 0.75);
  pointer-events: none;
}

.hud-score {
  color: rgba(255, 217, 138, 0.86);
}

.curtain-notice {
  position: absolute;
  left: 50%;
  bottom: calc(90 * var(--rpx));
  z-index: 70;
  transform: translateX(-50%);
  max-width: 86%;
  padding: calc(10 * var(--rpx)) calc(24 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.36);
  border-radius: calc(999 * var(--rpx));
  background: rgba(20, 11, 6, 0.88);
  color: rgba(255, 233, 189, 0.88);
  font-size: calc(21 * var(--rpx));
  text-align: center;
  cursor: pointer;
}

.curtain-sync {
  position: absolute;
  right: calc(20 * var(--rpx));
  top: calc(46 * var(--rpx));
  z-index: 72;
  width: min(76vw, calc(300 * var(--rpx)));
  padding: calc(12 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: calc(12 * var(--rpx));
  background: rgba(18, 10, 5, 0.92);
}

.sync-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: calc(8 * var(--rpx));
  color: #ffe9bd;
  font-size: calc(21 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
}

.sync-close {
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.5);
  border-radius: calc(8 * var(--rpx));
  background: transparent;
  color: rgba(255, 233, 189, 0.86);
  font-family: inherit;
  font-size: calc(19 * var(--rpx));
  padding: calc(4 * var(--rpx)) calc(12 * var(--rpx));
  cursor: pointer;
}

.sync-canvas {
  display: block;
  width: 100%;
  height: calc(190 * var(--rpx));
  border-radius: calc(8 * var(--rpx));
  background: #050302;
}

.sync-status {
  margin: calc(8 * var(--rpx)) 0 0;
  color: rgba(255, 227, 163, 0.6);
  font-size: calc(18 * var(--rpx));
  line-height: 1.5;
}

.curtain-dialog-mask {
  position: absolute;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  padding: calc(40 * var(--rpx));
}

.curtain-dialog {
  width: min(92%, calc(620 * var(--rpx)));
  max-height: 80%;
  overflow-y: auto;
  padding: calc(26 * var(--rpx)) calc(30 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  border-radius: calc(14 * var(--rpx));
  background: linear-gradient(180deg, rgba(46, 27, 15, 0.98), rgba(20, 11, 6, 0.99));
  color: #fff8e1;
  text-align: center;
}

.curtain-dialog h3 {
  margin: 0 0 calc(12 * var(--rpx));
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(32 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
}

.curtain-dialog p {
  margin: 0 0 calc(12 * var(--rpx));
  color: rgba(255, 248, 225, 0.82);
  font-size: calc(23 * var(--rpx));
  line-height: 1.65;
}

.curtain-dialog ul {
  margin: 0 0 calc(16 * var(--rpx));
  padding-left: calc(34 * var(--rpx));
  text-align: left;
  color: rgba(255, 227, 163, 0.7);
  font-size: calc(21 * var(--rpx));
  line-height: 1.7;
}

@media (max-width: 900px) {
  .curtain-stage {
    padding-bottom: calc(60 * var(--rpx));
  }

  .curtain-sync {
    top: auto;
    bottom: calc(70 * var(--rpx));
    right: calc(12 * var(--rpx));
  }
}
</style>
