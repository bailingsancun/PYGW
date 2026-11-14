<!--
  实现功能：身入影幕 · 动画结束后的「幕后」舞台
  职责：
    1) 全屏纸灯箱：白色（纸色）背景铺满整块舞台，主角居中持剑驻地、保持呼吸摆动，默认不显示关节点；
    2) 原「决战将启」的位置是四个入口：开始游戏 / 切换本地皮影 / AI图片转皮影 / 人影动作同步，
       下方另加「添加组件」——从砌末库往背景里摆放场景与特效（城楼、山石、松、云、火焰、黑雾、流矢…）；
    3) 皮影可放大缩小（按钮 / 滚轮），场景组件可拖动、缩放、左右翻转、删除；
    4) 点皮影显示各关节点、可直接拖动调试动作；点空白收起关节点；皮影始终呼吸摆动。
  Props：character（含 manifest / baseUrl / resolveSrc）/ busy / syncing
  Emits：start-game / switch-local / ai-character / sync-motion
-->
<template>
  <div class="hub">
    <div class="hub-stage" ref="stageWrapperRef" @click="onStageClick" @wheel.prevent="onWheel">
      <!-- 背景组件层：砌末（场景 / 特效） -->
      <div
        v-for="item in placed"
        :key="item.id"
        class="scene-item"
        :class="{ selected: item.id === selectedId }"
        :style="sceneStyle(item)"
        @pointerdown.stop="startDrag($event, item)"
        @click.stop="selectScene(item)"
      >
        <img
          :src="item.src"
          :alt="item.label"
          draggable="false"
          :style="{ transform: item.flip ? 'scaleX(-1)' : 'none' }"
        />
        <button
          v-if="item.id === selectedId"
          type="button"
          class="scene-del"
          title="移除这个组件"
          @pointerdown.stop
          @click.stop="removeScene(item)"
        >
          ×
        </button>
      </div>

      <!-- 皮影舞台：背景由外层全屏纸灯箱提供，这里只负责人物 -->
      <div class="hub-rig-frame" ref="frameRef">
        <div class="hub-rig-mount" ref="stageRef"></div>
      </div>

      <p v-if="!rigReady" class="hub-rig-loading">正在装配皮影…</p>

      <!-- 皮影缩放：按钮 + 滚轮 -->
      <div class="hub-zoom" @pointerdown.stop @click.stop>
        <button type="button" title="缩小皮影" @click="zoomBy(-0.1)">−</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button type="button" title="放大皮影" @click="zoomBy(0.1)">＋</button>
      </div>

      <!-- 选中组件的操作条 -->
      <div v-if="selected" class="scene-tools" @pointerdown.stop @click.stop>
        <span class="scene-tools-name">{{ selected.label }}</span>
        <button type="button" @click="sceneScale(-0.15)">缩小</button>
        <button type="button" @click="sceneScale(0.15)">放大</button>
        <button type="button" @click="flipScene">翻转</button>
        <button type="button" class="danger" @click="removeScene(selected)">移除</button>
      </div>

      <p class="hub-tip">
        {{ selected ? '拖动组件可挪位置，滚轮缩放选中的组件' : '点皮影可拖动各关节点调试动作 · 滚轮缩放皮影 · 点空白收起关节点' }}
      </p>
    </div>

    <div class="hub-actions">
      <div class="hub-actions-head">
        <span class="hub-actions-title">{{ character?.title || '皮影将官' }}</span>
        <span class="hub-actions-sub">持剑驻地 · 呼吸摆动</span>
      </div>

      <ArtButton
        class="act act-top"
        text="开始游戏"
        size="large"
        :disabled="busy"
        @click="$emit('start-game')"
      />

      <div class="act-row">
        <ArtButton
          class="act"
          text="切换本地皮影"
          size="medium"
          variant="secondary"
          :disabled="busy"
          @click="$emit('switch-local')"
        />
        <ArtButton
          class="act"
          text="AI图片转皮影"
          size="medium"
          variant="secondary"
          :disabled="busy"
          @click="$emit('ai-character')"
        />
      </div>

      <ArtButton
        class="act act-bottom"
        text="人影动作同步"
        size="large"
        variant="secondary"
        :disabled="busy"
        @click="$emit('sync-motion')"
      />

      <button type="button" class="hub-add-scene" :disabled="busy" @click="openSceneLibrary">
        ＋ 添加组件（场景 / 特效）
      </button>

      <p class="hub-actions-note">
        {{ syncing ? '动作同步进行中 · 皮影跟随镜头前的人' : `已放置 ${placed.length} 个砌末 · 四个入口将在正片里承接后续玩法` }}
      </p>
    </div>

    <!-- 砌末库抽屉 -->
    <div v-if="sceneLibraryOpen" class="scene-library-mask" @click.self="sceneLibraryOpen = false">
      <div class="scene-library">
        <header class="scene-library-head">
          <span>添加组件 · 砌末库</span>
          <button type="button" @click="sceneLibraryOpen = false">关闭</button>
        </header>
        <p v-if="!sceneryList.length" class="scene-library-empty">砌末库加载失败，请检查 /piying/scenery/index.json</p>
        <div v-else class="scene-grid">
          <button
            v-for="piece in sceneryList"
            :key="piece.name"
            type="button"
            class="scene-card"
            :title="piece.role"
            @click="addScene(piece)"
          >
            <img :src="piece.src" :alt="piece.label" draggable="false" />
            <span>{{ piece.label }}</span>
          </button>
        </div>
        <p class="scene-library-note">点一项即放置到舞台中央；放好后可拖动、缩放、翻转或移除。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import { createRig } from '@/piying/rig-engine.js';
