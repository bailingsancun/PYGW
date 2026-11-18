# 云幕皮影 · 非遗皮影数字化的 AI Web 应用

作品最初源自 `Cloud-Shadow-组员演示开发包` 的 UniApp 小程序（8 个页面），
现已扩展为 **Vue 3 + Vite + vue-router** 的 AI Web 应用：展馆数据由本地 MySQL 通过**只读 v1 shim**供给，
AI 能力（Agent / RAG / 多模态 / 端侧视觉）由独立的 AI 服务承担。

- 源工程（仅用于对照，**不是运行依赖**）：与本工程同级的 `..\PiYingGameWeChat`（原包另有一份 zip）
- 本工程：当前目录（仓库根）—— **自包含**，唯一外部依赖是 MySQL
- 交接文档：[HANDOFF.md](HANDOFF.md)；页面复刻口径：[CONVENTIONS.md](CONVENTIONS.md)

> 一个把非遗皮影搬进浏览器的 AI 应用：AI 生成的**可动皮影**直接上台表演，
> AI 讲解员知道自己正站在哪个省、看的是哪件作品，摄像头里的手势就是玩法输入。
> 面向 2026 AI Web 应用开发赛项（AI Agent 智能助手 / 多模态 AI 创意平台方向）。

---

## AI 能力总览

作品不是"传统页面加一个聊天框"，而是让 AI 成为皮影的**操偶师**与**说书人**。四块能力：

| 能力 | 载体 | 一句话说明 |
| --- | --- | --- |
| **讲解 Agent** | `server/src/ai/agent.js` + `tools.js` | Function Calling 驱动的工具调用循环（最多 3 轮、每轮 3 个工具），6 个只读工具 + 规则兜底规划；能回答问题，也能规划路线并**跳转页面** |
| **RAG 检索** | `retrieval.js` + `corpus.js` + `embedding.js` | 中文 bigram 关键词检索（可选 embedding 增强），top-4 命中随回答返回**可点击来源**，低于阈值宁可不答 |
| **多模态** | `/vision`、`/piying`、浏览器语音 | 识图讲解、语音提问与朗读；**图片转皮影**产出 15 个可动部件而非一张静态图 |
| **端侧视觉** | `src/piying/cv/`（MediaPipe WASM） | 摄像头姿态识别做 QTE 手势判定，视频不出浏览器；无摄像头时自动切指针轨迹 |

安全与兜底贯穿全部链路：输入/输出双向审核、密钥只走环境变量、模型不可用时降级到离线知识或本地程序化合成。


## AI 技术架构（Agent / RAG / 多模态 / 端侧视觉）

`server/src/ai-server.js` 是与只读 shim 分离的 AI 服务（默认 `127.0.0.1:8788`；dev 由 Vite `/api/ai` 代理，生产由 `static-server.js` 反代）：

- `GET  /api/ai/health`：配置 / 检索 / Agent / 多模态 / 安全状态
- `POST /api/ai/ask`：RAG 非遗问答（流式 + 来源）
- `POST /api/ai/narrate`：按当前地区/页面生成讲解
- `POST /api/ai/vision`：**多模态识图**（图片 DataURL + 可选问题 → 看图讲解，SSE 流式）
- `POST /api/ai/quiz`：**AI 动态出题**（依据展馆资料生成结构化选择题 + 解析，JSON 返回；未配置/失败回落 curated 种子题）
- `POST /api/ai/agent`：**导览 Agent（Function Calling 工具调用）**，SSE 事件：
  `step → tool_call → tool_result → sources / navigate → delta → done`

Agent 工作流（`server/src/ai/agent.js`）：

1. **模型驱动工具规划**：OpenAI 兼容 `chat` 协议下，用 `tools + tool_choice=auto` 让模型决定调用哪些工具（最多 `AI_AGENT_MAX_STEPS` 轮）；
2. **工具白名单**（`server/src/ai/tools.js`）：`search_knowledge` / `get_region_profile` / `get_craft_process` / `get_history_timeline` / `list_regions` / `navigate_to`；工具只读展馆知识快照与 RAG 语料，`navigate_to` 仅允许应用内路径；
3. **规则兜底**：未配置 LLM、非 chat 协议或模型未调用工具时，按意图规则规划同一批工具，保证链路始终可运行；
4. **流式作答**：把工具观测结果注入最终 prompt，走真实 SSE token 流；LLM 失败时回落工具观测整理。

