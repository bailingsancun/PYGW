/**
 * 实现功能：art-v2 素材资源表（Web 版）
 * 职责：集中管理 9 组 art-v2 素材路径，提供 getter 懒取；每个素材都先查 /assets/common
 *       下发的 imageKey（globalImages），查不到才回落到 ART_BASE 本地路径。
 *       这层回落必须保留：app_common_image 的 87 行只覆盖了部分 art_v2_* key（HANDOFF §3.4）。
 * 与源工程的差异：artNavTabs.url 改为 Web 路由（原值是小程序页面路径）。
 */
import { getImageByKey, normalizeImageUrl } from '@/store/imageStore.js';

const ART_BASE = '/images/art/v2';

export const assetPath = (group, file) => normalizeImageUrl(`${ART_BASE}/${group}/${file}`);

const artAsset = (key, group, file) => getImageByKey(key, `${ART_BASE}/${group}/${file}`);

const processStepAsset = (stepSort = 1) => {
  const index = Math.max(1, Math.min(8, Number(stepSort || 1)));
  return artAsset(`art_v2_process_step_${index}`, 'process', `process_img_step_${index}.png`);
};

export const artAssets = {
  common: {
    get btnPrimary() {
      return artAsset('art_v2_common_btn_primary', 'common', 'btn_primary_bg.png');
    },
    get btnPrimaryPressed() {
      return artAsset('art_v2_common_btn_primary_pressed', 'common', 'btn_primary_bg_pressed.png');
    },
    get btnSecondary() {
      return artAsset('art_v2_common_btn_secondary', 'common', 'btn_secondary_bg.png');
    },
    get btnSecondaryPressed() {
      return artAsset('art_v2_common_btn_secondary_pressed', 'common', 'btn_secondary_bg_pressed.png');
    },
    get cardPaper() {
      return artAsset('art_v2_common_card_paper', 'common', 'card_paper_frame.png');
    },
    get cardDark() {
      return artAsset('art_v2_common_card_dark', 'common', 'card_dark_frame.png');
    },
    get panelPaper() {
      return artAsset('art_v2_common_panel_paper', 'common', 'panel_paper_large.png');
    },
    get panelDark() {
      return artAsset('art_v2_common_panel_dark', 'common', 'panel_dark_large.png');
    },
    get popupPaper() {
      return artAsset('art_v2_common_popup_paper', 'common', 'popup_paper_panel.png');
    },
    get bottomNav() {
      return artAsset('art_v2_common_bottom_nav', 'common', 'bottom_nav_dark.png');
    },
    get topBarDark() {
      return artAsset('art_v2_common_top_bar_dark', 'common', 'top_bar_dark.png');
    },
    get topBarPaper() {
      return artAsset('art_v2_common_top_bar_paper', 'common', 'top_bar_paper.png');
    },
    get iconBack() {
      return artAsset('art_v2_common_icon_back', 'common', 'icon_back_gold.png');
    },
    get iconShare() {
      return artAsset('art_v2_common_icon_share', 'common', 'icon_share_gold.png');
    },
    navIcons: {
      get home() {
        return artAsset('art_v2_common_icon_home', 'common', 'icon_home.png');
      },
      get homeActive() {
        return artAsset('art_v2_common_icon_home_active', 'common', 'icon_home_active.png');
      },
      get map() {
        return artAsset('art_v2_common_icon_map', 'common', 'icon_map.png');
      },
      get mapActive() {
        return artAsset('art_v2_common_icon_map_active', 'common', 'icon_map_active.png');
      },
      get display() {
        return artAsset('art_v2_common_icon_display', 'common', 'icon_display.png');
      },
      get displayActive() {
        return artAsset('art_v2_common_icon_display_active', 'common', 'icon_display_active.png');
      },
      get process() {
        return artAsset('art_v2_common_icon_process', 'common', 'icon_process.png');
      },
      get processActive() {
        return artAsset('art_v2_common_icon_process_active', 'common', 'icon_process_active.png');
      },
      get game() {
        return artAsset('art_v2_common_icon_game', 'common', 'icon_game.png');
      },
      get gameActive() {
        return artAsset('art_v2_common_icon_game_active', 'common', 'icon_game_active.png');
      },
    },
  },
  home: {
    get bg() {
      return artAsset('art_v2_home_bg', 'home', 'home_bg_stage.png');
    },
    get badge() {
      return artAsset('art_v2_home_badge', 'home', 'home_badge_heritage.png');
    },
  },
  map: {
    get bg() {
      return artAsset('art_v2_map_bg', 'map', 'map_bg_dark.png');
    },
    get china() {
      return artAsset('art_v2_map_china', 'map', 'china_map_art.png');
    },
    get marker() {
      return artAsset('art_v2_map_marker', 'map', 'marker_normal.png');
    },
    get markerActive() {
      return artAsset('art_v2_map_marker_active', 'map', 'marker_active.png');
    },
    get popup() {
      return artAsset('art_v2_map_popup', 'map', 'region_popup_bg.png');
    },
    get menuItem() {
      return artAsset('art_v2_map_menu_item', 'map', 'menu_item_bg.png');
    },
    get compass() {
      return artAsset('art_v2_map_compass', 'map', 'compass_decor.png');
    },
  },
  quiz: {
    get bg() {
      return artAsset('art_v2_quiz_bg', 'quiz', 'quiz_bg_dark.png');
    },
    get progress() {
      return artAsset('art_v2_quiz_progress', 'quiz', 'progress_bar_bg.png');
    },
    get question() {
      return artAsset('art_v2_quiz_question', 'quiz', 'question_scroll_bg.png');
    },
    get optionDefault() {
      return artAsset('art_v2_quiz_option_default', 'quiz', 'option_bg_default.png');
    },
    get optionSelected() {
      return artAsset('art_v2_quiz_option_selected', 'quiz', 'option_bg_selected.png');
    },
    get optionCorrect() {
      return artAsset('art_v2_quiz_option_correct', 'quiz', 'option_bg_correct.png');
    },
    get optionWrong() {
      return artAsset('art_v2_quiz_option_wrong', 'quiz', 'option_bg_wrong.png');
    },
    get explanation() {
      return artAsset('art_v2_quiz_explanation', 'quiz', 'explanation_panel_bg.png');
    },
    get stampCorrect() {
      return artAsset('art_v2_quiz_stamp_correct', 'quiz', 'stamp_correct.png');
    },
    get stampWrong() {
      return artAsset('art_v2_quiz_stamp_wrong', 'quiz', 'stamp_wrong.png');
    },
    get result() {
      return artAsset('art_v2_quiz_result', 'quiz', 'result_panel_bg.png');
    },
  },
  process: {
    get bg() {
      return artAsset('art_v2_process_bg', 'process', 'process_bg_dark.png');
    },
    get card() {
      return artAsset('art_v2_process_card', 'process', 'process_card_bg.png');
    },
    get stepBadge() {
      return artAsset('art_v2_process_step_badge', 'process', 'step_badge_bg.png');
    },
    get stepImages() {
      return Array.from({ length: 8 }, (_, index) => processStepAsset(index + 1));
    },
  },
  game: {
    get bg() {
      return artAsset('art_v2_game_bg', 'game', 'game_bg_stage_dark.png');
    },
    get hint() {
      return artAsset('art_v2_game_hint', 'game', 'flashlight_hint_bg.png');
    },
    get progressTrack() {
      return artAsset('art_v2_game_progress_track', 'game', 'progress_track.png');
    },
    get puppetEmpty() {
      return artAsset('art_v2_game_puppet_empty', 'game', 'progress_puppet_empty.png');
    },
    get puppetFound() {
      return artAsset('art_v2_game_puppet_found', 'game', 'progress_puppet_found.png');
    },
    get treasureModal() {
      return artAsset('art_v2_game_treasure_modal', 'game', 'treasure_modal_bg.png');
    },
    get flashlight() {
      return artAsset('art_v2_game_flashlight', 'game', 'icon_flashlight.png');
    },
  },
  daily: {
    get bg() {
      return artAsset('art_v2_daily_bg', 'daily', 'daily_bg_dark.png');
    },
    get cardFrame() {
      return artAsset('art_v2_daily_card_frame', 'daily', 'daily_card_frame.png');
    },
    get infoPanel() {
      return artAsset('art_v2_daily_info_panel', 'daily', 'daily_info_panel.png');
    },
    get randomButton() {
      return artAsset('art_v2_daily_random_button', 'daily', 'random_button_bg.png');
    },
    get dice() {
      return artAsset('art_v2_daily_dice', 'daily', 'icon_dice.png');
    },
  },
  timeline: {
    get bg() {
      return artAsset('art_v2_timeline_bg', 'timeline', 'timeline_bg_dark.png');
    },
    get axis() {
      return artAsset('art_v2_timeline_axis', 'timeline', 'timeline_axis_line.png');
    },
    get node() {
      return artAsset('art_v2_timeline_node', 'timeline', 'timeline_node_normal.png');
    },
    get nodeActive() {
      return artAsset('art_v2_timeline_node_active', 'timeline', 'timeline_node_active.png');
    },
    get cardCollapsed() {
      return artAsset('art_v2_timeline_card_collapsed', 'timeline', 'timeline_card_collapsed.png');
    },
    get cardExpanded() {
      return artAsset('art_v2_timeline_card_expanded', 'timeline', 'timeline_card_expanded.png');
    },
    get tabActive() {
      return artAsset('art_v2_timeline_tab_active', 'timeline', 'tab_active_bg.png');
    },
    get tabInactive() {
      return artAsset('art_v2_timeline_tab_inactive', 'timeline', 'tab_inactive_bg.png');
    },
  },
};

/** 底部 5 tab：url 已换成 Web 路由 */
export const artNavTabs = [
  { id: 'home', text: '首页', url: '/', icon: 'home' },
  { id: 'map', text: '地图', url: '/select', icon: 'map' },
  { id: 'display', text: '展示', url: '/display', icon: 'display' },
  { id: 'process', text: '工艺', url: '/process', icon: 'process' },
  { id: 'interactive', text: '互动', url: '/interactive', icon: 'game' },
];

export const getProcessFallbackImage = (stepSort = 1) => processStepAsset(stepSort);
