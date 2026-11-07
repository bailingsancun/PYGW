@echo off
chcp 65001 >nul
title Cloud-Shadow 本地演示
cd /d "%~dp0"

if not exist ".env.local" (
  echo [错误] 缺少 .env.local
  echo 请把 .env.example 复制为 .env.local，并填写 DB_PASSWORD。
  pause
  exit /b 1
)

echo 正在启动只读 shim（http://127.0.0.1:8787）...
start "Cloud-Shadow Shim" cmd /k node server\src\index.js

rem 用 ping 等待：timeout 在输入被重定向时会直接失败，ping 兼容性更好
ping -n 4 127.0.0.1 >nul 2>&1

echo 正在启动前端开发服务器（http://127.0.0.1:5173）...
start "Cloud-Shadow Web" cmd /k npm run dev

ping -n 6 127.0.0.1 >nul 2>&1

start "" "http://127.0.0.1:5173/"

echo.
echo 已启动：浏览器应已打开 http://127.0.0.1:5173/
echo.
echo 若页面打不开，先看两个新窗口里的报错：
echo    - 端口被占用：先运行「停止本地演示.bat」，或关掉旧的服务窗口
echo    - 连不上数据库：检查 .env.local 里的 DB_ 配置
echo.
echo 关闭那两个命令行窗口即停止服务。
pause