配置（`.env.local`，密钥绝不进仓库）：`AI_BASE_URL / AI_API_KEY / AI_FORMAT / AI_MODEL`，可选 `AI_AGENT_MAX_STEPS`（1-8，默认 3）、`AI_RATE_LIMIT`（每分钟每 IP 上限，默认 20，0=关闭）、`AI_TRUST_PROXY`（默认 0 按 socket IP 限流；仅可信反代后设 1 才读 `X-Forwarded-For`）、`AI_ALLOWED_ORIGINS`（跨源白名单，同源部署/Vite 代理无需配置）。`/ask`、`/narrate`、`/agent`、`/vision`、`/quiz` 超出限流返回 HTTP 429，前端提示「AI 请求过于频繁」。
未配置 LLM 时 Agent 仍可用：规则规划 + 展馆资料整理，前端标注「AI 暂不可用」。

前端入口：右下角「影」按钮 → 面板顶部 **Agent 漫游** 开关；开启后展示工具轨迹、来源 chips 与可点击/自动跳转的路线。

### 交互形态

- **入口**：右下角悬浮球，只在展馆内部页面出现；着陆页（`/`）不渲染，返回首页时随之消失并关掉已打开的面板。
- **可拖动**：悬浮球与面板都能拖。面板每次打开锚定在悬浮球附近；关闭时若用户拖过面板就让球水平跟随
  （**只同步 x 轴**，垂直位置是用户偏好，不随开关跳动）。
- **可缩放**：桌面端面板右下角有缩放手柄，宽高与位置一并写入 `localStorage('ai-guide-pos')`。
- **逐字生成**：正文用打字机增长（离线兜底一次推整段时同样逐字）；「命中资料 / 步骤日志 / AI 生成标识」
  等附属信息等正文吐完再出现，安全过滤提示仍即时显示。
- **推荐提示词**：空对话时居中展示；有对话时收在消息流末尾。点某条即以用户气泡发出并隐藏整组，
  本次生成结束后再统一冒出来。
- **地区跟随**：地图页选中省份后 `saveRegion()` 派发 `REGION_CHANGE_EVENT`，助手顶部的地区标签同步更新
  （localStorage 自身不具备响应性，必须显式派发）。

### 多模态（识图 / 语音）

- **识图**：面板「图」按钮上传皮影图片 → 前端用 canvas 压缩为 JPEG DataURL（≤1024px，减小 payload）→ `/api/ai/vision`（OpenAI 兼容 chat 的 `image_url` 多模态 content）→ 看图讲解；结果带「图像识别」标签。
- **语音输入**：面板「语」按钮调用浏览器 `SpeechRecognition`（`zh-CN`）转写为问题；不支持的环境自动隐藏按钮。
- **语音朗读**：每条 AI 回答的「朗读」按钮用 `speechSynthesis`（`zh-CN`）播报，可再次点击停止。
- 语音为浏览器原生能力，**无新增依赖**；识图需要 `AI_FORMAT=chat` 且模型支持视觉（如 gpt-4o / qwen-vl-max / glm-4v），否则服务端回落「皮影赏析四看」+ 展馆资料。

### 内容安全与兜底（`server/src/ai/moderation.js`）