import { SCENERY_INDEX_URL, piyingUrl } from '@/piying/paths.js';

const props = defineProps({
  character: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
});

defineEmits(['start-game', 'switch-local', 'ai-character', 'sync-motion']);

/** 砌末的中文短名（index.json 的 role 前缀太长，这里给个可读标签） */
const SCENE_LABELS = {
  citywall: '城楼',
  hill: '山石',
  pine: '松树',
  tent: '军帐',
  banner: '军旗',
  cloud: '云纹',
  fire: '火焰',
  black_mist: '黑雾',
  arrow: '流矢',
  arrow_front: '断矢前半',
  arrow_back: '断矢后半',
};

const frameRef = ref(null);
const stageRef = ref(null);
const stageWrapperRef = ref(null);
const rigReady = ref(false);

const sceneryList = ref([]);
const placed = ref([]);
const selectedId = ref(null);
/**
 * 最后一次**用指针选中/拖动**的组件 id。
 * 图层规则：新添加的组件放在它下面（被它覆盖）；没选中过任何组件时新组件才放最上层。
 * 换句话说「用指针点过谁，谁就压在新加的组件上面」。
 */
const lastPickedId = ref('');
const sceneLibraryOpen = ref(false);
const zoom = ref(1);

let rig = null;
let observer = null;
let fitScale = 1;
let dragState = null;

const selected = computed(() => placed.value.find((item) => item.id === selectedId.value) || null);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------ */
/* 皮影                                                                */
/* ------------------------------------------------------------------ */

const mountRig = async () => {
  if (!props.character || !stageRef.value) return;
  teardown();
  rigReady.value = false;
  try {
    rig = createRig(stageRef.value, props.character.manifest, {
      baseUrl: props.character.baseUrl,
      resolveSrc: props.character.resolveSrc,
      handles: false,
      interactive: true,
      keyTarget: window,
      // 「持剑拄地」的剑尖会略微超出虚拟画布，底部留白保证整把剑都看得见
      extraBottom: 96,
    });
    rig.setPose('rest');
    await rig.ready();
    rig.setHandlesVisible(false);
    rig.setIdle(true);
    fitRig();
    rigReady.value = true;
  } catch (error) {
    console.warn('[curtain] 皮影装配失败', error);
  }
};

