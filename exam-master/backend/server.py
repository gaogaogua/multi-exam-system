"""
MinerU PDF解析后端服务 - FastAPI
启动: python start.py 或 uvicorn server:app --port 8765
"""

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

from pdf_engine import PdfEngine

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-chat"

app = FastAPI(
    title="MinerU PDF Parser API",
    description="高精度PDF题目解析服务 - 支持 MinerU / PyMuPDF / pdfplumber 多引擎",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Parse-Engine", "X-Parse-Time"],
)

import time


@app.get("/api/health")
async def health():
    """健康检查 + 可用引擎探测"""
    engines = {}

    try:
        import magic_pdf
        engines["mineru"] = {"available": True, "version": getattr(magic_pdf, "__version__", "unknown")}
    except ImportError:
        engines["mineru"] = {"available": False, "hint": "pip install magic-pdf"}

    try:
        import fitz
        engines["pymupdf"] = {"available": True, "version": fitz.version}
    except ImportError:
        engines["pymupdf"] = {"available": False, "hint": "pip install pymupdf"}

    try:
        import pdfplumber
        engines["pdfplumber"] = {"available": True, "version": pdfplumber.__version__}
    except ImportError:
        engines["pdfplumber"] = {"available": False, "hint": "pip install pdfplumber"}

    return {
        "status": "ok",
        "service": "MinerU PDF Parser API",
        "engines": engines,
    }


@app.post("/api/parse")
async def parse_pdf(
    file: UploadFile = File(...),
    strategy: str = Query("auto", regex="^(auto|mineru|pymupdf|pdfplumber)$"),
    max_questions: int = Query(200, ge=1, le=1000),
):
    """
    上传PDF文件，返回解析后的题目列表

    - **file**: PDF文件
    - **strategy**: 解析策略 (auto=自动选择最优, mineru, pymupdf, pdfplumber)
    - **max_questions**: 最大返回题目数
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, detail="仅支持PDF文件")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, detail="文件为空")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, detail="文件超过50MB限制")

    suffix = Path(file.filename).suffix
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(content)
        tmp.close()

        t0 = time.time()
        questions = PdfEngine.parse(tmp.name, strategy=strategy)
        elapsed = time.time() - t0

        engine_used = strategy
        if strategy == "auto":
            # 探测实际使用的引擎
            try:
                import magic_pdf
                engine_used = "mineru"
            except ImportError:
                try:
                    import fitz
                    engine_used = "pymupdf"
                except ImportError:
                    try:
                        import pdfplumber
                        engine_used = "pdfplumber"
                    except ImportError:
                        engine_used = "fallback"

        questions = questions[:max_questions]

        return JSONResponse(
            content={
                "success": True,
                "filename": file.filename,
                "total": len(questions),
                "engine": engine_used,
                "elapsed_ms": round(elapsed * 1000),
                "questions": questions,
            },
            headers={
                "X-Parse-Engine": engine_used,
                "X-Parse-Time": str(round(elapsed * 1000)),
            },
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=f"解析失败: {str(e)}")
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


@app.post("/api/parse/batch")
async def parse_pdf_batch(
    files: list[UploadFile] = File(...),
    strategy: str = Query("auto"),
):
    """批量上传PDF（最多20个），返回合并题目列表"""
    if len(files) > 20:
        raise HTTPException(400, detail="单次最多上传20个文件")

    all_questions = []
    results = []

    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            results.append({"filename": file.filename, "success": False, "error": "非PDF文件", "total": 0})
            continue

        content = await file.read()
        if len(content) == 0:
            results.append({"filename": file.filename, "success": False, "error": "文件为空", "total": 0})
            continue

        suffix = Path(file.filename).suffix
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(content)
        tmp.close()

        try:
            questions = PdfEngine.parse(tmp.name, strategy=strategy)
            all_questions.extend(questions)
            results.append({"filename": file.filename, "success": True, "total": len(questions)})
        except Exception as e:
            results.append({"filename": file.filename, "success": False, "error": str(e), "total": 0})
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    return {
        "success": True,
        "total_files": len(files),
        "total_questions": len(all_questions),
        "results": results,
        "questions": all_questions,
    }


# ─── AI 分析模型 ───────────────────────────────────────────
class QuestionForAI(BaseModel):
    id: Optional[str] = None
    title: str
    type: str  # single | multiple | judge | fill | essay
    options: list[dict] = []  # [{label, text}, ...]

class AIAnalyzeRequest(BaseModel):
    questions: list[QuestionForAI]
    api_key: Optional[str] = None  # 可选，前端传入的API Key

# ─── AI 分析端点 ───────────────────────────────────────────

def build_ai_prompt(q: dict) -> str:
    """根据题型构建不同的 prompt"""
    type_names = {
        "single": "单选题",
        "multiple": "多选题",
        "judge": "判断题",
        "fill": "填空题",
        "essay": "问答题",
    }
    type_name = type_names.get(q.get("type", "single"), "单选题")

    options_text = ""
    if q.get("options") and len(q["options"]) > 0:
        opts = "\n".join([f"{o['label']}. {o['text']}" for o in q["options"]])
        options_text = f"\n选项：\n{opts}"

    answer_hints = {
        "single": "返回单个选项字母，如 A",
        "multiple": "返回多个选项字母，如 ABD（按字母顺序排列）",
        "judge": "返回 A（正确/对）或 B（错误/错）",
        "fill": "返回填空答案文本",
        "essay": "返回参考答案要点",
    }

    return f"""你是一个专业的考试题目解析助手。请分析以下题目并提供正确答案和详细解析。