- **输入过滤**：拦截提示注入/越狱、明确违规与超长输入，命中即礼貌拒绝并引导回展馆主题（SSE 先发 `safety` 事件，前端显示「安全过滤」提示）；`region`/`page` 上下文走白名单（地区限语料收录名称、页面限应用内路由），注入文本进不了 prompt。
- **输出复核**：流式增量复核——安全前缀即时下发、尾部回留，违规/泄露组合在拼成前即被拦截（`safety(output)` 事件，前端隐藏全文），结束时再做全文复核兜底；拦截 API 密钥/系统提示泄露与违规内容，并清理控制字符。
- **兜底机制**：未配置 LLM、超时、上游报错或空回答时，回落展馆 curated 资料 / 工具观测整理 / 赏析指南；图片做 MIME（PNG/JPG/WebP）与大小校验；请求体与图片均有限长（超限返回 413）；上游错误细节只留服务端日志，前端只见通用提示。
- **结构化输出校验**：AI 出题（`/api/ai/quiz`）对模型返回做严格 JSON 解析与逐题校验（4 个互不重复选项、答案 A-D、解析非空、题干/选项/解析限长），非法结果整批丢弃并回落 curated 种子题；知识挑战页（`/quiz`）AI 不可用时再回落展馆题库。
- **可解释性**：回答展示来源 chips 与「AI 生成内容 · 已安全复核 · 仅供参考」标注；`/api/ai/health` 暴露 `vision / moderation` 能力；限流（默认按 socket IP，防 XFF 伪造）+ CORS 白名单防滥用；生产静态服务器带 `nosniff` / CSP / `X-Frame-Options` 等安全响应头，shim CORS 默认关闭。

### 素材、地图与 AI 内容合规

- **素材授权**：`assets/images` 的权利状态为 `internal`，仓库通过 `.gitignore` 排除素材本身；对外公开部署或宣传前须取得授权，未取得授权时仅用于赛事评审与教学演示。
- **中国地图**：`assets/images/art/v2/map/china_map_art.png` 为艺术化底图，缺少南海诸岛等要素，且未标注审图号。**公开传播前必须替换为自然资源部标准地图服务提供的标准地图并标注审图号**；赛事评审阶段地图页已展示「仅用于赛事与教学演示」的声明。
- **AI 生成内容标识**：AI 回答、AI 出题与识图结果均带「AI 生成」显式标识，并附「仅供参考」说明；展馆资料兜底内容标注为「展馆资料」。
- **隐私**：识图与语音仅用于当次讲解、不落库；图片会发送至所配置的第三方 LLM 服务，界面已提示请勿上传身份证、人脸等敏感信息。
- **事实核验**：地区流派资料为馆藏整理，非遗级别、批次、年代与流派归属等高风险字段，发布前应以文化和旅游部及 UNESCO 官方名录复核。

## 架构

```
浏览器
  ├─ GET /                  → Vue 3 SPA（dev: Vite，prod: server/static-server.js）
  ├─ GET /api/v1/*          → shim（Node + mysql2，只读 SELECT，连 database=deepseek）
  ├─ POST /api/ai/*         → AI 服务（RAG 问答 + Agent 工具调用，SSE 流式）
  └─ GET /images/**         → <工程>/assets/images（工程内直出；603 MB 素材刻意不入 git）
```

三个要点：

1. **只读 shim**：7 个 GET 端点，返回 v1 envelope `{code, message, data}`；HTTP 状态恒为 200，
   业务失败用 `code` 表达（前端 `unwrapResponse` 依赖这一点）。
2. **素材自包含**：`/images` 直接映射工程内的 `assets/images`，所以**拷贝本工程目录即可运行**。
   该目录 603 MB / 410 文件，刻意不进 git（否则仓库膨胀到 GB 级）；首次拿到仓库请运行
   `scripts/extract-assets.ps1` 从源工程 zip 一键抽取。文件名含空格、括号、大写扩展名
   （如 `shanxipy (1).PNG`），dev server 与生产静态服务器都做了 decode 与目录穿越保护。
3. **单源部署**：`VITE_API_BASE_URL=/api/v1` 时 `BASE_URL=''`，图片走同源相对路径 → 零 CORS、零源码改动。

## 身入影幕（光影互动 · 打斗过场 + 三式校准）

`/interactive` 的「身入影幕」按钮进入独立页面 `/curtain`（保留 ArtPageShell + 顶栏 + 底部导航的原有框架，
转场复用「影幕寻踪」那套灯晕扩散 `playPageGlow`）。

**过场动画**：`src/piying/battle/` 是 `testdemo/piying-rig/battle` 的迁移版（score 时间轴 + canvas 渲染器 + 播放控制器）。

