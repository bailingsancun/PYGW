@echo off
chcp 65001 >nul
title Cloud-Shadow Local Demo
cd /d "%~dp0"

rem All Chinese messages are printed by node (UTF-8). cmd.exe mis-parses Chinese echo lines.
node scripts\bat-msg.mjs config
node scripts\setup-local.mjs
if errorlevel 1 (
  node scripts\bat-msg.mjs config-fail
  pause
  exit /b 1
)

node scripts\bat-msg.mjs shim
start "Cloud-Shadow Shim" cmd /k node server\src\index.js

node scripts\bat-msg.mjs ai
start "Cloud-Shadow AI" cmd /k node server\src\ai-server.js

rem ping wait: timeout fails when input is redirected
ping -n 4 127.0.0.1 >nul 2>&1

node scripts\bat-msg.mjs web
start "Cloud-Shadow Web" cmd /k npm run dev

ping -n 6 127.0.0.1 >nul 2>&1

start "" "http://127.0.0.1:5173/"

echo.
node scripts\bat-msg.mjs opened
echo.
node scripts\bat-msg.mjs tips
echo.
pause