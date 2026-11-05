@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".env.local" (
  echo [错误] 缺少 .env.local
  echo 请把 .env.example 复制为 .env.local，并填写 DB_PASSWORD。
  pause
  exit /b 1
)

echo 正在启动只读 shim（http://127.0.0.1:8787）...
start "Cloud-Shadow Shim" cmd /k "node server\src\index.js"

timeout /t 2 /nobreak >nul

echo 正在启动前端开发服务器（http://127.0.0.1:5173）...
start "Cloud-Shadow Web" cmd /k "npm run dev"

timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173/"

echo.
echo 已启动：关闭两个命令行窗口即可停止服务。