- 整段 84.2s：0–17s 三段对白（无 BGM），17s 后配乐起，分双将交锋 / 步步紧逼 / 妖法流矢 / 一刃断矢 / 黑雾遁形五段。
- **没有进度条、没有跳过**：页面不渲染任何播放控件，播放器也不对外提供 seek（只有 QTE 失败时的内部回退）。
- 人物下方不再标「将领 / 徐鸿儒」（原调试页的标注已删除）。
- 时钟模型沿用原作：对白段用 `performance.now`，配乐段以 `audio.currentTime` 为准，二者在 17s 交接；
  配乐被浏览器拦截或提前结束时自动切无声时钟，过场不会卡住。

**三式校准（QTE）**：`src/piying/battle/qteTimeline.js` 把主角三个招式对应到 CV 的三动作识别。

表头「时间轴」为该式在动画里的落点（判定的正中）；引导角标从它前面 3.3 秒出现，
判定窗口是节点前后各 2 秒，**结算时刻 = 节点时间 + 2s**。

| 节点 | 时间轴 | 动作 | 角标位置 | 失败回退点 |
| --- | --- | --- | --- |
| 招架弹反 | music 18.6s（徐鸿儒腾身跃起） | X 交叉 | 左上 | 阶段一「双将交锋」开头（music 0） |
| 蓄力刺击 | music 33.6s（沉身蓄势中） | 前突刺 | 左下 | 上一式结束之后（music 18.6） |
| 斩断流矢 | music 60.2s（特写里流矢逼近） | 下劈 | 右下 | 上一式结束之后（music 33.6） |

- 到达节点前 **3.3 秒**（看图 1.3s + 判定前半 2s）在画面角落弹出引导角标——**不暗屏、不暂停，动画照常播放**：
  第一式左上、第二式左下、第三式右下，避开画面中央的打斗。角标内含示意图（CV 的 `guides.js`，纯 SVG）、
  招式名、动作要领、倒计时条与实时识别反馈（`scores.thrust` 等姿态分）。
- **判定窗口以节点为中心、前后各 2 秒**（共 4 秒）：招式动作在节点演出，玩家在动作前后各两秒内做出对应动作都算校准；
  播放器在 `time >= node.time + 2` 时才结算，通过就不打断演武，未通过才停下播黑屏闪回并回退（见下）。
- 判定输入有两条路：**摄像头视觉识别**（`src/piying/cv/vision.js`：MediaPipe PoseLandmarker + `gestures.js` 三动作识别），
  以及**指针轨迹**（`src/piying/qte/trace.js`）——画两笔交叉的斜线 = X，一笔横向直刺 = 前突刺，一笔自上而下 = 下劈。
  没有摄像头 / 拒绝授权 / 自动化环境里也能过关。
  「朝镜头前刺」这类屏幕位移极小的动作另有一条**屈臂→伸直快速通道**（连续 3 帧确认，避免抬手举高误判），
  判定参数由 `scripts/verify-gestures.mjs` 的离线合成骨架用例回归。
- 失败 → 黑屏闪回微转场（`utils/pageFlashBack.js`，约 620ms）→ 动画与 BGM 一起退回上一检查点续播；
  已通过的节点不会重复拦截，退回点之后重新遇到下一式才会再校准。

**幕后（动画结束）**：canvas 交给 DOM 皮影舞台（`CurtainHub.vue`）。

- **白色纸灯箱铺满整个幕后画面**（不再是中间一块）：皮影舞台的纸色背景改由外层提供，
  引擎自带的灯箱背景/网格纹理被覆盖，人物底部对齐、可放大而不被裁。
- 主角恢复「持剑拄地」并保持呼吸摆动，默认不显示关节点；点皮影出现关节点、可直接拖动调试，点空白收起。
- **皮影可缩放**：右上角「− / ＋」（55%~190%）或直接在舞台上滚轮；缩放后仍保持居中。
- 原「决战将启」的位置换成四个入口：上「开始游戏」/ 中左「切换本地皮影」/ 中右「AI图片转皮影」/ 下「人影动作同步」。
- **添加组件**：面板底部「＋ 添加组件（场景 / 特效）」打开砌末库（`public/piying/scenery`，
  城楼 / 山石 / 松 / 军帐 / 军旗 / 云纹 / 火焰 / 黑雾 / 流矢 / 断矢两半），点一项即放到背景层；
  放好的组件可拖动、滚轮或按钮缩放、左右翻转、删除，全部画在皮影之下（真正的「背景」）。
  **图层覆盖规则**：新组件默认加在最上层，但**用指针点过/拖过的组件会提到最上层，之后新添加的组件插在它下面**——
  也就是「选中的组件始终压住新加的组件」，直到你再点别的组件为止（数组顺序即绘制顺序）。
  为让点击能落到砌末上，皮影部件层设了 `pointer-events:none`，只有关节手柄仍接收指针事件。
