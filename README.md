# 云上皮影 · Web 复刻（路线 B）

把 `Cloud-Shadow-组员演示开发包` 里的 UniApp 小程序 8 个页面，用 **Vue 3 + Vite + vue-router** 复刻成纯 Web 应用；
数据来自本地 MySQL 的 legacy 表，通过一个**只读 v1 shim**供给前端。

- 源工程（只读引用）：`D:\聚萤分享\Cloud-Shadow-组员演示开发包-2026-08-03`（当前以 `Cloud-Shadow-2026-08-03.zip` 形式存放）
- 本工程：`D:\PiYingGameWeb` —— **自包含**，唯一外部依赖是 MySQL
- 交接文档：[HANDOFF.md](HANDOFF.md)；页面复刻口径：[CONVENTIONS.md](CONVENTIONS.md)

## 架构

```
浏览器
  ├─ GET /                  → Vue 3 SPA（dev: Vite，prod: server/static-server.js）
  ├─ GET /api/v1/*          → shim（Node + mysql2，只读 SELECT，连 database=deepseek）
  └─ GET /images/**         → <工程>/assets/images（工程内直出；603 MB 素材刻意不入 git）
```

三个要点：

1. **只读 shim**：7 个 GET 端点，返回 v1 envelope `{code, message, data}`；HTTPS 状态恒为 200，
   业务失败用 `code` 表达（前端 `unwrapResponse` 依赖这一点）。
2. **素材自包含**：`/images` 直接映射工程内的 `assets/images`，所以**拷贝本工程目录即可运行**。
   该目录 603 MB / 410 文件，刻意不进 git（否则仓库膨胀到 GB 级）；首次拿到仓库请运行
   `scripts/extract-assets.ps1` 从源工程 zip 一键抽取。文件名含空格、括号、大写扩展名
   （如 `shanxipy (1).PNG`），dev server 与生产静态服务器都做了 decode 与目录穿越保护。
3. **单源部署**：`VITE_API_BASE_URL=/api/v1` 时 `BASE_URL=''`，图片走同源相对路径 → 零 CORS、零源码改动。

## 目录结构

```
├─ index.html                 SPA 入口
├─ vite.config.js             rpx 转换插件 + /api 与 /images 双 proxy + 宽屏素材映射
├─ .env.example               配置模板（复制为 .env.local 再填口令）
├─ assets/images/             素材 603 MB / 410 文件（git 忽略；scripts/extract-assets.ps1 一键抽取）
├─ src/
│  ├─ main.js / App.vue       入口与根组件（App.vue 里初始化 /assets/common）
│  ├─ router/index.js         8 条路由
│  ├─ api/index.js            fetch 版 v1 adapter（禁止硬编码内网 IP / 禁止 X-Api-Base-Url 头）
│  ├─ store/imageStore.js     globalImages（imageKey → URL）与 normalizeImageUrl
│  ├─ config/artAssets.js     art-v2 素材表（9 组 getter + 5 个底部 tab）
│  ├─ utils/                  navigation（localStorage 地区）、rpx、toast
│  ├─ styles/base.css         --rpx 基准、reset、宽屏辅助类
│  ├─ components/art-v2/      ArtPageShell / ArtTopBar / ArtBottomNav / ArtButton / ArtStatus
│  ├─ components/             MapIcon / OptionOne / ArtToast
│  └─ pages/                  8 个复刻页面
├─ server/
│  ├─ src/index.js            shim HTTP 入口（7 端点 + /healthz）
│  ├─ src/endpoints.js        取数与 camelCase 映射（契约见 HANDOFF §5/§6）
│  ├─ src/db.js               连接池 + 只读纪律（拒绝非 SELECT）
│  ├─ db/10_legacy_v1.sql     legacy 段派生脚本（已导入 deepseek 库）
│  ├─ static-server.js        生产期同源静态服务器
│  └─ scripts/verify-shim.mjs §9.1 契约验收（19 项）
└─ scripts/verify-web.mjs     §9.2 浏览器验收（8 路由 × 2 视口）
```

## 前置条件

- Node.js ≥ 18（实测 24.19）
- 本地 MySQL 8 已启动，`deepseek` 库已导入（26 表 + 3 视图；导入脚本 `server/db/10_legacy_v1.sql`）
- 素材已放入 `assets/images/`（603 MB / 410 文件）：运行 `scripts\extract-assets.ps1` 从源工程 zip 抽取，
  或手动把 `<SRC>\storage\assets\legacy-import\images` 的内容复制进来

### 配置口令

