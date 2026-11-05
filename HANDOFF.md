# Cloud-Shadow 路线 B 交接文档（供执行模型阅读）

> 本文档是**已核实的事实清单 + 已定死的决策**，不是待讨论的方案。
> 你的任务是在 `D:\PiYingGameWeb` 里实现它，而不是重新设计它。
> 文档中标注 `[已核实]` 的结论都来自源码或 SQL 的直接阅读，可按给出的路径复核。
> 标注 `[待确认]` 的条目是唯一的开放项，见 §10。

- 源工程根目录（下称 `<SRC>`）：`D:\聚萤分享\Cloud-Shadow-组员演示开发包-2026-08-03`
- 目标工程根目录（下称 `<DST>`）：`D:\PiYingGameWeb`（已纳入工作区）
- 文档生成：2026-11-05，**同日完成数据导入与契约复核**

### 当前进度（写在这里，别按 §8 从头做）

| 步骤 | 状态 |
| --- | --- |
| §8-1/8-2 数据导入 | ✅ **已完成** —— `deepseek` 库 26 表 + 3 视图，行数已精确复核（§3.5/§3.6） |
| 契约复核 | ✅ 已完成，7 个端点的字段回落链逐条对过源码，camelCase 规则见 §6 |
| 第二轮文档核对（2026-11-05） | ✅ 已修正 4 处出入：art-v2 素材位置（§3.4）、uni-ui 实际未使用（§1/§7-9）、素材体积与 `data/` 目录不需挂载（§2-2）、组件清单与 `/assets/common` 全局性（§7.1/§7.2） |
| §8-3 起（shim / 前端 / 页面复刻） | ⬜ **未开始，这是你的工作起点** |
| `<DST>/.env.local` | ⬜ 未创建（模板 `.env.example` 已放好，填口令即可） |

**仍未定的事**（详见 §10）：Q3 视觉基准、Q4 随机条数、Q5 是否做登录页（建议不做）。另有两项数据没取到：`rpx` 在各页面的出现次数（统计命令被中断）、`index.vue` / `select.vue` 的行数 —— 需要时自行补测，不影响开工。

---

## 1. 已定决策（不要重开讨论）

| # | 决策 | 状态 |
| --- | --- | --- |
| D1 | 采用**路线 B**：新建一个独立的 Vue Web 工程复刻小程序的 8 个页面 | 用户明确选定 |
| D2 | **不修改 `<SRC>` 里的任何源文件**（只读引用） | 用户明确要求 |
| D3 | 数据源用**本地 MySQL 的 legacy 数据**（实际落在用户提供的 `deepseek` 库），不走 `/api/v2` | 用户确认本地有 MySQL 并已备好账号；导入已于 2026-11-05 完成，见 §3.6 |
| D4 | `<DST>` 为新工程根目录 | 用户指定 |
| D5 | 已被否决的替代方案：路线 A（`npm run build:h5` 直接编译 uniapp）；v1→v2 逐页迁移 | 用户「直接走 b」 |

**关于 D2 的关键澄清（最容易误解的一点）**：
「不改变源文件」约束的是 `<SRC>` 工程，**不是**说 `<DST>` 可以直接 import `<SRC>` 的 `.vue` 文件。
小程序页面依赖 uni-app 运行时（`uni.navigateTo`、`uni.setStorageSync`、`uni.showToast`、`uni.request`、`rpx` 单位、`onLoad` 生命周期、`navigationStyle: "custom"`）。这些在纯浏览器 Vue 工程里不存在。
**所以路线 B = 用干净的 Vue 3 + vue-router 重写这 8 个页面**，复用它们的视觉设计、交互流程和数据结构，而不是复用文件。

> **`[已核实 2026-11-05]` 一个好消息：uni-app 的 UI 组件库（`uni_modules`，47 个组件）在本项目里实际没有被用到，一个都没有。**
> 唯一相关引用是 `App.vue:30` 的 `@import '@/uni_modules/uni-scss/index.scss';`，而对 `pages/` 与 `components/` 全文检索 `$uni-`、`@import` **均无命中** —— 即这套 SCSS 变量/混入被全局引入却从未被业务样式消费。
> **结论：复刻时不要安装 uni-app、不要引 uni-ui、也不要移植 uni-scss。** 移植工作量比原先估计的小一整块。
> `[待确认]` 若某个 `.vue` 的 `<style>` 段落不含 rpx，可以直接搬；但为此引入 uni-app 依赖是不允许的。

---

## 2. 硬约束（违反即为错误）

1. **禁止修改 `<SRC>` 下任何文件。** 唯一例外见 §11。
2. **素材不复制。** `[已核实 2026-11-05]` `<SRC>/storage/assets/legacy-import` 共 **700 MB / 419 个文件**，其中 `images/` 子目录 **604 MB / 410 个文件**。**只需要挂载 `images/` 这一个子目录**（用 mount / alias / 符号链接，不要 `cp`）。
   > 剩下的 9 个文件在 `legacy-import/data/` 下：`maps/china.json` + 7 个 `lottie/*.json`。**这 8 个页面完全没有引用它们**（`[已核实]` 对 `pages/ components/ config/ utils/ store/ App.vue main.js` 全文检索 `china.json`、`/data/`、`lottie` 均无命中），所以不必挂载。地图页用的是静态 PNG `images/art/v2/map/china_map_art.png`，不是 JSON 地图数据。
3. **凭据规矩**：MySQL 密码只出现在 `<DST>/.env.local` 或进程环境变量里；绝不写进 `VITE_*` 前缀的变量（会被打进浏览器包）；绝不写进本文档或任何 memory 文件；`.env.local` 不进 git。
4. **只读数据库连接**。账号 `deepseek`@`%` 名义上对 `deepseek.*` 有 ALL PRIVILEGES，但 **shim 一律只允许 `SELECT`**：不要建表、不要写回、不要改列、不要 `INSERT`/`UPDATE`/`DELETE`/`DDL`。导入只做一次，走 §3.6 的脚本，不走 shim。
5. **shim 不是 v2**。它返回 v1 风格的 `{code, data, message}`，服务的是复刻的前端，**不代表项目 API 演进方向**。不要顺手把它写成 RESTful 或改成裸资源。
6. **`<SRC>/apps/uniapp/docs/UI与工程实现规范.md` §5 明确禁止**请求里携带 `X-Api-Base-Url` / `X-Backend-Origin`，且 base 地址不得硬编码内网 IP。复刻时**不要继承 `request.js` 的这些毛病**。

