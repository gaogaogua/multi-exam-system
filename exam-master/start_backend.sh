#!/bin/bash
# MinerU PDF 题目解析服务 - Linux/Mac 一键启动

set -e

echo "========================================"
echo "  MinerU PDF 题目解析服务"
echo "========================================"
echo ""

cd "$(dirname "$0")/backend"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.9+"
    exit 1
fi

echo "[✓] $(python3 --version)"

# 检查依赖
python3 -c "import fastapi" 2>/dev/null || {
    echo "[*] 安装依赖..."
    pip3 install -r requirements.txt
}

echo ""
echo "[*] 启动服务..."
python3 start.py --port 8765 "$@"