function fitRig() {
  if (!rig || !frameRef.value) return;
  const rect = frameRef.value.getBoundingClientRect();
  fitScale = rig.fit({ width: rect.width, height: rect.height });
  if (zoom.value !== 1) rig.setScale(fitScale * zoom.value);
  centerRig();
}

/**
 * 让「人物 + 武器」整体落在舞台正中：
 * 各角色的 manifest 里人物在虚拟画布中的横向位置并不一致（侧身、披风、剑都在一侧），
 * 直接用作者给的 attach 会偏左或偏右。这里按所有部件包围盒的水平中心做一次平移。
 */
function centerRig() {
  if (!rig) return;
  const stageWidth = rig.manifest?.stage?.width || 900;
  const scale = rig.scale || 1;
  let min = Infinity;
  let max = -Infinity;
  for (const node of rig.nodes) {
    const part = rig.manifest.parts?.[node.part];
    const size = part?.size;
    const matrix = rig.W[node.id];
    if (!size || !matrix) continue;
    const corners = [
      [0, 0],
      [size[0], 0],
      [0, size[1]],
      [size[0], size[1]],
    ];
    for (const [x, y] of corners) {
      const px = matrix[0] * x + matrix[2] * y + matrix[4];
      if (px < min) min = px;
      if (px > max) max = px;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;
  const center = (min + max) / 2;
  const target = (stageWidth * scale) / 2;
  const delta = (target - center) / scale;
  if (Math.abs(delta) < 1) return;
  const [px, py] = rig.stagePos;
  rig.setStagePos([px + delta, py]);
}

/** 缩放皮影（相对自适应尺寸的倍率） */
function zoomBy(delta) {
  zoom.value = clamp(Number((zoom.value + delta).toFixed(2)), 0.55, 1.9);
  applyZoom();
}

function applyZoom() {
  if (!rig) return;
  rig.setScale(Math.max(0.1, fitScale * zoom.value));
  centerRig();
}

/* ------------------------------------------------------------------ */
/* 砌末（场景 / 特效组件）                                              */
/* ------------------------------------------------------------------ */

async function loadScenery() {
  try {
    const response = await fetch(SCENERY_INDEX_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    sceneryList.value = (data.pieces || []).map((piece) => ({
      name: piece.name,
      label: SCENE_LABELS[piece.name] || String(piece.role || piece.name).split('·')[0].trim(),
      role: piece.role || '',
      aspect: piece.size?.[0] && piece.size?.[1] ? piece.size[0] / piece.size[1] : 1,
      src: piyingUrl(`scenery/${piece.file}`),
    }));
  } catch (error) {
    console.warn('[curtain] 砌末库加载失败', error);
    sceneryList.value = [];
  }
}

function openSceneLibrary() {
  sceneLibraryOpen.value = true;
  selectedId.value = null;
}

function addScene(piece) {
  const id = `${piece.name}-${Date.now().toString(36)}`;
  const index = placed.value.length;
  // 以舞台宽度为基准给一个合适的初始尺寸：太小的砌末（流矢）也能看清
  const width = clamp((piece.aspect > 2 ? 30 : 20) + Math.random() * 4, 8, 40);
  const entry = {
    id,
    name: piece.name,
    label: piece.label,
    src: piece.src,
    aspect: piece.aspect,
    // 按已放置数量错开初始位置，连着加好几个不会全部叠在正中
    x: 28 + ((index * 17) % 46) + (Math.random() * 6 - 3),
    y: 50 + ((index * 11) % 26) + (Math.random() * 6 - 3),
    width,
    flip: false,
  };

  /*
   * 覆盖规则：若之前用指针选中过某个组件，新组件插在它**下面**（数组越靠后画得越上），
   * 这样「选中的组件」始终压住新加的组件；没有选中过就按默认放最上层。
   */
  const anchor = lastPickedId.value
    ? placed.value.findIndex((item) => item.id === lastPickedId.value)
    : -1;
  if (anchor >= 0) {
    placed.value.splice(anchor, 0, entry);
  } else {
    placed.value.push(entry);
  }

  selectedId.value = id;
  sceneLibraryOpen.value = false;
}

/** 指针选中/拖动过的组件提到最上层（数组末尾 = 最上） */
function bringToFront(item) {
  const index = placed.value.indexOf(item);
  if (index < 0 || index === placed.value.length - 1) return;
  placed.value.splice(index, 1);
  placed.value.push(item);
}

const sceneStyle = (item) => ({
  left: `${item.x}%`,
  top: `${item.y}%`,
  width: `${item.width}%`,
  transform: 'translate(-50%, -50%)',
});

function selectScene(item) {
  selectedId.value = item.id;
  lastPickedId.value = item.id;
  bringToFront(item);
}

function removeScene(item) {
  placed.value = placed.value.filter((entry) => entry.id !== item.id);
  if (selectedId.value === item.id) selectedId.value = null;
  if (lastPickedId.value === item.id) lastPickedId.value = '';
}

function sceneScale(delta) {
  const item = selected.value;
  if (!item) return;
  item.width = clamp(item.width * (1 + delta), 5, 80);
}

function flipScene() {
  const item = selected.value;
  if (item) item.flip = !item.flip;
}

function startDrag(event, item) {
  selectedId.value = item.id;
  lastPickedId.value = item.id;
  bringToFront(item);
  const rect = stageWrapperRef.value?.getBoundingClientRect();
  if (!rect) return;
  dragState = { id: item.id, startX: event.clientX, startY: event.clientY, x0: item.x, y0: item.y, rect };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  event.preventDefault();
}

function onDragMove(event) {
  if (!dragState) return;
  const item = placed.value.find((entry) => entry.id === dragState.id);
  if (!item) return;
  const dx = ((event.clientX - dragState.startX) / dragState.rect.width) * 100;
  const dy = ((event.clientY - dragState.startY) / dragState.rect.height) * 100;
  item.x = clamp(dragState.x0 + dx, 0, 100);
  item.y = clamp(dragState.y0 + dy, 0, 100);
}

function endDrag() {
  dragState = null;
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
}

/* ------------------------------------------------------------------ */
/* 舞台交互                                                            */
/* ------------------------------------------------------------------ */

/** 滚轮：选中组件时缩放组件，否则缩放皮影 */
function onWheel(event) {
  const delta = event.deltaY > 0 ? -0.08 : 0.08;
  if (selected.value) {
    const item = selected.value;
    item.width = clamp(item.width * (1 + delta), 5, 80);
    return;
  }
  zoomBy(delta);
}

/** 点空白：取消选中组件。关节手柄的显隐统一由 window 捕获的 handleStageClick 处理（按坐标判断） */
function onStageClick(event) {
  const target = event.target;
  if (
    target?.closest?.('.scene-item') ||
    target?.closest?.('.py-stage') ||
    target?.closest?.('.py-handle') ||
    target?.closest?.('.hub-zoom') ||
    target?.closest?.('.scene-tools')
  ) {
    return;
  }
  selectedId.value = null;
}

/* ------------------------------------------------------------------ */
/* 生命周期                                                            */
/* ------------------------------------------------------------------ */

const teardown = () => {
  if (rig) {
    rig.destroy();
    rig = null;
  }
  if (stageRef.value) stageRef.value.innerHTML = '';
  rigReady.value = false;
};

watch(() => props.character, () => {
  nextTick(() => mountRig());
});

onMounted(() => {
  loadScenery();
  nextTick(() => mountRig());
  observer = new ResizeObserver(() => fitRig());
  if (frameRef.value) observer.observe(frameRef.value);
  window.addEventListener('click', handleStageClick, true);
});

onBeforeUnmount(() => {
  teardown();
  observer?.disconnect();
  observer = null;
  endDrag();
  window.removeEventListener('click', handleStageClick, true);
});

/**
 * 点皮影（部件或关节点）→ 显示关节点；点其它任何地方（灯箱空白、面板外）→ 收起。
 * 注意：部件图在 rig-engine 里是 pointer-events:none（拖动由关节手柄接管），
 * 所以不能靠 event.target 判断「点到皮影」，只能按坐标落在哪个部件的包围盒里判断。
 * 拖动手柄时 pointer 被手柄捕获，click 的 target 仍是手柄，不会误收起。
 */
const handleStageClick = (event) => {
  if (!rig) return;
  // 点到砌末组件 / 缩放条 / 组件操作条时，不参与「显示关节」的判断
  if (
    event.target?.closest?.('.scene-item') ||
    event.target?.closest?.('.hub-zoom') ||
    event.target?.closest?.('.scene-tools') ||
    event.target?.closest?.('.scene-library')
  ) {
    return;
  }
  const onHandle = event.target?.closest?.('.py-handle');
  if (onHandle || hitsAnyPart(event.clientX, event.clientY)) {
    if (!rig.handlesVisible) rig.setHandlesVisible(true);
    return;
  }
  rig.setHandlesVisible(false);
};

/** 视口坐标是否落在某个可见部件的包围盒内（旋转部件取外接矩形，判定偏宽松） */
function hitsAnyPart(x, y) {
  if (!rig) return false;
  for (const node of rig.nodes) {
    const image = rig.imgs[node.id];
    if (!image || image.style.display === 'none') continue;
    const rect = image.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
  }
  return false;
}

defineExpose({ fitRig, getRig: () => rig, getPlaced: () => placed.value });
</script>

<style scoped>
.hub {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: stretch;
  gap: calc(20 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(20 * var(--rpx));
  box-sizing: border-box;
  /* 白色纸灯箱铺满整个幕后画面（右侧入口面板作为深色木牌浮在上面） */
  background:
    radial-gradient(72% 66% at 46% 44%, #fff8e6 0%, #f8eccf 46%, #eeddbd 78%, #e6d2ac 100%);
  animation: hubIn 420ms ease-out both;
}

/*
 * 舞台区域：背景由 .hub 全屏提供，这里只留灯箱内阴影与纸纹，
 * 砌末组件、皮影都画在这块区域里。
 */
.hub-stage {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  border-radius: calc(10 * var(--rpx));
  overflow: hidden;
  background: transparent;
  box-shadow:
    inset 0 0 calc(90 * var(--rpx)) rgba(150, 110, 60, 0.26),
    inset 0 0 0 calc(2 * var(--rpx)) rgba(120, 80, 40, 0.18);
  cursor: default;
}

/* 纸纹：与皮影引擎的网格纹理同源，避免两层纹理对不上 */
.hub-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.05;
  background:
    repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 3px);
}

.hub-rig-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: calc(8 * var(--rpx));
  box-sizing: border-box;
  /* 整块舞台不接事件：点击要能穿透到下面的砌末组件与空白 */
  pointer-events: none;
}

.hub-rig-mount {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  /* 同上：只有关节手柄需要可点，见下方 .py-handle */
  pointer-events: none;
}

/*
 * 覆盖 rig-engine 自带的纸灯箱（背景 / 圆角 / 内阴影 / 网格纹理），
 * 背景与纸纹改由外层 .hub / .hub-stage 全屏提供；overflow:visible 让放大的皮影不被裁。
 */
.hub-rig-mount :deep(.py-stage) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  overflow: visible;
  pointer-events: none;
}

.hub-rig-mount :deep(.py-stage::before) {
  display: none;
}

/* 关节手柄仍然要能拖动（pointer-events:auto 的子元素即使父级为 none 也能成为事件目标） */
.hub-rig-mount :deep(.py-handle) {
  pointer-events: auto;
}

.hub-rig-loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  color: rgba(120, 82, 40, 0.7);
  font-size: calc(24 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
}

/* ---- 砌末组件 ---- */
.scene-item {
  position: absolute;
  z-index: 1;
  cursor: grab;
  touch-action: none;
  user-select: none;
  pointer-events: auto;
  filter: drop-shadow(0 calc(6 * var(--rpx)) calc(14 * var(--rpx)) rgba(70, 40, 12, 0.22));
}

.scene-item.selected {
  outline: calc(2 * var(--rpx)) dashed rgba(150, 96, 30, 0.7);
  outline-offset: calc(4 * var(--rpx));
  cursor: grabbing;
}

.scene-item img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
}