---

## 3. 源工程事实清单 `[已核实]`

### 3.1 小程序结构

| 项 | 事实 | 证据 |
| --- | --- | --- |
| 框架 | UniApp 3.0.0-alpha + Vue 3.4 `<script setup>` + Vite 5 + Sass 1.77.8 | `<SRC>/apps/uniapp/package.json` |
| 入口 | `main.js` → `createSSRApp(App)`；`App.vue` 的 `onLaunch(() => initImageStore())` | `apps/uniapp/main.js:11`、`App.vue:13` |
| 页面 | 8 个，全部 `navigationStyle: "custom"`，主题色 `#3E2723` | `apps/uniapp/pages.json` |
| 视觉体系 | `components/art-v2/*` 自绘组件 + `config/artAssets.js` 素材表 | 见 §3.4 |
| 网络层 | 单一 adapter `utils/request.js`，固定 `/api/v1` | 见 §3.3 |

`pages.json` 的 8 个路由与标题：

```
pages/index/index            云上皮影（启动/着陆页）
pages/select/select          地图寻影
pages/display/display        皮影展示
pages/process/process        工艺流程
pages/interactive/interactive光影互动
pages/quiz/quiz              知识挑战
pages/display/history        光影溯源
pages/display/school         地域流派
```

### 3.2 v1 后端在本包里**不存在**

`[已核实]` 全仓库只有 `services/backend`（Go / Gin / oapi-codegen / uber-fx），它只实现 `/api/v2`，Go 代码里 `api/v1` 出现次数为 0。
`services/backend/internal/platform/http.go` 的 `NoRoute` 对任何未注册路径返回 404 Problem `route.not_found`。
**结论：直接让复刻前端打 v2 后端是走不通的 —— 下面 7 个 v1 路径全部 404。这正是路线 B 必须自建 shim 的原因。**

### 3.3 v1 网络层语义（复刻必须对齐）

`apps/uniapp/utils/request.js`：

```js
API_PREFIX = '/api/v1'                    // :2
DEFAULT_TIMEOUT = 60000                   // :4
// 浏览器 + 相对 base 时，直接返回相对地址（走同源）  :22-25
// normalizeApiBaseUrl: '/x/api' → '/x/api/v1'；'/x' → '/x/api/v1'   :31-41
ASSET_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, '')   // :44
BASE_URL = ASSET_BASE_URL                                  // :45
unwrapResponse(payload):                                   // :108-128
  若 payload 有 code 且有 data/message/msg：
    code === 0 || code === 200 → return payload.data ?? payload
    否则 throw Error(payload.message || payload.msg)
  否则原样返回 payload
```

**单源部署特性 `[已核实]`（这是 shim 设计的核心便利）**：
构建时设 `VITE_API_BASE_URL=/api/v1`，则 `API_BASE_URL = '/api/v1'` 且 `BASE_URL = ''`。
于是 `imageStore.normalizeImageUrl('/images/index/bg.png')`（`store/imageStore.js:20`）返回**原样的相对路径**，浏览器按当前 origin 解析。
→ 一个服务器同时提供前端静态资源 + `/api/v1/*` + `/images/*`，**零 CORS、零源码改动**。
路线 B 的新工程沿用同样的思路：dev server 用两条 proxy（`/api` → shim，`/images` → 素材目录），生产用一台静态服务器 + 反代。

**不要继承的缺陷**：`:1` 硬编码 `https://192.168.1.159:8080`；`:97/100` 发送被禁的 `X-Api-Base-Url` / `X-Backend-Origin`；`:92` 从 `uni.getStorageSync` 取 token。

### 3.4 art-v2 素材体系 `[已核实 2026-11-05]`

`apps/uniapp/config/artAssets.js`：

```js
ART_BASE = '/images/art/v2'                                        // :21
assetPath(group, file)  = normalizeImageUrl(`${ART_BASE}/...`)     // :23
artAsset(key, group, file) = getImageByKey(key, `${ART_BASE}/${group}/${file}`)  // :25-27
processStepAsset(n)  → key `art_v2_process_step_${n}`              // :29-32
getProcessFallbackImage(stepSort) → 8 张工艺兜底图                  // 见 :17 注释
```
分组共 9 个：`common / home / map / quiz / process / game / daily / timeline / _style`；`:259` `artNavTabs` 是底部 5 个 tab（首页/地图/展示/工艺/互动）。

**素材实际位置（原先的 `[待确认]` 已解决）：art-v2 图片不在 `apps/uniapp/` 里，而是在同一个静态挂载目录下**：
`<SRC>/storage/assets/legacy-import/images/art/v2/{group}/*.png` —— 例如 `images/art/v2/process/process_img_step_1..8.png`、`images/art/v2/quiz/option_bg_correct.png`、`images/art/v2/home/home_bg_stage.png` 均实测存在。
`app_common_image` 第 5 行就是 `art_v2_home_bg → /images/art/v2/home/home_bg_stage.png`，**证明 art-v2 素材和 `/assets/common` 走的是同一批路径**。

→ **只要按 §2-2 挂上 `images/`，art-v2 全套图自动可用，不需要额外拷贝或第二个挂载点。**

