@echo off
chcp 65001 >nul
echo 正在停止 Cloud-Shadow 本地演示服务...
taskkill /FI "WINDOWTITLE eq Cloud-Shadow Shim*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cloud-Shadow Web*" /T /F >nul 2>&1
echo 完成。
timeout /t 2 /nobreak >nul
