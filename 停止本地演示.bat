@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts\bat-msg.mjs stop
taskkill /FI "WINDOWTITLE eq Cloud-Shadow Shim*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cloud-Shadow AI*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cloud-Shadow Web*" /T /F >nul 2>&1
node scripts\bat-msg.mjs stopped
timeout /t 2 /nobreak >nul