对比：`apps/uniapp/static/` 只有 **85 KB / 28 个文件**，4 个子目录（根、`display/`、`process/`、`select/`），内容是 `c1..c9.png`、`logo.png`、`customicons.css/ttf` 和一批 SVG（`character-design.svg`、`cultural-history.svg`、`icon-display*.svg` 等）。**里面没有 art-v2 的 PNG。** 若 8 个页面引用了这些 SVG，把 `static/` 整目录（85 KB）作为普通前端资源复制进 `<DST>/src/assets/` 即可 —— 这是唯一允许复制的素材目录。

**移植时要保留的取值语义**：每个素材先查 `globalImages[key]`（来自 `/assets/common`），查不到才回落 `ART_BASE` 本地路径。复刻时保持这层回落，因为 `/assets/common` 的 87 行只覆盖了部分 `art_v2_*` key。

### 3.5 数据可用性（内容预算）

legacy 段（原 `cloud_shadow_legacy` schema，现已导入 `deepseek` 库）的行数：

| 表 | 行数 | 服务的端点 |
| --- | --- | --- |
| `quiz_questions` | 116 | `/quiz/questions/random` |
| `interactive_characters` | 72 | `/interactive-materials/random` |
| `daily_appreciation` | 72 | `/daily-appreciations/random` |
| `shadow_region_profiles` | 34 | `/regions/by-name` |
| `regions` | 34 | `/regions/by-name` |
| `app_common_image` | 87 | `/assets/common` |
| `media_assets` | 410 | 全部图片解析 |
| `shadow_schools` | 8 | `/regions/by-name` |
| `shadow_craft_process` | 8 | `/craft-process/steps` |
| `shadow_history_timeline` | 8 | `/history/timeline` |
| `plays` / `inheritors` / `exhibitions` | 0 | 空表，勿依赖 |

**8 个页面全部有真实数据兜底。** `[已核实 2026-11-05]` 上表数字已用 `COUNT(*)` 精确复核，**并且已按 `is_active=1` / `status='published'` 过滤后仍然成立**：daily 72、quiz 116、interactive 72、craft 8、history 8、region_profiles 34（全部 published）、app_common_image 87、regions 34（其中 `level_depth=1` 正好 34 个省级）、media_assets 410。

> **坑（务必知道）**：`information_schema.tables.table_rows` 导入后立刻查会给出 **`shadow_region_profiles = 0`、`app_common_image = 2`** 这种错得离谱的估算值。它是 InnoDB 统计估算，**不要用来自它判断「表是不是空的」**，一律 `SELECT COUNT(*)`。

### 3.6 数据库状态 `[已完成 2026-11-05]`

- 本地 MySQL **8.0.46**，客户端 `D:\mysql\mysql-8.0.46-winx64\bin\mysql`，`127.0.0.1:3306`。
- 用户提供的账号：**`deepseek`@`%`**，权限 = `USAGE ON *.*` + `ALL PRIVILEGES ON deepseek.*`。**没有 CREATE DATABASE 权限。**
- 发布脚本 `<SRC>/database/release/cloud_shadow_v2_full.sql` 第 5 行和第 1896 行要各自 `CREATE DATABASE`（`cloud_shadow_legacy` / `cloud_shadow_v2`），且第 2 行注明「Fresh install only，库已存在则故意失败」（无 `IF NOT EXISTS`、无 `DROP DATABASE`）。**用这个账号直接跑整份脚本会失败。**
- 已改为：抽取脚本**第 1..1894 行（纯 legacy 段）**，把第 5 行的 `CREATE DATABASE` 替换为空操作、第 6 行改为 `USE deepseek;`，导出为派生脚本 **`<DST>/server/db/10_legacy_v1.sql`（332 KB）**，已成功导入 **`deepseek` 库** → **26 张表 + 3 个视图**。`cloud_shadow_v2` 段**未导入，路线 B 也不需要它**。
- 凭据位置：`<DST>/.env.local`（尚未创建）。**不要**把密码写进本文档或任何 .md。

> **因此本档所有 SQL 里的表名都在 `deepseek` 库下**，shim 的连接目标是 database = `deepseek`，不是 `cloud_shadow_legacy`。

> **✅ 已定案，不要再提议改动（2026-11-05 用户决定）**：曾评估过「用 root 建正式的 `cloud_shadow_legacy` 库、只给我们 SELECT」的更干净方案，用户答复「算了，就先这样吧」。**数据就留在 `deepseek` 库，权限维持 `ALL PRIVILEGES ON deepseek.*`。**
> 相应地，只读约束由**纪律**保证（§2-4：shim 只发 `SELECT`），而不是数据库权限。写 shim 时不要依赖数据库权限来兜住误操作。

### 3.7 legacy 自带的三个视图（`[已核实]`，优先使用）

导入后 `deepseek` 库里除了 26 张表还有 3 个视图，它们**就是 v1 后端当初的取数方式**，字段命名比手写 JOIN 更可信：

| 视图 | 输出列 | 用途 |
| --- | --- | --- |
| **`shadow_region_info`** | `id, province_name, popular_areas, feature_styling, feature_coloring, feature_singing, representative_plays, image_url, create_time`；内部已 `JOIN regions` 且过滤 `p.status='published'` | **`/regions/by-name` 就用它**（见 §5.6） |
| `provinces` | `id, name, school_id, region, shape_features, color_features, singing_features, representative_plays, image1..image6` | 地图页选点，字段名与 `normalizeRegion` 的另一组回落（`region`/`shapeFeatures`）对得上 |
| `schools` | `id, name, created_at, updated_at` | 影系列表 |

`shadow_region_info` 的列名经 `toCamel()` 后**精确等于** `normalizeRegion` 需要的 `provinceName / popularAreas / featureStyling / featureColoring / featureSinging / representativePlays`，无需手写三表连接。

---

## 4. 路线 B 目标架构

```
浏览器
  │
  ├─ GET /*.html, /assets/*        →  <DST> 静态构建产物（Vue 3 SPA）
  ├─ GET /api/v1/*                 →  shim（Node，只读 SELECT，连 database=deepseek）
  └─ GET /images/**                →  <SRC>/storage/assets/legacy-import/images（挂载，只读）
```