.scene-del {
  position: absolute;
  right: calc(-10 * var(--rpx));
  top: calc(-10 * var(--rpx));
  width: calc(30 * var(--rpx));
  height: calc(30 * var(--rpx));
  border-radius: 50%;
  border: calc(1 * var(--rpx)) solid rgba(120, 70, 20, 0.6);
  background: rgba(255, 246, 224, 0.95);
  color: #7a4a12;
  font-size: calc(20 * var(--rpx));
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}

/* ---- 皮影缩放 ---- */
.hub-zoom {
  position: absolute;
  right: calc(16 * var(--rpx));
  top: calc(14 * var(--rpx));
  z-index: 4;
  display: flex;
  align-items: center;
  gap: calc(6 * var(--rpx));
  padding: calc(5 * var(--rpx)) calc(9 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(120, 80, 40, 0.34);
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 248, 230, 0.86);
  box-shadow: 0 calc(4 * var(--rpx)) calc(12 * var(--rpx)) rgba(90, 60, 20, 0.16);
  color: #6b4520;
  font-size: calc(18 * var(--rpx));
  pointer-events: auto;
}

.hub-zoom button {
  width: calc(30 * var(--rpx));
  height: calc(30 * var(--rpx));
  border-radius: 50%;
  border: calc(1 * var(--rpx)) solid rgba(120, 80, 40, 0.4);
  background: rgba(255, 252, 240, 0.9);
  color: #6b4520;
  font-size: calc(19 * var(--rpx));
  line-height: 1;
  cursor: pointer;
}

