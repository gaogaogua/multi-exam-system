#!/usr/bin/env python3
"""
MinerU PDF解析服务 - 一键启动脚本

用法:
    python start.py                    # 默认端口 8765
    python start.py --port 9000        # 指定端口
    python start.py --engine pymupdf   # 仅使用 PyMuPDF（轻量模式）
    python start.py --setup            # 安装依赖
"""

import argparse
import subprocess
import sys
import os


def check_python():
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 9):
        print("[错误] 需要 Python 3.9 以上版本，当前:", sys.version)
        sys.exit(1)
    print(f"[✓] Python {v.major}.{v.minor}.{v.micro}")


def install_deps():
    req = os.path.join(os.path.dirname(__file__), "requirements.txt")
    print("[*] 安装依赖...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req])
    print("[✓] 依赖安装完成")


def check_engines():
    engines = {}
    try:
        import magic_pdf
        engines["MinerU (magic-pdf)"] = f"✓ v{getattr(magic_pdf, '__version__', '?')}"
    except ImportError:
        engines["MinerU (magic-pdf)"] = "✗ 未安装 (pip install magic-pdf)"

    try:
        import fitz
        engines["PyMuPDF (fitz)"] = f"✓ v{fitz.version}"
    except ImportError:
        engines["PyMuPDF (fitz)"] = "✗ 未安装 (pip install pymupdf)"

    try:
        import pdfplumber
        engines["pdfplumber"] = f"✓ v{pdfplumber.__version__}"
    except ImportError:
        engines["pdfplumber"] = "✗ 未安装 (pip install pdfplumber)"

    print("\n可用的解析引擎:")
    for name, status in engines.items():
        print(f"  {name}: {status}")
    print()

    return any("✓" in s for s in engines.values())


def main():
    parser = argparse.ArgumentParser(description="MinerU PDF解析服务")
    parser.add_argument("--port", type=int, default=8765, help="服务端口 (默认: 8765)")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址 (默认: 0.0.0.0)")
    parser.add_argument("--setup", action="store_true", help="安装依赖")
    parser.add_argument("--engine", choices=["auto", "mineru", "pymupdf", "pdfplumber"], default="auto",
                        help="默认解析策略 (默认: auto)")
    parser.add_argument("--reload", action="store_true", help="热重载模式（开发用）")
    args = parser.parse_args()

    check_python()

    if args.setup:
        install_deps()

    if not check_engines():
        print("[提示] 没有可用的解析引擎，请运行: python start.py --setup")
        print("        或至少安装一个: pip install pymupdf")
        sys.exit(1)

    os.environ.setdefault("DEFAULT_STRATEGY", args.engine)
    os.environ.setdefault("PORT", str(args.port))

    print(f"""
╔══════════════════════════════════════════════╗
║  MinerU PDF 题目解析服务                     ║
║  地址: http://localhost:{args.port}            ║
║  文档: http://localhost:{args.port}/docs       ║
║  策略: {args.engine.ljust(36)}║
╚══════════════════════════════════════════════╝

按 Ctrl+C 停止服务
""")

    import uvicorn
    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