三个组成部分：

1. **前端**：`<DST>` 独立 Vue 3 + Vite + vue-router 4 工程，复刻 8 个页面。
2. **shim**：`<DST>/server/` 下的 Node 服务，7 个只读 GET 端点，返回 v1 envelope。开发期由 Vite proxy 前置，生产期同源部署。
3. **素材挂载**：`/images` → 源工程 `storage/assets/legacy-import/images`。`[已核实]` 该目录下 410 个图片文件全部存在，被 `media_assets.url` 和 `shadow_craft_process.image_url` 等引用。

**技术选型（刻意选择的低成本组合）**：Vue 3（与小程序语法同构，迁移心智负担最小）+ 纯 CSS（**不要**引 MUI/Tailwind，art-v2 的样式是自绘的，见 §7）。

---

## 5. Shim 端点精确契约（7 个）

### 5.0 全局约定

- 方法：**全部 GET**。路径前缀 `/api/v1`。
- 响应：**始终** `{"code":200,"message":"ok","data":<payload>}`，`Content-Type: application/json; charset=utf-8`，HTTP 状态 **200**（包括业务失败，因为 `unwrapResponse` 靠 `code` 判断，不靠 HTTP status）。
- 业务失败：`{"code":500,"message":"...","data":null}`。
- 未知路径：同样 200 + `{"code":404,...}`，或直接 404 —— 前端 `fail` 分支只弹「无法连接服务器」，两种都能走通。
- **命名规则：见 §6，这是最容易做错的一节。**
- 时间戳字段（`create_time` / `created_at` / `updated_at`）一律**不返回**，前端不消费。
- 参数一律走 query string；shim 必须用**预编译语句**绑定参数，禁止字符串拼接 SQL（`/regions/by-name?name=` 是用户可控输入）。
- **⚠️ `[已核实 2026-11-05]` 库里有两种图片路径形态，不要统一处理**：
  - `app_common_image.relative_path` **带前导斜杠**：`/images/index/bg.png`、`/images/art/v2/home/home_bg_stage.png`。
  - 视图与内容表的 `image_url` **不带前导斜杠**，且**含空格、括号和大写扩展名**：`images/map/shanxipy (1).PNG`、`images/map/hainanpy (1).png`。
  两条路径都能落到同一个静态挂载上，但 `imageStore.normalizeImageUrl`（`store/imageStore.js:14-22`）**不做 encode**（`request.js` 里的 `encodeAssetUrl` 是另一个函数，没被它调用）。空格在浏览器 `src` 里通常会被自动编码，但**反代/静态服务器日志里会出现 `%20`**，若图片 404 先查这一点，不要去查数据库。
  `[已核实]` `shanxipy (1).PNG` 等文件在 `<SRC>/storage/assets/legacy-import/images/map/` 下真实存在，扩展名大小写混用（同一组里 `(1)`~`(4)`、`(6)` 是 `.PNG`，唯独 `(5)` 是 `.png`）—— **Linux 部署会因大小写敏感而 404**，本地 Windows 不报错。若将来上线，这是必修项。

### 5.1 `GET /assets/common`

- 调用方：`store/imageStore.js:51`，`App.vue` 的 `onLaunch` 里 `initImageStore()` 触发。
- `data`：**数组**。`applyCommonAssets`（`store/imageStore.js:24-38`）逐条读 `item.imageKey`，取 `item.fullUrl || item.relativePath` 存入 `globalImages[imageKey]`。
- SQL：
  ```sql
  SELECT image_key, relative_path FROM app_common_image ORDER BY id
  ```
- 输出映射（**必须改名**）：`{ "imageKey": image_key, "relativePath": relative_path }`。
- 注意：`relative_path` 形如 `/images/index/bg.png`，前端会走 `normalizeImageUrl` 拼 `BASE_URL`；`BASE_URL=''` 时原样保留，命中静态挂载。**不要**在这里返回绝对地址。

### 5.2 `GET /daily-appreciations/random`

- 调用方：`pages/display/display.vue:65`。`data`：**对象**。
- `applyDailyData`（`display.vue:51-60`）读取：
  - `imageUrl || image_url || url` → 有 snake 回落
  - `title || name || puppetName`
  - `description || introduction || desc || summary`
  - `tag || category`
- SQL：
  ```sql
  SELECT id, title, description, image_url, region, tag, category
    FROM daily_appreciation
   WHERE is_active = 1
   ORDER BY RAND() LIMIT 1
  ```
- 输出：对象；`image_url` 原样返回即可（回落分支覆盖到了），建议同时给 `imageUrl`。

### 5.3 `GET /quiz/questions/random`

- 调用方：`pages/quiz/quiz.vue:67`。`data`：**数组**，页面按顺序当一轮题走。
- `normalizeQuestion`（`quiz.vue:40-54`）读取：
  - `questionText || question || title` → **只认 camel！**
  - `Array.isArray(item.options)` 优先；否则逐字段取 `item.optionA / optionB / optionC / optionD` → **只认 camel！**
  - `correctAnswer || answer`，默认 `'A'`（**必须是 `"A"`/`"B"`/`"C"`/`"D"` 单字符**，DB 的 `correct_answer char(1)` 正好匹配）
  - `explanation || analysis`，`id`，`type || category`
- SQL：
  ```sql
  SELECT id, question_text, option_a, option_b, option_c, option_d,
         correct_answer, explanation, category
    FROM quiz_questions
   WHERE is_active = 1
   ORDER BY RAND() LIMIT ?      -- ? 默认 5，[待确认] 见 §10-Q4
  ```
- 输出映射（**必须逐个改名，否则选项全部消失**）：
  ```json
  { "id":1,"type":category,"questionText":question_text,
    "optionA":option_a,"optionB":option_b,"optionC":option_c,"optionD":option_d,
    "correctAnswer":correct_answer,"explanation":explanation }
  ```
  不要返回 `options` 数组 —— 走 `optionA-D` 分支即可，`filter(o => o.text)` 会去掉空值。

