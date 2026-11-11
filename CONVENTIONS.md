# 页面复刻约定（路线 B · Web 版）

> 本文件是「云幕皮影 Web 工程」根目录下的页面复刻唯一口径。写任何页面前先读完它，
> 再看一遍已完成的样板页 `src/pages/ProcessPage.vue`（试点页，已通过验收）。

## 1. 任务范围

把 `<SRC>/apps/uniapp/pages/**/*.vue` 复刻为工程内 `src/pages/XxxPage.vue`。

- 源工程根 `<SRC>` = `..\PiYingGameWeChat`（与本工程同级；2026-11-08 从旧路径整体迁移）
- **禁止修改 `<SRC>` 下任何文件**（只读引用）
- **禁止安装 uni-app / uni-ui**；只用 Vue 3 + vue-router + 本工程已有组件
- 数据来源是已跑通的 shim（`http://127.0.0.1:8787/api/v1`，经 Vite 代理为 `/api`）

## 2. 标签与语法映射（逐条照做）

| 小程序 | Web 版 |
| --- | --- |
| `<view>` `</view>` | `<div>` `</div>` |
| `<text>` `</text>` | `<span>` `</span>`（需要块级时在 CSS 里 `display:block`） |
| `<image :src="x" mode="aspectFill" />` | `<img :src="x" alt="" />` + CSS `object-fit: cover` |
| `<image mode="aspectFit" />` | `<img>` + CSS `object-fit: contain` |
| `<scroll-view scroll-y>` | 直接用 `<ArtPageShell scroll>`（已封装原生滚动） |
| `<button>` | `<ArtButton>` 或普通 `<button type="button">` |
| `@tap` | `@click` |
| `@touchstart` / `@touchmove` / `@touchend` | `@pointerdown` / `@pointermove` / `@pointerup`（触摸坐标从 `event.clientX/clientY` 取） |
| `v-if` / `v-for` / `:class` / `:style` | 原样保留 |
| `class="a b"` | 原样保留 |

**不要把 `<view>`/`<text>`/`<image>` 留在模板里**：Vue 会把它们当成未注册组件而报错。

## 3. rpx 单位

源码里的 `34rpx` **原样保留，不要手改成 px**。构建期有 PostCSS 插件自动转换为
`calc(34 * var(--rpx))`。

- 模板 inline style 里不要写 rpx 字符串，改用 `import { rpx } from '@/utils/rpx.js'` → `:style="{ height: rpx(220) }"`
- `--rpx` 取值：移动端 `100vw/750`（375px 屏上 = 0.5px，1:1 还原）；
  ≥900px 固定 0.65px；≥1600px 固定 0.78px

## 4. uni.* API 替换表

| 小程序 | Web 版 |
| --- | --- |
| `onLoad((options) => {})` | `onMounted(() => {})` + `const route = useRoute()`，参数从 `route.query` 取 |
| `uni.navigateTo` / `uni.redirectTo` / `uni.reLaunch({url})` | `router.replace({ path: '/xxx', query: { region } })` |
| `uni.navigateBack()` | `router.back()` |
| `uni.showToast({ title })` | `showToast('文案')`（`@/utils/toast.js`） |
| `uni.setStorageSync('currentRegion', v)` / `getStorageSync` | `saveRegion(v)` / `getCurrentRegion()`（`@/utils/navigation.js`） |
| `uni.getSystemInfoSync()` | `window.innerWidth` / `window.innerHeight` |
| `uni.vibrateShort()` | `navigator.vibrate?.(10)` |
| `uni.request` | 页面里直接用 `request`（`@/api/index.js`），**不要**自己写 fetch |

`request` 的返回**已经解包**（等价于源码 `unwrapResponse` 之后的结果）：
返回 envelope 的 `data`，失败时抛 Error。源码里 `res && res.code === 200 ? res.data : res?.data || res` 这类写法可以原样保留（对已解包值无害）。

## 5. 组件 API（已移植完成，直接 import）

```js
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import MapIcon from '@/components/MapIcon.vue';
import OptionOne from '@/components/OptionOne.vue';
```