.hub-zoom span {
  min-width: calc(52 * var(--rpx));
  text-align: center;
  letter-spacing: calc(1 * var(--rpx));
}

/* ---- 选中组件操作条 ---- */
.scene-tools {
  position: absolute;
  left: 50%;
  bottom: calc(14 * var(--rpx));
  z-index: 4;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: calc(8 * var(--rpx));
  padding: calc(7 * var(--rpx)) calc(12 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(120, 80, 40, 0.34);
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 248, 230, 0.92);
  box-shadow: 0 calc(6 * var(--rpx)) calc(16 * var(--rpx)) rgba(90, 60, 20, 0.18);
  color: #6b4520;
  font-size: calc(18 * var(--rpx));
  pointer-events: auto;
}

.scene-tools-name {
  padding-right: calc(6 * var(--rpx));
  border-right: calc(1 * var(--rpx)) solid rgba(120, 80, 40, 0.26);
  letter-spacing: calc(1 * var(--rpx));
}

.scene-tools button {
  padding: calc(4 * var(--rpx)) calc(12 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(120, 80, 40, 0.36);
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 252, 240, 0.9);
  color: #6b4520;
  font-family: inherit;
  font-size: calc(18 * var(--rpx));
  cursor: pointer;
}

.scene-tools button.danger {
  border-color: rgba(170, 60, 40, 0.5);
  color: #a13a22;
}