### 5.4 `GET /craft-process/steps`

- 调用方：`pages/process/process.vue:47`。`data`：**数组**。
- `normalizeStep`（`process.vue:31-42`）读取：
  - `stepSort || sort` → **只认 camel**；页面自己按 `stepSort` 升序排
  - `title || stepName`
  - `subtitle || subTitle || stageName` → **只认 camel**（DB 有 `subtitle`，直接对上）
  - `summary || description || content`
  - `detailsContent || detailContent || detail` → **只认 camel！**
  - `imageUrl || image_url` → 有 snake 回落；为空时页面回落到 `getProcessFallbackImage(stepSort)`，**所以 8 行数据里 image_url 为 NULL 不会崩**
- SQL：
  ```sql
  SELECT id, step_sort, title, subtitle, summary, details_content, image_url
    FROM shadow_craft_process
   WHERE is_active = 1
   ORDER BY step_sort ASC
  ```
  表上有 `UNIQUE uk_craft_step_sort(step_sort)`，顺序稳定。
- 输出映射：`{ id, stepSort: step_sort, title, subtitle, summary, detailsContent: details_content, imageUrl: image_url }`。

### 5.5 `GET /history/timeline`

- 调用方：`pages/display/history.vue:55`。`data`：**数组**。
- `normalizeHistory`（`history.vue:27-41`）**camel 和 snake 双回落齐全**，直接返回 DB 原始 snake 列名即可正常工作：
  - `eraName || era_name`、`eraTitle || era_title`、`year || timeRange || time_range`、`summary`、`detailContent || detail_content`、`sortOrder || sort_order`
- SQL：
  ```sql
  SELECT id, era_name, era_title, detail_content, time_range, sort_order
    FROM shadow_history_timeline
   WHERE is_active = 1
   ORDER BY sort_order ASC
  ```
- 这是 7 个端点里最省事的一个。**不要**为了「统一风格」把 snake 改成 camel —— `time_range` → `timeRange` 都行，但 `year` 字段 DB 没有，靠 `time_range` 供。

### 5.6 `GET /regions/by-name?name=<省名>`

- 调用方：`pages/display/school.vue:64-68`，参数名固定为 `name`，取值来自 `utils/navigation.js` 的 `getCurrentRegion()`。
- **⚠️ `[已核实 2026-11-05]` 名称后缀不一致会让本页静默失效**：
  `navigation.js:16` 的 `DEFAULT_REGION = '陕西'`（无后缀），而 `shadow_region_info.province_name` 的 34 个取值**全部带行政后缀**：`陕西省`、`上海市`、`台湾省`、`内蒙古自治区`、`广西壮族自治区`、`宁夏回族自治区`、`新疆维吾尔自治区`、`西藏自治区`、`香港特别行政区`、`澳门特别行政区` + 24 个「X省/市」。
  → `WHERE province_name = '陕西'` **返回 0 行**，页面显示「暂无数据」，而且不报错、日志干净，极难定位。
  **shim 必须做后缀容错**，建议两级匹配（都用预编译绑定）：
  ```sql
  -- 第 1 级：精确
  SELECT * FROM shadow_region_info WHERE province_name = ? LIMIT 1;
  -- 第 2 级（0 行时）：前缀匹配，兼容 '陕西'→'陕西省'、'内蒙古'→'内蒙古自治区'
  SELECT * FROM shadow_region_info WHERE province_name LIKE CONCAT(?, '%') ORDER BY province_name LIMIT 1;
  ```
  `[已核实]` 34 个省级名称里没有任何一个是另一个的前缀，前缀匹配不会误命中（`山西省`/`陕西省`、`吉林省`/`河北省` 均不同形）。反向也安全：入参已带后缀时第 1 级就命中。
- `data`：**对象**（不是数组）。
- `normalizeRegion`（`school.vue:52-59`）读取 —— **全部只认 camel，一个 snake 回落都没有**：
  - `provinceName || name`
  - `popularAreas || popularArea || region`
  - `featureStyling || styling || shapeFeatures || shapeFeature`
  - `featureColoring || coloring || colorFeatures || colorFeature`
  - `featureSinging || singing || singingFeatures || vocalFeature`
  - `representativePlays || plays || repertoire`
  → **别名做错的后果同样是整页「暂无数据」。**
- SQL：**直接用视图，不要手写三表连接**（视图已内含 `JOIN regions` 且过滤 `status='published'`）：
  ```sql
  SELECT id, province_name, popular_areas, feature_styling, feature_coloring,
         feature_singing, representative_plays, image_url
    FROM shadow_region_info
   WHERE province_name = ?           -- 第 1 级；0 行再走第 2 级 LIKE
   LIMIT 1
  ```
- 输出：对视图整行套用 `toCamel()` 即可，**必须再补一条** `provinceName` ← 命中行的 `province_name`（不是入参原样）。
- **必须处理 0 行**：返回 `{ provinceName: <入参 name> }`，页面会走 `normalizeRegion({provinceName})` 分支显示合理空态；**不要**返回 `null` 或 404。

### 5.7 `GET /interactive-materials/random`

- 调用方：`pages/interactive/interactive.vue:100`。`data`：**数组**，页面自己随机布点（`buildPuppetList`，`interactive.vue:72-89`：写 `x`/`y`/`size`/`found`/`justFound`，**shim 不要返回这些字段**）。
- 读取：`id`、`name || puppetName`、`imageUrl || image_url || url`（有 snake 回落）。为空时回落 `artAssets.game.puppetEmpty`。
- SQL：
  ```sql
  SELECT id, name, image_url, category, description
    FROM interactive_characters
   WHERE is_active = 1
   ORDER BY RAND() LIMIT ?
  ```
- `[待确认]` 每局数量 —— 读 `interactive.vue` 里的常量（`PUPPET_SIZE` 附近）再定，见 §10-Q4。

---

## 6. camelCase 别名规则表（做错就白干）