- **切换本地皮影**：先弹**已注册角色窗口**（角色图 + 角色名 + 单选勾选，内置将官/武净与本次导入/AI 生成的角色都在里面），
  点一项立即换上；真正导入新文件夹放在窗口右下角的「导入其他文件」——点了才走
  `showDirectoryPicker`（其它浏览器回落 `<input webkitdirectory>`）的文件夹导入，
  manifest / 零件图 / 关节树任一不合法都直接拒绝并弹窗列出原因（`scripts/verify-piying-import.mjs` 覆盖 8 个用例）；
  换上后武器固定为主角的宝剑（`applyHeroWeapon` 会摘掉角色自带武器并把宝剑挂到手节点，attach 按手部件尺寸等比缩放，
  剑的角度按该角色手臂的累计角度自动抵消，所以谁拿着都是「持剑拄地」而不是斜着翘起来）。
- **AI图片转皮影**：`POST /api/ai/piying`（`server/src/ai/piying.js`）按 `.qoder/skills/piying-pipeline` 的
  `prompts.md` 模板做人物门禁 + 图像生成（fast 单张零件图 / refined 定妆图 + 零件图）；前端 `src/piying/ai/chroma.js`
  把洋红底零件图抠成透明部件并对号入座装到标准骨架上。
  **未配置图像生成模型时**（`PIYING_IMAGE_BASE_URL / PIYING_IMAGE_API_KEY / PIYING_IMAGE_MODEL`），
  改由 `src/piying/ai/procedural.js` 用上传照片采样到的主色程序化合成整套皮影部件，同样产出可注册的皮影文件，
  界面会明确标注「本次由本地皮影合成器生成」。
- **人影动作同步**：开启摄像头 + MediaPipe 姿态，`src/piying/cv/tracker.js` 把肩/肘/腕、髋/膝/踝、躯干与头的角度
  平滑映射到皮影关节（预留 `setAngles` 接口），皮影一边呼吸摆动一边跟着人动；关闭即恢复驻地势。

**素材与路径**（全部在 `public/` 下，源码里用 `src/piying/paths.js` 基于 `import.meta.env.BASE_URL` 拼路径）：

```
public/piying/characters/{general,warrior}/   角色 manifest + 部件 PNG
public/piying/scenery/                        砌末（城楼/山石/松/云/旗/流矢）
public/piying/audio/battle-bgm.mp3            过场配乐
public/cv/vendor/tasks-vision/                MediaPipe tasks-vision（wasm 运行时）
public/cv/vendor/models/                      pose_landmarker_full / lite 模型
```

`public/cv/vendor/` 体积约 44MB（wasm + 模型），**不进 git**（交付 zip 已包含，解压即用）；
git 克隆后请运行 `node scripts/fetch-cv-vendor.mjs`（从官方 CDN 下载，逐文件 sha256 校验，跨平台、可重复运行）。
有 `testdemo/` 源目录的机器也可用 `powershell -File scripts/copy-piying-assets.ps1` 复制整套素材。

## 页面转场：云海启幕

首页「启幕寻影」进入地图页之间有一段约 4.1 秒的转场（实装自草案 05）：

- **实现**：`src/components/art-v2/TransitionVeil.vue` 用 rAF 时间轴逐帧写 `transform / opacity`，
  不走 CSS keyframes；按 `LEAD → 入场 → 停留 → 散场 → TAIL` 推进，横竖屏各一套云朵构图。
- **挂载位置**：必须在 `App.vue`（`router-view` 之外）。放进页面组件会随路由切换卸载，动画直接被掐断。
- **切路由的时机**：放在「散场开始」那一刻——此时转场背景仍不透明，切完再淡出，露出的才是地图页而不是首页。
- **默认参数**：入场 1500ms / 停留 600ms / 散场 1400ms / 晃动 7° / 起始角 -150° / 背景放大 1.18×。