把 `.env.example` 复制为 `.env.local`，填入 `DB_PASSWORD`：

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=deepseek
DB_PASSWORD=<你的口令>
DB_NAME=deepseek
SHIM_PORT=8787
VITE_API_BASE_URL=/api/v1
WEB_PORT=5173
```

> `ASSET_ROOT` 一般不用填：工程内 `assets/images` 存在时优先级最高，直接自包含运行。
> 只有把素材放到工程外时才需要它覆盖。

> 口令只存在于 `.env.local`（已被 `.gitignore` 排除）或进程环境变量。
> **不要**加 `VITE_` 前缀——那会把口令打进浏览器包。

## 启动

开发（两个进程）：

```powershell
npm run shim     # 终端 1：http://127.0.0.1:8787
npm run dev      # 终端 2：http://127.0.0.1:5173
```

或双击 `启动本地演示.bat`（自动开两个窗口并打开浏览器）。

生产：

```powershell
npm run build
npm run shim      # 终端 1
npm run serve     # 终端 2：http://127.0.0.1:8080（静态 + /api 反代 + /images 映射）
```

## 验收

```powershell
npm run verify        # shim 契约（19 项）+ 浏览器验收（8 路由 × 2 视口）
```

需要 shim 与 dev server 都在运行。浏览器验收会启动本机 Chrome（puppeteer-core），
逐页检查：路由可达、控制台 error、请求失败、图片损坏、横向溢出、真实 DB 内容关键词，
并把截图写到 `.artifacts/screens/`，报告写到 `.artifacts/verify-web.json`。

单独跑某一页：

```powershell
node scripts/verify-web.mjs quiz
node scripts/verify-web.mjs school display
```

## 打包下发

```powershell
npm run pack
```

按白名单生成 `_deliver/cloud-shadow-web-<时间戳>.zip`（约 0.2 MB / 53 个文件），打包前做三道校验：

1. 不含 `node_modules` / `dist` / `.artifacts` / `.env*.local`；
2. `.env.example` 的 `DB_PASSWORD` 必须为空（口令只能进 `.env.local`）；
3. `server/db/10_legacy_v1.sql` 必须存在（组员建库要用）。

> **不要把整个工程目录直接压缩发人**：会带上 `.env.local`（明文口令）和数百 MB 的 `node_modules`。
> 组员上手指南见 [docs/开发包说明.md](docs/开发包说明.md)。

## rpx 与宽屏策略

小程序用 `rpx`（750rpx = 视口宽），Web 侧由 PostCSS 插件在构建期把 `34rpx` 转成
`calc(34 * var(--rpx))`，源码保持可读：

| 视口 | `--rpx` | 效果 |
| --- | --- | --- |
| < 900px | `100vw / 750` | 1:1 还原（375px 屏上 1rpx = 0.5px） |
| ≥ 900px | `0.65px` 固定 | 字号保持舒适密度，不随视口翻倍 |
| ≥ 1600px | `0.78px` 固定 | 超宽屏略微放大 |

**宽屏铺满靠布局而不是放大字号**：列表页用
`repeat(auto-fill, minmax(560px, 1fr))` 多列网格，详情页用左右两栏，避免出现
「手机画框居中、两侧大片空白」或「卡片被撑成瘦高条、背景图纵向拉伸」。

## 关键决策（来自 HANDOFF，勿重开讨论）

| # | 决策 |
| --- | --- |
| D1 | 路线 B：独立 Vue 工程重写 8 个页面，**不复用** `.vue` 文件 |
| D2 | 不修改源工程任何文件；素材**物理放入工程内** `assets/images` 以实现自包含，但不进 git（603 MB） |
| D3 | 数据走本地 legacy 库（`deepseek`），不走 `/api/v2`（v2 后端未实现 v1 路径） |
| D4 | 不引入 uni-app / uni-ui（已核实 8 个页面零引用） |
| D5 | shim 只发 `SELECT`，只读由代码纪律保证（账号本身有 ALL PRIVILEGES） |
| D6 | quiz 每轮 5 题、interactive 每局 6 个影偶（用户确认） |
| D7 | 不做登录 / 收藏 / 账号页（库中无可用内容，用户确认） |

## 与源工程的差异（有意为之）

1. **不继承 `request.js` 的缺陷**：没有硬编码 `https://192.168.1.159:8080`，不发送
   `X-Api-Base-Url` / `X-Backend-Origin`（源工程 `UI与工程实现规范.md` §5 明令禁止）。
2. **dev server 用 HTTP**：源工程 `vite.config.js` 因 `resolveHttpsConfig` 读缺失证书导致
   `dev:h5` 起不来，本工程不启用 https。
3. **标签/事件改写**：`<view>/<text>/<image>` → `<div>/<span>/<img>`，`@tap` → `@click`，
   触摸事件改 `pointer*`，`uni.*` API 换成 vue-router / localStorage / fetch。
4. **`uni_modules` 未移植**：已核实 8 个页面零引用。
5. **`static/` 目录未复制**：已核实页面与组件对 `/static/` 零引用（HANDOFF §8-8 的条件不成立）。

## 已知限制

- **Linux 大小写敏感**：素材里同一组存在 `(1)~(4).PNG` 与 `(5).png` 混用，Windows 不报错，
  部署到 Linux 会 404。上线前需统一扩展名（HANDOFF §5.0）。
- **仅内部预览**：全部素材权利状态为 `internal`，本项目处于 `internal_preview` 里程碑，
  **复刻产物不得对外发布**（HANDOFF §12）。
- **数据规模小**：`plays` / `inheritors` / `exhibitions` 为空表，相关页面不依赖它们。
- **`information_schema.tables.table_rows` 不可信**：InnoDB 估算值严重偏差，
  判断表是否为空一律用 `SELECT COUNT(*)`（HANDOFF §3.5）。
