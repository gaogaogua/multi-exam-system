@echo off
chcp 65001 >nul
title 备考系统-手机访问

cd /d "%~dp0"
echo 启动服务中...
node server.js
pause
