/**
 * 实现功能：身入影幕过场动画里的三个 QTE 判定节点定义
 * 职责：把「打斗动画时间轴」上主角的三个招式与「视觉校准三式」一一对应起来，
 *       并约定每个节点失败时的时间回退点（前一个节点结束之后 / 第一个节点退回阶段一开头）。
 *
 * 时间轴口径（与 battle/score.js 一致）：
 *   time = 绝对秒；music = time - DIALOGUE_END（17s 对白之后才是配乐段）
 *   三个节点都落在配乐段，因此 time = 17 + music。
 *
 * 节点与动作的对应（动作名取自 CV 的三动作识别器）：
 *   招架弹反 —— x      双臂上举交叉成 X（架剑格挡徐鸿儒的腾身劈落）
 *   蓄力刺击 —— thrust 屈臂变直臂向前突刺（沉身蓄势后一剑破防）
 *   斩断流矢 —— swing  单臂自上而下挥斩（举剑过顶劈断飞来的流矢）
 */
import { DIALOGUE_END, DURATION, MUSIC_DURATION } from './score.js';

/**
 * 判定窗口：**以节点为中心，前后各 2 秒**（共 4 秒）。
 * 也就是说节点时刻不再不等于结算时刻，而是判定的正中间——
 * 招式动作在节点演出，玩家在动作前后各两秒内做出对应动作都算校准成功。
 */
export const QTE_JUDGE_MS = 4000;
export const QTE_JUDGE_BEFORE_MS = 2000;
export const QTE_JUDGE_AFTER_MS = QTE_JUDGE_MS - QTE_JUDGE_BEFORE_MS; // 2000
/** 看图（起势）时间：放在判定开始前 1.3 秒 */
export const QTE_PREPARE_MS = 1300;

/** 角标出现时间 = 节点时间 -（判定前半 2s + 看图 1.3s） */
export const QTE_LEAD_SECONDS = (QTE_JUDGE_BEFORE_MS + QTE_PREPARE_MS) / 1000; // 3.3
/** 进入判定 = 节点前 2 秒 */
export const QTE_JUDGE_START_SECONDS = QTE_JUDGE_BEFORE_MS / 1000; // 2
/** 结算时间 = 节点后 2 秒（判定的后半段） */
export const QTE_RESOLVE_SECONDS = QTE_JUDGE_AFTER_MS / 1000; // 2
/** 角标总时长（出现 → 结算） */
export const QTE_TOTAL_SECONDS = QTE_LEAD_SECONDS + QTE_RESOLVE_SECONDS; // 5.3

/**
 * 回退点 = 该节点「前一个节点结束之后」的动画位置。
 * 第一个节点没有前一个节点，按需求退回「阶段一：双将交锋」的动画开头（music = 0）。
 */
const PARRY_MUSIC = 18.6; // 徐鸿儒腾身跃起、尚未劈落 —— 正该架剑
const THRUST_MUSIC = 33.6; // 主角沉身蓄势（crouchCharge）中
const CUT_MUSIC = 60.2; // 特写里流矢正在逼近，未到 61s 的劈断瞬间

export const QTE_NODES = [
  {
    id: 'parry',
    order: 1,
    action: 'x',
    name: '招架弹反',
    chapter: '一 · 双将交锋',
    story: '徐鸿儒腾身劈落，抬臂横架、以剑脊卸力，方能反手还击。',
    brief: '双臂上举交叉成 X',
    /** 引导角标的落位：左上 / 左下 / 右下，避开画面中央的打斗 */
    placement: 'top-left',
    music: PARRY_MUSIC,
    time: DIALOGUE_END + PARRY_MUSIC,
    /** 失败回退的 music 位置 */
    resumeMusic: 0,
    resumeLabel: '阶段一 · 双将交锋（动画开头）',
  },
  {
    id: 'thrust',
    order: 2,
    action: 'thrust',
    name: '蓄力刺击',
    chapter: '二 · 步步紧逼',
    story: '沉身蓄势已满，腰间发力、直臂前刺，一剑破开偃月刀的封架。',
    brief: '屈臂变直臂向前突刺',
    placement: 'bottom-left',
    music: THRUST_MUSIC,
    time: DIALOGUE_END + THRUST_MUSIC,
    resumeMusic: PARRY_MUSIC,
    resumeLabel: '上一式「招架弹反」之后',
  },
  {
    id: 'cut',
    order: 3,
    action: 'swing',
    name: '斩断流矢',
    chapter: '四 · 一刃断矢',
    story: '妖法召来的流矢扑面而至，举剑过顶、自上而下斩断它。',
    brief: '单臂自上而下挥斩',
    placement: 'bottom-right',
    music: CUT_MUSIC,
    time: DIALOGUE_END + CUT_MUSIC,
    resumeMusic: THRUST_MUSIC,
    resumeLabel: '上一式「蓄力刺击」之后',
  },
];

/** 引导出现时间（绝对秒） */
export const qteWindowStart = (node) => Number(node.time) - QTE_LEAD_SECONDS;

/** music（配乐相对秒）→ 时间轴绝对秒 */
export const musicToTime = (music) => {
  const value = Math.max(0, Math.min(MUSIC_DURATION, Number(music) || 0));
  return Math.min(DURATION, DIALOGUE_END + value);
};

/** 绝对秒 → music（对白段返回 0） */
export const timeToMusic = (time) => Math.max(0, Number(time || 0) - DIALOGUE_END);

export const findQteNode = (id) => QTE_NODES.find((node) => node.id === id) || null;