素材取自 `assets/images/web/{bg,elements}`。`testdemo/` 是本地草案目录（含调参坞、对照层等调试 UI），
已加入 `.gitignore`，删除它不影响正式工程。

## 页面微转场（四套）

日常跳转用四套轻量过渡，按「跳转类型」分工、互不叠加，单段都在 1 秒内：

| 触发场景 | 方案 | 实现要点 |
| --- | --- | --- |
| 底部 tab 互切 | **灯焰呼吸** | `utils/pageFlash.js` + `PageFlash.vue`：400ms 暖暗遮罩压暗再回升，路由在暗场最深处（160ms）替换 |
| 展示页 ↔ 子页 | **影人推移** | `utils/pageSlide.js`：旧页反向推出 90ms → 切路由 → 新页推入 130ms；只作用于 `.art-page-shell` |
| AI 导览 / 来源卡片跳转 | **幕布斜扫** | `utils/pageCurtain.js` + `PageCurtain.vue`：260ms 柔边斜幕自左向右扫过，扫到正中时切路由 |
| 页面内入口 → 玩法 | **灯晕扩散** | `utils/pageGlow.js` + `PageGlow.vue`：以点击点为圆心扩散 640ms，盖满（300ms）时切视图 |

- 四套转场层都挂在 `App.vue`（`router-view` 之外）：放进页面组件会随路由卸载，动画被掐断。
- **影人推移只作用于 `.art-page-shell`**：底栏 `ArtBottomNav` 在它外面且是 `position: fixed`，
  一旦给其祖先加 `transform`，fixed 会退化成相对定位、底栏会跟着跳。
- 另有一套反向动效：`utils/pageFlashBack.js`（黑屏闪回约 620ms），用于「身入影幕」QTE 失败后
  退回上一检查点。

## 目录结构

```
├─ index.html                 SPA 入口
├─ vite.config.js             rpx 转换插件 + /api 与 /images 双 proxy + 宽屏素材映射
├─ .env.example               配置模板（复制为 .env.local 再填口令）
├─ assets/images/             素材 603 MB / 410 文件（git 忽略；scripts/extract-assets.ps1 一键抽取）
├─ public/piying/             皮影角色、砌末、过场配乐（scripts/copy-piying-assets.ps1 同步）
├─ public/cv/                 MediaPipe tasks-vision 运行时与姿态模型（44MB，git 忽略）
├─ src/
│  ├─ main.js / App.vue       入口与根组件（App.vue 里初始化 /assets/common）
│  ├─ router/index.js         9 条路由（含 /curtain 身入影幕）
│  ├─ api/index.js            fetch 版 v1 adapter（禁止硬编码内网 IP / 禁止 X-Api-Base-Url 头）
│  ├─ store/imageStore.js     globalImages（imageKey → URL）与 normalizeImageUrl
│  ├─ config/artAssets.js     art-v2 素材表（9 组 getter + 5 个底部 tab）
│  ├─ utils/                  navigation、rpx、toast、transition（云海启幕）、
│  │                          pageFlash / pageSlide / pageCurtain / pageGlow（四套微转场）、pageFlashBack
│  ├─ styles/base.css         --rpx 基准、reset、宽屏辅助类
│  ├─ piying/                 身入影幕模块（见下）
│  │  ├─ rig-engine.js        manifest 驱动的关节装配引擎（迁移版：extraBottom / setAngles / 绝对路径解析）
│  │  ├─ battle/              score 时间轴、canvas 渲染器、播放控制器、QTE 节点表
│  │  ├─ cv/                  landmarks / gestures / guides / pose-engine / feed / vision / tracker（来自 CV 目录）
│  │  ├─ qte/trace.js         指针轨迹判定（X 交叉 / 前突刺 / 下劈）
│  │  ├─ hub/                 角色库、文件夹导入与格式校验、主角武器固定
│  │  ├─ ai/                  图片预处理+配色、洋红抠图分割、程序化皮影合成、AI 转皮影流程
│  │  └─ paths.js             素材根路径（基于 BASE_URL）
│  ├─ components/art-v2/      ArtPageShell / ArtTopBar / ArtBottomNav / ArtButton / ArtStatus
│  │                          + AiGuide（AI 讲解员）、TransitionVeil（云海启幕转场）
│  │                          + CurtainQte / CurtainHub / CurtainFlash / CurtainAi（身入影幕）
│  ├─ components/             MapIcon / OptionOne / ArtToast
│  └─ pages/                  8 个复刻页面 + CurtainPage（身入影幕）
├─ server/
│  ├─ src/index.js            shim HTTP 入口（7 端点 + /healthz）
│  ├─ src/endpoints.js        取数与 camelCase 映射（契约见 HANDOFF §5/§6）
│  ├─ src/ai-server.js        AI 服务入口（/health /ask /narrate /agent /vision /quiz /piying）
│  ├─ src/ai/                 RAG 检索 + provider 适配 + Agent 工具调用 + 知识快照 + piying（皮影生成）
│  ├─ src/db.js               连接池 + 只读纪律（拒绝非 SELECT）
│  ├─ db/10_legacy_v1.sql     legacy 段派生脚本（已导入 deepseek 库）
│  ├─ static-server.js        生产期同源静态服务器
│  └─ scripts/verify-shim.mjs §9.1 契约验收（19 项）
└─ scripts/                   素材抽取 / 打包 / 验收（verify-web、verify-curtain、verify-curtain-full、
                              verify-curtain-hub、verify-curtain-entry、verify-gestures、verify-piying-import、
                              copy-piying-assets、fetch-cv-vendor）
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
npm run verify        # shim 契约（19 项）+ 浏览器验收（8 路由 × 2 视口）+ AI 离线自检
```