DB 列是 snake_case，页面 `normalize*` 函数对大小写的容忍度**不一致**。逐端点结论：

| 端点 | 页面是否接受 snake 回落 | shim 是否必须改名 |
| --- | --- | --- |
| `/assets/common` | ❌ 只认 `imageKey` / `relativePath` | **必须改名** |
| `/quiz/questions/random` | ❌ 只认 `questionText` / `optionA-D` / `correctAnswer` | **必须改名** |
| `/craft-process/steps` | ⚠️ 只有 `image_url` 有回落；`stepSort`、`detailsContent` 必须 camel | **必须改名** |
| `/regions/by-name` | ❌ 六个字段全只认 camel | **必须改名** |
| `/daily-appreciations/random` | ✅ `image_url` 有回落 | 建议改名，非强制 |
| `/interactive-materials/random` | ✅ `image_url` 有回落 | 建议改名，非强制 |
| `/history/timeline` | ✅ 双回落齐全 | **不用改名** |

**最省心的实现**：shim 里放一个 `toCamel(row)` 工具（`snake_case → camelCase`），对 `/history/timeline` 之外的 6 个端点统一套用。注意 `option_a` → `optionA` 正好符合，`details_content` → `detailsContent` 正好符合，`image_key` → `imageKey` 正好符合。

**验证方式**：§9 的每条 curl 都要人工比对一次字段名，不要只看返回了 200。

---

## 7. 前端 8 页面复刻清单

页面实测规模 `[已核实]`：quiz 479 行、interactive 466、display 451、history 363、school 278、process 226（6 个页面 2263 行），另有 index、select 未统计。

| 路由（建议） | 对应小程序页 | 依赖的 shim 端点 | 复刻要点 |
| --- | --- | --- | --- |
| `/` | `pages/index/index` | 无（纯视觉着陆） | 点击后 `uni.navigateTo` → `uni.$router` 或 `<router-link>` |
| `/select` | `pages/select/select` | `/assets/common` | 地图寻影，`redirectTo` 式跳转见 `utils/navigation.js`；`saveRegion()` 写 `currentRegion`，web 侧换成 `localStorage` |
| `/display` | `pages/display/display` | `/daily-appreciations/random` | 「每日一赏」+ 底部 5 tab 导航（`artNavTabs`） |
| `/process` | `pages/process/process` | `/craft-process/steps` | 8 步工艺流程，步骤图为空时有回落图 |
| `/interactive` | `pages/interactive/interactive` | `/interactive-materials/random` | 找影偶小游戏；坐标随机化逻辑**原样保留在前端** |
| `/quiz` | `pages/quiz/quiz` | `/quiz/questions/random` | 一轮多题 + 计分 + 解析展示 |
| `/history` | `pages/display/history` | `/history/timeline` | 时间轴，`activeEra` / `expandedId` 折叠交互 |
| `/school` | `pages/display/school` | `/regions/by-name` | 地域流派四宫格（造型/色彩/唱腔/剧目），tab `currentTab='styling'` 起步 |

> 表中「依赖的 shim 端点」只列**本页主动调用**的那个。`/assets/common` 是**全部 8 页共同的应用级依赖**（见 §7.2），不是 `/select` 专属。

**移植时逐页要替换的东西：**

1. `import request from '@/utils/request.js'` → 新的 `src/api/index.js`（fetch 版，见下）。
2. `uni.request` → `fetch`；保持 `unwrapResponse` 的 `code === 0 || code === 200` 语义不变，页面代码才不用改。
3. `uni.navigateTo` / `redirectTo` → `vue-router`。
4. `uni.setStorageSync` / `getStorageSync('currentRegion')` → `localStorage`（`utils/navigation.js:16` 有 `DEFAULT_REGION = '陕西'`）。**保留这个默认值以维持行为一致**，但注意它**匹配不到库里的 `陕西省`** —— 容错必须由 shim 承担（§5.6），不要改成 `'陕西省'` 来绕过，那会让地图页传进来的短名字全部失效。
5. `uni.showToast` → 自己实现一个 toast 或直接用页面内 `ArtStatus` 空态。
6. `onLoad` / `onMounted`（`@dcloudio/uni-app` 的 `onLoad`）→ 只用 `onMounted`，query 参数从 `route.query` 取。
7. **`rpx` 单位**：uni-app 私有单位（750rpx = 视口宽）。纯 web 里没有。**必须转换**：建议约定 `1rpx = 0.5px` 基准，或写一个 postcss 插件把 `rpx` → `clamp()`/`rem`。这是复刻里最大的一块机械工作量，先拿 `/process`（最短，226 行）试通转换规则，再推广。
8. `navigationStyle: "custom"` → web 本来就没有原生导航栏，`ArtTopBar` / `ArtBottomNav` 组件直接当普通组件用，不需要特殊处理。
9. ~~`uni_modules`（47 个 uni-ui 组件）~~ → ✅ **`[已核实 2026-11-05]` 无需处理，8 个页面一个 uni-ui 组件都没用**（详见 §1 的结论块）。不要安装 uni-app。

### 7.1 组件清单 `[已核实 2026-11-05]`

对 8 个页面检索 `import ... from '@/components'`，实际被引用的组件**只有 7 个**：

```
components/art-v2/ArtPageShell.vue     页面外壳（背景 + 内容槽）
components/art-v2/ArtTopBar.vue        自定义顶栏
components/art-v2/ArtBottomNav.vue     底部 5 tab 导航
components/art-v2/ArtButton.vue        按钮
components/art-v2/ArtStatus.vue        加载 / 错误 / 空态
components/MapIcon.vue                 地图点位图标
components/OptionOne.vue               答题选项行
```

- **组件之间不互相 import**（`components/` 下检索 `from '@/components'` 无命中）→ 7 个都是叶子，可逐个移植，没有依赖顺序问题。
- `components/BottomNav.vue` 和 `components/ClickGoTo.vue` **没有任何页面引用**，是遗留文件，**跳过不做**。
- `components/art-v2/` 目录共 6 个文件（上表 5 个 + 1 个未被页面直接引用的）。

