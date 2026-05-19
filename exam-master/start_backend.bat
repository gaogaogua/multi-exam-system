@echo off
chcp 65001 >nul
title MinerU PDF解析服务

echo ========================================
echo   MinerU PDF 题目解析服务
echo ========================================
echo.

cd /d "%~dp0backend"

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查并安装依赖
echo [*] 检查依赖...
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [*] 正在安装依赖（首次可能需要几分钟）...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo.
echo [*] 启动服务...
python start.py --port 8765

pause
