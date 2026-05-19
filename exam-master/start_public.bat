@echo off
chcp 65001 >nul
title 备考系统-外网访问

cd /d "%~dp0"

echo ==========================================
echo   多考试备考系统 - 外网访问模式
echo ==========================================
echo.
echo  [1] 启动本地服务器 (端口8080)...
start "ExamServer" cmd /c "node server.js"
timeout /t 2 /nobreak >nul

echo  [2] 启动ngrok隧道...
echo.
echo  ==========================================
echo   复制下面的 https:// 地址到手机浏览器
echo   先打开 /import-json.html 导入题库
echo   再打开 /index.html 开始学习
echo  ==========================================
echo.
ngrok http 8080