### 7.2 `/assets/common` 是全局的，不是某个页面专属

`App.vue:13` 的 `onLaunch(() => initImageStore())` 会拉 `/assets/common` 填充 `globalImages`，**8 个页面全部依赖它**（`config/artAssets.js` 的每个 getter 都先查这张表）。
所以复刻时它对应**应用级初始化**（在 `main.js` 或路由守卫里拉一次），不要只挂在 `/select` 上。

**新 `src/api/index.js` 的骨架要求**（照 §3.3 的语义重写，不要 import 源码）：

- base 只从 `import.meta.env.VITE_API_BASE_URL` 读，**不给默认内网 IP**；
- 拼 `/api/v1` 前缀；
- GET 把 `data` 编成 query string，跳过 `undefined/null/''`；
- 解析 `{code,data,message}`，`code===0||200` 取 `data`，否则 throw；
- 不发送 `X-Api-Base-Url` / `X-Backend-Origin`（§2-6）。

**注意 dev server 用 HTTP，不要用 HTTPS**：`[已核实]` `<SRC>/apps/uniapp/vite.config.js:90` 是 `resolveHttpsConfig(command !== 'build')`，`:48-49` 从 `../../certs` 读证书、`:51` 证书缺失即抛错 —— 这是 uniapp `dev:h5` 起不来的原因（`build:h5` 反而正常）。`<DST>` 是全新工程，**直接不要启用 https**，绕开这个坑。

---

## 8. 实施顺序（按此顺序做，每步可独立验证）

1. ✅ **`[已完成 2026-11-05]`** 前置确认与建库：数据已导入 `deepseek` 库（26 表 + 3 视图），详见 §3.6。派生脚本在 `<DST>/server/db/10_legacy_v1.sql`，可重复执行验证。**下一步直接从 §8-3 开始，不要重新导入。**
2. ✅ **`[已跳过]`** 整份 `cloud_shadow_v2_full.sql` **不要**再跑一遍。它会尝试 `CREATE DATABASE`，当前账号无此权限、必然失败；而且 `deepseek` 库里已经有全部所需数据。若将来确实需要 `cloud_shadow_v2` 库，必须先让用户授予 CREATE 权限并由用户执行。
3. **搭 shim**：`<DST>/server/`，Node + 一个 MySQL 驱动（建议 `mysql2/promise`，预编译语句）+ 原生 `http` 或 Fastify。7 个端点，`GET /healthz` 加一条。**连接参数指向 database = `deepseek`**（不是 `cloud_shadow_legacy`，见 §3.6）；凭据从 `<DST>/.env.local` 读 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`，缺变量时给明确报错。账号已由用户提供，可立即实连。
4. **验证 shim**：逐条 curl 比对 §9，**重点核对 §6 的字段名**。此时还没有前端，先确保契约对。账号已就绪，可直接实连；**`/regions/by-name?name=陕西` 这条务必测**（后缀容错，见 §5.6）。
5. **搭前端骨架**：Vite + Vue 3 + vue-router + 上述 `src/api/index.js` + proxy 配置（`/api`→shim、`/images`→`<SRC>/storage/assets/legacy-import/images`，见 §2-2；`data/` 目录不用挂）。**dev server 用 HTTP，不要开 https。**
6. **打通 rpx 转换规则**：用 `/process`（226 行，最短）作为试点页，跑通「样式转换 + 数据渲染 + 图片显示」全链路。**这一步不通过就不要开工其他页面。**
7. **按序复刻剩余页面**：`/history` → `/school` → `/quiz` → `/interactive` → `/display` → `/select` → `/`（着陆页最后做）。组件按 §7.1 的 7 个来，`BottomNav.vue` / `ClickGoTo.vue` 不做。
8. **补 `static/` 小资源**：`[已核实]` art-v2 全套 PNG 由 §8-5 的 `/images` 挂载直接覆盖，**不需要单独处理**（§3.4）。唯一要做的是把 `apps/uniapp/static/`（85 KB / 28 文件：SVG 图标、`c1..c9.png`、`customicons.ttf`）**复制**进 `<DST>/src/assets/` —— 这是全项目唯一允许复制的素材目录，仅当页面确实引用了其中的 SVG/字体时才需要（先 grep 再决定）。
9. **端到端验收**：§9 清单全走一遍。

---

## 9. 验收清单

### 9.1 shim（每条都要比对字段名，不只看状态码）

```
GET /api/v1/assets/common               → data 是数组，87 项，每项含 imageKey + relativePath（camel）
GET /api/v1/daily-appreciations/random  → data 是对象，含 title + description + image_url|imageUrl（库中 72 行可抽）
GET /api/v1/quiz/questions/random       → data 是数组，每项含 questionText + optionA..D + correctAnswer(A/B/C/D)（库中 116 行可抽）
GET /api/v1/craft-process/steps         → data 是数组，8 项，含 stepSort(数字) + detailsContent（不是 detail_content）
GET /api/v1/history/timeline            → data 是数组，8 项，era_name/era_title/detail_content/sort_order 原样 OK
GET /api/v1/regions/by-name?name=陕西    → 【关键回归用例】必须命中「陕西省」，六个 camel 字段非空
GET /api/v1/regions/by-name?name=陕西省  → 同样命中（第 1 级精确匹配）
GET /api/v1/regions/by-name?name=内蒙古  → 命中「内蒙古自治区」（验证 LIKE 前缀容错对长后缀也生效）
GET /api/v1/regions/by-name?name=不存在的省份 → data 是 { provinceName: "不存在的省份" }，不 404、不 null
GET /api/v1/interactive-materials/random → data 是数组，含 name + image_url，不含 x/y/size（库中 72 行可抽）
```

- 每个响应外层必须是 `{"code":200,"message":"...","data":...}`。
- 中文不乱码（`charset=utf-8`）。
- `name` 参数含 `'` 或 `;` 时不报 SQL 错（验证预编译生效）。