题目类型：{type_name}
题目内容：{q['title']}{options_text}

请以JSON格式返回（只返回JSON，不要包含其他内容）：
{{"answer": "正确答案", "analysis": "详细解析"}}

要求：
1. 答案格式：{answer_hints.get(q.get("type", "single"), "返回选项字母")}
2. 解析要详细、准确，解释选择该答案的原因，对选择题需逐一分析每个选项
3. 对于判断题，A表示正确/对，B表示错误/错"""


async def call_deepseek_api(questions: list[dict], api_key: str) -> list[dict]:
    """调用 DeepSeek API 批量分析题目"""
    if not api_key:
        raise HTTPException(400, detail="未提供DeepSeek API Key，请在设置中配置或设置环境变量DEEPSEEK_API_KEY")

    results = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for q in questions:
            prompt = build_ai_prompt(q)
            try:
                resp = await client.post(
                    f"{DEEPSEEK_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": DEEPSEEK_MODEL,
                        "messages": [
                            {"role": "system", "content": "你是一个专业的考试题目解析助手，只返回JSON格式的结果。"},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()

                # 提取 JSON（处理可能的 markdown 代码块包裹）
                if content.startswith("```"):
                    lines = content.split("\n")
                    content = "\n".join(lines[1:]) if lines[0].startswith("```") else content
                    if content.endswith("```"):
                        content = content[:-3].strip()
                # 尝试找到 JSON 对象
                if "{" in content:
                    start = content.index("{")
                    end = content.rindex("}") + 1
                    content = content[start:end]

                parsed = json.loads(content)
                results.append({
                    "id": q.get("id"),
                    "answer": parsed.get("answer", ""),
                    "analysis": parsed.get("analysis", ""),
                    "success": True,
                })
            except Exception as e:
                results.append({
                    "id": q.get("id"),
                    "answer": "",
                    "analysis": "",
                    "success": False,
                    "error": str(e),
                })

    return results


@app.post("/api/ai/analyze")
async def ai_analyze(req: AIAnalyzeRequest):
    """AI分析题目，生成答案和解析"""
    if not req.questions:
        raise HTTPException(400, detail="题目列表为空")

    api_key = req.api_key or DEEPSEEK_API_KEY
    results = await call_deepseek_api(
        [q.model_dump() for q in req.questions], api_key
    )
    return {"success": True, "results": results}


@app.post("/api/ai/analyze/batch")
async def ai_analyze_batch(req: AIAnalyzeRequest):
    """批量AI分析题目（最多50道）"""
    if not req.questions:
        raise HTTPException(400, detail="题目列表为空")
    if len(req.questions) > 50:
        raise HTTPException(400, detail="单次最多分析50道题目")

    api_key = req.api_key or DEEPSEEK_API_KEY
    results = await call_deepseek_api(
        [q.model_dump() for q in req.questions], api_key
    )
    return {
        "success": True,
        "total": len(results),
        "success_count": sum(1 for r in results if r["success"]),
        "results": results,
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print(f"""
╔══════════════════════════════════════════╗
║   MinerU PDF 题目解析服务 v2.0           ║
║   地址: http://localhost:{port}            ║
║   文档: http://localhost:{port}/docs       ║
║   健康检查: http://localhost:{port}/api/health ║
╚══════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