`npm run verify:ai` 无需数据库/外网/密钥：用 fixture 语料与本地 mock LLM 覆盖 RAG 检索、provider 三协议、
Agent 工具执行、规则规划、离线兜底与 `/api/ai/agent` 的 SSE 线格式。

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

按白名单生成 `_deliver/cloud-shadow-web-<时间戳>.zip`（约 45 MB / 170 个文件，含完整 `public/`：皮影素材 + CV 运行时，
收件方解压即全功能；CV 运行时若在本机缺失，打包会告警，先跑 `node scripts/fetch-cv-vendor.mjs` 补齐），打包前做三道校验：

1. 不含 `node_modules` / `dist` / `.artifacts` / `.env*.local`；
2. `.env.example` 中所有名含 `PASSWORD` / `API_KEY` / `SECRET` / `TOKEN` 的键形字段必须为空（口令只能进 `.env.local`）；
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
6. **新增「云海启幕」首页转场**：源工程首页是直接跳转，本工程按草案 05 实装了 4.1 秒的云海转场（见「页面转场」）。
7. **AI 助手交互增强**：可拖动 / 可缩放 / 逐字生成 / 推荐词收放 / 地区同步，均为 Web 端新增形态，源工程没有。
8. **地图标点命中区改为圆形**：源工程整块矩形可点，相邻省份（河北与山西的圆点中心仅相距约 44px）矩形重叠，
   会出现「点 A 命中 B」；本工程改为与图标同心的圆形命中区（直径 76rpx），贴合看到的圆点。
9. **光影溯源卡片透明化**：源工程用自带米黄底的卡片 PNG，在深色时间轴上是一块突兀的色块；
   本工程去掉背景图，改为透明 + 金色细描边（展开态再加淡金色底）。
10. **工艺页同排卡片等高**：源工程卡片各自贴合内容高度，同行右卡比左卡矮一截；
    本工程宽屏下用 `align-items: stretch` 拉齐。

## 已知限制

- **Linux 大小写敏感**：素材里同一组存在 `(1)~(4).PNG` 与 `(5).png` 混用，Windows 不报错，
  部署到 Linux 会 404。上线前需统一扩展名（HANDOFF §5.0）。
- **仅内部预览**：全部素材权利状态为 `internal`，本项目处于 `internal_preview` 里程碑，
  **复刻产物不得对外发布**（HANDOFF §12）。
- **数据规模小**：`plays` / `inheritors` / `exhibitions` 为空表，相关页面不依赖它们。
- **`information_schema.tables.table_rows` 不可信**：InnoDB 估算值严重偏差，
  判断表是否为空一律用 `SELECT COUNT(*)`（HANDOFF §3.5）。
