/**
 * 实现功能：bat 的中文提示输出（编码安全）
 * 职责：cmd.exe 解析 UTF-8 .bat 中的中文 echo 会丢字/误执行（报 "xxx is not recognized"）。
 *       故 .bat 只保留 ASCII 控制流，所有中文提示交由本脚本以 UTF-8 打印（配合 chcp 65001）。
 * 用法：node scripts/bat-msg.mjs <key>
 */
const MSG = {
  config: '正在检查/收集本地配置（首次会先问 DB_PASSWORD，再问 AI base_url 等；已有配置自动复用）...',
  'config-fail': '[错误] 配置未完成。',
  shim: '正在启动只读 shim（http://127.0.0.1:8787）...',
  ai: '正在启动 AI 讲解员服务（http://127.0.0.1:8788）...',
  web: '正在启动前端开发服务器（http://127.0.0.1:5173）...',
  opened: '已启动：浏览器应已打开 http://127.0.0.1:5173/',
  stop: '正在停止 Cloud-Shadow 本地演示服务...',
  stopped: '完成。',
  tips: [
    '若页面打不开，先看新窗口里的报错：',
    '   - 端口被占用：先运行「停止本地演示.bat」，或关掉旧的服务窗口',
    '   - 连不上数据库：检查 .env.local 里的 DB_ 配置',
    '   - AI 无回答：检查 .env.local 里的 AI_ 配置（或 npm run setup -- --reconfig 重配）',
    '',
    '关闭那些命令行窗口即停止服务。',
  ],
};

const value = MSG[process.argv[2]];
if (Array.isArray(value)) console.log(value.join('\n'));
else if (value) console.log(value);