### 9.2 前端

- 8 条路由全部可达、控制台零 error。
- **每页真实渲染出 DB 内容**（不是空态、不是回落占位图）。特别是：`/school` 六格有文字、`/quiz` 四个选项有文字、`/process` 8 步按序排列。
- 图片全部加载成功（Network 无 404）。
- 移动端视口（375px 宽）与桌面视口都无明显破版。
- `localStorage.currentRegion` 改变后 `/school` 跟着变。
- 断网/shim 停掉时页面显示错误态而不是白屏。

---

## 10. 开放项 `[待确认]` —— 开工前问用户，不要自己猜

| # | 问题 | 状态 |
| --- | --- | --- |
| Q1 | **MySQL 身份** | ✅ **已解决（2026-11-05）**：用户提供 `deepseek`@`%`（口令由用户直接给出，只写进 `<DST>/.env.local`，**不进本文件、不进 git、不进 memory**）。权限范围 `ALL PRIVILEGES ON deepseek.*`，**无 CREATE DATABASE**。数据库名固定 `deepseek` |
| Q2 | **库是否已导入** | ✅ **已完成（2026-11-05）**：legacy 段已导入 `deepseek` 库，26 表 + 3 视图，行数见 §3.5。**不要重跑原始 3.9 MB 脚本**（会因无 CREATE 权限失败） |
| Q3 | **视觉基准** | `[待确认]` 复刻是「跟小程序长得一样」还是「借内容重做一套 web 版式」？rpx 转换策略取决于这个答案 |
| Q4 | **随机条数** | `[待确认]` `/quiz` 每题数、`/interactive` 每局影偶数 —— 先从 `.vue` 里读常量，读不到再问 |
| Q5 | **要不要做登录/收藏/账号页** | 建议**不做**：`[已核实]` demo README §5 写明「文化浏览不要求默认账号」，复刻范围限定在 8 个浏览页。`[已核实]` 库里 `users` 有 2 行、`user_favorites`/`comments` 为 0 行，做登录也没有可用内容 |

**已回答过的账号问题（结论，不必重查）**：路线 B **不需要**任何后端账号 —— shim 直连 legacy 库、无鉴权。若将来要接 `/api/v2`，唯一被认可的本地建号方式是 `<SRC>/services/backend/cmd/cloudshadowctl/main.go:21` 的 `cloudshadowctl users bootstrap --email EMAIL --display-name NAME --roles editor,reviewer --password-stdin`；公开 `POST /users` 自注册要求 `termsAccepted`/`privacyAccepted` + 邮件验证（本地 adapter 落到 `services/backend/.local/mailbox`）。且 v2 的 internal 内容可见性靠 `content.read.internal` 权限，**不是「登录了就能看」**。

---

## 11. `<SRC>` 侧的唯一例外：`apps/uniapp/utils/request-v2.js`

`[本会话已完成，勿重做]` 已创建 `<SRC>/apps/uniapp/utils/request-v2.js`（253 行，9205 字节）—— 一份符合 `apps/uniapp/docs/UI与工程实现规范.md` §5 的 V2 网络 adapter，保持与 `request.js` 相同的公开签名（默认导出 + `.get/.post/.put/.delete`），实现裸资源解析、RFC 7807 错误模型、`/session-renewals` 401 续签重放、GET-only 重试、Rendition URL 解析，并**主动拒绝** `/api/v1` 地址。`utils/request.js` 本体保持冻结未动 `[已核实]`。

**这份文件属于另一条路线（v1→v2 逐页迁移），路线 B 用不到它。** 不要删，也不要因为看到它就以为 shim 该返回裸资源。

---

## 12. 背景：为什么不走 `/api/v2`（一段话，够用了）

`[已核实]` `services/backend/openapi/v2.yaml` 只开了 15 条路径，集中在 identity（users/sessions/preferences/email-verification）和 knowledge（content-discovery、cultural-entities 及 relations）加一条 assets rendition；而 `cloud_shadow_v2` 有 87 张表 —— **数据治理层已建好，API 表面远没补齐**。小程序 8 个页面在用的 7 个 v1 路径里，只有 2 个能勉强对上 v2 语义（`/content-discovery`、`cultural-entities`），其余在 v2 中无对应资源；且 `store/imageStore.js` 依赖的 `imageKey→URL` 批量下发机制在 v2 里根本没有等价物（v2 素材是 `MediaSummary{assetId,profileCode}` 引用式）。
所以复刻走 legacy shim 是**当前唯一能立即跑通**的路。

另一个背景：全部 185 条素材的权利状态仍是 `internal`，本项目当前是 `internal_preview` 里程碑而非公开发布。**复刻产物同样不得对外发布。**

---

## 13. 快速索引

| 我要找 | 去哪儿看 |
| --- | --- |
| 页面路由与标题 | `<SRC>/apps/uniapp/pages.json` |
| v1 请求语义（envelope 规则） | `<SRC>/apps/uniapp/utils/request.js:108-128` |
| 素材表初始化 | `<SRC>/apps/uniapp/store/imageStore.js` |
| 各页面字段回落链 | 见 §5 各小节引用的 `normalize*` 行号 |
| 地区默认值与跳转 | `<SRC>/apps/uniapp/utils/navigation.js` |
| art-v2 素材路径与 tab | `<SRC>/apps/uniapp/config/artAssets.js:21`、`:259` |
| 全部建表与数据 | `<SRC>/database/release/cloud_shadow_v2_full.sql` |
| 迁移规范（禁改方向依据） | `<SRC>/apps/uniapp/docs/UI与工程实现规范.md` §5、`产品体验与V2迁移规范.md` §6-7 |
| v2 已实现范围 | `<SRC>/services/backend/openapi/v2.yaml`、`internal/knowledge/http/handler.go` |
| 参考实现（React 版 v2 前端） | `<SRC>/apps/web/`（已覆盖 6/8 页面的等价功能） |