- **ArtPageShell**：`bg` / `theme`(`'dark'`|`'paper'`) / `overlay` / `withBottomNav` / `scroll` / `contentClass`
- **ArtTopBar**：`title` / `theme` / `showBack`(默认 true) / `showShare` / `backText`；事件 `@share`
- **ArtBottomNav**：`currentTab`（`home`|`map`|`display`|`process`|`interactive`）/ `region`
- **ArtButton**：`text` / `variant`(`primary`|`secondary`) / `size`(`large`|`medium`|`small`) / `icon` / `disabled` / `bg` / `pressedBg`；事件 `@click`
- **ArtStatus**：`type`(`loading`|`empty`|`error`) / `title` / `description` / `actionText`；事件 `@action`
- **MapIcon**：`region` / `x` / `y` / `active`；事件 `@clickMapIcon`
- **OptionOne**：`region`

## 6. 素材

```js
import { artAssets } from '@/config/artAssets.js';
// artAssets.process.card / artAssets.quiz.optionDefault / artAssets.timeline.node ...
```

`artAssets` 的每个 getter 都是**字符串 URL**（同步返回），可直接用于 `:src` 或 `backgroundImage`。
取不到时已自动回落到 `/images/art/v2/**` 本地路径。

图片 URL 规范化：DB 返回的 `imageUrl` 形如 `images/map/x.png`（**无前导斜杠**）或 `/images/...`，
一律过：

```js
import { normalizeImageUrl } from '@/store/imageStore.js';
```

## 7. 数据契约（shim 已实现并验收，字段名严格）

| 端点 | data 形状 |
| --- | --- |
| `GET /craft-process/steps` | 数组：`id, stepSort, title, subtitle, summary, detailsContent, imageUrl` |
| `GET /history/timeline` | 数组：`id, era_name, era_title, detail_content, time_range, sort_order`（**snake**） |
| `GET /regions/by-name?name=陕西` | 对象：`id, provinceName, popularAreas, featureStyling, featureColoring, featureSinging, representativePlays, imageUrl` |
| `GET /quiz/questions/random?limit=5` | 数组：`id, type, questionText, optionA..optionD, correctAnswer('A'..'D'), explanation` |
| `GET /interactive-materials/random?limit=6` | 数组：`id, name, imageUrl, image_url, category, description`（**不含 x/y/size**，布点由前端算） |
| `GET /daily-appreciations/random` | 对象：`id, title, description, imageUrl, image_url, region, tag, category` |

`/assets/common` 是应用级依赖，`App.vue` 启动时已拉取，页面**不要**重复请求。

## 8. 宽屏适配（用户已选「全响应式铺满桌面」）

- **移动端 <900px**：保持原设计单列、1:1 视觉
- **桌面 ≥900px**：布局铺满横向宽度，**不要**用固定 `max-width` 把页面锁成手机宽度
- 列表类（时间轴、卡片流）用网格：

```css
.list { display: grid; grid-template-columns: 1fr; gap: calc(26 * var(--rpx)); }
@media (min-width: 900px) {
  .list { grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); align-items: start; }
}
```

- 详情类（单条内容）在桌面用左右两栏或更宽的容器；长正文加 `class="art-readable"`（78ch 限宽）
- 底部导航 `ArtBottomNav` 内部已做宽屏居中限宽，无需处理

## 9. 验收（每个页面必须做）

```powershell
node scripts/verify-web.mjs <routeName>
```

`routeName` 取：`index` / `select` / `display` / `process` / `interactive` / `quiz` / `history` / `school`。

两条记录（mobile / desktop）都必须 **PASS**，然后再用 `read_image` 打开：
`.artifacts/screens/mobile-<routeName>.png` 与 `.artifacts/screens/desktop-<routeName>.png`
人工确认视觉正常（无空白、无重叠、无破版）。有问题就改，改完重跑，直到通过。

## 10. 常见坑

1. `<text>` 是 inline：需要整行时记得 `display: block`
2. 源码里 `:style="{ backgroundImage: \`url(${...})\` }"` 保留即可，注意 `url()` 里路径含空格时浏览器会自动编码
3. 滚动容器：页面外层用 `<ArtPageShell scroll>`，内部内容不要再套 `overflow:hidden`
4. 全屏定位元素（如游戏图层）用 `position: absolute/fixed` + `inset: 0`，父级需 `position: relative`
5. 不要引入新的 npm 依赖
6. 不要改动 `src/components/`、`src/api/`、`src/store/`、`src/config/`、`vite.config.js`、`server/`