.hub-tip {
  position: absolute;
  left: 50%;
  bottom: calc(58 * var(--rpx));
  z-index: 3;
  transform: translateX(-50%);
  margin: 0;
  max-width: 92%;
  color: rgba(110, 74, 36, 0.62);
  font-size: calc(18 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
  text-align: center;
  pointer-events: none;
}

/* ---- 右侧入口面板 ---- */
.hub-actions {
  flex: 0 0 calc(400 * var(--rpx));
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: calc(18 * var(--rpx));
  padding: calc(22 * var(--rpx)) calc(20 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.34);
  border-radius: calc(14 * var(--rpx));
  background: linear-gradient(180deg, rgba(52, 31, 18, 0.9), rgba(24, 13, 7, 0.94));
  box-shadow:
    inset 0 0 0 calc(1 * var(--rpx)) rgba(255, 226, 168, 0.08),
    0 calc(20 * var(--rpx)) calc(46 * var(--rpx)) rgba(0, 0, 0, 0.45);
}

.hub-actions-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(4 * var(--rpx));
  padding-bottom: calc(10 * var(--rpx));
  border-bottom: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.24);
}

.hub-actions-title {
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(32 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
}

.hub-actions-sub {
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(19 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
}

.hub-actions :deep(.art-button) {
  width: 100%;
}

.act-row {
  display: flex;
  gap: calc(14 * var(--rpx));
}

.act-row :deep(.art-button) {
  flex: 1 1 0;
  min-width: 0;
}

/* 中部两个按钮文字较长，字号略收，避免在窄面板里换行 */
.act-row :deep(.button-text) {
  font-size: calc(24 * var(--rpx));
  white-space: nowrap;
}

.hub-add-scene {
  width: 100%;
  padding: calc(12 * var(--rpx)) 0;
  border: calc(1 * var(--rpx)) dashed rgba(212, 175, 55, 0.5);
  border-radius: calc(10 * var(--rpx));
  background: rgba(255, 236, 196, 0.06);
  color: rgba(255, 233, 189, 0.9);
  font-family: var(--art-font-title);
  font-size: calc(24 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.hub-add-scene:hover {
  background: rgba(255, 236, 196, 0.12);
  border-color: rgba(255, 217, 138, 0.8);
}

.hub-add-scene:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hub-actions-note {
  margin: 0;
  color: rgba(255, 227, 163, 0.4);
  font-size: calc(18 * var(--rpx));
  line-height: 1.5;
  text-align: center;
}

/* ---- 砌末库抽屉 ---- */
.scene-library-mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  background: rgba(4, 2, 1, 0.55);
}

.scene-library {
  width: min(460px, 46%);
  height: 100%;
  padding: calc(18 * var(--rpx)) calc(20 * var(--rpx));
  box-sizing: border-box;
  overflow-y: auto;
  border-left: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  background: linear-gradient(180deg, rgba(44, 26, 14, 0.99), rgba(18, 10, 5, 0.99));
  color: #fff8e1;
}

.scene-library-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: calc(12 * var(--rpx));
  border-bottom: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.3);
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(28 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
}

.scene-library-head button {
  padding: calc(5 * var(--rpx)) calc(16 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  border-radius: calc(999 * var(--rpx));
  background: transparent;
  color: rgba(255, 233, 189, 0.8);
  font-family: inherit;
  font-size: calc(19 * var(--rpx));
  cursor: pointer;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(12 * var(--rpx));
  margin-top: calc(14 * var(--rpx));
}

.scene-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(6 * var(--rpx));
  padding: calc(10 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.26);
  border-radius: calc(10 * var(--rpx));
  background: rgba(255, 236, 196, 0.06);
  color: rgba(255, 233, 189, 0.86);
  font-family: inherit;
  font-size: calc(19 * var(--rpx));
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.scene-card:hover {
  border-color: rgba(255, 217, 138, 0.7);
  background: rgba(255, 236, 196, 0.12);
}

.scene-card img {
  width: 100%;
  height: calc(72 * var(--rpx));
  object-fit: contain;
  pointer-events: none;
}

.scene-library-empty,
.scene-library-note {
  margin: calc(14 * var(--rpx)) 0 0;
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(18 * var(--rpx));
  line-height: 1.6;
}

@keyframes hubIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .hub {
    flex-direction: column;
    padding: calc(8 * var(--rpx)) calc(16 * var(--rpx)) calc(190 * var(--rpx) + env(safe-area-inset-bottom));
    gap: calc(8 * var(--rpx));
    overflow-y: auto;
  }

  .hub-stage {
    flex: 0 0 auto;
    height: 44vh;
    min-height: calc(320 * var(--rpx));
  }

  .hub-actions {
    flex: 0 0 auto;
    gap: calc(12 * var(--rpx));
    padding: calc(16 * var(--rpx)) calc(18 * var(--rpx));
  }

  .hub-actions-title {
    font-size: calc(26 * var(--rpx));
  }

  .scene-library {
    width: 100%;
  }

  .hub-tip {
    display: none;
  }
}
</style>
