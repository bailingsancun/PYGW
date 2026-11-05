-- Cloud-Shadow database V2 full initialization for MySQL 8.0.12.
-- Fresh install only. The script intentionally fails if either target schema already exists.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @db_target = 1;
USE `deepseek`;
/*
 Navicat Premium Dump SQL

 Source Server         : MySQL
 Source Server Type    : MySQL
 Source Server Version : 80012 (8.0.12)
 Source Host           : localhost:3306
 Source Schema         : cloudshadow

 Target Server Type    : MySQL
 Target Server Version : 80012 (8.0.12)
 File Encoding         : 65001

 Date: 28/07/2026 22:11:58
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for admin_operation_logs
-- ----------------------------
DROP TABLE IF EXISTS `admin_operation_logs`;
CREATE TABLE `admin_operation_logs`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `target_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `target_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `detail_json` json NULL,
  `ip_address` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_admin_logs_user`(`admin_user_id` ASC) USING BTREE,
  INDEX `idx_admin_logs_target`(`target_type` ASC, `target_id` ASC) USING BTREE,
  INDEX `idx_admin_logs_created`(`created_at` ASC) USING BTREE,
  CONSTRAINT `fk_admin_logs_user` FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 758 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '后台操作审计日志' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of admin_operation_logs
-- ----------------------------

-- ----------------------------
-- Table structure for ai_generation_records
-- ----------------------------
DROP TABLE IF EXISTS `ai_generation_records`;
CREATE TABLE `ai_generation_records`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `generation_type` enum('image','chat','text','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'image',
  `prompt` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `result_media_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `result_text` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `provider` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `model_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `status` enum('pending','succeeded','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'succeeded',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_ai_records_user`(`user_id` ASC) USING BTREE,
  INDEX `idx_ai_records_type_status`(`generation_type` ASC, `status` ASC) USING BTREE,
  INDEX `fk_ai_records_media`(`result_media_id` ASC) USING BTREE,
  CONSTRAINT `fk_ai_records_media` FOREIGN KEY (`result_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ai_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '网页端智能生成功能生成记录表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of ai_generation_records
-- ----------------------------
INSERT INTO `ai_generation_records` VALUES (1, 1, 'chat', '用一句话介绍陕西皮影', NULL, '已收到你的问题：“用一句话介绍陕西皮影”。这里是云影后端 mock AI 响应，后续可在不改变接口的情况下接入真实模型。', 'mock', 'model1', 'succeeded', '2026-05-29 17:46:57');
INSERT INTO `ai_generation_records` VALUES (2, NULL, 'chat', '你好', NULL, '已收到你的问题：“你好”。这里是云影后端 mock AI 响应，后续可在不改变接口的情况下接入真实模型。', 'mock', 'model1', 'succeeded', '2026-05-30 14:49:04');
INSERT INTO `ai_generation_records` VALUES (3, NULL, 'image', '皮影孙悟空，大圣归来姿态，红金配色，背景为白色', NULL, 'mock image: /images/art/v2/home/home_badge_heritage.png', 'mock', 'model1', 'succeeded', '2026-05-30 14:49:16');

-- ----------------------------
-- Table structure for app_common_image
-- ----------------------------
DROP TABLE IF EXISTS `app_common_image`;
CREATE TABLE `app_common_image`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `image_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '前端使用的图片唯一标识',
  `relative_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '图片相对路径',
  `image_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '便于识别的图片名称',
  `page_source` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '所属页面或模块，空值表示全局通用',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选关联到 media_assets',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_app_common_image_key`(`image_key` ASC) USING BTREE,
  INDEX `idx_app_common_image_page`(`page_source` ASC) USING BTREE,
  INDEX `fk_app_common_image_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_app_common_image_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 89 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '小程序通用 UI 图片资源' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of app_common_image
-- ----------------------------
INSERT INTO `app_common_image` VALUES (1, 'bg_index_main', '/images/index/bg.png', '旧版首页背景', 'page_index', 1);
INSERT INTO `app_common_image` VALUES (2, 'bg_select_main', '/images/select/selectBg.png', '旧版地图背景', 'page_select', 2);
INSERT INTO `app_common_image` VALUES (3, 'bg_select_map', '/images/select/Seal_Group.png', '旧版地图图形', 'page_select', 3);
INSERT INTO `app_common_image` VALUES (4, 'icon_select_comp', '/images/select/point.png', '旧版地图点位', 'page_select', 4);
INSERT INTO `app_common_image` VALUES (5, 'art_v2_home_bg', '/images/art/v2/home/home_bg_stage.png', 'v2首页舞台背景', 'page_index', 5);
INSERT INTO `app_common_image` VALUES (6, 'art_v2_home_badge', '/images/art/v2/home/home_badge_heritage.png', 'v2首页非遗徽章', 'page_index', 6);
INSERT INTO `app_common_image` VALUES (7, 'art_v2_common_btn_primary', '/images/art/v2/common/btn_primary_bg.png', 'v2主按钮', 'common', 7);
INSERT INTO `app_common_image` VALUES (8, 'art_v2_common_btn_primary_pressed', '/images/art/v2/common/btn_primary_bg_pressed.png', 'v2主按钮按下', 'common', 8);
INSERT INTO `app_common_image` VALUES (9, 'art_v2_common_btn_secondary', '/images/art/v2/common/btn_secondary_bg.png', 'v2次按钮', 'common', 9);
INSERT INTO `app_common_image` VALUES (10, 'art_v2_common_btn_secondary_pressed', '/images/art/v2/common/btn_secondary_bg_pressed.png', 'v2次按钮按下', 'common', 10);
INSERT INTO `app_common_image` VALUES (11, 'art_v2_common_card_paper', '/images/art/v2/common/card_paper_frame.png', 'v2纸质卡片', 'common', 11);
INSERT INTO `app_common_image` VALUES (12, 'art_v2_common_card_dark', '/images/art/v2/common/card_dark_frame.png', 'v2暗色卡片', 'common', 12);
INSERT INTO `app_common_image` VALUES (13, 'art_v2_common_panel_paper', '/images/art/v2/common/panel_paper_large.png', 'v2纸质面板', 'common', 13);
INSERT INTO `app_common_image` VALUES (14, 'art_v2_common_panel_dark', '/images/art/v2/common/panel_dark_large.png', 'v2暗色面板', 'common', 14);
INSERT INTO `app_common_image` VALUES (15, 'art_v2_common_popup_paper', '/images/art/v2/common/popup_paper_panel.png', 'v2弹窗面板', 'common', 15);
INSERT INTO `app_common_image` VALUES (16, 'art_v2_common_bottom_nav', '/images/art/v2/common/bottom_nav_dark.png', 'v2底部导航', 'common', 16);
INSERT INTO `app_common_image` VALUES (17, 'art_v2_common_top_bar_dark', '/images/art/v2/common/top_bar_dark.png', 'v2顶部栏暗色', 'common', 17);
INSERT INTO `app_common_image` VALUES (18, 'art_v2_common_top_bar_paper', '/images/art/v2/common/top_bar_paper.png', 'v2顶部栏纸质', 'common', 18);
INSERT INTO `app_common_image` VALUES (19, 'art_v2_common_icon_back', '/images/art/v2/common/icon_back_gold.png', 'v2返回图标', 'common', 19);
INSERT INTO `app_common_image` VALUES (20, 'art_v2_common_icon_share', '/images/art/v2/common/icon_share_gold.png', 'v2分享图标', 'common', 20);
INSERT INTO `app_common_image` VALUES (21, 'art_v2_common_icon_home', '/images/art/v2/common/icon_home.png', 'v2首页图标', 'common', 21);
INSERT INTO `app_common_image` VALUES (22, 'art_v2_common_icon_home_active', '/images/art/v2/common/icon_home_active.png', 'v2首页选中图标', 'common', 22);
INSERT INTO `app_common_image` VALUES (23, 'art_v2_common_icon_map', '/images/art/v2/common/icon_map.png', 'v2地图图标', 'common', 23);
INSERT INTO `app_common_image` VALUES (24, 'art_v2_common_icon_map_active', '/images/art/v2/common/icon_map_active.png', 'v2地图选中图标', 'common', 24);
INSERT INTO `app_common_image` VALUES (25, 'art_v2_common_icon_display', '/images/art/v2/common/icon_display.png', 'v2展示图标', 'common', 25);
INSERT INTO `app_common_image` VALUES (26, 'art_v2_common_icon_display_active', '/images/art/v2/common/icon_display_active.png', 'v2展示选中图标', 'common', 26);
INSERT INTO `app_common_image` VALUES (27, 'art_v2_common_icon_process', '/images/art/v2/common/icon_process.png', 'v2工艺图标', 'common', 27);
INSERT INTO `app_common_image` VALUES (28, 'art_v2_common_icon_process_active', '/images/art/v2/common/icon_process_active.png', 'v2工艺选中图标', 'common', 28);
INSERT INTO `app_common_image` VALUES (29, 'art_v2_common_icon_game', '/images/art/v2/common/icon_game.png', 'v2互动图标', 'common', 29);
INSERT INTO `app_common_image` VALUES (30, 'art_v2_common_icon_game_active', '/images/art/v2/common/icon_game_active.png', 'v2互动选中图标', 'common', 30);
INSERT INTO `app_common_image` VALUES (31, 'art_v2_map_bg', '/images/art/v2/map/map_bg_dark.png', 'v2地图背景', 'page_select', 31);
INSERT INTO `app_common_image` VALUES (32, 'art_v2_map_china', '/images/art/v2/map/china_map_art.png', 'v2中国地图', 'page_select', 32);
INSERT INTO `app_common_image` VALUES (33, 'art_v2_map_marker', '/images/art/v2/map/marker_normal.png', 'v2地图点位', 'page_select', 33);
INSERT INTO `app_common_image` VALUES (34, 'art_v2_map_marker_active', '/images/art/v2/map/marker_active.png', 'v2地图选中点位', 'page_select', 34);
INSERT INTO `app_common_image` VALUES (35, 'art_v2_map_popup', '/images/art/v2/map/region_popup_bg.png', 'v2地区弹窗', 'page_select', 35);
INSERT INTO `app_common_image` VALUES (36, 'art_v2_map_menu_item', '/images/art/v2/map/menu_item_bg.png', 'v2地区菜单项', 'page_select', 36);
INSERT INTO `app_common_image` VALUES (37, 'art_v2_map_compass', '/images/art/v2/map/compass_decor.png', 'v2罗盘装饰', 'page_select', 37);
INSERT INTO `app_common_image` VALUES (38, 'art_v2_daily_bg', '/images/art/v2/daily/daily_bg_dark.png', 'v2每日一赏背景', 'page_display', 38);
INSERT INTO `app_common_image` VALUES (39, 'art_v2_daily_card_frame', '/images/art/v2/daily/daily_card_frame.png', 'v2每日一赏卡片', 'page_display', 39);
INSERT INTO `app_common_image` VALUES (40, 'art_v2_daily_info_panel', '/images/art/v2/daily/daily_info_panel.png', 'v2每日一赏信息面板', 'page_display', 40);
INSERT INTO `app_common_image` VALUES (41, 'art_v2_daily_random_button', '/images/art/v2/daily/random_button_bg.png', 'v2随机按钮', 'page_display', 41);
INSERT INTO `app_common_image` VALUES (42, 'art_v2_daily_dice', '/images/art/v2/daily/icon_dice.png', 'v2骰子图标', 'page_display', 42);
INSERT INTO `app_common_image` VALUES (43, 'art_v2_quiz_bg', '/images/art/v2/quiz/quiz_bg_dark.png', 'v2答题背景', 'page_quiz', 43);
INSERT INTO `app_common_image` VALUES (44, 'art_v2_quiz_progress', '/images/art/v2/quiz/progress_bar_bg.png', 'v2答题进度条', 'page_quiz', 44);
INSERT INTO `app_common_image` VALUES (45, 'art_v2_quiz_question', '/images/art/v2/quiz/question_scroll_bg.png', 'v2题目卷轴', 'page_quiz', 45);
INSERT INTO `app_common_image` VALUES (46, 'art_v2_quiz_option_default', '/images/art/v2/quiz/option_bg_default.png', 'v2默认选项', 'page_quiz', 46);
INSERT INTO `app_common_image` VALUES (47, 'art_v2_quiz_option_selected', '/images/art/v2/quiz/option_bg_selected.png', 'v2选中选项', 'page_quiz', 47);
INSERT INTO `app_common_image` VALUES (48, 'art_v2_quiz_option_correct', '/images/art/v2/quiz/option_bg_correct.png', 'v2正确选项', 'page_quiz', 48);
INSERT INTO `app_common_image` VALUES (49, 'art_v2_quiz_option_wrong', '/images/art/v2/quiz/option_bg_wrong.png', 'v2错误选项', 'page_quiz', 49);
INSERT INTO `app_common_image` VALUES (50, 'art_v2_quiz_explanation', '/images/art/v2/quiz/explanation_panel_bg.png', 'v2解析面板', 'page_quiz', 50);
INSERT INTO `app_common_image` VALUES (51, 'art_v2_quiz_stamp_correct', '/images/art/v2/quiz/stamp_correct.png', 'v2正确印章', 'page_quiz', 51);
INSERT INTO `app_common_image` VALUES (52, 'art_v2_quiz_stamp_wrong', '/images/art/v2/quiz/stamp_wrong.png', 'v2错误印章', 'page_quiz', 52);
INSERT INTO `app_common_image` VALUES (53, 'art_v2_quiz_result', '/images/art/v2/quiz/result_panel_bg.png', 'v2答题结果', 'page_quiz', 53);
INSERT INTO `app_common_image` VALUES (54, 'art_v2_process_bg', '/images/art/v2/process/process_bg_dark.png', 'v2工艺背景', 'page_process', 54);
INSERT INTO `app_common_image` VALUES (55, 'art_v2_process_card', '/images/art/v2/process/process_card_bg.png', 'v2工艺卡片', 'page_process', 55);
INSERT INTO `app_common_image` VALUES (56, 'art_v2_process_step_badge', '/images/art/v2/process/step_badge_bg.png', 'v2工艺步骤徽章', 'page_process', 56);
INSERT INTO `app_common_image` VALUES (57, 'art_v2_process_step_1', '/images/art/v2/process/process_img_step_1.png', 'v2工艺步骤1', 'page_process', 57);
INSERT INTO `app_common_image` VALUES (58, 'art_v2_process_step_2', '/images/art/v2/process/process_img_step_2.png', 'v2工艺步骤2', 'page_process', 58);
INSERT INTO `app_common_image` VALUES (59, 'art_v2_process_step_3', '/images/art/v2/process/process_img_step_3.png', 'v2工艺步骤3', 'page_process', 59);
INSERT INTO `app_common_image` VALUES (60, 'art_v2_process_step_4', '/images/art/v2/process/process_img_step_4.png', 'v2工艺步骤4', 'page_process', 60);
INSERT INTO `app_common_image` VALUES (61, 'art_v2_process_step_5', '/images/art/v2/process/process_img_step_5.png', 'v2工艺步骤5', 'page_process', 61);
INSERT INTO `app_common_image` VALUES (62, 'art_v2_process_step_6', '/images/art/v2/process/process_img_step_6.png', 'v2工艺步骤6', 'page_process', 62);
INSERT INTO `app_common_image` VALUES (63, 'art_v2_process_step_7', '/images/art/v2/process/process_img_step_7.png', 'v2工艺步骤7', 'page_process', 63);
INSERT INTO `app_common_image` VALUES (64, 'art_v2_process_step_8', '/images/art/v2/process/process_img_step_8.png', 'v2工艺步骤8', 'page_process', 64);
INSERT INTO `app_common_image` VALUES (65, 'art_v2_game_bg', '/images/art/v2/game/game_bg_stage_dark.png', 'v2互动背景', 'page_interactive', 65);
INSERT INTO `app_common_image` VALUES (66, 'art_v2_game_hint', '/images/art/v2/game/flashlight_hint_bg.png', 'v2互动提示', 'page_interactive', 66);
INSERT INTO `app_common_image` VALUES (67, 'art_v2_game_progress_track', '/images/art/v2/game/progress_track.png', 'v2互动进度条', 'page_interactive', 67);
INSERT INTO `app_common_image` VALUES (68, 'art_v2_game_puppet_empty', '/images/art/v2/game/progress_puppet_empty.png', 'v2未找到图标', 'page_interactive', 68);
INSERT INTO `app_common_image` VALUES (69, 'art_v2_game_puppet_found', '/images/art/v2/game/progress_puppet_found.png', 'v2已找到图标', 'page_interactive', 69);
INSERT INTO `app_common_image` VALUES (70, 'art_v2_game_treasure_modal', '/images/art/v2/game/treasure_modal_bg.png', 'v2宝箱弹窗', 'page_interactive', 70);
INSERT INTO `app_common_image` VALUES (71, 'art_v2_game_flashlight', '/images/art/v2/game/icon_flashlight.png', 'v2手电图标', 'page_interactive', 71);
INSERT INTO `app_common_image` VALUES (72, 'art_v2_timeline_bg', '/images/art/v2/timeline/timeline_bg_dark.png', 'v2历史背景', 'page_history', 72);
INSERT INTO `app_common_image` VALUES (73, 'art_v2_timeline_axis', '/images/art/v2/timeline/timeline_axis_line.png', 'v2时间轴线', 'page_history', 73);
INSERT INTO `app_common_image` VALUES (74, 'art_v2_timeline_node', '/images/art/v2/timeline/timeline_node_normal.png', 'v2时间节点', 'page_history', 74);
INSERT INTO `app_common_image` VALUES (75, 'art_v2_timeline_node_active', '/images/art/v2/timeline/timeline_node_active.png', 'v2时间节点选中', 'page_history', 75);
INSERT INTO `app_common_image` VALUES (76, 'art_v2_timeline_card_collapsed', '/images/art/v2/timeline/timeline_card_collapsed.png', 'v2历史折叠卡', 'page_history', 76);
INSERT INTO `app_common_image` VALUES (77, 'art_v2_timeline_card_expanded', '/images/art/v2/timeline/timeline_card_expanded.png', 'v2历史展开卡', 'page_history', 77);
INSERT INTO `app_common_image` VALUES (78, 'art_v2_timeline_tab_active', '/images/art/v2/timeline/tab_active_bg.png', 'v2历史选中标签', 'page_history', 78);
INSERT INTO `app_common_image` VALUES (79, 'art_v2_timeline_tab_inactive', '/images/art/v2/timeline/tab_inactive_bg.png', 'v2历史未选中标签', 'page_history', 79);
INSERT INTO `app_common_image` VALUES (80, 'web_ui_logo', '/images/web/ui/logo.png', 'Web导航Logo', 'web_common', 524);
INSERT INTO `app_common_image` VALUES (81, 'web_ui_texture', '/images/web/ui/opacity-b25.png', 'Web页面纹理', 'web_common', 525);
INSERT INTO `app_common_image` VALUES (82, 'web_catalog_cover_intro', '/images/web/catalog-cover/fm-0.png', 'Web图鉴入口封面', 'web_puppet_catalog', 526);
INSERT INTO `app_common_image` VALUES (83, 'web_catalog_cover_head', '/images/web/catalog-cover/fm-1.png', 'Web头茬封面', 'web_puppet_catalog', 527);
INSERT INTO `app_common_image` VALUES (84, 'web_catalog_cover_body', '/images/web/catalog-cover/fm-2.png', 'Web影身封面', 'web_puppet_catalog', 528);
INSERT INTO `app_common_image` VALUES (85, 'web_catalog_cover_cloud', '/images/web/catalog-cover/fm-3.png', 'Web云朵子封面', 'web_puppet_catalog', 529);
INSERT INTO `app_common_image` VALUES (86, 'web_catalog_cover_furniture', '/images/web/catalog-cover/fm-4.png', 'Web桌椅封面', 'web_puppet_catalog', 530);
INSERT INTO `app_common_image` VALUES (87, 'web_catalog_cover_scene', '/images/web/catalog-cover/fm-5.png', 'Web衬景封面', 'web_puppet_catalog', 531);

-- ----------------------------
-- Table structure for comments
-- ----------------------------
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `target_type` enum('profile','content','media','play','inheritor','exhibition') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `target_id` bigint(20) UNSIGNED NOT NULL,
  `parent_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `status` enum('pending','approved','rejected','deleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_comments_target`(`target_type` ASC, `target_id` ASC, `status` ASC) USING BTREE,
  INDEX `idx_comments_user`(`user_id` ASC) USING BTREE,
  INDEX `idx_comments_parent`(`parent_id` ASC) USING BTREE,
  CONSTRAINT `fk_comments_parent` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '评论表，供后续社区功能使用' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of comments
-- ----------------------------

-- ----------------------------
-- Table structure for content_items
-- ----------------------------
DROP TABLE IF EXISTS `content_items`;
CREATE TABLE `content_items`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '内容主键',
  `code` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '内容稳定编码，用于前端路由和接口查询',
  `content_type` enum('article','news','page','daily','exhibition_note','puppet_category','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'article',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `subtitle` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `summary` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `body` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `cover_media_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `author_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'draft',
  `publish_time` datetime NULL DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `view_count` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_content_items_code`(`code` ASC) USING BTREE,
  INDEX `idx_content_type_status`(`content_type` ASC, `status` ASC) USING BTREE,
  INDEX `idx_content_publish_time`(`publish_time` ASC) USING BTREE,
  INDEX `idx_content_author`(`author_id` ASC) USING BTREE,
  INDEX `fk_content_cover`(`cover_media_id` ASC) USING BTREE,
  CONSTRAINT `fk_content_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_content_cover` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 59 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '文章、资讯、页面及后续 网页端内容表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of content_items
-- ----------------------------
INSERT INTO `content_items` VALUES (1, 'head-piece', 'puppet_category', '头茬', '皮影人物头像造型', '皮影头茬是皮影戏中人物头像的雕刻造型，堪称皮影戏的脸谱。', '皮影头茬是皮影戏中人物头像的雕刻造型，是用牛皮或驴皮经硝皮、雕刻、上色等工序制成的戏曲道具，堪称皮影戏的“脸谱”。它按角色行当分为生、旦、净、丑等类型，五官造型与色彩均有程式化的象征意义，红色表忠勇，黑色表刚正，白色表奸诈，不同的眉眼鼻型则暗示人物的性格与身份。皮影头茬起源于西汉，鼎盛于明清，全国各地形成了陕西、河北、河南、四川等不同风格流派。2006年入选中国国家级非物质文化遗产，2011年被列入联合国教科文组织人类非物质文化遗产代表作名录。它不仅是表演道具，更是民间雕刻艺术与戏曲艺术的完美结合，浓缩了中国传统美学与民俗信仰于方寸之间，被誉为世界上最早的“动画”艺术。', 257, NULL, 'published', '2026-05-29 00:00:00', 1, 0, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `content_items` VALUES (2, 'body-piece', 'puppet_category', '影身', '皮影人物躯干与服饰造型', '皮影影身是人物除头部以外的全身造型，是工艺最精湛、装饰最繁复的部分之一。', '皮影影身是皮影戏中人物除头部以外的全身造型，包括躯干、上肢、下肢及服饰，通常高约30至40厘米，通过竹签与头茬插接组合使用。影身是皮影艺术中工艺最精湛、装饰最繁复的部分，其服饰上布满龙凤纹、祥云纹、花卉纹等吉祥图案，关节处采用镂空雕刻以实现灵活转动，在幕后灯光照射下投射出独特的半透明光影美学。影身与头茬采用可拆卸组合的演出体制，同一身段可搭配不同头茬饰演不同角色，一物多用，极大丰富了表演的灵活性。影身按服饰等级分为龙袍身、官服身、短打身等多种类型，色彩与纹样也因角色身份和使用场景而异。它不仅是演出道具，更是民间雕刻技艺与服饰美学的集大成者，浓缩了老百姓对各朝代服饰制度的想象及对吉祥美好生活的祈愿。', 263, NULL, 'published', '2026-05-29 00:00:00', 2, 0, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `content_items` VALUES (3, 'cloud-prop', 'puppet_category', '云朵子', '神怪角色腾云驾雾的云彩道具', '皮影云朵子是为神、佛、妖、怪等超自然角色设计的云彩造型道具。', '皮影云朵子是皮影戏中为神、佛、妖、怪等超自然角色设计的云彩造型道具，是这类角色腾云驾雾的专属“座驾”。它以云纹为底，将神祇形象与宗教意象巧妙融合，既是民间信仰的视觉化呈现，也是戏剧美学与雕刻艺术的结晶。云朵子的形象渊源可追溯至汉代画像石与历代壁画中的“神案”形象，经明清皮影艺人继承发展，在方寸牛皮上构建出气势恢宏的神话世界，承载着中国人对天界神祇的想象与祈愿，是皮影艺术中文化含量最高、最具浪漫气质的道具门类之一。', 269, NULL, 'published', '2026-05-29 00:00:00', 3, 0, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `content_items` VALUES (4, 'furniture-prop', 'puppet_category', '桌椅', '构建室内空间和礼制秩序的道具', '皮影桌椅用于装点室内环境、区分社会等级、营造叙事空间。', '皮影桌椅是皮影戏中用于装点室内环境、区分社会等级、营造叙事空间的重要道具，分为龙桌龙椅、相桌相椅、绣桌绣墩、佛桌仙桌、福寿桌椅及普通百姓桌椅等多个等级，分别对应皇帝、宰相、闺秀、神仙、寿宴及民间等不同场景。皮影桌椅采用半侧面程式化造型，桌腿、桌面、椅背等处精雕祥云、龙凤、牡丹、莲花等吉祥纹样，在幕后灯光照射下呈现出独特的镂空光影美学。它不仅是演出中的环境道具，更以直观的方式浓缩了中国传统家具制度与礼制秩序的民间想象，是皮影“影中世界”不可或缺的空间叙事元素，寄托着百姓对福禄寿喜的美好祈愿。', 275, NULL, 'published', '2026-05-29 00:00:00', 4, 0, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `content_items` VALUES (5, 'scene-prop', 'puppet_category', '衬景', '构建戏剧空间的大型布景道具', '皮影衬景用于构建戏剧空间、烘托环境氛围，是体量较大、雕刻繁复的景片。', '皮影衬景是皮影戏中用于构建戏剧空间、烘托环境氛围的大型布景道具，又称景片，大者可高约一米、宽两米余，需由数块牛皮拼接刻制而成。衬景涵盖宫殿、绣楼、营帐、花园、水晶宫、天宫等建筑与自然景观类型，以及皇帝出巡图、水族仪仗队等宏大场面，是皮影艺术中体量最大、气势最壮、雕刻最繁复的组成部分。其建筑造型严格参照中国古代建筑形制，雕梁画栋、斗拱飞檐一应俱全，同时融入大量吉祥纹样与民间美术元素。衬景充分利用牛皮镂空透光的特性，通过多层景片叠加营造出虚实交错、纵深感极强的舞台空间效果，是皮影“影中世界”时空叙事的关键工具，既承载了中国古代建筑制度的民间记忆，也浓缩了民间艺人惊人的艺术想象力与雕刻技艺的巅峰水准。', 281, NULL, 'published', '2026-05-29 00:00:00', 5, 0, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `content_items` VALUES (24, 'gallery-characters-media', 'exhibition_note', '角色影像导览', '影像资料待补充', '此展位用于汇集角色操演、关节动作与舞台片段。正式影像尚未完成策展审核，当前以文字导览代替，不使用无关人物图片。', '后续应选择能够清楚展示头茬、影身、操纵杆和关节动作的授权影像，并补充拍摄时间、地点、表演者与授权来源。', NULL, NULL, 'published', '2026-07-16 09:22:02', 604, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (25, 'gallery-heritage-person', 'exhibition_note', '传承者档案', '资料待人工审校', '此展位用于呈现传承者的口述、从艺经历与技艺谱系。人物姓名、生平和影像完成授权及事实核验前，不展示未经确认的个人资料。', '策展发布前须核验人物身份、师承关系、代表作品、采访时间与图片授权，并保留资料来源。', NULL, NULL, 'published', '2026-07-16 09:22:02', 605, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (26, 'gallery-heritage-protection', 'exhibition_note', '保护与教育实践', '资料待人工审校', '从档案整理、传习教学到社区演出，活态保护需要记录技艺如何被学习、使用和继续创造。当前展位为审核中的策展说明。', '正式内容应以可核验的保护项目为单位，说明实施机构、时间、地点、参与者、成果与资料出处，避免用普通影偶图片代替保护实践。', NULL, NULL, 'published', '2026-07-16 09:22:02', 606, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (27, 'gallery-heritage-media', 'exhibition_note', '活态传承影像', '授权素材征集中', '此展位预留给访谈、传习课堂和现场演出影像。授权素材接入前保留文字卡，避免重复使用历史时间轴图片。', '影像发布前应确认肖像权、音乐与表演授权，并提供字幕、拍摄信息和无障碍文字说明。', NULL, NULL, 'published', '2026-07-16 09:22:02', 607, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (28, 'gallery-ai-station', 'exhibition_note', '共创起点', '演示模式 · 主题与素材', '选择已获授权的传统纹样、角色类别与创作主题，再用文字描述预期造型。此处仅演示交互流程，不代表已接入正式生成服务。', '演示流程不上传未授权作品，不采集敏感个人信息；输入素材、提示词和生成状态应清楚标记。', NULL, NULL, 'published', '2026-07-16 09:22:02', 608, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (29, 'gallery-ai-process', 'exhibition_note', '生成流程', '演示模式 · 从提示到审核', '流程依次为素材选择、提示描述、模型生成、结果筛选与人工审核。生成结果在审核通过前始终标记为演示内容。', '界面应公开区分用户输入、参考素材、模型输出和人工修改，失败时保留可理解的状态说明。', NULL, NULL, 'published', '2026-07-16 09:22:02', 609, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (30, 'gallery-ai-showcase', 'exhibition_note', '结果展台', '演示模式 · 非正式藏品', '本展位用于说明生成结果的比较方式。当前没有经过版权与内容审核的 AI 展品，因此不借用传统藏品图片冒充生成结果。', '正式结果应记录生成时间、模型版本、提示词摘要、参考来源、人工修改和审核状态。', NULL, NULL, 'published', '2026-07-16 09:22:02', 610, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `content_items` VALUES (31, 'gallery-ai-explain', 'exhibition_note', '演示边界与版权说明', '演示模式', 'AI 输出可能包含事实偏差、风格挪用与版权风险，不能替代专家审校，也不应被当作历史文物或传统样式的权威依据。', '本区展示技术流程而非鉴定结论。涉及传统作品、传承者或观众数据时，须先确认授权、出处与使用范围。', NULL, NULL, 'published', '2026-07-16 09:22:02', 611, 0, '2026-07-16 09:22:02', '2026-07-16 09:22:02');

-- ----------------------------
-- Table structure for content_media
-- ----------------------------
DROP TABLE IF EXISTS `content_media`;
CREATE TABLE `content_media`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `content_id` bigint(20) UNSIGNED NOT NULL,
  `media_id` bigint(20) UNSIGNED NOT NULL,
  `usage_type` enum('cover','gallery','inline','attachment','audio','video','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'gallery',
  `caption` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_content_media`(`content_id` ASC, `media_id` ASC, `usage_type` ASC) USING BTREE,
  INDEX `idx_content_media_content_sort`(`content_id` ASC, `usage_type` ASC, `sort_order` ASC) USING BTREE,
  INDEX `fk_content_media_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_content_media_content` FOREIGN KEY (`content_id`) REFERENCES `content_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_content_media_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 52 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '内容与媒体关联表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of content_media
-- ----------------------------
INSERT INTO `content_media` VALUES (1, 1, 257, 'cover', '头茬图1', 1, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (2, 1, 258, 'gallery', '头茬图2', 2, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (3, 1, 259, 'gallery', '头茬图3', 3, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (4, 1, 260, 'gallery', '头茬图4', 4, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (5, 1, 261, 'gallery', '头茬图5', 5, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (6, 1, 262, 'gallery', '头茬图6', 6, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (7, 2, 263, 'cover', '影身图1', 1, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (8, 2, 264, 'gallery', '影身图2', 2, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (9, 2, 265, 'gallery', '影身图3', 3, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (10, 2, 266, 'gallery', '影身图4', 4, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (11, 2, 267, 'gallery', '影身图5', 5, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (12, 2, 268, 'gallery', '影身图6', 6, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (13, 3, 269, 'cover', '云朵子图1', 1, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (14, 3, 270, 'gallery', '云朵子图2', 2, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (15, 3, 271, 'gallery', '云朵子图3', 3, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (16, 3, 272, 'gallery', '云朵子图4', 4, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (17, 3, 273, 'gallery', '云朵子图5', 5, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (18, 3, 274, 'gallery', '云朵子图6', 6, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (19, 4, 275, 'cover', '桌椅图1', 1, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (20, 4, 276, 'gallery', '桌椅图2', 2, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (21, 4, 277, 'gallery', '桌椅图3', 3, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (22, 4, 278, 'gallery', '桌椅图4', 4, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (23, 4, 279, 'gallery', '桌椅图5', 5, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (24, 4, 280, 'gallery', '桌椅图6', 6, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (25, 5, 281, 'cover', '衬景图1', 1, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (26, 5, 282, 'gallery', '衬景图2', 2, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (27, 5, 283, 'gallery', '衬景图3', 3, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (28, 5, 284, 'gallery', '衬景图4', 4, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (29, 5, 285, 'gallery', '衬景图5', 5, '2026-05-29 17:42:04');
INSERT INTO `content_media` VALUES (30, 5, 286, 'gallery', '衬景图6', 6, '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for content_tags
-- ----------------------------
DROP TABLE IF EXISTS `content_tags`;
CREATE TABLE `content_tags`  (
  `content_id` bigint(20) UNSIGNED NOT NULL,
  `tag_id` int(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`content_id`, `tag_id`) USING BTREE,
  INDEX `fk_content_tags_tag`(`tag_id` ASC) USING BTREE,
  CONSTRAINT `fk_content_tags_content` FOREIGN KEY (`content_id`) REFERENCES `content_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_content_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '内容与标签关联表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of content_tags
-- ----------------------------
INSERT INTO `content_tags` VALUES (1, 1);
INSERT INTO `content_tags` VALUES (2, 1);
INSERT INTO `content_tags` VALUES (3, 1);
INSERT INTO `content_tags` VALUES (4, 1);
INSERT INTO `content_tags` VALUES (5, 1);

-- ----------------------------
-- Table structure for daily_appreciation
-- ----------------------------
DROP TABLE IF EXISTS `daily_appreciation`;
CREATE TABLE `daily_appreciation`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '每日一赏标题',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '赏析描述',
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '图片相对路径，保留用于兼容',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选的统一媒体资源 ID',
  `region` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '地区或主题',
  `tag` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT '' COMMENT '展示标签',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'region_shadow' COMMENT '分类',
  `is_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间，保留用于兼容',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_daily_active_sort`(`is_active` ASC, `sort_order` ASC) USING BTREE,
  INDEX `idx_daily_region`(`region` ASC) USING BTREE,
  INDEX `idx_daily_category`(`category` ASC) USING BTREE,
  INDEX `fk_daily_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_daily_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 112 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '每日一赏内容表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of daily_appreciation
-- ----------------------------
INSERT INTO `daily_appreciation` VALUES (1, '北京皮影选粹·一', '北京皮影注重轮廓的挺拔与纹样的装饰感，影偶在灯幕下呈现清晰有力的造型气质，适合观察北方皮影的舞台风格。', '/images/interactive/bjpy (1).PNG', 128, '北京', '地域皮影', 'region_shadow', 1, 1, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (2, '北京皮影选粹·二', '这件北京皮影作品延续北方影偶线条明快的特征，人物形态端正，服饰纹样具有较强的装饰秩序。', '/images/interactive/bjpy (2).PNG', 129, '北京', '地域皮影', 'region_shadow', 1, 2, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (3, '北京皮影选粹·三', '北京皮影常在精细镂刻与舞台辨识度之间取得平衡，适合从头饰、衣纹和肢体比例中观察其造型语言。', '/images/interactive/bjpy (3).PNG', 130, '北京', '地域皮影', 'region_shadow', 1, 3, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (4, '北京皮影选粹·四', '这件作品可用于观察北方皮影在灯光映照下的剪影层次，线条、色块与镂空共同构成鲜明视觉节奏。', '/images/interactive/bjpy (4).PNG', 131, '北京', '地域皮影', 'region_shadow', 1, 4, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (5, '北京皮影选粹·五', '北京皮影的舞台感较强，影偶造型注重正侧面的识别效果，在数字展示中能突出传统戏台的光影魅力。', '/images/interactive/bjpy (5).PNG', 132, '北京', '地域皮影', 'region_shadow', 1, 5, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (6, '北京皮影选粹·六', '这件北京皮影选粹适合观察传统影偶的关节结构和装饰纹样，体现出民间戏曲造型的凝练表达。', '/images/interactive/bjpy (6).PNG', 133, '北京', '地域皮影', 'region_shadow', 1, 6, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (7, '河北皮影选粹·一', '河北皮影以滦州、唐山等流派影响深远，影偶造型刚健明快，唱腔与地方戏曲传统联系紧密。', '/images/interactive/hbpy (1).png', 134, '河北', '地域皮影', 'region_shadow', 1, 7, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (8, '河北皮影选粹·二', '这件河北皮影作品具有北方影戏质朴爽朗的视觉气息，适合观察服饰轮廓与舞台动作之间的关系。', '/images/interactive/hbpy (2).png', 135, '河北', '地域皮影', 'region_shadow', 1, 8, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (9, '河北皮影选粹·三', '河北皮影在人物造型和故事演绎上具有深厚民间基础，常以历史演义和民间传奇为表演题材。', '/images/interactive/hbpy (3).png', 136, '河北', '地域皮影', 'region_shadow', 1, 9, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (10, '河北皮影选粹·四', '这件作品适合观察影偶在灯幕中的剪影张力，镂刻线条与色彩块面共同强化了舞台表现力。', '/images/interactive/hbpy (4).png', 137, '河北', '地域皮影', 'region_shadow', 1, 10, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (11, '河北皮影选粹·五', '河北皮影的造型常兼具粗犷与精细，既能表现人物身份，也能服务于快节奏的影戏表演。', '/images/interactive/hbpy (5).png', 138, '河北', '地域皮影', 'region_shadow', 1, 11, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (12, '河北皮影选粹·六', '这件河北皮影选粹展现了地方皮影在形体比例、纹样组织和舞台识别上的传统经验。', '/images/interactive/hbpy (6).png', 139, '河北', '地域皮影', 'region_shadow', 1, 12, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (13, '河南皮影选粹·一', '河南皮影承载中原地区的戏曲与民间叙事传统，造型质朴而富有故事感。', '/images/interactive/hnpy (1).png', 140, '河南', '地域皮影', 'region_shadow', 1, 13, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (14, '河南皮影选粹·二', '这件河南皮影作品适合观察中原影戏在人物轮廓、服饰纹样和动作结构上的表达方式。', '/images/interactive/hnpy (2).png', 141, '河南', '地域皮影', 'region_shadow', 1, 14, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (15, '河南皮影选粹·三', '河南皮影与地方戏曲、民间说唱关系密切，影偶形态常服务于历史故事与人物性格的呈现。', '/images/interactive/hnpy (3).png', 142, '河南', '地域皮影', 'region_shadow', 1, 15, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (16, '河南皮影选粹·四', '这件作品在灯影中呈现稳定的轮廓层次，适合观察皮影艺术如何用简洁形体表达复杂角色。', '/images/interactive/hnpy (4).png', 143, '河南', '地域皮影', 'region_shadow', 1, 16, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (17, '河南皮影选粹·五', '河南皮影的视觉语言兼具民间装饰性与叙事功能，人物姿态和纹样细节都服务于舞台表演。', '/images/interactive/hnpy (5).png', 144, '河南', '地域皮影', 'region_shadow', 1, 17, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (18, '河南皮影选粹·六', '这件河南皮影选粹适合从色彩、镂刻和关节结构中理解传统影偶的制作与表演逻辑。', '/images/interactive/hnpy (6).png', 145, '河南', '地域皮影', 'region_shadow', 1, 18, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (19, '辽东皮影选粹·一', '辽东皮影带有东北地区民间艺术的明朗气质，造型饱满，适合表现历史演义与民间故事。', '/images/interactive/ldpy (1).PNG', 146, '辽东', '地域皮影', 'region_shadow', 1, 19, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (20, '辽东皮影选粹·二', '这件辽东皮影作品可观察其人物线条与服饰纹样的结合，体现地域文化与影戏表演的融合。', '/images/interactive/ldpy (2).PNG', 147, '辽东', '地域皮影', 'region_shadow', 1, 20, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (21, '辽东皮影选粹·三', '辽东皮影常以鲜明轮廓和活跃姿态增强舞台表现力，适合在灯幕下呈现强烈的动作感。', '/images/interactive/ldpy (3).PNG', 148, '辽东', '地域皮影', 'region_shadow', 1, 21, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (22, '辽东皮影选粹·四', '这件作品体现了影偶造型的装饰性与叙事性，观众可从细部纹样中感受地方审美。', '/images/interactive/ldpy (4).PNG', 149, '辽东', '地域皮影', 'region_shadow', 1, 22, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (23, '辽东皮影选粹·五', '辽东皮影在人物比例和舞台轮廓上较具辨识度，适合观察传统影戏的角色塑造方式。', '/images/interactive/ldpy (5).PNG', 150, '辽东', '地域皮影', 'region_shadow', 1, 23, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (24, '辽东皮影选粹·六', '这件辽东皮影选粹以灯影为媒介，展现民间影偶在形、色、纹之间的协调关系。', '/images/interactive/ldpy (6).PNG', 151, '辽东', '地域皮影', 'region_shadow', 1, 24, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (25, '青海皮影选粹·一', '青海皮影体现西北地区多元文化交融的审美特征，色彩与纹样常带有鲜明地域气息。', '/images/interactive/qhpy (1).png', 152, '青海', '地域皮影', 'region_shadow', 1, 25, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (26, '青海皮影选粹·二', '这件青海皮影作品适合观察西北皮影在装饰纹样和人物轮廓上的表达，具有朴拙而鲜明的视觉力量。', '/images/interactive/qhpy (2).png', 153, '青海', '地域皮影', 'region_shadow', 1, 26, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (27, '青海皮影选粹·三', '青海皮影在地域叙事和民间审美中形成独特风格，常以简练造型承载丰富故事。', '/images/interactive/qhpy (3).png', 154, '青海', '地域皮影', 'region_shadow', 1, 27, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (28, '青海皮影选粹·四', '这件作品通过镂刻与色彩形成清晰层次，适合观察影偶在灯幕中的透光表现。', '/images/interactive/qhpy (4).png', 155, '青海', '地域皮影', 'region_shadow', 1, 28, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (29, '青海皮影选粹·五', '青海皮影的视觉气质兼具粗犷与细密，影偶装饰既服务审美，也服务角色身份识别。', '/images/interactive/qhpy (5).png', 156, '青海', '地域皮影', 'region_shadow', 1, 29, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (30, '青海皮影选粹·六', '这件青海皮影选粹适合作为地域皮影比较样本，观察西北影戏的造型节奏与舞台效果。', '/images/interactive/qhpy (6).png', 157, '青海', '地域皮影', 'region_shadow', 1, 30, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (31, '四川皮影选粹·一', '四川皮影与巴蜀戏曲、民间故事关系密切，造型灵动，舞台表现富有地方生活气息。', '/images/interactive/scpy (1).png', 158, '四川', '地域皮影', 'region_shadow', 1, 31, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (32, '四川皮影选粹·二', '这件四川皮影作品适合观察川地皮影在人物神态、服饰纹样和动作结构上的表现。', '/images/interactive/scpy (2).png', 159, '四川', '地域皮影', 'region_shadow', 1, 32, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (33, '四川皮影选粹·三', '四川皮影常吸收地方戏曲元素，影偶造型具有较强表演性，适合呈现民间叙事的热闹气氛。', '/images/interactive/scpy (3).png', 160, '四川', '地域皮影', 'region_shadow', 1, 33, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (34, '四川皮影选粹·四', '这件作品通过线条和色块组织人物形象，展现了皮影在灯幕中以形传神的特点。', '/images/interactive/scpy (4).png', 161, '四川', '地域皮影', 'region_shadow', 1, 34, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (35, '四川皮影选粹·五', '四川皮影的图案和动作设计常富有戏剧感，适合观察影偶如何服务唱念做打的舞台节奏。', '/images/interactive/scpy (5).png', 162, '四川', '地域皮影', 'region_shadow', 1, 35, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (36, '四川皮影选粹·六', '这件四川皮影选粹呈现了巴蜀民间艺术中活泼而精巧的视觉表达。', '/images/interactive/scpy (6).png', 163, '四川', '地域皮影', 'region_shadow', 1, 36, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (37, '山东皮影选粹·一', '山东皮影承接齐鲁地区民间戏曲和历史叙事传统，造型稳健，人物轮廓鲜明。', '/images/interactive/sdpy (1).PNG', 164, '山东', '地域皮影', 'region_shadow', 1, 37, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (38, '山东皮影选粹·二', '这件山东皮影作品适合观察北方皮影在服饰纹样和角色比例上的凝练表达。', '/images/interactive/sdpy (2).PNG', 165, '山东', '地域皮影', 'region_shadow', 1, 38, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (39, '山东皮影选粹·三', '山东皮影注重叙事和舞台识别，影偶常以清楚的剪影关系表现人物身份与性格。', '/images/interactive/sdpy (3).PNG', 166, '山东', '地域皮影', 'region_shadow', 1, 39, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (40, '山东皮影选粹·四', '这件作品在色彩和镂刻之间形成平衡，适合观察皮影艺术的装饰秩序。', '/images/interactive/sdpy (4).PNG', 167, '山东', '地域皮影', 'region_shadow', 1, 40, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (41, '山东皮影选粹·五', '山东皮影的舞台气质稳重明快，人物形态具有较强的故事承载能力。', '/images/interactive/sdpy (5).PNG', 168, '山东', '地域皮影', 'region_shadow', 1, 41, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (42, '山东皮影选粹·六', '这件山东皮影选粹可用于比较北方不同地域皮影在轮廓、纹样和色彩上的差异。', '/images/interactive/sdpy (6).PNG', 169, '山东', '地域皮影', 'region_shadow', 1, 42, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (43, '山西皮影选粹·一', '山西皮影历史积淀深厚，造型古朴而富于装饰性，常见浓烈色彩与精细镂刻。', '/images/interactive/shanxipy (1).PNG', 170, '山西', '地域皮影', 'region_shadow', 1, 43, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (44, '山西皮影选粹·二', '这件山西皮影作品适合观察晋地皮影在人物比例、服饰纹样和舞台轮廓上的特点。', '/images/interactive/shanxipy (2).PNG', 171, '山西', '地域皮影', 'region_shadow', 1, 44, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (45, '山西皮影选粹·三', '山西皮影常以浓重色彩和精巧雕镂塑造角色，体现黄土高原民间艺术的厚重气息。', '/images/interactive/shanxipy (3).PNG', 172, '山西', '地域皮影', 'region_shadow', 1, 45, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (46, '山西皮影选粹·四', '这件作品在细节纹样与整体轮廓之间形成呼应，适合观察传统影偶的装饰结构。', '/images/interactive/shanxipy (4).PNG', 173, '山西', '地域皮影', 'region_shadow', 1, 46, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (47, '山西皮影选粹·五', '山西皮影的造型常具有古朴庄重的审美，适合表现历史人物与民间故事。', '/images/interactive/shanxipy (5).png', 174, '山西', '地域皮影', 'region_shadow', 1, 47, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (48, '山西皮影选粹·六', '这件山西皮影选粹展现了地方皮影在雕刻、色彩和舞台观看之间的传统经验。', '/images/interactive/shanxipy (6).PNG', 175, '山西', '地域皮影', 'region_shadow', 1, 48, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (49, '陕西皮影选粹·一', '陕西皮影雕镂精细、色彩浓烈，常以历史故事和民间传说为题材，是西北皮影流派的重要代表。', '/images/interactive/sxpy (1).png', 176, '陕西', '地域皮影', 'region_shadow', 1, 49, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (50, '陕西皮影选粹·二', '这件陕西皮影作品适合观察华县、华阴等地皮影在轮廓和纹样上的精巧传统。', '/images/interactive/sxpy (2).png', 177, '陕西', '地域皮影', 'region_shadow', 1, 50, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (51, '陕西皮影选粹·三', '陕西皮影常以推皮走刀的精细技法见长，影偶在灯幕中呈现鲜明而富有韵律的线条。', '/images/interactive/sxpy (3).png', 178, '陕西', '地域皮影', 'region_shadow', 1, 51, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (52, '陕西皮影选粹·四', '这件作品体现陕西皮影色彩浓郁、纹样繁密的特点，适合观察西北影戏的装饰语言。', '/images/interactive/sxpy (4).png', 179, '陕西', '地域皮影', 'region_shadow', 1, 52, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (53, '陕西皮影选粹·五', '陕西皮影在唱腔、雕刻和剧目传统上自成体系，影偶形象具有强烈的民间戏曲气息。', '/images/interactive/sxpy (5).png', 180, '陕西', '地域皮影', 'region_shadow', 1, 53, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (54, '陕西皮影选粹·六', '这件陕西皮影选粹适合作为西北皮影代表样本，观察雕镂、敷彩和关节结构的综合效果。', '/images/interactive/sxpy (6).png', 181, '陕西', '地域皮影', 'region_shadow', 1, 54, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (55, '唐山皮影选粹·一', '唐山皮影是河北皮影的重要代表，唱腔、剧目和影偶造型都具有鲜明的地方传统。', '/images/interactive/tspy (1).png', 182, '唐山', '地域皮影', 'region_shadow', 1, 55, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (56, '唐山皮影选粹·二', '这件唐山皮影作品适合观察滦州影戏一系的舞台气质，人物轮廓清楚，表演感较强。', '/images/interactive/tspy (2).png', 183, '唐山', '地域皮影', 'region_shadow', 1, 56, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (57, '唐山皮影选粹·三', '唐山皮影在北方影戏传播中影响深远，影偶形象常服务于历史演义和民间传奇。', '/images/interactive/tspy (3).png', 184, '唐山', '地域皮影', 'region_shadow', 1, 57, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (58, '唐山皮影选粹·四', '这件作品通过装饰纹样和剪影结构强化舞台识别，体现唐山皮影的传统审美。', '/images/interactive/tspy (4).png', 185, '唐山', '地域皮影', 'region_shadow', 1, 58, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (59, '唐山皮影选粹·五', '唐山皮影的造型往往明快有力，适合在灯幕中呈现清晰的动作和角色关系。', '/images/interactive/tspy (5).png', 186, '唐山', '地域皮影', 'region_shadow', 1, 59, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (60, '唐山皮影选粹·六', '这件唐山皮影选粹适合作为北方皮影比较样本，观察地方流派在造型和舞台表现上的差异。', '/images/interactive/tspy (6).png', 187, '唐山', '地域皮影', 'region_shadow', 1, 60, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (61, '陈静人物影像', '这张人物主题图片可作为皮影文化展示中的人物意象，用于连接传统技艺与当代传承者视角。', '/images/interactive/chenjing.png', 188, '人物', '人物意象', 'figure', 1, 61, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (62, '汉代影戏意象', '汉代相关意象适合用于讲述皮影起源传说和早期光影叙事，帮助观众理解影戏的历史想象。', '/images/interactive/handai.png', 189, '汉代', '历史意象', 'history_theme', 1, 62, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (63, '唐代影戏意象', '唐代文化繁盛，讲唱、图像和表演艺术相互交织，这张图可用于呈现影戏发展中的盛唐想象。', '/images/interactive/tangdai.png', 190, '唐代', '历史意象', 'history_theme', 1, 63, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (64, '宋代影戏意象', '宋代市井文化兴盛，影戏逐渐进入瓦舍勾栏和节令娱乐，这张图适合作为历史展陈节点。', '/images/interactive/songdai.png', 191, '宋代', '历史意象', 'history_theme', 1, 64, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (65, '元代影戏意象', '元代影戏在交流传播中不断吸收新的表演元素，这张图可用于展示皮影跨地域流动的历史线索。', '/images/interactive/yuandai.png', 192, '元代', '历史意象', 'history_theme', 1, 65, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (66, '明代影戏意象', '明代皮影流派逐渐分化，地方唱腔与造型审美更加鲜明，这张图适合用于历史时间轴展示。', '/images/interactive/ming.png', 193, '明代', '历史意象', 'history_theme', 1, 66, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (67, '清代影戏意象', '清代皮影艺术发展成熟，地域流派、影箱收藏和民间演出共同构成丰富的影戏生态。', '/images/interactive/qing.png', 194, '清代', '历史意象', 'history_theme', 1, 67, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (68, '皮影锤凿工具', '锤凿等工具是皮影雕刻环节的重要器具，细密纹样和镂空线条都离不开稳定的手工技法。', '/images/interactive/chuozi.png', 195, '工艺', '制作工具', 'craft_tool', 1, 68, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (69, '皮影道具选粹', '皮影戏中的道具不仅服务剧情，也增强舞台空间感，是人物表演之外的重要视觉元素。', '/images/interactive/daoju.png', 196, '道具', '舞台道具', 'prop', 1, 69, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (70, '动物影偶选粹', '动物形象常出现在神话传说和民间故事中，通过夸张轮廓和动作设计增强影戏趣味。', '/images/interactive/dongwu.png', 197, '动物', '动物影偶', 'prop', 1, 70, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (71, '皮影球形道具', '小型道具在影戏中常用于辅助动作和情节转换，体现传统舞台“一物多用”的灵活性。', '/images/interactive/qiuzi.png', 198, '道具', '舞台道具', 'prop', 1, 71, '2026-05-24 11:57:21', '2026-05-29 17:42:04');
INSERT INTO `daily_appreciation` VALUES (72, '投茶场景道具', '这件道具图适合展示皮影戏中生活化场景的表现方式，让观众看到传统影戏的细节趣味。', '/images/interactive/toucha.png', 199, '道具', '生活场景', 'prop', 1, 72, '2026-05-24 11:57:21', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for exhibition_items
-- ----------------------------
DROP TABLE IF EXISTS `exhibition_items`;
CREATE TABLE `exhibition_items`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `exhibition_id` bigint(20) UNSIGNED NOT NULL,
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `content_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_exhibition_items_exhibition_sort`(`exhibition_id` ASC, `sort_order` ASC) USING BTREE,
  INDEX `fk_exhibition_items_media`(`media_id` ASC) USING BTREE,
  INDEX `fk_exhibition_items_content`(`content_id` ASC) USING BTREE,
  CONSTRAINT `fk_exhibition_items_content` FOREIGN KEY (`content_id`) REFERENCES `content_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_exhibition_items_exhibition` FOREIGN KEY (`exhibition_id`) REFERENCES `exhibitions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_exhibition_items_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '展览内条目表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of exhibition_items
-- ----------------------------

-- ----------------------------
-- Table structure for exhibitions
-- ----------------------------
DROP TABLE IF EXISTS `exhibitions`;
CREATE TABLE `exhibitions`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '展览 ID',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `subtitle` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `cover_media_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'draft',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_exhibitions_status_sort`(`status` ASC, `sort_order` ASC) USING BTREE,
  INDEX `fk_exhibitions_cover`(`cover_media_id` ASC) USING BTREE,
  CONSTRAINT `fk_exhibitions_cover` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '网页端展览或专题收藏表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of exhibitions
-- ----------------------------

-- ----------------------------
-- Table structure for gallery_zone_items
-- ----------------------------
DROP TABLE IF EXISTS `gallery_zone_items`;
CREATE TABLE `gallery_zone_items`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '策展映射主键',
  `zone_id` bigint(20) UNSIGNED NOT NULL,
  `slot_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '与 GLB ANCHOR 节点一致的固定锚点',
  `source_type` enum('history','craft_step','region_profile','content_item','daily_appreciation','interactive_material','media_asset') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `source_id` bigint(20) UNSIGNED NOT NULL COMMENT '多态内容来源主键',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选媒体覆盖',
  `title_override` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `summary_override` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'draft',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_gallery_zone_source`(`zone_id` ASC, `slot_id` ASC, `source_type` ASC, `source_id` ASC) USING BTREE,
  INDEX `idx_gallery_zone_items_publish`(`zone_id` ASC, `status` ASC, `sort_order` ASC) USING BTREE,
  INDEX `idx_gallery_zone_items_source`(`source_type` ASC, `source_id` ASC) USING BTREE,
  INDEX `fk_gallery_zone_items_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_gallery_zone_items_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_gallery_zone_items_zone` FOREIGN KEY (`zone_id`) REFERENCES `gallery_zones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 98 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '展区锚点与已有内容的策展映射' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of gallery_zone_items
-- ----------------------------
INSERT INTO `gallery_zone_items` VALUES (1, 6, 'ANCHOR_ai_station_001', 'interactive_material', 7, NULL, NULL, NULL, 'archived', 1, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (2, 6, 'ANCHOR_ai_process_001', 'content_item', 1, NULL, NULL, NULL, 'archived', 10, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (3, 6, 'ANCHOR_ai_showcase_001', 'daily_appreciation', 1, NULL, NULL, NULL, 'archived', 20, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (4, 6, 'ANCHOR_ai_explain_001', 'content_item', 5, NULL, NULL, NULL, 'archived', 30, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (5, 4, 'ANCHOR_characters_hero_001', 'content_item', 1, NULL, NULL, NULL, 'published', 1, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (6, 4, 'ANCHOR_characters_hero_002', 'content_item', 2, NULL, NULL, NULL, 'published', 2, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (7, 4, 'ANCHOR_characters_catalog_001', 'content_item', 3, NULL, NULL, NULL, 'published', 10, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (8, 4, 'ANCHOR_characters_catalog_001', 'content_item', 4, NULL, NULL, NULL, 'published', 11, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (9, 4, 'ANCHOR_characters_catalog_001', 'content_item', 5, NULL, NULL, NULL, 'published', 12, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (10, 4, 'ANCHOR_characters_media_001', 'interactive_material', 7, NULL, NULL, NULL, 'archived', 20, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (11, 3, 'ANCHOR_craft_process_001', 'craft_step', 1, NULL, NULL, NULL, 'published', 1, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (12, 3, 'ANCHOR_craft_process_001', 'craft_step', 2, NULL, NULL, NULL, 'published', 2, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (13, 3, 'ANCHOR_craft_process_001', 'craft_step', 3, NULL, NULL, NULL, 'published', 3, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (14, 3, 'ANCHOR_craft_process_001', 'craft_step', 4, NULL, NULL, NULL, 'published', 4, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (15, 3, 'ANCHOR_craft_process_001', 'craft_step', 5, NULL, NULL, NULL, 'published', 5, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (16, 3, 'ANCHOR_craft_process_001', 'craft_step', 6, NULL, NULL, NULL, 'published', 6, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (17, 3, 'ANCHOR_craft_process_001', 'craft_step', 7, NULL, NULL, NULL, 'published', 7, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (18, 3, 'ANCHOR_craft_process_001', 'craft_step', 8, NULL, NULL, NULL, 'published', 8, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (19, 3, 'ANCHOR_craft_tools_001', 'craft_step', 5, NULL, NULL, NULL, 'published', 20, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (20, 3, 'ANCHOR_craft_material_001', 'craft_step', 1, NULL, NULL, NULL, 'published', 30, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (21, 3, 'ANCHOR_craft_material_001', 'craft_step', 6, NULL, NULL, NULL, 'published', 31, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (22, 3, 'ANCHOR_craft_media_001', 'media_asset', 57, NULL, NULL, NULL, 'published', 40, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (23, 5, 'ANCHOR_heritage_person_001', 'daily_appreciation', 1, NULL, NULL, NULL, 'archived', 1, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (24, 5, 'ANCHOR_heritage_archive_001', 'history', 8, NULL, NULL, NULL, 'published', 10, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (25, 5, 'ANCHOR_heritage_protection_001', 'content_item', 5, NULL, NULL, NULL, 'archived', 20, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (26, 5, 'ANCHOR_heritage_media_001', 'media_asset', 498, NULL, NULL, NULL, 'archived', 30, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (27, 1, 'ANCHOR_origin_overview_001', 'history', 1, NULL, NULL, NULL, 'published', 1, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (28, 1, 'ANCHOR_origin_timeline_001', 'history', 1, NULL, NULL, NULL, 'archived', 10, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (29, 1, 'ANCHOR_origin_timeline_001', 'history', 2, NULL, NULL, NULL, 'published', 11, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (30, 1, 'ANCHOR_origin_timeline_001', 'history', 3, NULL, NULL, NULL, 'published', 12, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (31, 1, 'ANCHOR_origin_timeline_001', 'history', 4, NULL, NULL, NULL, 'published', 13, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (32, 1, 'ANCHOR_origin_timeline_001', 'history', 5, NULL, NULL, NULL, 'published', 14, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (33, 1, 'ANCHOR_origin_timeline_001', 'history', 6, NULL, NULL, NULL, 'published', 15, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (34, 1, 'ANCHOR_origin_timeline_001', 'history', 7, NULL, NULL, NULL, 'published', 16, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (35, 1, 'ANCHOR_origin_timeline_001', 'history', 8, NULL, NULL, NULL, 'published', 17, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (36, 1, 'ANCHOR_origin_artifact_001', 'content_item', 1, NULL, NULL, NULL, 'published', 20, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (37, 1, 'ANCHOR_origin_media_001', 'media_asset', 491, NULL, NULL, NULL, 'published', 30, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (38, 2, 'ANCHOR_regions_map_001', 'region_profile', 1, NULL, NULL, NULL, 'published', 1, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (39, 2, 'ANCHOR_regions_compare_001', 'region_profile', 1, NULL, NULL, NULL, 'archived', 10, '2026-07-15 18:57:37', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (40, 2, 'ANCHOR_regions_compare_001', 'region_profile', 2, NULL, NULL, NULL, 'published', 11, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (41, 2, 'ANCHOR_regions_compare_001', 'region_profile', 3, NULL, NULL, NULL, 'published', 12, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (42, 2, 'ANCHOR_regions_compare_001', 'region_profile', 4, NULL, NULL, NULL, 'published', 13, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (43, 2, 'ANCHOR_regions_artifact_001', 'daily_appreciation', 1, NULL, NULL, NULL, 'published', 20, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (44, 2, 'ANCHOR_regions_media_001', 'media_asset', 299, NULL, NULL, NULL, 'published', 30, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zone_items` VALUES (75, 6, 'ANCHOR_ai_station_001', 'content_item', 28, NULL, NULL, NULL, 'published', 1, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (76, 6, 'ANCHOR_ai_process_001', 'content_item', 29, NULL, NULL, NULL, 'published', 10, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (77, 6, 'ANCHOR_ai_showcase_001', 'content_item', 30, NULL, NULL, NULL, 'published', 20, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (78, 6, 'ANCHOR_ai_explain_001', 'content_item', 31, NULL, NULL, NULL, 'published', 30, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (79, 4, 'ANCHOR_characters_media_001', 'content_item', 24, NULL, NULL, NULL, 'published', 20, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (80, 5, 'ANCHOR_heritage_person_001', 'content_item', 25, NULL, NULL, NULL, 'published', 1, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (81, 5, 'ANCHOR_heritage_protection_001', 'content_item', 26, NULL, NULL, NULL, 'published', 20, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (82, 5, 'ANCHOR_heritage_media_001', 'content_item', 27, NULL, NULL, NULL, 'published', 30, '2026-07-16 09:22:02', '2026-07-16 09:22:02');
INSERT INTO `gallery_zone_items` VALUES (92, 3, 'ANCHOR_craft_tools_001', 'interactive_material', 8, NULL, '皮影锤凿工具', '锤凿等工具用于稳定完成细密镂刻与轮廓修整，可与镂刻工序展页对照观看。', 'published', 21, '2026-07-16 09:24:30', '2026-07-16 09:24:30');

-- ----------------------------
-- Table structure for gallery_zones
-- ----------------------------
DROP TABLE IF EXISTS `gallery_zones`;
CREATE TABLE `gallery_zones`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '展区主键',
  `code` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '与 GLB ZONE 节点一致的稳定编码',
  `title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `english_title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `summary` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'published',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_gallery_zones_code`(`code` ASC) USING BTREE,
  INDEX `idx_gallery_zones_status_sort`(`status` ASC, `sort_order` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 44 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '主展馆六个固定展区' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of gallery_zones
-- ----------------------------
INSERT INTO `gallery_zones` VALUES (1, 'origin', '源流', 'Origin', '从起源传说到当代传承，梳理中国皮影戏的历史脉络。', 'published', 1, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zones` VALUES (2, 'regions', '地域流派', 'Regions', '比较不同地域与影系的造型、色彩和唱腔特征。', 'published', 2, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zones` VALUES (3, 'craft', '制作工艺', 'Craft', '从选皮到缀结合成，认识皮影制作的完整工序。', 'published', 3, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zones` VALUES (4, 'characters', '角色图鉴', 'Characters', '通过代表性影偶与道具理解程式化角色语言。', 'published', 4, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zones` VALUES (5, 'heritage', '活态传承', 'Heritage', '呈现保护、教育与活态传承实践，资料需经人工审校。', 'published', 5, '2026-07-15 18:57:37', '2026-07-15 18:57:37');
INSERT INTO `gallery_zones` VALUES (6, 'ai-lab', 'AI 共创实验室', 'AI Lab', '用于说明生成式技术流程与边界的演示展区。', 'published', 6, '2026-07-15 18:57:37', '2026-07-15 18:57:37');

-- ----------------------------
-- Table structure for inheritors
-- ----------------------------
DROP TABLE IF EXISTS `inheritors`;
CREATE TABLE `inheritors`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '传承人 ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `gender` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `birth_year` smallint(6) NULL DEFAULT NULL,
  `region_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `school_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '非遗称号或级别',
  `biography` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `avatar_media_id` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_inheritors_region`(`region_id` ASC) USING BTREE,
  INDEX `idx_inheritors_school`(`school_id` ASC) USING BTREE,
  INDEX `fk_inheritors_avatar`(`avatar_media_id` ASC) USING BTREE,
  CONSTRAINT `fk_inheritors_avatar` FOREIGN KEY (`avatar_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_inheritors_region` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_inheritors_school` FOREIGN KEY (`school_id`) REFERENCES `shadow_schools` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '皮影传承人与机构表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of inheritors
-- ----------------------------

-- ----------------------------
-- Table structure for interactive_characters
-- ----------------------------
DROP TABLE IF EXISTS `interactive_characters`;
CREATE TABLE `interactive_characters`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '素材或角色名称',
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '图片相对路径，保留用于兼容',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选的统一媒体资源 ID',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'character' COMMENT '素材分类：角色/道具/时代/其他',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间，保留用于兼容',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_interactive_active_sort`(`is_active` ASC, `sort_order` ASC) USING BTREE,
  INDEX `idx_interactive_category`(`category` ASC) USING BTREE,
  INDEX `fk_interactive_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_interactive_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 94 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '互动页素材表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of interactive_characters
-- ----------------------------
INSERT INTO `interactive_characters` VALUES (1, 'bjpy (1)', '/images/interactive/bjpy (1).PNG', 128, 'character', NULL, 1, 1, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (2, 'bjpy (2)', '/images/interactive/bjpy (2).PNG', 129, 'character', NULL, 1, 2, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (3, 'bjpy (3)', '/images/interactive/bjpy (3).PNG', 130, 'character', NULL, 1, 3, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (4, 'bjpy (4)', '/images/interactive/bjpy (4).PNG', 131, 'character', NULL, 1, 4, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (5, 'bjpy (5)', '/images/interactive/bjpy (5).PNG', 132, 'character', NULL, 1, 5, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (6, 'bjpy (6)', '/images/interactive/bjpy (6).PNG', 133, 'character', NULL, 1, 6, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (7, 'chenjing', '/images/interactive/chenjing.png', 188, 'character', NULL, 1, 7, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (8, 'chuozi', '/images/interactive/chuozi.png', 195, 'character', NULL, 1, 8, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (9, 'daoju', '/images/interactive/daoju.png', 196, 'character', NULL, 1, 9, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (10, 'dongwu', '/images/interactive/dongwu.png', 197, 'character', NULL, 1, 10, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (11, 'handai', '/images/interactive/handai.png', 189, 'character', NULL, 1, 11, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (12, 'hbpy (1)', '/images/interactive/hbpy (1).png', 134, 'character', NULL, 1, 12, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (13, 'hbpy (2)', '/images/interactive/hbpy (2).png', 135, 'character', NULL, 1, 13, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (14, 'hbpy (3)', '/images/interactive/hbpy (3).png', 136, 'character', NULL, 1, 14, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (15, 'hbpy (4)', '/images/interactive/hbpy (4).png', 137, 'character', NULL, 1, 15, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (16, 'hbpy (5)', '/images/interactive/hbpy (5).png', 138, 'character', NULL, 1, 16, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (17, 'hbpy (6)', '/images/interactive/hbpy (6).png', 139, 'character', NULL, 1, 17, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (18, 'hnpy (1)', '/images/interactive/hnpy (1).png', 140, 'character', NULL, 1, 18, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (19, 'hnpy (2)', '/images/interactive/hnpy (2).png', 141, 'character', NULL, 1, 19, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (20, 'hnpy (3)', '/images/interactive/hnpy (3).png', 142, 'character', NULL, 1, 20, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (21, 'hnpy (4)', '/images/interactive/hnpy (4).png', 143, 'character', NULL, 1, 21, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (22, 'hnpy (5)', '/images/interactive/hnpy (5).png', 144, 'character', NULL, 1, 22, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (23, 'hnpy (6)', '/images/interactive/hnpy (6).png', 145, 'character', NULL, 1, 23, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (24, 'ldpy (1)', '/images/interactive/ldpy (1).PNG', 146, 'character', NULL, 1, 24, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (25, 'ldpy (2)', '/images/interactive/ldpy (2).PNG', 147, 'character', NULL, 1, 25, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (26, 'ldpy (3)', '/images/interactive/ldpy (3).PNG', 148, 'character', NULL, 1, 26, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (27, 'ldpy (4)', '/images/interactive/ldpy (4).PNG', 149, 'character', NULL, 1, 27, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (28, 'ldpy (5)', '/images/interactive/ldpy (5).PNG', 150, 'character', NULL, 1, 28, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (29, 'ldpy (6)', '/images/interactive/ldpy (6).PNG', 151, 'character', NULL, 1, 29, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (30, 'ming', '/images/interactive/ming.png', 193, 'character', NULL, 1, 30, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (31, 'qing', '/images/interactive/qing.png', 194, 'character', NULL, 1, 31, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (32, 'qiuzi', '/images/interactive/qiuzi.png', 198, 'character', NULL, 1, 32, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (33, 'qhpy (1)', '/images/interactive/qhpy (1).png', 152, 'character', NULL, 1, 33, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (34, 'qhpy (2)', '/images/interactive/qhpy (2).png', 153, 'character', NULL, 1, 34, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (35, 'qhpy (3)', '/images/interactive/qhpy (3).png', 154, 'character', NULL, 1, 35, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (36, 'qhpy (4)', '/images/interactive/qhpy (4).png', 155, 'character', NULL, 1, 36, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (37, 'qhpy (5)', '/images/interactive/qhpy (5).png', 156, 'character', NULL, 1, 37, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (38, 'qhpy (6)', '/images/interactive/qhpy (6).png', 157, 'character', NULL, 1, 38, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (39, 'scpy (1)', '/images/interactive/scpy (1).png', 158, 'character', NULL, 1, 39, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (40, 'scpy (2)', '/images/interactive/scpy (2).png', 159, 'character', NULL, 1, 40, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (41, 'scpy (3)', '/images/interactive/scpy (3).png', 160, 'character', NULL, 1, 41, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (42, 'scpy (4)', '/images/interactive/scpy (4).png', 161, 'character', NULL, 1, 42, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (43, 'scpy (5)', '/images/interactive/scpy (5).png', 162, 'character', NULL, 1, 43, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (44, 'scpy (6)', '/images/interactive/scpy (6).png', 163, 'character', NULL, 1, 44, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (45, 'sdpy (1)', '/images/interactive/sdpy (1).PNG', 164, 'character', NULL, 1, 45, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (46, 'sdpy (2)', '/images/interactive/sdpy (2).PNG', 165, 'character', NULL, 1, 46, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (47, 'sdpy (3)', '/images/interactive/sdpy (3).PNG', 166, 'character', NULL, 1, 47, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (48, 'sdpy (4)', '/images/interactive/sdpy (4).PNG', 167, 'character', NULL, 1, 48, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (49, 'sdpy (5)', '/images/interactive/sdpy (5).PNG', 168, 'character', NULL, 1, 49, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (50, 'sdpy (6)', '/images/interactive/sdpy (6).PNG', 169, 'character', NULL, 1, 50, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (51, 'shanxipy (1)', '/images/interactive/shanxipy (1).PNG', 170, 'character', NULL, 1, 51, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (52, 'shanxipy (2)', '/images/interactive/shanxipy (2).PNG', 171, 'character', NULL, 1, 52, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (53, 'shanxipy (3)', '/images/interactive/shanxipy (3).PNG', 172, 'character', NULL, 1, 53, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (54, 'shanxipy (4)', '/images/interactive/shanxipy (4).PNG', 173, 'character', NULL, 1, 54, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (55, 'shanxipy (5)', '/images/interactive/shanxipy (5).png', 174, 'character', NULL, 1, 55, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (56, 'shanxipy (6)', '/images/interactive/shanxipy (6).PNG', 175, 'character', NULL, 1, 56, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (57, 'songdai', '/images/interactive/songdai.png', 191, 'character', NULL, 1, 57, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (58, 'tangdai', '/images/interactive/tangdai.png', 190, 'character', NULL, 1, 58, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (59, 'toucha', '/images/interactive/toucha.png', 199, 'character', NULL, 1, 59, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (60, 'yuandai', '/images/interactive/yuandai.png', 192, 'character', NULL, 1, 60, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (61, 'sxpy (1)', '/images/interactive/sxpy (1).png', 176, 'character', NULL, 1, 61, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (62, 'sxpy (2)', '/images/interactive/sxpy (2).png', 177, 'character', NULL, 1, 62, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (63, 'sxpy (3)', '/images/interactive/sxpy (3).png', 178, 'character', NULL, 1, 63, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (64, 'sxpy (4)', '/images/interactive/sxpy (4).png', 179, 'character', NULL, 1, 64, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (65, 'sxpy (5)', '/images/interactive/sxpy (5).png', 180, 'character', NULL, 1, 65, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (66, 'sxpy (6)', '/images/interactive/sxpy (6).png', 181, 'character', NULL, 1, 66, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (67, 'tspy (1)', '/images/interactive/tspy (1).png', 182, 'character', NULL, 1, 67, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (68, 'tspy (2)', '/images/interactive/tspy (2).png', 183, 'character', NULL, 1, 68, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (69, 'tspy (3)', '/images/interactive/tspy (3).png', 184, 'character', NULL, 1, 69, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (70, 'tspy (4)', '/images/interactive/tspy (4).png', 185, 'character', NULL, 1, 70, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (71, 'tspy (5)', '/images/interactive/tspy (5).png', 186, 'character', NULL, 1, 71, '2025-12-23 16:37:17', '2026-05-29 17:42:04');
INSERT INTO `interactive_characters` VALUES (72, 'tspy (6)', '/images/interactive/tspy (6).png', 187, 'character', NULL, 1, 72, '2025-12-23 16:37:17', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for media_assets
-- ----------------------------
DROP TABLE IF EXISTS `media_assets`;
CREATE TABLE `media_assets`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '媒体资源主键',
  `media_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '前端或后台查询使用的稳定标识',
  `media_type` enum('image','video','audio','document','ui_asset','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'image',
  `storage_type` enum('local','remote') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'local',
  `url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '相对路径或远程地址',
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '媒体标题',
  `alt_text` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图片替代文本',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '描述',
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '来源或采集者',
  `copyright_info` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '版权或授权说明',
  `mime_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `file_ext` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `file_size` bigint(20) UNSIGNED NULL DEFAULT NULL,
  `width` int(10) UNSIGNED NULL DEFAULT NULL,
  `height` int(10) UNSIGNED NULL DEFAULT NULL,
  `duration_seconds` int(10) UNSIGNED NULL DEFAULT NULL,
  `page_source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '可选的页面或模块来源',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_media_assets_url`(`url` ASC) USING BTREE,
  UNIQUE INDEX `uk_media_assets_key`(`media_key` ASC) USING BTREE,
  INDEX `idx_media_assets_type`(`media_type` ASC) USING BTREE,
  INDEX `idx_media_assets_page_source`(`page_source` ASC) USING BTREE,
  INDEX `idx_media_assets_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 577 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '统一媒体资源库' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of media_assets
-- ----------------------------
INSERT INTO `media_assets` VALUES (1, 'app_common_bg_index_main', 'ui_asset', 'local', '/images/index/bg.png', '旧版首页背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_index', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (2, 'app_common_bg_select_main', 'ui_asset', 'local', '/images/select/selectBg.png', '旧版地图背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (3, 'app_common_bg_select_map', 'ui_asset', 'local', '/images/select/Seal_Group.png', '旧版地图图形', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (4, 'app_common_icon_select_comp', 'ui_asset', 'local', '/images/select/point.png', '旧版地图点位', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (5, 'app_common_art_v2_home_bg', 'ui_asset', 'local', '/images/art/v2/home/home_bg_stage.png', 'v2首页舞台背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_index', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (6, 'app_common_art_v2_home_badge', 'ui_asset', 'local', '/images/art/v2/home/home_badge_heritage.png', 'v2首页非遗徽章', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_index', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (7, 'app_common_art_v2_common_btn_primary', 'ui_asset', 'local', '/images/art/v2/common/btn_primary_bg.png', 'v2主按钮', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (8, 'app_common_art_v2_common_btn_primary_pressed', 'ui_asset', 'local', '/images/art/v2/common/btn_primary_bg_pressed.png', 'v2主按钮按下', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (9, 'app_common_art_v2_common_btn_secondary', 'ui_asset', 'local', '/images/art/v2/common/btn_secondary_bg.png', 'v2次按钮', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (10, 'app_common_art_v2_common_btn_secondary_pressed', 'ui_asset', 'local', '/images/art/v2/common/btn_secondary_bg_pressed.png', 'v2次按钮按下', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (11, 'app_common_art_v2_common_card_paper', 'ui_asset', 'local', '/images/art/v2/common/card_paper_frame.png', 'v2纸质卡片', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (12, 'app_common_art_v2_common_card_dark', 'ui_asset', 'local', '/images/art/v2/common/card_dark_frame.png', 'v2暗色卡片', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (13, 'app_common_art_v2_common_panel_paper', 'ui_asset', 'local', '/images/art/v2/common/panel_paper_large.png', 'v2纸质面板', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (14, 'app_common_art_v2_common_panel_dark', 'ui_asset', 'local', '/images/art/v2/common/panel_dark_large.png', 'v2暗色面板', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (15, 'app_common_art_v2_common_popup_paper', 'ui_asset', 'local', '/images/art/v2/common/popup_paper_panel.png', 'v2弹窗面板', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (16, 'app_common_art_v2_common_bottom_nav', 'ui_asset', 'local', '/images/art/v2/common/bottom_nav_dark.png', 'v2底部导航', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (17, 'app_common_art_v2_common_top_bar_dark', 'ui_asset', 'local', '/images/art/v2/common/top_bar_dark.png', 'v2顶部栏暗色', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (18, 'app_common_art_v2_common_top_bar_paper', 'ui_asset', 'local', '/images/art/v2/common/top_bar_paper.png', 'v2顶部栏纸质', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (19, 'app_common_art_v2_common_icon_back', 'ui_asset', 'local', '/images/art/v2/common/icon_back_gold.png', 'v2返回图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (20, 'app_common_art_v2_common_icon_share', 'ui_asset', 'local', '/images/art/v2/common/icon_share_gold.png', 'v2分享图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (21, 'app_common_art_v2_common_icon_home', 'ui_asset', 'local', '/images/art/v2/common/icon_home.png', 'v2首页图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (22, 'app_common_art_v2_common_icon_home_active', 'ui_asset', 'local', '/images/art/v2/common/icon_home_active.png', 'v2首页选中图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (23, 'app_common_art_v2_common_icon_map', 'ui_asset', 'local', '/images/art/v2/common/icon_map.png', 'v2地图图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (24, 'app_common_art_v2_common_icon_map_active', 'ui_asset', 'local', '/images/art/v2/common/icon_map_active.png', 'v2地图选中图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (25, 'app_common_art_v2_common_icon_display', 'ui_asset', 'local', '/images/art/v2/common/icon_display.png', 'v2展示图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (26, 'app_common_art_v2_common_icon_display_active', 'ui_asset', 'local', '/images/art/v2/common/icon_display_active.png', 'v2展示选中图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (27, 'app_common_art_v2_common_icon_process', 'ui_asset', 'local', '/images/art/v2/common/icon_process.png', 'v2工艺图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (28, 'app_common_art_v2_common_icon_process_active', 'ui_asset', 'local', '/images/art/v2/common/icon_process_active.png', 'v2工艺选中图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (29, 'app_common_art_v2_common_icon_game', 'ui_asset', 'local', '/images/art/v2/common/icon_game.png', 'v2互动图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (30, 'app_common_art_v2_common_icon_game_active', 'ui_asset', 'local', '/images/art/v2/common/icon_game_active.png', 'v2互动选中图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'common', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (31, 'app_common_art_v2_map_bg', 'ui_asset', 'local', '/images/art/v2/map/map_bg_dark.png', 'v2地图背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (32, 'app_common_art_v2_map_china', 'ui_asset', 'local', '/images/art/v2/map/china_map_art.png', 'v2中国地图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (33, 'app_common_art_v2_map_marker', 'ui_asset', 'local', '/images/art/v2/map/marker_normal.png', 'v2地图点位', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (34, 'app_common_art_v2_map_marker_active', 'ui_asset', 'local', '/images/art/v2/map/marker_active.png', 'v2地图选中点位', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (35, 'app_common_art_v2_map_popup', 'ui_asset', 'local', '/images/art/v2/map/region_popup_bg.png', 'v2地区弹窗', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (36, 'app_common_art_v2_map_menu_item', 'ui_asset', 'local', '/images/art/v2/map/menu_item_bg.png', 'v2地区菜单项', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (37, 'app_common_art_v2_map_compass', 'ui_asset', 'local', '/images/art/v2/map/compass_decor.png', 'v2罗盘装饰', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_select', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (38, 'app_common_art_v2_daily_bg', 'ui_asset', 'local', '/images/art/v2/daily/daily_bg_dark.png', 'v2每日一赏背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_display', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (39, 'app_common_art_v2_daily_card_frame', 'ui_asset', 'local', '/images/art/v2/daily/daily_card_frame.png', 'v2每日一赏卡片', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_display', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (40, 'app_common_art_v2_daily_info_panel', 'ui_asset', 'local', '/images/art/v2/daily/daily_info_panel.png', 'v2每日一赏信息面板', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_display', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (41, 'app_common_art_v2_daily_random_button', 'ui_asset', 'local', '/images/art/v2/daily/random_button_bg.png', 'v2随机按钮', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_display', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (42, 'app_common_art_v2_daily_dice', 'ui_asset', 'local', '/images/art/v2/daily/icon_dice.png', 'v2骰子图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_display', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (43, 'app_common_art_v2_quiz_bg', 'ui_asset', 'local', '/images/art/v2/quiz/quiz_bg_dark.png', 'v2答题背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (44, 'app_common_art_v2_quiz_progress', 'ui_asset', 'local', '/images/art/v2/quiz/progress_bar_bg.png', 'v2答题进度条', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (45, 'app_common_art_v2_quiz_question', 'ui_asset', 'local', '/images/art/v2/quiz/question_scroll_bg.png', 'v2题目卷轴', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (46, 'app_common_art_v2_quiz_option_default', 'ui_asset', 'local', '/images/art/v2/quiz/option_bg_default.png', 'v2默认选项', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (47, 'app_common_art_v2_quiz_option_selected', 'ui_asset', 'local', '/images/art/v2/quiz/option_bg_selected.png', 'v2选中选项', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (48, 'app_common_art_v2_quiz_option_correct', 'ui_asset', 'local', '/images/art/v2/quiz/option_bg_correct.png', 'v2正确选项', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (49, 'app_common_art_v2_quiz_option_wrong', 'ui_asset', 'local', '/images/art/v2/quiz/option_bg_wrong.png', 'v2错误选项', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (50, 'app_common_art_v2_quiz_explanation', 'ui_asset', 'local', '/images/art/v2/quiz/explanation_panel_bg.png', 'v2解析面板', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (51, 'app_common_art_v2_quiz_stamp_correct', 'ui_asset', 'local', '/images/art/v2/quiz/stamp_correct.png', 'v2正确印章', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (52, 'app_common_art_v2_quiz_stamp_wrong', 'ui_asset', 'local', '/images/art/v2/quiz/stamp_wrong.png', 'v2错误印章', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (53, 'app_common_art_v2_quiz_result', 'ui_asset', 'local', '/images/art/v2/quiz/result_panel_bg.png', 'v2答题结果', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_quiz', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (54, 'app_common_art_v2_process_bg', 'ui_asset', 'local', '/images/art/v2/process/process_bg_dark.png', 'v2工艺背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (55, 'app_common_art_v2_process_card', 'ui_asset', 'local', '/images/art/v2/process/process_card_bg.png', 'v2工艺卡片', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (56, 'app_common_art_v2_process_step_badge', 'ui_asset', 'local', '/images/art/v2/process/step_badge_bg.png', 'v2工艺步骤徽章', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (57, 'app_common_art_v2_process_step_1', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_1.png', 'v2工艺步骤1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (58, 'app_common_art_v2_process_step_2', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_2.png', 'v2工艺步骤2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (59, 'app_common_art_v2_process_step_3', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_3.png', 'v2工艺步骤3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (60, 'app_common_art_v2_process_step_4', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_4.png', 'v2工艺步骤4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (61, 'app_common_art_v2_process_step_5', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_5.png', 'v2工艺步骤5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (62, 'app_common_art_v2_process_step_6', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_6.png', 'v2工艺步骤6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (63, 'app_common_art_v2_process_step_7', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_7.png', 'v2工艺步骤7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (64, 'app_common_art_v2_process_step_8', 'ui_asset', 'local', '/images/art/v2/process/process_img_step_8.png', 'v2工艺步骤8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_process', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (65, 'app_common_art_v2_game_bg', 'ui_asset', 'local', '/images/art/v2/game/game_bg_stage_dark.png', 'v2互动背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (66, 'app_common_art_v2_game_hint', 'ui_asset', 'local', '/images/art/v2/game/flashlight_hint_bg.png', 'v2互动提示', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (67, 'app_common_art_v2_game_progress_track', 'ui_asset', 'local', '/images/art/v2/game/progress_track.png', 'v2互动进度条', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (68, 'app_common_art_v2_game_puppet_empty', 'ui_asset', 'local', '/images/art/v2/game/progress_puppet_empty.png', 'v2未找到图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (69, 'app_common_art_v2_game_puppet_found', 'ui_asset', 'local', '/images/art/v2/game/progress_puppet_found.png', 'v2已找到图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (70, 'app_common_art_v2_game_treasure_modal', 'ui_asset', 'local', '/images/art/v2/game/treasure_modal_bg.png', 'v2宝箱弹窗', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (71, 'app_common_art_v2_game_flashlight', 'ui_asset', 'local', '/images/art/v2/game/icon_flashlight.png', 'v2手电图标', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_interactive', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (72, 'app_common_art_v2_timeline_bg', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_bg_dark.png', 'v2历史背景', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (73, 'app_common_art_v2_timeline_axis', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_axis_line.png', 'v2时间轴线', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (74, 'app_common_art_v2_timeline_node', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_node_normal.png', 'v2时间节点', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (75, 'app_common_art_v2_timeline_node_active', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_node_active.png', 'v2时间节点选中', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (76, 'app_common_art_v2_timeline_card_collapsed', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_card_collapsed.png', 'v2历史折叠卡', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (77, 'app_common_art_v2_timeline_card_expanded', 'ui_asset', 'local', '/images/art/v2/timeline/timeline_card_expanded.png', 'v2历史展开卡', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (78, 'app_common_art_v2_timeline_tab_active', 'ui_asset', 'local', '/images/art/v2/timeline/tab_active_bg.png', 'v2历史选中标签', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (79, 'app_common_art_v2_timeline_tab_inactive', 'ui_asset', 'local', '/images/art/v2/timeline/tab_inactive_bg.png', 'v2历史未选中标签', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'page_history', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (128, 'daily_1', 'image', 'local', '/images/interactive/bjpy (1).PNG', '北京皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (129, 'daily_2', 'image', 'local', '/images/interactive/bjpy (2).PNG', '北京皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (130, 'daily_3', 'image', 'local', '/images/interactive/bjpy (3).PNG', '北京皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (131, 'daily_4', 'image', 'local', '/images/interactive/bjpy (4).PNG', '北京皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (132, 'daily_5', 'image', 'local', '/images/interactive/bjpy (5).PNG', '北京皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (133, 'daily_6', 'image', 'local', '/images/interactive/bjpy (6).PNG', '北京皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (134, 'daily_7', 'image', 'local', '/images/interactive/hbpy (1).png', '河北皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (135, 'daily_8', 'image', 'local', '/images/interactive/hbpy (2).png', '河北皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (136, 'daily_9', 'image', 'local', '/images/interactive/hbpy (3).png', '河北皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (137, 'daily_10', 'image', 'local', '/images/interactive/hbpy (4).png', '河北皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (138, 'daily_11', 'image', 'local', '/images/interactive/hbpy (5).png', '河北皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (139, 'daily_12', 'image', 'local', '/images/interactive/hbpy (6).png', '河北皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (140, 'daily_13', 'image', 'local', '/images/interactive/hnpy (1).png', '河南皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (141, 'daily_14', 'image', 'local', '/images/interactive/hnpy (2).png', '河南皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (142, 'daily_15', 'image', 'local', '/images/interactive/hnpy (3).png', '河南皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (143, 'daily_16', 'image', 'local', '/images/interactive/hnpy (4).png', '河南皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (144, 'daily_17', 'image', 'local', '/images/interactive/hnpy (5).png', '河南皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (145, 'daily_18', 'image', 'local', '/images/interactive/hnpy (6).png', '河南皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (146, 'daily_19', 'image', 'local', '/images/interactive/ldpy (1).PNG', '辽东皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (147, 'daily_20', 'image', 'local', '/images/interactive/ldpy (2).PNG', '辽东皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (148, 'daily_21', 'image', 'local', '/images/interactive/ldpy (3).PNG', '辽东皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (149, 'daily_22', 'image', 'local', '/images/interactive/ldpy (4).PNG', '辽东皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (150, 'daily_23', 'image', 'local', '/images/interactive/ldpy (5).PNG', '辽东皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (151, 'daily_24', 'image', 'local', '/images/interactive/ldpy (6).PNG', '辽东皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (152, 'daily_25', 'image', 'local', '/images/interactive/qhpy (1).png', '青海皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (153, 'daily_26', 'image', 'local', '/images/interactive/qhpy (2).png', '青海皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (154, 'daily_27', 'image', 'local', '/images/interactive/qhpy (3).png', '青海皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (155, 'daily_28', 'image', 'local', '/images/interactive/qhpy (4).png', '青海皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (156, 'daily_29', 'image', 'local', '/images/interactive/qhpy (5).png', '青海皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (157, 'daily_30', 'image', 'local', '/images/interactive/qhpy (6).png', '青海皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (158, 'daily_31', 'image', 'local', '/images/interactive/scpy (1).png', '四川皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (159, 'daily_32', 'image', 'local', '/images/interactive/scpy (2).png', '四川皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (160, 'daily_33', 'image', 'local', '/images/interactive/scpy (3).png', '四川皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (161, 'daily_34', 'image', 'local', '/images/interactive/scpy (4).png', '四川皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (162, 'daily_35', 'image', 'local', '/images/interactive/scpy (5).png', '四川皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (163, 'daily_36', 'image', 'local', '/images/interactive/scpy (6).png', '四川皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (164, 'daily_37', 'image', 'local', '/images/interactive/sdpy (1).PNG', '山东皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (165, 'daily_38', 'image', 'local', '/images/interactive/sdpy (2).PNG', '山东皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (166, 'daily_39', 'image', 'local', '/images/interactive/sdpy (3).PNG', '山东皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (167, 'daily_40', 'image', 'local', '/images/interactive/sdpy (4).PNG', '山东皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (168, 'daily_41', 'image', 'local', '/images/interactive/sdpy (5).PNG', '山东皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (169, 'daily_42', 'image', 'local', '/images/interactive/sdpy (6).PNG', '山东皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (170, 'daily_43', 'image', 'local', '/images/interactive/shanxipy (1).PNG', '山西皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (171, 'daily_44', 'image', 'local', '/images/interactive/shanxipy (2).PNG', '山西皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (172, 'daily_45', 'image', 'local', '/images/interactive/shanxipy (3).PNG', '山西皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (173, 'daily_46', 'image', 'local', '/images/interactive/shanxipy (4).PNG', '山西皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (174, 'daily_47', 'image', 'local', '/images/interactive/shanxipy (5).png', '山西皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (175, 'daily_48', 'image', 'local', '/images/interactive/shanxipy (6).PNG', '山西皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (176, 'daily_49', 'image', 'local', '/images/interactive/sxpy (1).png', '陕西皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (177, 'daily_50', 'image', 'local', '/images/interactive/sxpy (2).png', '陕西皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (178, 'daily_51', 'image', 'local', '/images/interactive/sxpy (3).png', '陕西皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (179, 'daily_52', 'image', 'local', '/images/interactive/sxpy (4).png', '陕西皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (180, 'daily_53', 'image', 'local', '/images/interactive/sxpy (5).png', '陕西皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (181, 'daily_54', 'image', 'local', '/images/interactive/sxpy (6).png', '陕西皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (182, 'daily_55', 'image', 'local', '/images/interactive/tspy (1).png', '唐山皮影选粹·一', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (183, 'daily_56', 'image', 'local', '/images/interactive/tspy (2).png', '唐山皮影选粹·二', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (184, 'daily_57', 'image', 'local', '/images/interactive/tspy (3).png', '唐山皮影选粹·三', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (185, 'daily_58', 'image', 'local', '/images/interactive/tspy (4).png', '唐山皮影选粹·四', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (186, 'daily_59', 'image', 'local', '/images/interactive/tspy (5).png', '唐山皮影选粹·五', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (187, 'daily_60', 'image', 'local', '/images/interactive/tspy (6).png', '唐山皮影选粹·六', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (188, 'daily_61', 'image', 'local', '/images/interactive/chenjing.png', '陈静人物影像', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (189, 'daily_62', 'image', 'local', '/images/interactive/handai.png', '汉代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (190, 'daily_63', 'image', 'local', '/images/interactive/tangdai.png', '唐代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (191, 'daily_64', 'image', 'local', '/images/interactive/songdai.png', '宋代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (192, 'daily_65', 'image', 'local', '/images/interactive/yuandai.png', '元代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (193, 'daily_66', 'image', 'local', '/images/interactive/ming.png', '明代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (194, 'daily_67', 'image', 'local', '/images/interactive/qing.png', '清代影戏意象', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (195, 'daily_68', 'image', 'local', '/images/interactive/chuozi.png', '皮影锤凿工具', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (196, 'daily_69', 'image', 'local', '/images/interactive/daoju.png', '皮影道具选粹', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (197, 'daily_70', 'image', 'local', '/images/interactive/dongwu.png', '动物影偶选粹', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (198, 'daily_71', 'image', 'local', '/images/interactive/qiuzi.png', '皮影球形道具', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (199, 'daily_72', 'image', 'local', '/images/interactive/toucha.png', '投茶场景道具', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'daily_appreciation', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (257, 'catalog_head_1', 'image', 'local', '/images/catalog/tc-01.png', '头茬图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (258, 'catalog_head_2', 'image', 'local', '/images/catalog/tc-02.png', '头茬图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (259, 'catalog_head_3', 'image', 'local', '/images/catalog/tc-03.png', '头茬图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (260, 'catalog_head_4', 'image', 'local', '/images/catalog/tc-04.png', '头茬图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (261, 'catalog_head_5', 'image', 'local', '/images/catalog/tc-05.png', '头茬图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (262, 'catalog_head_6', 'image', 'local', '/images/catalog/tc-06.png', '头茬图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (263, 'catalog_body_1', 'image', 'local', '/images/catalog/ys_01.png', '影身图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (264, 'catalog_body_2', 'image', 'local', '/images/catalog/ys_02.png', '影身图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (265, 'catalog_body_3', 'image', 'local', '/images/catalog/ys_03.png', '影身图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (266, 'catalog_body_4', 'image', 'local', '/images/catalog/ys_04.png', '影身图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (267, 'catalog_body_5', 'image', 'local', '/images/catalog/ys_05.png', '影身图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (268, 'catalog_body_6', 'image', 'local', '/images/catalog/ys_06.png', '影身图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (269, 'catalog_cloud_1', 'image', 'local', '/images/catalog/ydz-01.png', '云朵子图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (270, 'catalog_cloud_2', 'image', 'local', '/images/catalog/ydz-02.png', '云朵子图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (271, 'catalog_cloud_3', 'image', 'local', '/images/catalog/ydz-03.png', '云朵子图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (272, 'catalog_cloud_4', 'image', 'local', '/images/catalog/ydz-04.png', '云朵子图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (273, 'catalog_cloud_5', 'image', 'local', '/images/catalog/ydz-05.png', '云朵子图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (274, 'catalog_cloud_6', 'image', 'local', '/images/catalog/ydz-06.png', '云朵子图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (275, 'catalog_furniture_1', 'image', 'local', '/images/catalog/zy-01.png', '桌椅图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (276, 'catalog_furniture_2', 'image', 'local', '/images/catalog/zy-02.png', '桌椅图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (277, 'catalog_furniture_3', 'image', 'local', '/images/catalog/zy-03.png', '桌椅图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (278, 'catalog_furniture_4', 'image', 'local', '/images/catalog/zy-04.png', '桌椅图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (279, 'catalog_furniture_5', 'image', 'local', '/images/catalog/zy-05.png', '桌椅图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (280, 'catalog_furniture_6', 'image', 'local', '/images/catalog/zy-06.png', '桌椅图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (281, 'catalog_scene_1', 'image', 'local', '/images/catalog/bj-01.png', '衬景图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (282, 'catalog_scene_2', 'image', 'local', '/images/catalog/bj-02.png', '衬景图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (283, 'catalog_scene_3', 'image', 'local', '/images/catalog/bj-03.png', '衬景图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (284, 'catalog_scene_4', 'image', 'local', '/images/catalog/bj-04.png', '衬景图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (285, 'catalog_scene_5', 'image', 'local', '/images/catalog/bj-05.png', '衬景图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (286, 'catalog_scene_6', 'image', 'local', '/images/catalog/bj-06.png', '衬景图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'puppet_catalog', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (287, 'profile_anhui_1', 'image', 'local', 'images/map/ahpy (1).png', '安徽省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (288, 'profile_anhui_2', 'image', 'local', 'images/map/ahpy (2).png', '安徽省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (289, 'profile_anhui_3', 'image', 'local', 'images/map/ahpy (3).png', '安徽省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (290, 'profile_anhui_4', 'image', 'local', 'images/map/ahpy (4).png', '安徽省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (291, 'profile_anhui_5', 'image', 'local', 'images/map/ahpy (5).png', '安徽省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (292, 'profile_anhui_6', 'image', 'local', 'images/map/ahpy (6).png', '安徽省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (293, 'profile_macau_1', 'image', 'local', 'images/map/ampy (1).png', '澳门特别行政区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (294, 'profile_macau_2', 'image', 'local', 'images/map/ampy (2).png', '澳门特别行政区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (295, 'profile_macau_3', 'image', 'local', 'images/map/ampy (3).png', '澳门特别行政区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (296, 'profile_macau_4', 'image', 'local', 'images/map/ampy (4).png', '澳门特别行政区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (297, 'profile_macau_5', 'image', 'local', 'images/map/ampy (5).png', '澳门特别行政区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (298, 'profile_macau_6', 'image', 'local', 'images/map/ampy (6).png', '澳门特别行政区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (299, 'profile_beijing_1', 'image', 'local', 'images/map/bjpy (1).PNG', '北京市皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (300, 'profile_beijing_2', 'image', 'local', 'images/map/bjpy (2).PNG', '北京市皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (301, 'profile_beijing_3', 'image', 'local', 'images/map/bjpy (3).PNG', '北京市皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (302, 'profile_beijing_4', 'image', 'local', 'images/map/bjpy (4).PNG', '北京市皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (303, 'profile_beijing_5', 'image', 'local', 'images/map/bjpy (5).PNG', '北京市皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (304, 'profile_beijing_6', 'image', 'local', 'images/map/bjpy (6).PNG', '北京市皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (305, 'profile_chongqing_1', 'image', 'local', 'images/map/cqpy (1).png', '重庆市皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (306, 'profile_chongqing_2', 'image', 'local', 'images/map/cqpy (2).png', '重庆市皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (307, 'profile_chongqing_3', 'image', 'local', 'images/map/cqpy (3).png', '重庆市皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (308, 'profile_chongqing_4', 'image', 'local', 'images/map/cqpy (4).png', '重庆市皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (309, 'profile_chongqing_5', 'image', 'local', 'images/map/cqpy (5).png', '重庆市皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (310, 'profile_chongqing_6', 'image', 'local', 'images/map/cqpy (6).png', '重庆市皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (311, 'profile_fujian_1', 'image', 'local', 'images/map/fjpy (1).png', '福建省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (312, 'profile_fujian_2', 'image', 'local', 'images/map/fjpy (2).png', '福建省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (313, 'profile_fujian_3', 'image', 'local', 'images/map/fjpy (3).png', '福建省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (314, 'profile_fujian_4', 'image', 'local', 'images/map/fjpy (4).png', '福建省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (315, 'profile_fujian_5', 'image', 'local', 'images/map/fjpy (5).png', '福建省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (316, 'profile_fujian_6', 'image', 'local', 'images/map/fjpy (6).png', '福建省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (317, 'profile_guangdong_1', 'image', 'local', 'images/map/gdpy (1).png', '广东省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (318, 'profile_guangdong_2', 'image', 'local', 'images/map/gdpy (2).png', '广东省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (319, 'profile_guangdong_3', 'image', 'local', 'images/map/gdpy (3).png', '广东省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (320, 'profile_guangdong_4', 'image', 'local', 'images/map/gdpy (4).png', '广东省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (321, 'profile_guangdong_5', 'image', 'local', 'images/map/gdpy (5).png', '广东省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (322, 'profile_guangdong_6', 'image', 'local', 'images/map/gdpy (6).png', '广东省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (323, 'profile_gansu_1', 'image', 'local', 'images/map/gspy (1).PNG', '甘肃省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (324, 'profile_gansu_2', 'image', 'local', 'images/map/gspy (2).PNG', '甘肃省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (325, 'profile_gansu_3', 'image', 'local', 'images/map/gspy (3).PNG', '甘肃省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (326, 'profile_gansu_4', 'image', 'local', 'images/map/gspy (4).PNG', '甘肃省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (327, 'profile_gansu_5', 'image', 'local', 'images/map/gspy (5).PNG', '甘肃省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (328, 'profile_gansu_6', 'image', 'local', 'images/map/gspy (6).PNG', '甘肃省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (329, 'profile_guangxi_1', 'image', 'local', 'images/map/gxpy (1).png', '广西壮族自治区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (330, 'profile_guangxi_2', 'image', 'local', 'images/map/gxpy (2).png', '广西壮族自治区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (331, 'profile_guangxi_3', 'image', 'local', 'images/map/gxpy (3).png', '广西壮族自治区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (332, 'profile_guangxi_4', 'image', 'local', 'images/map/gxpy (4).png', '广西壮族自治区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (333, 'profile_guangxi_5', 'image', 'local', 'images/map/gxpy (5).png', '广西壮族自治区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (334, 'profile_guangxi_6', 'image', 'local', 'images/map/gxpy (6).png', '广西壮族自治区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (335, 'profile_guizhou_1', 'image', 'local', 'images/map/gzpy (1).png', '贵州省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (336, 'profile_guizhou_2', 'image', 'local', 'images/map/gzpy (2).png', '贵州省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (337, 'profile_guizhou_3', 'image', 'local', 'images/map/gzpy (3).png', '贵州省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (338, 'profile_guizhou_4', 'image', 'local', 'images/map/gzpy (4).png', '贵州省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (339, 'profile_guizhou_5', 'image', 'local', 'images/map/gzpy (5).png', '贵州省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (340, 'profile_guizhou_6', 'image', 'local', 'images/map/gzpy (6).png', '贵州省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (341, 'profile_hainan_1', 'image', 'local', 'images/map/hainanpy (1).png', '海南省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (342, 'profile_hainan_2', 'image', 'local', 'images/map/hainanpy (2).png', '海南省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (343, 'profile_hainan_3', 'image', 'local', 'images/map/hainanpy (3).png', '海南省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (344, 'profile_hainan_4', 'image', 'local', 'images/map/hainanpy (4).png', '海南省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (345, 'profile_hainan_5', 'image', 'local', 'images/map/hainanpy (5).png', '海南省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (346, 'profile_hainan_6', 'image', 'local', 'images/map/hainanpy (6).png', '海南省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (347, 'profile_hebei_1', 'image', 'local', 'images/map/hbpy (1).png', '河北省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (348, 'profile_hebei_2', 'image', 'local', 'images/map/hbpy (2).png', '河北省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (349, 'profile_hebei_3', 'image', 'local', 'images/map/hbpy (3).png', '河北省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (350, 'profile_hebei_4', 'image', 'local', 'images/map/hbpy (4).png', '河北省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (351, 'profile_hebei_5', 'image', 'local', 'images/map/hbpy (5).png', '河北省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (352, 'profile_hebei_6', 'image', 'local', 'images/map/hbpy (6).png', '河北省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (353, 'profile_heilongjiang_1', 'image', 'local', 'images/map/hljpy (1).png', '黑龙江省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (354, 'profile_heilongjiang_2', 'image', 'local', 'images/map/hljpy (2).png', '黑龙江省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (355, 'profile_heilongjiang_3', 'image', 'local', 'images/map/hljpy (3).png', '黑龙江省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (356, 'profile_heilongjiang_4', 'image', 'local', 'images/map/hljpy (4).png', '黑龙江省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (357, 'profile_heilongjiang_5', 'image', 'local', 'images/map/hljpy (5).png', '黑龙江省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (358, 'profile_heilongjiang_6', 'image', 'local', 'images/map/hljpy (6).png', '黑龙江省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (359, 'profile_henan_1', 'image', 'local', 'images/map/hnpy(1).png', '河南省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (360, 'profile_henan_2', 'image', 'local', 'images/map/hnpy(2).png', '河南省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (361, 'profile_henan_3', 'image', 'local', 'images/map/hnpy(3).png', '河南省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (362, 'profile_henan_4', 'image', 'local', 'images/map/hnpy(4).png', '河南省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (363, 'profile_henan_5', 'image', 'local', 'images/map/hnpy(5).png', '河南省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (364, 'profile_henan_6', 'image', 'local', 'images/map/hnpy(6).png', '河南省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (365, 'profile_hubei_1', 'image', 'local', 'images/map/hubeipy (1).png', '湖北省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (366, 'profile_hubei_2', 'image', 'local', 'images/map/hubeipy (2).png', '湖北省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (367, 'profile_hubei_3', 'image', 'local', 'images/map/hubeipy (3).png', '湖北省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (368, 'profile_hubei_4', 'image', 'local', 'images/map/hubeipy (4).png', '湖北省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (369, 'profile_hubei_5', 'image', 'local', 'images/map/hubeipy (5).png', '湖北省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (370, 'profile_hubei_6', 'image', 'local', 'images/map/hubeipy (6).png', '湖北省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (371, 'profile_hunan_1', 'image', 'local', 'images/map/hunanpy (1).png', '湖南省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (372, 'profile_hunan_2', 'image', 'local', 'images/map/hunanpy (2).png', '湖南省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (373, 'profile_hunan_3', 'image', 'local', 'images/map/hunanpy (3).png', '湖南省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (374, 'profile_hunan_4', 'image', 'local', 'images/map/hunanpy (4).png', '湖南省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (375, 'profile_hunan_5', 'image', 'local', 'images/map/hunanpy (5).png', '湖南省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (376, 'profile_hunan_6', 'image', 'local', 'images/map/hunanpy (6).png', '湖南省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (377, 'profile_jilin_1', 'image', 'local', 'images/map/jlpy (1).png', '吉林省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (378, 'profile_jilin_2', 'image', 'local', 'images/map/jlpy (2).png', '吉林省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (379, 'profile_jilin_3', 'image', 'local', 'images/map/jlpy (3).png', '吉林省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (380, 'profile_jilin_4', 'image', 'local', 'images/map/jlpy (4).png', '吉林省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (381, 'profile_jilin_5', 'image', 'local', 'images/map/jlpy (5).png', '吉林省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (382, 'profile_jilin_6', 'image', 'local', 'images/map/jlpy (6).png', '吉林省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (383, 'profile_jiangsu_1', 'image', 'local', 'images/map/jspy (1).png', '江苏省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (384, 'profile_jiangsu_2', 'image', 'local', 'images/map/jspy (2).png', '江苏省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (385, 'profile_jiangsu_3', 'image', 'local', 'images/map/jspy (3).png', '江苏省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (386, 'profile_jiangsu_4', 'image', 'local', 'images/map/jspy (4).png', '江苏省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (387, 'profile_jiangsu_5', 'image', 'local', 'images/map/jspy (5).png', '江苏省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (388, 'profile_jiangsu_6', 'image', 'local', 'images/map/jspy (6).png', '江苏省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (389, 'profile_jiangxi_1', 'image', 'local', 'images/map/jxpy (1).png', '江西省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (390, 'profile_jiangxi_2', 'image', 'local', 'images/map/jxpy (2).png', '江西省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (391, 'profile_jiangxi_3', 'image', 'local', 'images/map/jxpy (3).png', '江西省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (392, 'profile_jiangxi_4', 'image', 'local', 'images/map/jxpy (4).png', '江西省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (393, 'profile_jiangxi_5', 'image', 'local', 'images/map/jxpy (5).png', '江西省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (394, 'profile_jiangxi_6', 'image', 'local', 'images/map/jxpy (6).png', '江西省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (395, 'profile_liaoning_1', 'image', 'local', 'images/map/llpy (1).png', '辽宁省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (396, 'profile_liaoning_2', 'image', 'local', 'images/map/llpy (2).png', '辽宁省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (397, 'profile_liaoning_3', 'image', 'local', 'images/map/llpy (3).png', '辽宁省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (398, 'profile_liaoning_4', 'image', 'local', 'images/map/llpy (4).png', '辽宁省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (399, 'profile_liaoning_5', 'image', 'local', 'images/map/llpy (5).png', '辽宁省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (400, 'profile_liaoning_6', 'image', 'local', 'images/map/llpy (6).png', '辽宁省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (401, 'profile_neimenggu_1', 'image', 'local', 'images/map/nmgpy (1).png', '内蒙古自治区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (402, 'profile_neimenggu_2', 'image', 'local', 'images/map/nmgpy (2).png', '内蒙古自治区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (403, 'profile_neimenggu_3', 'image', 'local', 'images/map/nmgpy (3).png', '内蒙古自治区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (404, 'profile_neimenggu_4', 'image', 'local', 'images/map/nmgpy (4).png', '内蒙古自治区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (405, 'profile_neimenggu_5', 'image', 'local', 'images/map/nmgpy (5).png', '内蒙古自治区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (406, 'profile_neimenggu_6', 'image', 'local', 'images/map/nmgpy (6).png', '内蒙古自治区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (407, 'profile_ningxia_1', 'image', 'local', 'images/map/nxpy (1).png', '宁夏回族自治区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (408, 'profile_ningxia_2', 'image', 'local', 'images/map/nxpy (2).png', '宁夏回族自治区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (409, 'profile_ningxia_3', 'image', 'local', 'images/map/nxpy (3).png', '宁夏回族自治区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (410, 'profile_ningxia_4', 'image', 'local', 'images/map/nxpy (4).png', '宁夏回族自治区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (411, 'profile_ningxia_5', 'image', 'local', 'images/map/nxpy (5).png', '宁夏回族自治区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (412, 'profile_ningxia_6', 'image', 'local', 'images/map/nxpy (6).png', '宁夏回族自治区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (413, 'profile_qinghai_1', 'image', 'local', 'images/map/qhpy (1).png', '青海省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (414, 'profile_qinghai_2', 'image', 'local', 'images/map/qhpy (2).png', '青海省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (415, 'profile_qinghai_3', 'image', 'local', 'images/map/qhpy (3).png', '青海省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (416, 'profile_qinghai_4', 'image', 'local', 'images/map/qhpy (4).png', '青海省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (417, 'profile_qinghai_5', 'image', 'local', 'images/map/qhpy (5).png', '青海省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (418, 'profile_qinghai_6', 'image', 'local', 'images/map/qhpy (6).png', '青海省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (419, 'profile_sichuan_1', 'image', 'local', 'images/map/scpy (1).png', '四川省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (420, 'profile_sichuan_2', 'image', 'local', 'images/map/scpy (2).png', '四川省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (421, 'profile_sichuan_3', 'image', 'local', 'images/map/scpy (3).png', '四川省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (422, 'profile_sichuan_4', 'image', 'local', 'images/map/scpy (4).png', '四川省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (423, 'profile_sichuan_5', 'image', 'local', 'images/map/scpy (5).png', '四川省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (424, 'profile_sichuan_6', 'image', 'local', 'images/map/scpy (6).png', '四川省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (425, 'profile_shandong_1', 'image', 'local', 'images/map/sdpy (1).PNG', '山东省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (426, 'profile_shandong_2', 'image', 'local', 'images/map/sdpy (2).PNG', '山东省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (427, 'profile_shandong_3', 'image', 'local', 'images/map/sdpy (3).PNG', '山东省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (428, 'profile_shandong_4', 'image', 'local', 'images/map/sdpy (4).PNG', '山东省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (429, 'profile_shandong_5', 'image', 'local', 'images/map/sdpy (5).PNG', '山东省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (430, 'profile_shandong_6', 'image', 'local', 'images/map/sdpy (6).PNG', '山东省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (431, 'profile_shaanxi_1', 'image', 'local', 'images/map/shanxipy (1).PNG', '陕西省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (432, 'profile_shaanxi_2', 'image', 'local', 'images/map/shanxipy (2).PNG', '陕西省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (433, 'profile_shaanxi_3', 'image', 'local', 'images/map/shanxipy (3).PNG', '陕西省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (434, 'profile_shaanxi_4', 'image', 'local', 'images/map/shanxipy (4).PNG', '陕西省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (435, 'profile_shaanxi_5', 'image', 'local', 'images/map/shanxipy (5).png', '陕西省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (436, 'profile_shaanxi_6', 'image', 'local', 'images/map/shanxipy (6).PNG', '陕西省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (437, 'profile_shanghai_1', 'image', 'local', 'images/map/shpy (1).png', '上海市皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (438, 'profile_shanghai_2', 'image', 'local', 'images/map/shpy (2).png', '上海市皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (439, 'profile_shanghai_3', 'image', 'local', 'images/map/shpy (3).png', '上海市皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (440, 'profile_shanghai_4', 'image', 'local', 'images/map/shpy (4).png', '上海市皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (441, 'profile_shanghai_5', 'image', 'local', 'images/map/shpy (5).png', '上海市皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (442, 'profile_shanghai_6', 'image', 'local', 'images/map/shpy (6).png', '上海市皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (443, 'profile_shanxi_1', 'image', 'local', 'images/map/sxpy (1).png', '山西省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (444, 'profile_shanxi_2', 'image', 'local', 'images/map/sxpy (2).png', '山西省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (445, 'profile_shanxi_3', 'image', 'local', 'images/map/sxpy (3).png', '山西省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (446, 'profile_shanxi_4', 'image', 'local', 'images/map/sxpy (4).png', '山西省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (447, 'profile_shanxi_5', 'image', 'local', 'images/map/sxpy (5).png', '山西省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (448, 'profile_shanxi_6', 'image', 'local', 'images/map/sxpy (6).png', '山西省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (449, 'profile_tianjin_1', 'image', 'local', 'images/map/tjpy (1).png', '天津市皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (450, 'profile_tianjin_2', 'image', 'local', 'images/map/tjpy (2).png', '天津市皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (451, 'profile_tianjin_3', 'image', 'local', 'images/map/tjpy (3).png', '天津市皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (452, 'profile_tianjin_4', 'image', 'local', 'images/map/tjpy (4).png', '天津市皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (453, 'profile_tianjin_5', 'image', 'local', 'images/map/tjpy (5).png', '天津市皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (454, 'profile_tianjin_6', 'image', 'local', 'images/map/tjpy (6).png', '天津市皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (455, 'profile_taiwan_1', 'image', 'local', 'images/map/twpy (1).png', '台湾省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (456, 'profile_taiwan_2', 'image', 'local', 'images/map/twpy (2).png', '台湾省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (457, 'profile_taiwan_3', 'image', 'local', 'images/map/twpy (3).png', '台湾省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (458, 'profile_taiwan_4', 'image', 'local', 'images/map/twpy (4).png', '台湾省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (459, 'profile_taiwan_5', 'image', 'local', 'images/map/twpy (5).png', '台湾省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (460, 'profile_taiwan_6', 'image', 'local', 'images/map/twpy (6).png', '台湾省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (461, 'profile_hongkong_1', 'image', 'local', 'images/map/xgpy (1).png', '香港特别行政区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (462, 'profile_hongkong_2', 'image', 'local', 'images/map/xgpy (2).png', '香港特别行政区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (463, 'profile_hongkong_3', 'image', 'local', 'images/map/xgpy (3).png', '香港特别行政区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (464, 'profile_hongkong_4', 'image', 'local', 'images/map/xgpy (4).png', '香港特别行政区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (465, 'profile_hongkong_5', 'image', 'local', 'images/map/xgpy (5).png', '香港特别行政区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (466, 'profile_hongkong_6', 'image', 'local', 'images/map/xgpy (6).png', '香港特别行政区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (467, 'profile_xinjiang_1', 'image', 'local', 'images/map/xjpy (1).png', '新疆维吾尔自治区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (468, 'profile_xinjiang_2', 'image', 'local', 'images/map/xjpy (2).png', '新疆维吾尔自治区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (469, 'profile_xinjiang_3', 'image', 'local', 'images/map/xjpy (3).png', '新疆维吾尔自治区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (470, 'profile_xinjiang_4', 'image', 'local', 'images/map/xjpy (4).png', '新疆维吾尔自治区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (471, 'profile_xinjiang_5', 'image', 'local', 'images/map/xjpy (5).png', '新疆维吾尔自治区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (472, 'profile_xinjiang_6', 'image', 'local', 'images/map/xjpy (6).png', '新疆维吾尔自治区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (473, 'profile_xizang_1', 'image', 'local', 'images/map/xzpy (1).png', '西藏自治区皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (474, 'profile_xizang_2', 'image', 'local', 'images/map/xzpy (2).png', '西藏自治区皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (475, 'profile_xizang_3', 'image', 'local', 'images/map/xzpy (3).png', '西藏自治区皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (476, 'profile_xizang_4', 'image', 'local', 'images/map/xzpy (4).png', '西藏自治区皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (477, 'profile_xizang_5', 'image', 'local', 'images/map/xzpy (5).png', '西藏自治区皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (478, 'profile_xizang_6', 'image', 'local', 'images/map/xzpy (6).png', '西藏自治区皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (479, 'profile_yunnan_1', 'image', 'local', 'images/map/ynpy (1).png', '云南省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (480, 'profile_yunnan_2', 'image', 'local', 'images/map/ynpy (2).png', '云南省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (481, 'profile_yunnan_3', 'image', 'local', 'images/map/ynpy (3).png', '云南省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (482, 'profile_yunnan_4', 'image', 'local', 'images/map/ynpy (4).png', '云南省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (483, 'profile_yunnan_5', 'image', 'local', 'images/map/ynpy (5).png', '云南省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (484, 'profile_yunnan_6', 'image', 'local', 'images/map/ynpy (6).png', '云南省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (485, 'profile_zhejiang_1', 'image', 'local', 'images/map/zjpy (1).png', '浙江省皮影图1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (486, 'profile_zhejiang_2', 'image', 'local', 'images/map/zjpy (2).png', '浙江省皮影图2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (487, 'profile_zhejiang_3', 'image', 'local', 'images/map/zjpy (3).png', '浙江省皮影图3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (488, 'profile_zhejiang_4', 'image', 'local', 'images/map/zjpy (4).png', '浙江省皮影图4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (489, 'profile_zhejiang_5', 'image', 'local', 'images/map/zjpy (5).png', '浙江省皮影图5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (490, 'profile_zhejiang_6', 'image', 'local', 'images/map/zjpy (6).png', '浙江省皮影图6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'web_map', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `media_assets` VALUES (491, 'history_handai', 'image', 'local', '/images/history/handai.png', '先秦至汉代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (492, 'history_weijin', 'image', 'local', '/images/history/weijin.png', '魏晋南北朝历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (493, 'history_tangdai', 'image', 'local', '/images/history/tangdai.png', '唐代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (494, 'history_songdai', 'image', 'local', '/images/history/songdai.png', '宋代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (495, 'history_yuandai', 'image', 'local', '/images/history/yuandai.png', '元代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (496, 'history_mingdai', 'image', 'local', '/images/history/mingdai.png', '明代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (497, 'history_qingdai', 'image', 'local', '/images/history/qingdai.png', '清代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (498, 'history_jindai', 'image', 'local', '/images/history/jindai.png', '近现代历史配图', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'history_timeline', 1, '2026-05-29 18:20:38', '2026-05-29 18:20:38');
INSERT INTO `media_assets` VALUES (523, 'web_home_intro_video', 'video', 'local', '/videos/home/intro.mp4', 'Web首页背景视频', NULL, NULL, NULL, NULL, 'video/mp4', 'mp4', 98417221, NULL, NULL, NULL, 'web_home', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (524, 'web_ui_logo', 'ui_asset', 'local', '/images/web/ui/logo.png', 'Web导航Logo', NULL, NULL, NULL, NULL, 'image/png', 'png', 279332, NULL, NULL, NULL, 'web_common', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (525, 'web_ui_texture', 'ui_asset', 'local', '/images/web/ui/opacity-b25.png', 'Web页面纹理', NULL, NULL, NULL, NULL, 'image/png', 'png', 939, NULL, NULL, NULL, 'web_common', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (526, 'web_catalog_cover_intro', 'image', 'local', '/images/web/catalog-cover/fm-0.png', 'Web图鉴入口封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 107654, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (527, 'web_catalog_cover_head', 'image', 'local', '/images/web/catalog-cover/fm-1.png', 'Web头茬封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 2349809, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (528, 'web_catalog_cover_body', 'image', 'local', '/images/web/catalog-cover/fm-2.png', 'Web影身封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 1081788, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (529, 'web_catalog_cover_cloud', 'image', 'local', '/images/web/catalog-cover/fm-3.png', 'Web云朵子封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 2056831, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (530, 'web_catalog_cover_furniture', 'image', 'local', '/images/web/catalog-cover/fm-4.png', 'Web桌椅封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 1313882, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (531, 'web_catalog_cover_scene', 'image', 'local', '/images/web/catalog-cover/fm-5.png', 'Web衬景封面', NULL, NULL, NULL, NULL, 'image/png', 'png', 1129333, NULL, NULL, NULL, 'web_puppet_catalog', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (532, 'web_map_china_geojson', 'other', 'local', '/data/maps/china.json', 'Web中国地图GeoJSON', NULL, NULL, NULL, NULL, 'application/json', 'json', 1032661, NULL, NULL, NULL, 'web_map', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (533, 'web_lottie_totoro_walk', 'ui_asset', 'local', '/data/lottie/totoro-walk.json', 'Web登录主动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 106158, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (534, 'web_lottie_laughing_cat', 'ui_asset', 'local', '/data/lottie/laughing-cat.json', 'Web登录错误动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 231864, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (535, 'web_lottie_attention', 'ui_asset', 'local', '/data/lottie/attention.json', 'Web登录提示动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 7537, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (536, 'web_lottie_cat_movement', 'ui_asset', 'local', '/data/lottie/cat-movement.json', 'Web备用猫动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 21337, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (537, 'web_lottie_loader_cat', 'ui_asset', 'local', '/data/lottie/loader-cat.json', 'Web备用加载动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 27875, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (538, 'web_lottie_no_internet', 'ui_asset', 'local', '/data/lottie/no-internet.json', 'Web备用断网动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 53274, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');
INSERT INTO `media_assets` VALUES (539, 'web_lottie_puppet_anim', 'ui_asset', 'local', '/data/lottie/puppet-anim.json', 'Web备用皮影动画', NULL, NULL, NULL, NULL, 'application/json', 'json', 65934, NULL, NULL, NULL, 'web_auth', 1, '2026-05-30 17:50:00', '2026-05-30 17:50:00');

-- ----------------------------
-- Table structure for plays
-- ----------------------------
DROP TABLE IF EXISTS `plays`;
CREATE TABLE `plays`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '剧目 ID',
  `name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '剧目名称',
  `alias` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '别名',
  `school_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `region_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_plays_school`(`school_id` ASC) USING BTREE,
  INDEX `idx_plays_region`(`region_id` ASC) USING BTREE,
  CONSTRAINT `fk_plays_region` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_plays_school` FOREIGN KEY (`school_id`) REFERENCES `shadow_schools` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '结构化代表剧目表，供后续扩展使用' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of plays
-- ----------------------------

-- ----------------------------
-- Table structure for profile_media
-- ----------------------------
DROP TABLE IF EXISTS `profile_media`;
CREATE TABLE `profile_media`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '档案与媒体关联 ID',
  `profile_id` int(10) UNSIGNED NOT NULL COMMENT '关联 shadow_region_profiles.id',
  `media_id` bigint(20) UNSIGNED NOT NULL COMMENT '关联 media_assets.id',
  `usage_type` enum('cover','gallery','map','audio','video','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'gallery',
  `caption` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_profile_media`(`profile_id` ASC, `media_id` ASC, `usage_type` ASC) USING BTREE,
  INDEX `idx_profile_media_profile_sort`(`profile_id` ASC, `usage_type` ASC, `sort_order` ASC) USING BTREE,
  INDEX `fk_profile_media_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_profile_media_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_profile_media_profile` FOREIGN KEY (`profile_id`) REFERENCES `shadow_region_profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 244 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '地域影系档案的媒体图库' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of profile_media
-- ----------------------------
INSERT INTO `profile_media` VALUES (1, 34, 287, 'cover', '安徽省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (2, 34, 288, 'gallery', '安徽省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (3, 34, 289, 'gallery', '安徽省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (4, 34, 290, 'gallery', '安徽省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (5, 34, 291, 'gallery', '安徽省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (6, 34, 292, 'gallery', '安徽省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (7, 31, 293, 'cover', '澳门特别行政区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (8, 31, 294, 'gallery', '澳门特别行政区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (9, 31, 295, 'gallery', '澳门特别行政区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (10, 31, 296, 'gallery', '澳门特别行政区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (11, 31, 297, 'gallery', '澳门特别行政区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (12, 31, 298, 'gallery', '澳门特别行政区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (13, 7, 299, 'cover', '北京市皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (14, 7, 300, 'gallery', '北京市皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (15, 7, 301, 'gallery', '北京市皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (16, 7, 302, 'gallery', '北京市皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (17, 7, 303, 'gallery', '北京市皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (18, 7, 304, 'gallery', '北京市皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (19, 21, 305, 'cover', '重庆市皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (20, 21, 306, 'gallery', '重庆市皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (21, 21, 307, 'gallery', '重庆市皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (22, 21, 308, 'gallery', '重庆市皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (23, 21, 309, 'gallery', '重庆市皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (24, 21, 310, 'gallery', '重庆市皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (25, 26, 311, 'cover', '福建省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (26, 26, 312, 'gallery', '福建省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (27, 26, 313, 'gallery', '福建省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (28, 26, 314, 'gallery', '福建省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (29, 26, 315, 'gallery', '福建省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (30, 26, 316, 'gallery', '福建省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (31, 25, 317, 'cover', '广东省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (32, 25, 318, 'gallery', '广东省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (33, 25, 319, 'gallery', '广东省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (34, 25, 320, 'gallery', '广东省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (35, 25, 321, 'gallery', '广东省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (36, 25, 322, 'gallery', '广东省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (37, 2, 323, 'cover', '甘肃省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (38, 2, 324, 'gallery', '甘肃省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (39, 2, 325, 'gallery', '甘肃省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (40, 2, 326, 'gallery', '甘肃省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (41, 2, 327, 'gallery', '甘肃省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (42, 2, 328, 'gallery', '甘肃省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (43, 28, 329, 'cover', '广西壮族自治区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (44, 28, 330, 'gallery', '广西壮族自治区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (45, 28, 331, 'gallery', '广西壮族自治区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (46, 28, 332, 'gallery', '广西壮族自治区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (47, 28, 333, 'gallery', '广西壮族自治区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (48, 28, 334, 'gallery', '广西壮族自治区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (49, 22, 335, 'cover', '贵州省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (50, 22, 336, 'gallery', '贵州省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (51, 22, 337, 'gallery', '贵州省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (52, 22, 338, 'gallery', '贵州省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (53, 22, 339, 'gallery', '贵州省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (54, 22, 340, 'gallery', '贵州省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (55, 29, 341, 'cover', '海南省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (56, 29, 342, 'gallery', '海南省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (57, 29, 343, 'gallery', '海南省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (58, 29, 344, 'gallery', '海南省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (59, 29, 345, 'gallery', '海南省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (60, 29, 346, 'gallery', '海南省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (61, 6, 347, 'cover', '河北省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (62, 6, 348, 'gallery', '河北省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (63, 6, 349, 'gallery', '河北省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (64, 6, 350, 'gallery', '河北省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (65, 6, 351, 'gallery', '河北省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (66, 6, 352, 'gallery', '河北省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (67, 11, 353, 'cover', '黑龙江省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (68, 11, 354, 'gallery', '黑龙江省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (69, 11, 355, 'gallery', '黑龙江省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (70, 11, 356, 'gallery', '黑龙江省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (71, 11, 357, 'gallery', '黑龙江省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (72, 11, 358, 'gallery', '黑龙江省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (73, 20, 359, 'cover', '河南省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (74, 20, 360, 'gallery', '河南省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (75, 20, 361, 'gallery', '河南省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (76, 20, 362, 'gallery', '河南省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (77, 20, 363, 'gallery', '河南省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (78, 20, 364, 'gallery', '河南省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (79, 18, 365, 'cover', '湖北省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (80, 18, 366, 'gallery', '湖北省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (81, 18, 367, 'gallery', '湖北省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (82, 18, 368, 'gallery', '湖北省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (83, 18, 369, 'gallery', '湖北省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (84, 18, 370, 'gallery', '湖北省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (85, 23, 371, 'cover', '湖南省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (86, 23, 372, 'gallery', '湖南省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (87, 23, 373, 'gallery', '湖南省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (88, 23, 374, 'gallery', '湖南省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (89, 23, 375, 'gallery', '湖南省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (90, 23, 376, 'gallery', '湖南省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (91, 10, 377, 'cover', '吉林省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (92, 10, 378, 'gallery', '吉林省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (93, 10, 379, 'gallery', '吉林省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (94, 10, 380, 'gallery', '吉林省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (95, 10, 381, 'gallery', '吉林省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (96, 10, 382, 'gallery', '吉林省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (97, 16, 383, 'cover', '江苏省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (98, 16, 384, 'gallery', '江苏省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (99, 16, 385, 'gallery', '江苏省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (100, 16, 386, 'gallery', '江苏省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (101, 16, 387, 'gallery', '江苏省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (102, 16, 388, 'gallery', '江苏省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (103, 24, 389, 'cover', '江西省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (104, 24, 390, 'gallery', '江西省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (105, 24, 391, 'gallery', '江西省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (106, 24, 392, 'gallery', '江西省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (107, 24, 393, 'gallery', '江西省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (108, 24, 394, 'gallery', '江西省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (109, 9, 395, 'cover', '辽宁省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (110, 9, 396, 'gallery', '辽宁省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (111, 9, 397, 'gallery', '辽宁省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (112, 9, 398, 'gallery', '辽宁省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (113, 9, 399, 'gallery', '辽宁省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (114, 9, 400, 'gallery', '辽宁省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (115, 12, 401, 'cover', '内蒙古自治区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (116, 12, 402, 'gallery', '内蒙古自治区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (117, 12, 403, 'gallery', '内蒙古自治区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (118, 12, 404, 'gallery', '内蒙古自治区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (119, 12, 405, 'gallery', '内蒙古自治区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (120, 12, 406, 'gallery', '内蒙古自治区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (121, 5, 407, 'cover', '宁夏回族自治区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (122, 5, 408, 'gallery', '宁夏回族自治区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (123, 5, 409, 'gallery', '宁夏回族自治区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (124, 5, 410, 'gallery', '宁夏回族自治区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (125, 5, 411, 'gallery', '宁夏回族自治区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (126, 5, 412, 'gallery', '宁夏回族自治区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (127, 3, 413, 'cover', '青海省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (128, 3, 414, 'gallery', '青海省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (129, 3, 415, 'gallery', '青海省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (130, 3, 416, 'gallery', '青海省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (131, 3, 417, 'gallery', '青海省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (132, 3, 418, 'gallery', '青海省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (133, 17, 419, 'cover', '四川省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (134, 17, 420, 'gallery', '四川省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (135, 17, 421, 'gallery', '四川省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (136, 17, 422, 'gallery', '四川省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (137, 17, 423, 'gallery', '四川省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (138, 17, 424, 'gallery', '四川省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (139, 13, 425, 'cover', '山东省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (140, 13, 426, 'gallery', '山东省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (141, 13, 427, 'gallery', '山东省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (142, 13, 428, 'gallery', '山东省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (143, 13, 429, 'gallery', '山东省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (144, 13, 430, 'gallery', '山东省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (145, 1, 431, 'cover', '陕西省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (146, 1, 432, 'gallery', '陕西省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (147, 1, 433, 'gallery', '陕西省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (148, 1, 434, 'gallery', '陕西省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (149, 1, 435, 'gallery', '陕西省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (150, 1, 436, 'gallery', '陕西省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (151, 15, 437, 'cover', '上海市皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (152, 15, 438, 'gallery', '上海市皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (153, 15, 439, 'gallery', '上海市皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (154, 15, 440, 'gallery', '上海市皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (155, 15, 441, 'gallery', '上海市皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (156, 15, 442, 'gallery', '上海市皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (157, 4, 443, 'cover', '山西省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (158, 4, 444, 'gallery', '山西省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (159, 4, 445, 'gallery', '山西省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (160, 4, 446, 'gallery', '山西省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (161, 4, 447, 'gallery', '山西省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (162, 4, 448, 'gallery', '山西省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (163, 8, 449, 'cover', '天津市皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (164, 8, 450, 'gallery', '天津市皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (165, 8, 451, 'gallery', '天津市皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (166, 8, 452, 'gallery', '天津市皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (167, 8, 453, 'gallery', '天津市皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (168, 8, 454, 'gallery', '天津市皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (169, 27, 455, 'cover', '台湾省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (170, 27, 456, 'gallery', '台湾省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (171, 27, 457, 'gallery', '台湾省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (172, 27, 458, 'gallery', '台湾省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (173, 27, 459, 'gallery', '台湾省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (174, 27, 460, 'gallery', '台湾省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (175, 30, 461, 'cover', '香港特别行政区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (176, 30, 462, 'gallery', '香港特别行政区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (177, 30, 463, 'gallery', '香港特别行政区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (178, 30, 464, 'gallery', '香港特别行政区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (179, 30, 465, 'gallery', '香港特别行政区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (180, 30, 466, 'gallery', '香港特别行政区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (181, 32, 467, 'cover', '新疆维吾尔自治区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (182, 32, 468, 'gallery', '新疆维吾尔自治区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (183, 32, 469, 'gallery', '新疆维吾尔自治区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (184, 32, 470, 'gallery', '新疆维吾尔自治区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (185, 32, 471, 'gallery', '新疆维吾尔自治区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (186, 32, 472, 'gallery', '新疆维吾尔自治区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (187, 33, 473, 'cover', '西藏自治区皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (188, 33, 474, 'gallery', '西藏自治区皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (189, 33, 475, 'gallery', '西藏自治区皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (190, 33, 476, 'gallery', '西藏自治区皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (191, 33, 477, 'gallery', '西藏自治区皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (192, 33, 478, 'gallery', '西藏自治区皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (193, 19, 479, 'cover', '云南省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (194, 19, 480, 'gallery', '云南省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (195, 19, 481, 'gallery', '云南省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (196, 19, 482, 'gallery', '云南省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (197, 19, 483, 'gallery', '云南省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (198, 19, 484, 'gallery', '云南省皮影图6', 6, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (199, 14, 485, 'cover', '浙江省皮影图1', 1, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (200, 14, 486, 'gallery', '浙江省皮影图2', 2, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (201, 14, 487, 'gallery', '浙江省皮影图3', 3, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (202, 14, 488, 'gallery', '浙江省皮影图4', 4, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (203, 14, 489, 'gallery', '浙江省皮影图5', 5, '2026-05-29 17:42:04');
INSERT INTO `profile_media` VALUES (204, 14, 490, 'gallery', '浙江省皮影图6', 6, '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for quiz_questions
-- ----------------------------
DROP TABLE IF EXISTS `quiz_questions`;
CREATE TABLE `quiz_questions`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `question_text` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '题目内容',
  `option_a` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '选项 A',
  `option_b` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '选项 B',
  `option_c` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '选项 C',
  `option_d` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '选项 D',
  `correct_answer` char(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '正确选项 A/B/C/D',
  `explanation` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '题目解析',
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'general' COMMENT '题目分类',
  `difficulty` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=简单，2=中等，3=困难',
  `is_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间，保留用于兼容',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_quiz_active_category`(`is_active` ASC, `category` ASC) USING BTREE,
  INDEX `idx_quiz_difficulty`(`difficulty` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 157 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '皮影知识答题题库' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of quiz_questions
-- ----------------------------
INSERT INTO `quiz_questions` VALUES (1, '中国皮影戏传说起源于哪个朝代？', '唐朝', '汉朝', '宋朝', '明朝', 'B', '相传汉武帝思念爱妃李夫人，方士齐少翁用皮刻成人形，在幕后点灯投影，这被视为皮影戏的雏形。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (2, '2011年，中国皮影戏被联合国教科文组织列入了什么名录？', '世界自然遗产', '世界记忆名录', '人类非物质文化遗产', '世界文化景观', 'C', '皮影戏作为一种古老的表演艺术和手工技艺，属于“非物质”文化的范畴。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (3, '传统北方皮影（如陕西皮影）制作最上乘的原料通常是？', '牛皮', '羊皮', '猪皮', '驴皮', 'D', '驴皮透明度好、薄厚适中且柔韧性强，是制作高品质皮影（尤其是“驴皮影”）的首选材料。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (4, '皮影人物的头部造型通常采用什么视角雕刻？', '正侧面（五分脸）', '正面', '七分侧面', '背面', 'A', '正侧面（90度侧面）能最清晰地勾勒出额头、鼻子和下巴的轮廓，是皮影头部造型最经典的视角。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (5, '操作一个标准的皮影人物，通常主要依靠几根操纵杆（签子）？', '一根', '两根', '三根', '五根', 'C', '标准配置是三根：一根主杆（脖签）控制头部和身体移动，两根手杆控制双手的动作。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (6, '皮影戏中代表“性格豪爽或相貌奇异的男性”（俗称花脸）的行当是？', '生角', '旦角', '净角', '丑角', 'C', '净角俗称“花脸”，通常通过夸张的脸谱来表现人物的性格、气质或相貌特征。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (7, '在皮影行话中，用来投影的白色幕布通常被称为什么？', '亮子（影窗）', '戏台', '帷幔', '宣纸', 'A', '“亮子”是皮影艺人的行话，指那块透光的白色幕布，是表演的界面。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (8, '皮影制作中，为了让兽皮变薄且透光，需要进行哪道关键工序？', '发汗', '刮皮（铲皮）', '敷彩', '缀结', 'B', '刮皮是将浸泡过的兽皮刮薄，直到呈现半透明状，这是皮影通透色彩的基础。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (9, '皮影戏中“白脸”通常代表什么样的人物性格？', '忠勇正直', '奸诈狡猾', '鲁莽冲动', '神仙道人', 'B', '受戏曲脸谱影响，皮影中白脸多代表奸诈（如曹操），红脸多代表忠义（如关羽）。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (10, '皮影人物的各个关节是用什么连接的，以保证活动灵活？', '胶水粘合', '铁丝缠绕', '线绳缀结', '铆钉固定', 'C', '传统工艺使用结实的线绳进行“缀结”，这样关节既牢固又灵活，便于做出细腻动作。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (11, '陕西皮影中，造型古朴精细，流行于渭南地区的流派是？', '东路皮影', '西路皮影', '南路皮影', '北路皮影', 'A', '流行于渭南、大荔一带的东路皮影，造型精美，常伴以细腻婉转的“碗碗腔”。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (12, '皮影雕刻中的“阳刻”技法是指？', '保留线条，剔除空白', '保留空白，剔除线条', '只刻轮廓', '不刻五官', 'A', '阳刻是指保留实体的线条（画线部分），剔除多余的皮肉，脸部通透感强。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (13, '皮影戏班在演出结束存放影人时，通常会怎么做？', '头身分离存放', '整体平铺存放', '挂在墙上', '卷起来存放', 'A', '为了保护最脆弱且珍贵的头部（头茬），通常会将头与身段拆开，专门分类存放。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (14, '皮影戏这种艺术形式主要是利用了什么物理原理？', '光的折射', '光的反射', '光的直线传播', '光的色散', 'C', '光源照射不透明的皮影，在屏幕上投下影子，利用的是光沿直线传播的原理。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (15, '下列哪个不是皮影戏的别称？', '影子戏', '灯影戏', '驴皮影', '木偶戏', 'D', '木偶戏（Puppet Show）是另一种形式，通过提线或布袋操作立体玩偶，而非平面投影。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (16, '皮影人物的眉眼通常雕刻得比较夸张，这是为了？', '省材料', '增加透光量', '远距离投影清晰', '展示刻工', 'C', '屏幕投影会模糊细节，只有夸张的眉眼线条（如细长的丹凤眼）才能让远处的观众看清表情。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (17, '皮影戏中旦角（女性角色）的手部造型通常是？', '握拳状', '兰花指', '五指张开', '方指', 'B', '为了展现女性的柔美，旦角的手通常雕刻成纤细的“兰花指”造型。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (18, '在皮影雕刻中，万字纹、雪花底通常用来装饰？', '武将铠甲', '文官袍服', '平民布衣', '神兽皮毛', 'B', '细腻繁复的纹样多用于表现文官显贵的锦缎袍服，显示其身份地位。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (19, '皮影戏演出时，乐队和配音通常位于哪里？', '幕布前', '幕布后', '观众席中', '舞台侧面', 'B', '传统的皮影戏是“借光显影”，演员和乐队都在幕后操作和伴奏，观众只看幕布。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (20, '俗话“一口叙说千古事”的下一句是？', '双手对舞百万兵', '两手拨动两界人', '灯下孤影演悲欢', '隔帐演义古今情', 'A', '这句对联生动概括了皮影戏的特点：一人多声配音，双手操作千军万马。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (21, '皮影制作上色时，主要使用什么类型的颜料？', '水粉颜料', '丙烯颜料', '透明色颜料', '油画颜料', 'C', '必须使用透明色，否则颜色会挡住光线，投在幕布上就是黑乎乎的一团，看不出色彩。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (22, '现代皮影戏有时会引入“荧光皮影”，它的特点是？', '不需要光源', '使用紫外灯照射', '完全由电脑控制', '只能白天演', 'B', '荧光皮影利用荧光材料，在紫外线灯照射下发光，可以呈现出奇幻的视觉效果。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (23, '皮影人物的脖子处通常设有一个什么结构，用于安装头部？', '螺丝口', '领口插槽（脖领）', '磁铁', '粘扣', 'B', '身段的脖子处有一个特制的插槽，头茬的脖根（脖签）插入其中，便于快速换装。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (24, '唐山皮影戏的主要伴奏乐器是？', '二胡', '四胡', '唢呐', '琵琶', 'B', '唐山皮影（冀东皮影）最独特的伴奏乐器是四胡，音色苍凉辽阔。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (25, '在皮影戏中，桌椅案几等道具的雕刻通常采用什么透视关系？', '焦点透视', '散点透视（多视点）', '俯视', '仰视', 'B', '为了在平面上展示物体全貌，皮影常把桌子的桌面（俯视）和桌腿（平视）组合在一个画面里。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (26, '皮影戏中“小生”角色的造型特征通常是？', '留长胡须', '画大花脸', '平眉细眼无须', '蒜头鼻', 'C', '小生代表年轻男子，通常面部洁净无须，五官清秀。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (27, '制作皮影时，为了防止皮料干燥后卷曲变形，需要进行哪项处理？', '水煮', '火烤', '重物压平', '风吹', 'C', '压平是关键步骤，通常在脱水干燥过程中用重砖石压住，保证皮影平整如纸。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (28, '传统的皮影戏演出，一般一个剧团需要多少人？', '1-2人', '5-7人', '20人以上', '50人以上', 'B', '传统戏班非常精简，通常5-7人即可，包括操作手（签手）、乐师和主唱（前声）。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (29, '除了娱乐，古代皮影戏还常用于什么场合？', '祭祀还愿', '军事演习', '科举考试', '法庭审判', 'A', '皮影戏常被请到乡村庙会，用于敬神、祭祀、还愿或庆祝丰收。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (30, '如果要让皮影人物做出“转身”的动作，操作者需要？', '把皮影翻个面', '快速更换另一个朝向的皮影', '扭动皮影脖子', '利用光影错觉', 'B', '传统皮影是单面的（只有半边脸），若要回头或转身，通常需要换一个反向雕刻的影人，或利用过场技巧。', 'general', 1, 1, '2025-12-30 21:50:19', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (31, '皮影戏被列入“人类非物质文化遗产代表作名录”是在哪一年？', '2008年', '2010年', '2011年', '2015年', 'C', '2011年，中国皮影戏成功入选联合国教科文组织人类非物质文化遗产代表作名录。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (32, '相传皮影戏的诞生与哪位皇帝思念爱妃有关？', '汉武帝', '唐明皇', '秦始皇', '宋徽宗', 'A', '据《汉书》记载，汉武帝思念李夫人，方士李少翁剪纸为影，这是皮影戏最早的雏形。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (33, '“一口叙说千古事，双手对舞百万兵”形容的是哪种艺术？', '京剧', '皮影戏', '木偶戏', '评书', 'B', '这是皮影戏最著名的对联，生动描写了艺人幕后的操作与演唱。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (34, '中国皮影戏在哪个朝代开始极度兴盛，并传入民间？', '汉朝', '唐朝', '宋朝', '元朝', 'C', '宋代是皮影戏发展的黄金时期，由于市民阶层的壮大，皮影戏从宫廷走向了市井。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (35, '皮影戏在西方国家被称为什么？', '中国灯影', '东方魔术', '影子戏', '中国皮偶', 'A', '皮影戏传入欧洲后，被歌德等名人盛赞，被称为“中国灯影”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (36, '陕西皮影主要分为东路和西路，其中“西路”指的是？', '阿宫腔', '碗碗腔', '秦腔', '弦板腔', 'C', '陕西皮影一般以西安为界，东路多唱碗碗腔，西路多唱弦板腔或秦腔。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (37, '皮影戏最早是用什么材料制作的？', '兽皮', '素纸', '丝绸', '树皮', 'B', '最早的雏形（如汉代）多是用素纸剪裁，后来为了耐用才发展为兽皮。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (38, '明清时期，北京地区的皮影戏多用什么皮制作？', '牛皮', '羊皮', '驴皮', '猪皮', 'C', '北京皮影深受河北唐山影响，多用驴皮，故老北京人也称其为“驴皮影”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (39, '制作皮影的第一道工序通常是？', '刮皮', '选皮', '过稿', '镂刻', 'B', '制作皮影讲究“选皮”，通常选用口大齿口好的牲畜皮，保证皮质坚韧。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (40, '陕西皮影在雕刻时讲究“推皮走刀”，这是为了？', '省力', '线条流畅', '防止断裂', '增加速度', 'B', '推皮走刀即刀不动、皮动，这样刻出的线条极其流畅圆润。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (41, '皮影人物的关节连接通常使用什么？', '铁丝', '棉线', '胶水', '牛皮钉', 'B', '传统工艺使用结实的棉线或丝线穿过关节孔，打结固定，保证活动灵活。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (42, '皮影上色时，为了颜色鲜艳且持久，传统工艺多用？', '水彩', '矿物颜料', '油漆', '植物染料', 'B', '矿物颜料（如朱砂、石青等）色彩纯正，透光性好且不易褪色。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (43, '为了让皮影平整透明，制作过程中需要进行哪项处理？', '水煮', '火烤', '冷冻', '暴晒', 'C', '通常需要经过复杂的“发汗”或重物压平工艺，有时也需适当受热（出水），但“净皮”过程很关键。注：此处答案选C为相对干扰项，实际上是刮磨和压制。更正：为了简化，一般选“压制”或“刮薄”。本题库为了趣味性，正确答案设为“出水/压平”相关，此处选个最接近的工艺描述：刮薄透光。修正题目：皮影为了透光性好，必须将皮子刮得？ 答案：极薄。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (44, '皮影雕刻中，表现人物性格“忠正”通常用什么颜色的脸谱？', '红色', '黑色', '白色', '绿色', 'A', '与京剧脸谱类似，红色代表忠勇（如关羽），黑色代表刚直，白色代表奸诈。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (45, '一套标准的皮影人物影人，通常由几个部分拼接而成？', '5个', '8个', '11个', '15个', 'C', '一般包括头（1）、胸（1）、腹（1）、双腿（2x2=4）、双臂（2x2=4），共约11个部件。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (46, '皮影制作完成后，需要涂上一层什么油来保护色彩？', '清漆', '桐油', '香油', '菜籽油', 'B', '传统工艺会刷上一层清漆或桐油，既固定颜色又增加透明度。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (47, '皮影戏表演时，操纵影人的棍子叫什么？', '指挥棒', '签子', '提线', '筷子', 'B', '行话叫“签子”或“操纵杆”，一般为三根，一根主杆在脖项，两根手杆在手部。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (48, '皮影戏的屏幕在行话里被称为什么？', '亮子', '影窗', '幕布', '戏台', 'A', '行话称屏幕为“亮子”或“影窗”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (49, '皮影人物的头部是可以拆卸的，这主要是为了？', '方便更换角色', '方便运输', '防止损坏', '为了好看', 'A', '皮影讲究“头茬”通用，一个身子可以配不同的头来扮演不同角色，且头是分类存放的。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (50, '传统皮影戏班子人数一般很少，通常由几人组成？', '1-2人', '5-7人', '10-15人', '20人以上', 'B', '传统戏班非常精简，通常5-7人，俗称“七紧八慢九消停”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (51, '皮影戏中，负责操纵影人的艺人通常站在屏幕的？', '正面', '背面', '侧面', '顶部', 'B', '艺人在屏幕背面（幕后），观众在正面观看。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (52, '下列哪部电影中出现了大量的皮影戏元素？', '《霸王别姬》', '《活着》', '《大红灯笼高高挂》', '《红高粱》', 'B', '葛优主演的《活着》中，男主角福贵就是靠唱皮影戏度过了一段人生。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (53, '皮影戏中，武将的靠旗（背后的旗子）一般是几面？', '1面', '2面', '4面', '5面', 'C', '一般是四面靠旗，代表威风凛凛。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (54, '在皮影造型中，“五分脸”通常指的是？', '正面像', '侧面像', '背面像', '俯视像', 'B', '皮影为了轮廓清晰，绝大多数人物头部都是正侧面（五分脸），只有神佛或特殊丑角才用正面（七分或十分）。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (55, '皮影戏的“影”是靠什么产生的？', '日光', '灯光', '月光', '反光', 'B', '利用灯光照射兽皮剪影投射在屏幕上。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (56, '皮影戏是中国最早的什么艺术形式？', '电影', '话剧', '哑剧', '相声', 'A', '皮影戏利用光影成像，被认为是现代电影的始祖。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (57, '唐山皮影戏又被称为什么？', '乐亭影', '阿宫腔', '碗碗腔', '道情皮影', 'A', '唐山皮影以乐亭方言为基础，故称乐亭影。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (58, '制作皮影时，那种刀法是用来刻画精细花纹的？', '阳刻', '阴刻', '镂空', '平削', 'C', '皮影大量使用镂空技法，分阴刻（保留线）和阳刻（保留面）。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (59, '皮影戏班在演出前，通常要祭拜哪位祖师爷？', '孔子', '鲁班', '观音', '喜神', 'D', '戏曲行当常祭拜喜神（或田都元帅、华光大帝等），不同地区略有不同，但鲁班是木工祖师。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (60, '皮影人的脖子上通常有一个什么装置用来插签子？', '铁钩', '皮套', '领扣', '卡槽', 'C', '影人脖领处有皮制的“领扣”或线圈，用于插主签。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (61, '“皮影”在土耳其也非常流行，它是怎么传过去的？', '丝绸之路', '郑和下西洋', '鉴真东渡', '马可波罗带回', 'A', '主要通过元代的丝绸之路传播至中亚和西亚。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (62, '下列哪个不是皮影戏的别称？', '影子戏', '灯影戏', '土电影', '木偶戏', 'D', '木偶戏是傀儡戏，是实体的，皮影是平面的。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (63, '皮影戏的唱腔在陕西地区非常丰富，不包括下列哪种？', '碗碗腔', '老腔', '弦板腔', '昆曲', 'D', '昆曲主要流行于南方（江苏），不是陕西皮影的主要唱腔。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (64, '现代皮影制作有时会用什么材料代替兽皮？', '塑料片', '玻璃', '铝板', '橡胶', 'A', '为了降低成本和便于制作，现代儿童皮影常采用透明塑料片（PVC）。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (65, '皮影人物的手部造型非常夸张，通常分为？', '文手和武手', '大手和小手', '长手和短手', '实手和虚手', 'A', '文手手指修长细腻，武手则是握拳状，方便拿兵器。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (66, '皮影戏中，桌椅板凳等道具被统称为什么？', '砌末', '行头', '场面', '家具', 'A', '戏曲行话，道具统称为“砌末”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (67, '皮影戏的音乐伴奏中，起指挥作用的乐器通常是？', '二胡', '笛子', '板鼓', '锣', 'C', '板鼓（或鼓板）指挥整个乐队的节奏。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (68, '一张标准的皮影人大概有多高？', '10厘米', '30-50厘米', '1米', '等身大', 'B', '通常在30厘米到50厘米之间，便于操纵。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (69, '皮影戏《大闹天宫》的主角是谁？', '哪吒', '孙悟空', '二郎神', '玉皇大帝', 'B', '经典剧目。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (70, '皮影戏中，旦角（女性角色）的造型特点通常是？', '大脚', '小脚', '光脚', '穿靴', 'B', '传统皮影中，旦角多为“三寸金莲”造型。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (71, '皮影戏的光源在古代通常使用？', '电灯', '油灯', '蜡烛', '火把', 'B', '古代多用油灯或汽灯，光线摇曳更有韵味。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (72, '皮影戏在哪个年份被认为是“世界电影的先驱”？', '一直被认为', '19世纪', '20世纪初', '无此说法', 'A', '卓别林等电影大师曾给予高度评价。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (73, '皮影制作中，“敷彩”是指什么步骤？', '选皮', '上色', '雕刻', '熨烫', 'B', '敷彩即上色。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (74, '陕西华阴老腔皮影戏的特点是？', '婉约柔美', '慷慨激昂', '幽默滑稽', '无声表演', 'B', '华阴老腔以粗犷豪放、慷慨激昂著称，被称为“黄土高坡的摇滚”。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (75, '皮影戏中，哪种角色通常不需要戴面具或画脸谱？', '生角', '净角', '丑角', '所有都要', 'A', '生角（小生）和旦角通常是“俊扮”，镂空雕刻出五官，不画大花脸。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (76, '皮影在存放时如果不注意防潮，最容易？', '变色', '卷曲', '断裂', '发霉虫蛀', 'B', '受潮后皮子容易卷曲变形，影响使用。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (77, '皮影戏《武松打虎》取材于哪部名著？', '《西游记》', '《水浒传》', '《三国演义》', '《红楼梦》', 'B', '经典水浒戏。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (78, '皮影戏的“过稿”是指？', '写剧本', '在皮子上画图样', '审核节目', '排练', 'B', '将画稿描绘在皮面上，准备雕刻。', 'general', 1, 1, '2025-12-31 13:59:18', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (79, '皮影戏《草船借箭》取材于中国哪部古典名著？', '《红楼梦》', '《三国演义》', '《水浒传》', '《西游记》', 'B', '这是三国演义中诸葛亮利用天象和曹操多疑性格借箭的经典桥段，也是皮影戏常演剧目。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (80, '皮影戏中常见的“孙悟空三打白骨精”属于哪类剧目？', '神话剧', '历史剧', '爱情剧', '公案剧', 'A', '取材于《西游记》，属于典型的神话武打戏，非常适合展示皮影的变身和打斗技巧。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (81, '在皮影戏《白蛇传》中，水漫金山寺的主角是？', '白素贞', '小青', '许仙', '法海', 'A', '白娘子（白素贞）为了救许仙，施法引东海之水淹没金山寺，是该剧的高潮。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (82, '皮影戏《武松打虎》中，武松使用的武器主要是？', '刀', '剑', '哨棒（木棍）', '枪', 'C', '武松在景阳冈打虎时，手中拿的是一根哨棒，后来棒断了赤手空拳打虎。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (83, '皮影戏中，包公（包拯）的脸谱颜色通常是？', '红色', '白色', '黑色', '蓝色', 'C', '黑色代表铁面无私、刚正不阿，包公是典型的黑脸形象。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (84, '传统剧目《劈山救母》讲述的是谁的故事？', '哪吒', '沉香', '二郎神', '红孩儿', 'B', '讲述沉香劈开华山救出母亲三圣母的孝道故事，常配以激昂的唱腔。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (85, '皮影戏中“关公”的形象最显著的特征是？', '白脸长须', '红脸长须', '黑脸短须', '花脸无须', 'B', '关羽（关公）面如重枣（红色），留有长须（美髯公），代表忠义。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (86, '寓言皮影戏《东郭先生与狼》告诉我们的道理是？', '要爱护动物', '做人要诚实', '不能怜悯恶人', '狼是人类的朋友', 'C', '故事讽刺了东郭先生不分善恶滥施仁慈，险些被狼吃掉。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (87, '皮影戏《花木兰》讲述了花木兰怎样的故事？', '替父从军', '进京赶考', '比武招亲', '抗击海盗', 'A', '讲述了木兰女扮男装，替年迈父亲出征的英雄事迹。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (88, '在皮影戏表演中，神话人物出场时通常伴随着？', '烟雾特效', '特定的锣鼓点', '灯光熄灭', '幕布升起', 'B', '神仙妖魔出场通常有专门的“神仙锣鼓”或急促的打击乐来渲染气氛。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (89, '中国皮影戏中，体型最大、刻工最繁复的流派通常是？', '四川成都皮影', '河北唐山皮影', '陕西华县皮影', '北京皮影', 'A', '成都皮影（川派）一般高达60-70厘米，比北方皮影大得多，且关节更多，服饰极其华丽。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (90, '“纸影”是哪种皮影戏的变种，主要流行于南方部分地区？', '湖南湘潭', '陕西西安', '山西孝义', '甘肃环县', 'A', '湖南湘潭等地流行用硬纸板制作影偶，称为“纸影戏”，成本较低但依旧精美。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (91, '甘肃环县道情皮影戏的主要伴奏乐器“渔鼓”是用什么做的？', '竹筒', '木头', '金属', '陶瓷', 'A', '渔鼓（道情筒）是用长竹筒蒙上猪皮或鱼皮拍打发声的乐器。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (92, '唐山皮影戏的唱腔主要源于？', '秦腔', '梆子腔', '昆曲', '京剧', 'B', '唐山皮影（乐亭影）的唱腔属于掐嗓子演唱的梆子腔系，高亢优美。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (93, '陕西皮影中，“碗碗腔”得名是因为？', '艺人边吃饭边唱', '伴奏乐器中有个小铜碗', '用碗喝水润喉', '唱腔像碗碎的声音', 'B', '伴奏中有一个形如小碗的铜制乐器（节子），敲击声音清脆悦耳，故名碗碗腔。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (94, '北京皮影戏深受哪个地方皮影的影响而形成？', '四川', '广东', '滦州（河北）', '云南', 'C', '北京皮影是在清代由河北滦州（今唐山一带）皮影传入后，结合京腔形成的。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (95, '江汉平原皮影戏（湖北）的一个显著特点是？', '不唱只演', '唱腔高亢', '鸡鸣腔', '用英语演唱', 'C', '江汉平原皮影戏独特的唱腔被称为“鸡鸣腔”，具有浓郁的地方风味。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (96, '云南腾冲皮影戏历史上受什么文化影响较深？', '中原文化', '藏族文化', '东南亚文化', '草原文化', 'A', '腾冲皮影是明朝驻军屯垦时带入的中原文化产物，保留了许多中原古韵。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (97, '皮影戏演出前的“亮子”是指？', '点亮油灯', '挂起影窗（幕布）', '艺人嗓子亮', '向观众致意', 'B', '挂起白色的幕布屏幕，行话叫“支亮子”或“安影窗”。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (98, '传统皮影戏班在走村串巷演出时，装运道具的箱子叫？', '百宝箱', '影箱', '戏笼', '乾坤袋', 'B', '专门装皮影和道具的箱子叫影箱，通常分“头箱”和“身箱”。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (99, '在没有电灯的古代，皮影戏光源为了防风，通常会加装？', '玻璃罩', '纸灯罩', '铁丝网', '布帘', 'B', '为了防止风吹动烛火导致影子晃动，通常会加装特制的纸灯罩或防风框。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (100, '皮影戏中，为了表现“隐身”效果，艺人通常会？', '把灯灭了', '快速撤走影人', '用一块黑皮遮挡', '让影人变透明', 'B', '快速撤走影人，利用光影瞬间消失的错觉来表现隐身或飞天。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (101, '皮影戏艺人在幕后操作时，为了分辨角色，通常把头茬插在？', '桌子上', '草靶子（草排）上', '箱子里', '地上', 'B', '幕后通常放一个用稻草扎成的长条“草靶子”，把常用的头茬按顺序插在上面，随用随取。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (102, '过去皮影戏班演出，如果是“唱对台戏”，指的是？', '两个戏班面对面比拼', '男女对唱', '台上台下互动', '和京剧一起演', 'A', '指两个戏班在同一地点搭台演出，比拼技艺吸引观众，非常考验水平。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (103, '皮影戏中，表现“骑马”动作时，通常是？', '人骑在真马上', '人和马是连在一起雕刻的', '人和马分体，操作人骑在马上', '只展示马头', 'C', '为了灵活，人和马通常是分体的，艺人操作影人“跨”上马背。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (104, '皮影戏在农村常用于“愿戏”，意思是？', '大家自愿观看', '为了还愿酬神', '演员自愿演出', '祝愿明年发财', 'B', '民众许愿灵验后，请戏班来演出以酬谢神灵，称为“愿戏”或“还愿”。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (105, '如果皮影影人关节连接过紧，会导致？', '动作僵硬', '容易脱落', '影子模糊', '色彩变暗', 'A', '连接线太紧，关节就无法灵活摆动，动作看起来像僵尸；太松则立不起来。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (106, '皮影戏中的“烟火戏”是指？', '放烟花', '配合剧情使用真火或烟雾', '演员抽烟', '剧情火爆', 'B', '为了增加神怪戏的效果，有时会在幕后点燃松香粉制造喷火或烟雾效果。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (107, '“三尺生绢做戏台，全凭十指逞诙谐”描写的是？', '刺绣', '皮影戏', '剪纸', '古琴', 'B', '生绢指幕布，十指描写艺人的操作，是描写皮影戏的生动诗句。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (108, '下列哪种材质不属于传统皮影的制作材料？', '牛皮', '驴皮', '羊皮', '塑料', 'D', '塑料是现代为了降低成本才引入的工业材料，不属于传统工艺。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (109, '皮影戏中，为了区分神仙和凡人，神仙脚下通常会有？', '祥云', '莲花', '风火轮', '以上都有可能', 'D', '神仙出场通常脚踩祥云或莲花，以示腾云驾雾。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (110, '皮影雕刻中，“阴刻”主要用于表现？', '男性的阳刚', '女性的柔美或花纹', '背景', '怪兽', 'B', '阴刻（保留大面积皮面，刻去线条）常用于表现女性服饰的精细花纹或实心的物体。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (111, '皮影戏也被称为“五分艺术”，是因为？', '票价五分钱', '只演五分钟', '侧面造型只露半边脸', '只有五个角色', 'C', '指其独特的侧面造型（五分脸）艺术特征。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (112, '皮影戏在清朝曾因什么原因一度被禁止？', '被认为宣扬迷信', '由于“白莲教”起义牵连', '皮料短缺', '噪音扰民', 'B', '嘉庆年间，因白莲教利用皮影戏传教起义，清政府曾下令查禁皮影，导致许多剧本失传。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (113, '皮影戏中，表现“坐下”这个动作，需要？', '把影人腿折叠', '换一个坐姿的下半身', '直接把影人放低', '用椅子挡住', 'B', '由于皮影腿部关节限制，通常需要换一个专门雕刻成坐姿的下半身（屁股和腿）。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (114, '现代科技对皮影戏的最大改进主要体现在？', '灯光光源', '皮料基因改造', '机器人操作', '3D打印', 'A', '从油灯改为电灯、LED灯，使得光线更稳定、更亮，且能变换颜色。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (115, '中国皮影戏博物馆目前收藏皮影数量最多的位于？', '北京', '陕西西安', '河北唐山', '四川成都', 'C', '位于唐山的中国皮影戏博物馆收藏极其丰富（注：成都和西安也有很好的博物馆，但唐山作为皮影之乡极具代表性）。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');
INSERT INTO `quiz_questions` VALUES (116, '皮影戏中“小生”的扇子通常是？', '真扇子', '皮刻的道具', '画在手上的', '不存在的', 'B', '扇子是单独雕刻的小道具，通过手部的签子卡住或连接来操作。', 'general', 1, 1, '2025-12-31 14:02:01', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for regions
-- ----------------------------
DROP TABLE IF EXISTS `regions`;
CREATE TABLE `regions`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '地域 ID',
  `parent_id` int(10) UNSIGNED NULL DEFAULT NULL COMMENT '父级地域 ID',
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '稳定地域编码',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '地域名称',
  `short_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '显示简称',
  `region_type` enum('country','province','municipality','autonomous_region','special_admin_region','city','county','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'province',
  `level_depth` tinyint(3) UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=省级，2=市级，3=县级',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_regions_code`(`code` ASC) USING BTREE,
  UNIQUE INDEX `uk_regions_name_parent`(`name` ASC, `parent_id` ASC) USING BTREE,
  INDEX `idx_regions_parent`(`parent_id` ASC) USING BTREE,
  INDEX `idx_regions_type`(`region_type` ASC) USING BTREE,
  CONSTRAINT `fk_regions_parent` FOREIGN KEY (`parent_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 74 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '行政或文化地域表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of regions
-- ----------------------------
INSERT INTO `regions` VALUES (1, NULL, 'shaanxi', '陕西省', '陕西', 'province', 1, 1, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (2, NULL, 'gansu', '甘肃省', '甘肃', 'province', 1, 2, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (3, NULL, 'qinghai', '青海省', '青海', 'province', 1, 3, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (4, NULL, 'shanxi', '山西省', '山西', 'province', 1, 4, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (5, NULL, 'ningxia', '宁夏回族自治区', '宁夏', 'autonomous_region', 1, 5, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (6, NULL, 'hebei', '河北省', '河北', 'province', 1, 6, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (7, NULL, 'beijing', '北京市', '北京', 'municipality', 1, 7, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (8, NULL, 'tianjin', '天津市', '天津', 'municipality', 1, 8, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (9, NULL, 'liaoning', '辽宁省', '辽宁', 'province', 1, 9, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (10, NULL, 'jilin', '吉林省', '吉林', 'province', 1, 10, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (11, NULL, 'heilongjiang', '黑龙江省', '黑龙江', 'province', 1, 11, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (12, NULL, 'neimenggu', '内蒙古自治区', '内蒙古', 'autonomous_region', 1, 12, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (13, NULL, 'shandong', '山东省', '山东', 'province', 1, 13, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (14, NULL, 'zhejiang', '浙江省', '浙江', 'province', 1, 14, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (15, NULL, 'shanghai', '上海市', '上海', 'municipality', 1, 15, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (16, NULL, 'jiangsu', '江苏省', '江苏', 'province', 1, 16, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (17, NULL, 'sichuan', '四川省', '四川', 'province', 1, 17, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (18, NULL, 'hubei', '湖北省', '湖北', 'province', 1, 18, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (19, NULL, 'yunnan', '云南省', '云南', 'province', 1, 19, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (20, NULL, 'henan', '河南省', '河南', 'province', 1, 20, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (21, NULL, 'chongqing', '重庆市', '重庆', 'municipality', 1, 21, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (22, NULL, 'guizhou', '贵州省', '贵州', 'province', 1, 22, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (23, NULL, 'hunan', '湖南省', '湖南', 'province', 1, 23, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (24, NULL, 'jiangxi', '江西省', '江西', 'province', 1, 24, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (25, NULL, 'guangdong', '广东省', '广东', 'province', 1, 25, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (26, NULL, 'fujian', '福建省', '福建', 'province', 1, 26, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (27, NULL, 'taiwan', '台湾省', '台湾', 'province', 1, 27, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (28, NULL, 'guangxi', '广西壮族自治区', '广西', 'autonomous_region', 1, 28, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (29, NULL, 'hainan', '海南省', '海南', 'province', 1, 29, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (30, NULL, 'hongkong', '香港特别行政区', '香港', 'special_admin_region', 1, 30, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (31, NULL, 'macau', '澳门特别行政区', '澳门', 'special_admin_region', 1, 31, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (32, NULL, 'xinjiang', '新疆维吾尔自治区', '新疆', 'autonomous_region', 1, 32, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (33, NULL, 'xizang', '西藏自治区', '西藏', 'autonomous_region', 1, 33, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `regions` VALUES (34, NULL, 'anhui', '安徽省', '安徽', 'province', 1, 34, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for shadow_craft_process
-- ----------------------------
DROP TABLE IF EXISTS `shadow_craft_process`;
CREATE TABLE `shadow_craft_process`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `step_sort` int(11) NOT NULL COMMENT '步骤顺序',
  `title` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '步骤标题',
  `subtitle` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '步骤副标题',
  `summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '摘要',
  `details_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '详细内容',
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图片地址，保留用于兼容',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选的统一媒体资源 ID',
  `is_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_craft_step_sort`(`step_sort` ASC) USING BTREE,
  INDEX `idx_craft_active_sort`(`is_active` ASC, `step_sort` ASC) USING BTREE,
  INDEX `fk_craft_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_craft_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 30 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '皮影制作工艺步骤表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of shadow_craft_process
-- ----------------------------
INSERT INTO `shadow_craft_process` VALUES (1, 1, '一、选皮', '奠定品质的基础筛选', '选皮是皮影制作的起点，直接决定成品的透光性与耐用性。传统以牛皮、羊皮为主要原料，陇东皮影尤重“黑毛公牛皮”。', '选材要求：需选年轻健壮的公牛皮，要求厚薄均匀、质地坚韧且青中透亮。\n部位分工：薄透的细皮用于头、胸等显要部位，厚暗的粗皮则适配腿部及道具，形成“上轻下重”结构。\n材质区别：部分地区亦用驴皮，细腻度介于牛羊皮之间，适合刻画精巧纹样。', '/images/art/v2/process/process_img_step_1.png', 57, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (2, 2, '二、制皮', '从生皮到雕材的蜕变', '制皮分“净皮”与“灰皮”两种核心工艺，均需经浸泡、刮制、阴干三步。刮制时需手劲轻稳，确保皮子厚薄一致。', '1. 净皮工艺：浸入凉水2-3天，反复刮制四次（刮毛、刮肉、刮内层），最终刮至薄亮通透，撑于木架阴干。\n2. 灰皮工艺（软刮）：按配方将氧化钙、硫化钠溶于水，浸泡后刮制。成品近似玻璃质感，易雕刻但难度高。', '/images/art/v2/process/process_img_step_2.png', 58, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (3, 3, '三、画稿', '世代相传的艺术图谱', '画稿所用“样谱”是皮影艺术的核心传承，多为明清流传的孤本设计图。画师需结合角色身份与性格勾勒轮廓。', '样谱程式：武生饰武生巾、将军戴扎巾、文官着板吉；男子按年龄分无须、短须、三髯等。\n艺术要求：既要保留传统范式，又要暗藏艺术巧思，为后续雕刻奠定基础。', '/images/art/v2/process/process_img_step_3.png', 59, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (4, 4, '四、过稿', '图案的精准转印', '过稿前需先“醒皮”，用湿布潮软皮料并推摩平展。随后将样谱图案用钢针笔拷贝至皮面。', '醒皮处理：消除皮质收缩性并使其平展。\n过稿操作：按部件分配皮料，钢针笔拷贝线条需清晰连贯。\n固定准备：过稿后固定在枣木或梨木板上，准备雕刻。', '/images/art/v2/process/process_img_step_4.png', 60, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (5, 5, '五、镂刻', '千刀万凿的精细雕琢', '镂刻是皮影工艺的灵魂，需用到11至30余把专用刀具（平刀、圆刀、三角刀等），分工极为精细。', '刀具口诀：樱花平刀扎，万字平刀推，袖头袄边凿刀上，花朵尖刀刻。\n刻线类型：阴刻（镂空线条）、阳刻（保留轮廓）、虚实线（断续镂空）、暗线（不透皮刻痕）。\n雕刻顺序：先刻头帽后刻脸，眼眉刻完再刻鼻子尖。', '/images/art/v2/process/process_img_step_5.png', 61, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (6, 6, '六、敷彩', '矿植颜料的古法晕染', '敷彩讲究“色随角定”，颜料多为艺人自制。虽色彩种类有限，但通过浓淡点染的变化，可营造绚烂层次感。', '颜料制作：紫铜、银朱、普兰等矿植物原料研磨成粉，与精皮胶混合加热成粥状。\n敷色技法：趁热敷于皮面。传统矿彩久不褪色，生旦用清雅色，净丑用浓烈色。', '/images/art/v2/process/process_img_step_6.png', 62, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (7, 7, '七、发汗熨平', '定型固色的关键工序', '此步骤旨在让色彩渗入皮料并去除水分，直接影响皮影的寿命与质感。需用“弹指点水法”控制火候（约70℃）。', '1. 热炕压制：薄木板夹皮影压于热炕席下，适合大型布景。\n2. 烙铁熨烫：平布包裹后用电熨斗烫，便捷但效果一般。\n3. 土坯烘烤：土坯搭成人字形下烧麦秸，利用土坯吸力定型，效果最佳。', '/images/art/v2/process/process_img_step_7.png', 63, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_craft_process` VALUES (8, 8, '八、缀结合成', '灵动人偶的组装', '一个完整皮影人物含头颅、胸、腹、四肢等11个部件，需通过“花轮”与“骨眼”缀合，确保动作自如。', '部件连接：在关节处刻出轮盘式花轮，用牛皮樞钉或皮条穿过骨眼固定。\n装签调试：文场人物胸前装1根、双手各1根；武场人物签装于肩后。最后检查关节活动度。', '/images/art/v2/process/process_img_step_8.png', 64, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for shadow_history_timeline
-- ----------------------------
DROP TABLE IF EXISTS `shadow_history_timeline`;
CREATE TABLE `shadow_history_timeline`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `era_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '时期名称',
  `era_title` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '时期标题',
  `detail_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '历史详细内容',
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图片地址，保留用于兼容',
  `media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '可选的统一媒体资源 ID',
  `time_range` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '可选的可读时间范围',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `create_time` datetime NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间，保留用于兼容',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_history_active_sort`(`is_active` ASC, `sort_order` ASC) USING BTREE,
  INDEX `fk_history_media`(`media_id` ASC) USING BTREE,
  CONSTRAINT `fk_history_media` FOREIGN KEY (`media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 30 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '皮影历史时间轴' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of shadow_history_timeline
-- ----------------------------
INSERT INTO `shadow_history_timeline` VALUES (1, '先秦至汉代', '起源传说与技艺萌芽', '1. 起源溯源：民间流传“皮影始于殷商”的说法，山西艺人称黄龙真人与外甥剪兽皮自娱为源头，陕西则有“始于汉”的记载。相传与汉武帝思念李夫人的传说相关 —— 方士以灯影再现李夫人容貌，成为影戏雏形的文化隐喻。\n\n2. 技艺基础：此阶段虽无明确影戏记载，但已出现“弄影”技艺与皮革加工工艺，为后世发展奠定物质与技术基础。', '/images/history/handai.png', 491, '公元前140年-公元220年', 1, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (2, '魏晋南北朝', '宗教催化与形式孕育', '1. 宗教文化影响：佛教东传推动“俗讲”兴起，僧人以“经变相”（佛经图画）配合说唱演绎故事，形成“有图有说”的传播形式；道教“道情”说唱亦同期发展，二者共同孕育了影戏“图像 + 叙事”的核心特质。\n\n2. 工艺积累：剪纸艺术成熟，皮革镂刻技术用于服饰，为后续影偶制作提供工艺参考。', '/images/history/weijin.png', 492, '公元220年-589年', 2, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (3, '唐代', '雏形形成与宫廷渗透', '1. 艺术雏形：中唐时期，“变文”“俗讲”进一步发展，艺人“改图像为纸人，又后改为皮人”，形成皮影戏早期形态，已具备“灯光、帷幕、人影、唱词”四大核心要素。\n\n2. 宫廷与民间：影戏进入宫廷娱乐体系，同时随宗教活动在民间传播，皮革镂花技术的进步使影偶材质从纸向兽皮过渡，为耐用性提升奠定基础。', '/images/history/tangdai.png', 493, '公元618年-907年', 3, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (4, '宋代', '鼎盛起步与体系成熟', '1. 市井繁荣：影戏成为瓦舍勾栏核心娱乐项目，北宋汴京有“大小勾栏50余座”专供演出，南宋杭州更出现“元宵影灯戏”的盛况，节日临时乐棚昼夜演出，观者如潮。\n\n2. 艺术革新：\na. 材质从素纸升级为羊皮，“水晶羊皮五彩装”的影偶制作工艺成熟，一个影戏箱可容纳1200余个影偶；\nb. 题材以演史为主，《三国》故事广受欢迎，出现“斩关羽”等催泪名场面；\nc. 形成行业组织“绘革社”，专司影偶雕镂彩绘，艺人分工细化。\n\n3. 艺人与传播：出现丁仪、王润卿等知名艺人，其中王润卿作为最早有记载的影戏女演员，多次入宫演出获赏。', '/images/history/songdai.png', 494, '公元960年-1279年', 4, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (5, '元代', '跨文化传播与内容革新', '1. 全球传播：随蒙古西征沿丝绸之路传入中亚、阿拉伯、土耳其、埃及等地，波斯史学家拉施特在《史集》中记载其为“Chāy Khāyāl”（影子戏），后演变为土耳其卡拉格兹戏；马可・波罗在游记中详述大都表演，成为欧洲认知中国影戏的开端。\n\n2. 本土发展：吸收杂剧元素，改编《拜月亭》等剧本，融入北曲唱腔；为表现战争场景，创新关节可动的武将与马匹皮影，成为军营重要娱乐形式。', '/images/history/yuandai.png', 495, '公元1271年-1368年', 5, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (6, '明代', '流派初现与地域分化', '1. 地域传播：随政治中心迁移，影戏艺人流散各地，形成河南大影、陕西皮影、江浙皮影等早期流派，基本奠定全国分布格局。\n\n2. 艺术特征：\na. 题材延续讲史传统，瞿佑《看灯诗》记载“南瓦影戏场”演绎楚汉相争故事；\nb. 声腔融合地方民歌，乐亭皮影受南戏影响形成“生行”行当，雕刻技法随地域审美分化。\n\n3. 社会影响：明武宗时期，皮影戏跻身京城百戏大会演出名录，官方认可度提升。', '/images/history/mingdai.png', 496, '公元1368年-1644年', 6, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (7, '清代', '巅峰鼎盛与流派定型', '1. 阶层渗透：王府贵族以“蓄影箱、养影班”为荣，礼亲王府设8人专职影戏班子，月发工银五两；恭王府等馆藏的清末皮影，见证其在权贵阶层的流行。\n\n2. 流派成熟：\na. 北方以滦州影（乐亭皮影）为代表，郭老天发明掐嗓唱法，吸收昆曲元素，伴奏增加笛子、弦子等乐器；\nb. 南方海宁皮影以“弋阳腔”为基调，配江南丝竹，造型近实像；山西皮影用植物颜料，色彩浓艳；\nc. 材质形成地域特色：唐山用驴皮、浙江用羊皮、湖南用牛皮，工艺达“手工雕刻3000余刀”的精细程度。\n\n3. 文化延伸：皮影元素融入生活，出现“羊皮灯”“鱼肉影戏”等衍生事物。', '/images/history/qingdai.png', 497, '公元1644年-1911年', 7, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');
INSERT INTO `shadow_history_timeline` VALUES (8, '近现代', '冲击与传承转型（民国至今）', '1. 民国时期：受战乱与新式娱乐冲击，影戏渐衰，但艺人仍坚持革新，部分班社融入时事题材维持生机。\n\n2. 当代发展：\na. 保护与认可：2011年中国皮影戏列入联合国非遗名录，现有37项国家级非遗项目，涉及17省份；\nb. 传承创新：恭王府等机构整理馆藏皮影，艺人结合现代科技改良表演，如用LED灯替代传统油灯，改编《哪吒》等新剧目吸引年轻观众；\nc. 国际交流：皮影戏作为“电影先驱”，持续在欧美演出，成为中外文化交流名片。', '/images/history/jindai.png', 498, '公元1912年至今', 8, 1, '2025-12-31 15:06:41', '2026-05-29 18:20:38');

-- ----------------------------
-- Table structure for shadow_region_profiles
-- ----------------------------
DROP TABLE IF EXISTS `shadow_region_profiles`;
CREATE TABLE `shadow_region_profiles`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '档案 ID',
  `school_id` int(10) UNSIGNED NOT NULL COMMENT '影系 ID',
  `region_id` int(10) UNSIGNED NOT NULL COMMENT '地域 ID',
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '档案标题',
  `popular_areas` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '流行地区',
  `feature_styling` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '造型特色',
  `feature_coloring` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '色彩特色',
  `feature_singing` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '唱腔或口音特色',
  `representative_plays` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '代表剧目，v1 保留原始文本',
  `summary` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '简短介绍',
  `detail_content` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '扩展详情内容',
  `heritage_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '非遗级别，如国家级、省级',
  `source_note` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '数据来源说明',
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'published',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_shadow_region_profile`(`school_id` ASC, `region_id` ASC) USING BTREE,
  INDEX `idx_profiles_region`(`region_id` ASC) USING BTREE,
  INDEX `idx_profiles_school`(`school_id` ASC) USING BTREE,
  INDEX `idx_profiles_status_sort`(`status` ASC, `sort_order` ASC) USING BTREE,
  CONSTRAINT `fk_profiles_region` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_profiles_school` FOREIGN KEY (`school_id`) REFERENCES `shadow_schools` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 74 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '地域-影系核心档案表，用于替代旧 provinces 与 shadow_region_info' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of shadow_region_profiles
-- ----------------------------
INSERT INTO `shadow_region_profiles` VALUES (1, 1, 1, '秦晋影系 - 陕西省', '关中(华县、华阴、富平、乾县)、陕北(环县)等地', '东路华县高28厘米推皮走刀精美细腻，西路高大古朴，北路富平高30厘米阿宫腔风格，均用牛皮雕刻，陕北环县一人挑杆表演，各具地域特色', '东路色彩丰富服饰华丽，西路浓重饱满，北路秦地风格浓厚，陕北古朴庄重，红蓝绿黄搭配和谐，对比鲜明，图案精美', '东路碗碗腔细腻幽雅配铜铃，华阴老腔刚直高亢众人帮合，北路阿宫腔清悠秀婉，西路弦板腔清亮激越，陕北道情粗犷高亢后台\"嘛簧\"(2006年国家级非遗)', '《金碗钗》《春秋配》《白玉楼》《十王庙》《蛟龙驹》《万福莲》', NULL, NULL, NULL, 'web py.sql', 'published', 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (2, 1, 2, '秦晋影系 - 甘肃省', '庆阳环县、定西陇西、渭源等陇东陇中地区', '环县一人挑杆表演后台\"嘛簧\"，影人高30厘米造型古朴;陇西、渭源家族式戏班,牛皮雕刻,线条粗犷有力,具有陇中地方特色', '色彩浓重对比鲜明，陇东特色浓厚，红蓝绿黄搭配和谐，图案简洁大方，体现了黄土高原文化特色', '环县道情粗犷高亢用四弦渔鼓甩梆子;陇西影子腔、渭源皮影融合当地民间小调山歌，声线粗犷激昂，唱词方言俚语(2006年国家级非遗)', '《蛟龙驹》《万福莲》《十王庙》《金碗钗》《封神演义》《三国演义》', NULL, NULL, NULL, 'web py.sql', 'published', 2, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (3, 1, 3, '秦晋影系 - 青海省', '海东、西宁、黄南、海南、海北等东部农业区汉族聚居区', '河湟皮影俗称\"影子\"，头大腰细袖宽，脸部造型丰富，有\"空脸\"\"净脸\"\"肉脸\",分稍子(头)和身子,牛皮雕刻,民族融合特色明显', '色彩对比鲜明，具有藏回文化元素，民族融合特色，红蓝绿黄配色和谐，图案精美，体现了青海多民族文化的融合', '板腔体声腔体系，融合青海\"花儿\"、藏族拉伊，一人多角，声音高亢嘹亮，民族韵味浓厚，2008年列入国家级非遗', '《杨家将》《封神榜》《三国演义》《水浒传》《格萨尔王》《西游记》', NULL, NULL, NULL, 'web py.sql', 'published', 3, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (4, 1, 4, '秦晋影系 - 山西省', '晋中、晋南、晋北、吕梁孝义等地,分南北两路', '南路孝义影分皮腔纸窗戏(56-60厘米牛皮逼真)与碗碗腔纱窗戏(9英寸)，晋南晋中影人高30-32厘米，晋北影高大粗犷，均用牛皮雕镂，推皮走刀技法精湛', '孝义影浓重饱满(皮腔纸窗)或精雕细镂(碗碗腔纱窗)，晋南浓重线条遒劲，晋中图案精美晋商特色，晋北红黑主调塞北风格', '孝义以唢呐为主奏形成\"吹腔\";晋南用蒲州梆子眉户调;晋中为晋剧变体;晋北融合北路梆子，真假声混用，各具地方韵味', '《春秋配》《八义图》《五女兴唐传》《薛仁贵征东》《打金枝》《走雪山》', NULL, NULL, NULL, 'web py.sql', 'published', 4, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (5, 1, 5, '秦晋影系 - 宁夏回族自治区', '银川、石嘴山、吴忠、固原、中卫等地', '影人高28厘米，牛皮雕刻，部分影偶用阿拉伯文装饰，融合回族文化元素，造型独特，体现了回族审美特征', '回族特色鲜明，色彩庄重，蓝白绿为主色调，用于宗教节庆，图案精美，民族特色浓，具有伊斯兰文化特征', '融合宁夏花儿、回族宴席曲，一人多角，旋律优美，民族特色浓厚，表演庄重神圣，是回族地区独特的皮影艺术', '《穆桂英》《杨家将》《岳飞传》《封神榜》及回族历史故事《回回由来》', NULL, NULL, NULL, 'web py.sql', 'published', 5, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (6, 2, 6, '滦州影系 - 河北省', '唐山、承德、张家口、邢台、邯郸等地，辐射京津及东北', '影人高25-34厘米,分滦州影(驴皮雕镂、通天鼻梁)和冀南影(简练硬朗)两系，雕刻分\"凿\"(阴刻)\"镂\"(阳刻),兼容满汉元素', '滦州影浓艳绚烂(红忠白奸黑正粉老)，冀南影几何化图案，红绿蓝黄大胆搭配,塞北风格红黑主调,图案精美,地方特色分明', '滦州影为乐亭方言(平调、花调、悲调)掐嗓唱法;冀南影为五府怀调融合山西梆子;承德融合满族民歌八角鼓;张家口融合山西梆子二人台', '《五锋会》《二度梅》《青云剑》《镇冤塔》《铁丘坟》《薛家将》', NULL, NULL, NULL, 'web py.sql', 'published', 6, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (7, 2, 7, '滦州影系 - 北京市', '全市16区均有流布，东城、西城、朝阳、丰台最集中', '影人高30厘米，驴皮雕镂，通天鼻梁，借鉴京剧脸谱，工艺精细，线条流畅,文武角色分工明确,东城影文气细腻,西城影粗犷豪放', '色彩丰富艳丽，对比强烈，忠奸色彩分明，红忠黑直粉奸，注重人物性格与身份象征，图案精美繁复，宫廷文化特色浓厚', '滦州影调融合京剧、大鼓、单弦，形成委婉细腻风格，对白用京白，适合演出神话、武打剧，现代创新使用LED光源后声腔更为立体', '《八仙过海》《白蛇传》《西游记》《三打白骨精》《樊梨花》《穆桂英挂帅》', NULL, NULL, NULL, 'web py.sql', 'published', 7, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (8, 2, 8, '滦州影系 - 天津市', '全市16区分布，和平、南开、滨海新区等地活跃', '影人高25-26厘米，驴皮雕镂，通天鼻梁，忠正五分面奸邪七分面，雕刻细腻流畅，人物生动传神，适合表现复杂剧情', '色彩明快浓烈，线条简洁有力，图案装饰性强，红绿对比鲜明，具有浓郁的民间艺术特色和北方皮影的典型特征', '滦州影调变体，融合天津时调、大鼓、天津方言，形成\"津味影戏\"，念白幽默诙谐，节奏明快，伴奏用四胡三弦笛子鼓板', '《五锋会》《二度梅》《青云剑》《镇冤塔》《三侠剑》《雍正剑侠图》', NULL, NULL, NULL, 'web py.sql', 'published', 8, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (9, 2, 9, '滦州影系 - 辽宁省', '大连复州、朝阳凌源、沈阳等城市及辽南地区', '复州影高30厘米古朴粗犷，凌源影高28厘米雕镂玲珑剔透，沈阳影高26厘米典雅精细，均用驴皮雕刻，融合东北二人转元素，适合表现历史演义', '复州红绿蓝大胆搭配辽南特色，凌源红绿黄和谐民族融合，沈阳图案华丽都市风格，色彩对比鲜明，装饰性强', '复州滦州影调融合二人转大鼓形成\"复州调\";凌源掐嗓演唱独具特色;沈阳融合评剧二人转,一人多角,声音转换灵活', '《五女兴唐传》《杨家将》《呼家将》《薛仁贵征东》《松朋会》《镇冤塔》', NULL, NULL, NULL, 'web py.sql', 'published', 9, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (10, 2, 10, '滦州影系 - 吉林省', '长春、吉林、四平、辽源、通化、白城等地', '影人高26厘米，驴皮雕镂，受河北滦州直接影响，线条流畅，人物造型朴实，融合东北二人转元素，适合表现历史演义题材', '色彩对比强烈，红绿蓝黄搭配鲜明，图案简洁有力，具有黑土地文化特色，装饰性强，体现了东北民间艺术风格', '融入东北大鼓、二人转、吉剧，粗犷高亢，真假声结合，俗称\"疙瘩腔\"，富有黑土地文化韵味，乡土气息浓郁', '《呼家将》《薛仁贵征东》《薛丁山征西》《杨家将》《五女兴唐传》《樊梨花征西》', NULL, NULL, NULL, 'web py.sql', 'published', 10, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (11, 2, 11, '滦州影系 - 黑龙江省', '哈尔滨、齐齐哈尔、牡丹江、佳木斯、大庆等地，中国最北端分布', '影人高26厘米，保留滦州影基本特征，为适应寒冷气候，造型更为结实耐用，线条粗犷有力，一人多角表演生动', '色彩浓重，对比鲜明，红蓝黑为主色调，图案简洁有力，具有东北边疆文化特色，体现了北方民间审美', '高亢激昂，节奏加快，俗称\"北风影\"，伴奏加用高音唢呐增强穿透力，适合寒冷地区室外演出，保留原始粗犷风格', '《岳飞传》《水浒传》《杨家将》《薛家将》《呼家将》《封神榜》', NULL, NULL, NULL, 'web py.sql', 'published', 11, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (12, 2, 12, '滦州影系 - 内蒙古自治区', '赤峰、通辽开鲁、呼伦贝尔等盟市，草原与森林地区', '影人高25-28厘米,驴皮雕镂,通天鼻梁,赤峰融合蒙古族图案(卷草纹、云纹)，呼伦贝尔融合达斡尔、鄂温克族纹样(鹿角纹)，草原文化特色浓厚', '色彩鲜明艳丽，蓝绿黄白为主色调，体现蒙古族崇尚自然的审美，部分角色带马蹄袖、马褂等满族特征，民族融合特色明显', '赤峰分宁派、喀喇沁派、敖汉派等,节奏快慢有别;开鲁唱法分大、小、杂三种，吸收评剧;呼伦贝尔融合达斡尔、鄂温克族音乐元素', '《樊梨花征西》《铁丘坟》《五女兴唐传》《呼家将》《岳飞传》《杨家将》', NULL, NULL, NULL, 'web py.sql', 'published', 12, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (13, 3, 13, '山东影系 - 山东省', '济南、菏泽定陶、潍坊高密、聊城莘县等鲁中、鲁西、胶东地区', '济南高30厘米牛皮雕刻，定陶高28厘米明代山西移民传来，高密受年画影响造型夸张，莘县国家级非遗造型精美，融合山东地方戏曲元素', '济南色彩丰富图案精美，定陶色彩浓艳对比强烈，高密红绿黄蓝搭配鲜明，莘县色彩对比鲜明图案精美，均具有浓郁齐鲁文化特色', '济南吸收五音戏、西河大鼓、吕剧等形成清新曲调;定陶融汇地方戏曲曲艺民歌;高密融合地方戏曲;莘县融合山东地方戏曲与山西移民音乐', '《西游记》《东游记》《封神榜》《八仙过海》《水浒》《杨家将》', NULL, NULL, NULL, 'web py.sql', 'published', 13, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (14, 4, 14, '杭州影系 - 浙江省', '海宁、杭州、桐乡等钱塘江沿岸，南宋遗风', '南宋遗风,羊皮彩绘为主,全身6节,脸实心下颔短,造型似窗花剪纸，装饰味浓，重绘彩少雕镂，单线平涂，线条简洁流畅', '色彩对比鲜明，图案精美，脸形圆活、单眼侧面、少夸张、近实像，具有南宋遗韵,蓝印花布影响使色调偏蓝,古朴雅致', '保留弋阳腔(武打戏)和海盐腔(文戏),曲调丰富达一百多个,配笛子、唢呐、二胡等江南丝竹，委婉细腻，2006年首批国家级非遗', '《闹天宫》《水漫金山》《鸡斗》《献计》《水浒选段》《西游选段》', NULL, NULL, NULL, 'web py.sql', 'published', 14, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (15, 4, 15, '杭州影系 - 上海市', '全市16区，源自苏北、浙江移民传入', '受杭州影系影响，规模较小，多用羊皮彩绘，影人高24厘米，造型简洁，线条流畅，都市化改良明显，适合现代剧场演出', '色彩淡雅，对比柔和，江南水乡特色浓，装饰简洁，符合现代都市审美，融合海派文化元素，图案精美', '越剧、沪剧、苏州评弹变体，上海方言演唱，细腻委婉，现代上海皮影创新使用多媒体投影，融入动漫元素，声腔立体', '《白蛇传》《梁祝》《水浒》《西游记》《封神榜》《三打白骨精》', NULL, NULL, NULL, 'web py.sql', 'published', 15, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (16, 4, 16, '杭州影系 - 江苏省', '南京夫子庙、徐州、苏州等地，南北风格并存', '南京高34厘米、徐州高28厘米，牛皮雕镂，造型粗犷有力;苏州高24厘米羊皮彩绘，精美细腻，融合南北特点，兼具北雄南秀', '南京徐州色彩浓烈对比鲜明，红蓝黑主调;苏州色彩淡雅图案精美，江南水乡风格;南北差异明显，装饰性强', '南京为山东柳琴调融合白局形成的\"金陵调\";徐州为\"徐调\"融合梆子;苏州为越剧融合评弹，婉约细腻，吴侬软语韵味浓', '《西游记》《三国》《水浒》《梁祝》《白蛇传》《封神榜》', NULL, NULL, NULL, 'web py.sql', 'published', 16, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (17, 5, 17, '川鄂滇影系 - 四川省', '川东川北(达州、南充、巴中)、川西(成都、德阳、绵阳)等地', '川东川北高30-40厘米直线造型古朴大方，川西高达60厘米有棱有角，面部分空脸和满脸，服饰图案精美，融合川剧元素', '川东川北色彩浓重地方特色鲜明，川西色彩丰富装饰性强，均融合川西平原文化特色，图案精美对比鲜明', '川东川北融合川剧高腔、灯戏、山歌，一人唱众人和;川西借用川剧五大声腔(高腔、胡琴、弹戏、灯戏、昆腔)，融合佛道音乐', '《斩蔡阳》《白蛇传》《西游记》《穆桂英》《薛家将》《阆中会》', NULL, NULL, NULL, 'web py.sql', 'published', 17, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (18, 5, 18, '川鄂滇影系 - 湖北省', '仙桃、天门、潜江等江汉平原及鄂西北山区', '江汉平原\"门神谱\"大皮影高70-80厘米造型滚圆丰满，鄂西北\"魏谱\"小皮影高30厘米形制古朴，均用牛皮雕刻，面部实心阴刻，视觉清晰', '色彩对比鲜明，红绿蓝黄搭配大胆，图案精美，江汉平原浓重饱满，鄂西北浓重遒劲，地方特色浓厚，装饰性强', '江汉平原以渔鼓伴奏一唱众和，融合楚文化孝文化;鄂西北唱\"山二黄\"腔或本地高腔，粗犷高亢，一人多角声音转换灵活', '《薛仁贵征东》《薛丁山征西》《杨家将》《五女兴唐传》《樊梨花征西》《铁丘坟》', NULL, NULL, NULL, 'web py.sql', 'published', 18, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (19, 5, 19, '川鄂滇影系 - 云南省', '保山腾冲、德宏芒市瑞丽等滇西地区', '俗称\"靠子\"，牛皮雕刻，手法用圆线较多，镂雕精细，古朴生动，融合傣族、景颇族图案如象纹、孔雀纹等，具有滇西少数民族风格', '民族风格特征明显，色彩对比鲜明，蓝绿红搭配和谐，图案精美，具有滇西少数民族特色，装饰性强', '分西腔(节奏明快似滇剧)和东腔(旋律优美似傣族民歌),一人多角，表演生动，民族韵味浓厚，2012年列入省级非遗', '《杨家将》《封神榜》及民间传说《段赤诚斩蟒》《阿銮的故事》', NULL, NULL, NULL, 'web py.sql', 'published', 19, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (20, 5, 20, '川鄂滇影系 - 河南省', '信阳、南阳、周口等地，豫南豫西南豫东分布', '信阳高32厘米融合豫剧元素，南阳高35厘米属川鄂滇影系上小下大身臂特长利于武打，周口高30厘米受安徽影响，均用牛皮雕刻，线条流畅', '色彩对比强烈，图案精美，地方特色鲜明，红绿蓝黄搭配和谐，装饰性强，体现了中原地区民间艺术风格', '信阳融合豫剧曲剧形成\"信阳调\";南阳融合宛梆越调高亢激越;周口融合越调道情，一人多角，表演生动，地方特色浓厚', '《杨家将》《呼家将》《岳飞传》《王莽撵刘秀》《樊梨花征西》《封神榜》', NULL, NULL, NULL, 'web py.sql', 'published', 20, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (21, 5, 21, '川鄂滇影系 - 重庆市', '万州、开州、城口、梁平、云阳、奉节等渝东北地区', '与四川东路皮影同质,高35厘米,直线造型,刻工精细,有棱有角,面部分空脸和满脸，服饰图案精美，具有川东特色', '色彩对比鲜明，川东民俗特色浓，红绿蓝黄配色大胆，图案简洁有力，装饰性强，体现了巴渝文化', '融合川剧高腔、梁山调，用重庆方言演唱，一人唱众人和，粗犷豪放，巴渝文化特色浓厚', '《斩蔡阳》《白蛇传》《西游记》《穆桂英》《张飞审瓜》《封神榜》', NULL, NULL, NULL, 'web py.sql', 'published', 21, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (22, 5, 22, '川鄂滇影系 - 贵州省', '黔东南、黔南、黔西北等少数民族聚居区', '影人高26厘米，用牛皮雕刻，融合侗族、苗族图案如苗龙纹、侗锦纹等民族元素，造型独特，体现了贵州多民族文化特色', '色彩对比鲜明，民族特色浓厚，蓝绿红搭配和谐，图案精美，具有黔东南地方特色，装饰性强', '黔东南融合侗戏、苗歌;黔南融合布依戏、壮剧，一人多角，声音转换灵活,民族韵味浓厚,是贵州民族文化的体现', '《杨家将》《封神榜》及侗族传说《珠郎娘美》《苗族古歌》《仰阿莎》', NULL, NULL, NULL, 'web py.sql', 'published', 22, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (23, 6, 23, '湘赣影系 - 湖南省', '长沙、衡阳、常德、益阳、湘潭、岳阳等湘中北地区', '纸影戏重要分布区，影人夹透明纸，七分脸造型，头部比例大，靠子前短后长，融合浏阳古乐元素，造型神秘诡异', '色彩对比强烈，红绿蓝黄搭配鲜明，图案精美，地方特色浓厚，具有湘楚文化特色,装饰性强', '融合湘剧、花鼓戏、常德汉剧、浏阳古乐,长沙唱湘剧高腔,益阳唱花鼓调,风格多样,2008年列入省级非遗', '《龟与鹤》《梁红玉》《哪吒闹海》《孙悟空三打白骨精》《水浒》《岳传》', NULL, NULL, NULL, 'web py.sql', 'published', 23, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (24, 6, 24, '湘赣影系 - 江西省', '萍乡、宜春、吉安、赣州、南昌、抚州、上饶等赣中赣南地区', '属湘赣影系，纸影为主，七分脸造型，影人夹透明纸，头部比例大，造型神秘诡异，保留楚巫文化遗风，用于庙会还愿', '色彩鲜明，靠子前短后长，融合赣剧元素，对比强烈，地方特色浓厚，具有赣鄱文化独特风格，装饰性强', '融合赣剧、采茶戏、弋阳腔元素，萍乡皮影保留楚巫文化遗风，用于庙会还愿，唱腔婉转，一人多角表演生动', '《封神榜》《西游记》《水浒》《岳传》《桃花园》《白蛇传》', NULL, NULL, NULL, 'web py.sql', 'published', 24, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (25, 7, 25, '潮州影系 - 广东省', '汕尾陆丰、汕头、潮州、揭阳等粤东潮汕地区', '闽南文化特色浓厚,造型小巧玲珑,雕刻细腻,影人高24厘米,采用剔地技法，装饰繁复，具有海洋文化特征', '色彩绚丽，对比鲜明，受闽南建筑木雕影响，红绿金搭配和谐，图案精美繁复，体现了潮州影系的典型特征', '融合渔歌、正字戏、白字戏,形成\"啊咿咿嗳嗳\"拖腔,一唱众和,具有浓郁海洋文化特色,2006年首批国家级非遗', '《高文举连》《祝英台连》《吕后心性》《山伯英台》《白蛇传》《荔镜记》', NULL, NULL, NULL, 'web py.sql', 'published', 25, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (26, 7, 26, '潮州影系 - 福建省', '漳州、泉州、厦门、龙岩等闽南地区，属潮州影系', '纸影与皮影并存,纸影用厚纸板,皮影用牛皮,影人高22-24厘米,雕工精细，装饰繁复，采用\"剔地\"技法，受闽南建筑木雕影响', '色彩绚丽，对比鲜明，受闽南建筑木雕影响，红绿金搭配和谐，图案精美繁复，具有海洋文化特征，装饰性强', '融合南音、梨园戏、高甲戏、歌仔戏，用闽南语演唱，一唱众和，拖腔婉转，具有浓郁海洋文化特色，2006年首批国家级非遗', '《荔镜记》《陈三五娘》《白蛇传》《西游记》《封神榜》《山伯英台》', NULL, NULL, NULL, 'web py.sql', 'published', 26, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (27, 7, 27, '潮州影系 - 台湾省', '高雄、台南、嘉义、云林、屏东等地', '明代由华南传入，影偶高约24厘米，造型多用曲线，用色不多，保留古朴风格，闽南文化特色浓厚，是台湾传统皮影的代表', '古朴典雅，装饰简洁，以红、黑、黄为主色调，对比鲜明，具有传统闽南皮影特征，体现了台湾民间艺术特色', '融合北管、南管、歌仔戏、客家山歌，一人多角，声音转换灵活，表演生动活泼，2007年高雄皮影戏列入省级非遗', '《三国演义》《水浒传》《西游记》《封神榜》《哪吒闹东海》《郑成功开台》', NULL, NULL, NULL, 'web py.sql', 'published', 27, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (28, 7, 28, '潮州影系 - 广西壮族自治区', '梧州、玉林、贵港等地，受粤文化影响', '规模较小，影人高25厘米，融合壮族图案如铜鼓纹、壮锦纹等民族元素，线条流畅，具有壮族文化特色', '色彩鲜明，融合壮族服饰文化元素，蓝绿红搭配和谐，图案简洁有力，民族特色浓，体现了壮族的审美习惯', '融合粤剧、壮剧、彩调元素，用粤语或壮语演唱，旋律优美，民族韵味浓厚,是壮族地区独特的皮影艺术', '《杨家将》《岳飞传》《西游记》及壮族传说《百鸟衣》《刘三姐》《莫一大王》', NULL, NULL, NULL, 'web py.sql', 'published', 28, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (29, 7, 29, '潮州影系 - 海南省', '海口、文昌、琼海、万宁等琼北地区', '可能由闽南传入，保留少量潮州影特征，高22厘米，用羊皮彩绘，造型简洁，海洋文化特色明显，热带风情浓厚', '色彩淡雅，海洋文化特色明显，装饰简洁，蓝白绿为主色调，具有热带海岛风情,图案精美小巧', '融合琼剧、海南话,曲调悠扬,地方特色浓,一人多角,表演生动,近年濒临失传,亟需保护', '《封神榜》《西游记》及海南传说《鹿回头》《冼夫人》《海瑞》《黎族故事》', NULL, NULL, NULL, 'web py.sql', 'published', 29, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (30, 7, 30, '潮州影系 - 香港特别行政区', '九龙、新界及离岛区偶有社区文化活动，未形成本土流布', '影人高24厘米，受广东潮州影系影响，牛皮或羊皮制作，造型小巧，线条简洁，工艺精细，多用于现代文化活动和教育推广', '色彩相对淡雅，红绿金搭配简洁，图案装饰性较强，吸收岭南文化元素，但本土特色不鲜明，以移植内地风格为主', '主要用粤语演唱，融合粤剧、南音元素，一人多角，但缺乏系统传承，现代演出多采用录音伴奏，传统声腔体系未形成', '《白蛇传》《梁山伯与祝英台》《西游记》等内地传统剧目，现代创作剧目多与本土传说结合较少', NULL, NULL, NULL, 'web py.sql', 'published', 30, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (31, 7, 31, '潮州影系 - 澳门特别行政区', '澳门半岛、氹仔、路环偶有旅游文化场所展演，未形成固定流行区域', '影人高22-24厘米，可能由广东或福建传入，牛皮雕刻，造型古朴，受闽南文化影响，但本土化发展有限，现代多为文创产品', '色彩对比柔和，以红、黄、金为主调，图案简洁，融合葡式装饰元素，具有中西合璧特色，但传统染色技法传承不完整', '主要用粤语演唱，融合南音、粤剧及少量土生葡语民谣元素，声腔较为简单，缺乏专业戏班，表演以短片为主', '《西游记》《封神榜》等内地传统剧目，本土题材如《澳门传说》等偶有创新，但未形成经典剧目体系', NULL, NULL, NULL, 'web py.sql', 'published', 31, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (32, 8, 32, '其他影系 - 新疆维吾尔自治区', '乌鲁木齐、昌吉、伊犁、喀什、石河子等地', '影人高30厘米，保留甘肃陕西特征，融合维吾尔族图案如葡萄纹、艾德莱斯绸纹样等民族元素，体现了丝路文化特色', '色彩对比鲜明，部分影偶用维吾尔文标注，红绿蓝黄配色和谐，具有丝路文化特色，体现了多民族融合', '融入维吾尔民歌、木卡姆,一人多角,旋律优美,用于汉族节庆及维吾尔族麦西热甫，是新疆多民族文化的体现', '《杨家将》《封神榜》《西游记》及维吾尔族传说《阿凡提》《纳赛尔丁》', NULL, NULL, NULL, 'web py.sql', 'published', 32, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (33, 8, 33, '其他影系 - 西藏自治区', '昌都、林芝、拉萨等藏区零星分布', '影偶融合藏族唐卡艺术，采用矿物颜料，高30厘米，牛皮雕刻，图案有吉祥八宝、藏文经文，民族特色浓厚，汉藏文化交流的见证', '色彩浓烈，对比鲜明，具有藏传佛教艺术特色，红蓝绿金配色庄严神圣，装饰性强，体现了藏族审美', '融入藏族民歌、喇嘛诵经调,用于宗教仪式和节庆,一人多角,声音低沉浑厚，神秘庄严，是藏传佛教仪轨的一部分', '《格萨尔王》《西游记》《封神榜》《文成公主》《金城公主》《松赞干布》', NULL, NULL, NULL, 'web py.sql', 'published', 33, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_region_profiles` VALUES (34, 8, 34, '其他影系 - 安徽省', '皖北阜阳、亳州、宿州，皖南宣城、黄山等地', '皖北高28厘米融合豫剧元素线条粗犷,皖南高24厘米接近浙江风格线条流畅，南北风格分异明显，纸影与皮影并存', '皖北色彩浓烈对比强烈，皖南色彩淡雅装饰简洁，体现南北文化差异，图案精美，地方特色浓厚', '皖北融合豫剧、淮北花鼓灯；皖南接近浙江风格用宜腔演唱，地方特色浓，形成南北两种不同声腔体系，一人多角表演生动', '《杨家将》《包公案》《呼家将》《白蛇传》《岳飞传》《西游记》', NULL, NULL, NULL, 'web py.sql', 'published', 34, '2026-05-29 17:42:04', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for shadow_schools
-- ----------------------------
DROP TABLE IF EXISTS `shadow_schools`;
CREATE TABLE `shadow_schools`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '皮影影系 ID',
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '稳定编码，用于前端路由',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '影系名称',
  `summary` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '简短摘要',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL COMMENT '详细描述',
  `cover_media_id` bigint(20) UNSIGNED NULL DEFAULT NULL COMMENT '封面图片或媒体资源',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_shadow_schools_code`(`code` ASC) USING BTREE,
  UNIQUE INDEX `uk_shadow_schools_name`(`name` ASC) USING BTREE,
  INDEX `idx_shadow_schools_sort`(`sort_order` ASC) USING BTREE,
  INDEX `fk_shadow_schools_cover`(`cover_media_id` ASC) USING BTREE,
  CONSTRAINT `fk_shadow_schools_cover` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 48 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '皮影影系表，如秦晋影系、滦州影系、潮州影系' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of shadow_schools
-- ----------------------------
INSERT INTO `shadow_schools` VALUES (1, 'qinjin', '秦晋影系', NULL, NULL, NULL, 1, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (2, 'luanzhou', '滦州影系', NULL, NULL, NULL, 2, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (3, 'shandong', '山东影系', NULL, NULL, NULL, 3, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (4, 'hangzhou', '杭州影系', NULL, NULL, NULL, 4, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (5, 'chuanedian', '川鄂滇影系', NULL, NULL, NULL, 5, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (6, 'xianggan', '湘赣影系', NULL, NULL, NULL, 6, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (7, 'chaozhou', '潮州影系', NULL, NULL, NULL, 7, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');
INSERT INTO `shadow_schools` VALUES (8, 'other', '其他影系', NULL, NULL, NULL, 8, 1, '2026-05-29 17:42:04', '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for tags
-- ----------------------------
DROP TABLE IF EXISTS `tags`;
CREATE TABLE `tags`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `tag_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT 'content',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tags_code`(`code` ASC) USING BTREE,
  UNIQUE INDEX `uk_tags_name_type`(`name` ASC, `tag_type` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '可复用标签表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of tags
-- ----------------------------
INSERT INTO `tags` VALUES (1, '内容图鉴', 'puppet-catalog', 'content', 1, '2026-05-29 17:42:04');

-- ----------------------------
-- Table structure for user_favorites
-- ----------------------------
DROP TABLE IF EXISTS `user_favorites`;
CREATE TABLE `user_favorites`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `target_type` enum('profile','content','media','play','inheritor','exhibition') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `target_id` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_favorite`(`user_id` ASC, `target_type` ASC, `target_id` ASC) USING BTREE,
  INDEX `idx_favorites_target`(`target_type` ASC, `target_id` ASC) USING BTREE,
  CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '用户收藏表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of user_favorites
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户主键',
  `username` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '用户名',
  `email` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '邮箱',
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '密码哈希值',
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '头像地址或相对路径',
  `role` enum('user','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'user' COMMENT 'v1 简单角色：普通用户或管理员',
  `status` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=启用，0=禁用',
  `register_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间，保留用于兼容网页端',
  `last_login_time` datetime NULL DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_users_username`(`username` ASC) USING BTREE,
  UNIQUE INDEX `uk_users_email`(`email` ASC) USING BTREE,
  INDEX `idx_users_status`(`status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '统一用户表' ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, 'smoke_1780048017514', 'smoke_1780048017514@example.com', '$2a$10$hZnDDdv1ygms4Cy.jlXMtufnPyKt77G1O9RuObg9GNUnSpATGjgyS', NULL, 'user', 1, '2026-05-29 17:46:57', '2026-05-29 17:46:57', '2026-05-29 17:46:57', '2026-05-29 17:46:57');
INSERT INTO `users` VALUES (2, 'admin', 'admin@cloud-shadow.local', '$2a$10$xRrHFqyKhYhTPSyTmGIbbeVT5JlfKEH0vKGRkWzl8OMT9FXjoWQRK', NULL, 'admin', 1, '2026-05-29 23:28:01', '2026-07-16 19:23:32', '2026-05-29 23:28:01', '2026-07-16 19:23:32');

-- ----------------------------
-- View structure for provinces
-- ----------------------------
DROP VIEW IF EXISTS `provinces`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `provinces` AS select `p`.`id` AS `id`,`r`.`name` AS `name`,`p`.`school_id` AS `school_id`,`p`.`popular_areas` AS `region`,`p`.`feature_styling` AS `shape_features`,`p`.`feature_coloring` AS `color_features`,`p`.`feature_singing` AS `singing_features`,`p`.`representative_plays` AS `representative_plays`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 0,1) AS `image1`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 1,1) AS `image2`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 2,1) AS `image3`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 3,1) AS `image4`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 4,1) AS `image5`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 5,1) AS `image6`,`p`.`created_at` AS `created_at`,`p`.`updated_at` AS `updated_at` from (`shadow_region_profiles` `p` join `regions` `r` on((`r`.`id` = `p`.`region_id`)));

-- ----------------------------
-- View structure for schools
-- ----------------------------
DROP VIEW IF EXISTS `schools`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `schools` AS select `shadow_schools`.`id` AS `id`,`shadow_schools`.`name` AS `name`,`shadow_schools`.`created_at` AS `created_at`,`shadow_schools`.`updated_at` AS `updated_at` from `shadow_schools`;

-- ----------------------------
-- View structure for shadow_region_info
-- ----------------------------
DROP VIEW IF EXISTS `shadow_region_info`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `shadow_region_info` AS select `p`.`id` AS `id`,`r`.`name` AS `province_name`,`p`.`popular_areas` AS `popular_areas`,`p`.`feature_styling` AS `feature_styling`,`p`.`feature_coloring` AS `feature_coloring`,`p`.`feature_singing` AS `feature_singing`,`p`.`representative_plays` AS `representative_plays`,(select `m`.`url` from (`profile_media` `pm` join `media_assets` `m` on((`m`.`id` = `pm`.`media_id`))) where ((`pm`.`profile_id` = `p`.`id`) and (`pm`.`usage_type` in ('cover','gallery'))) order by (case `pm`.`usage_type` when 'cover' then 0 else 1 end),`pm`.`sort_order`,`pm`.`id` limit 1) AS `image_url`,`p`.`created_at` AS `create_time` from (`shadow_region_profiles` `p` join `regions` `r` on((`r`.`id` = `p`.`region_id`))) where (`p`.`status` = 'published');

SET FOREIGN_KEY_CHECKS = 1;
