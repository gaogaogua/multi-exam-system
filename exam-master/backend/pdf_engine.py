"""
PDF解析引擎 - 多策略提取题目
策略优先级: MinerU > PyMuPDF > pdfplumber > 纯文本
"""

import re
import json
import os
import hashlib
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict


@dataclass
class Question:
    title: str
    type: str = "single"
    options: list = field(default_factory=list)
    answer: str = ""
    analysis: str = ""
    difficulty: str = "中等"
    category: str = "未分类"

    def to_dict(self):
        d = asdict(self)
        d["id"] = "q_" + hashlib.md5(self.title.encode()).hexdigest()[:12]
        d["source"] = "pdf_import"
        return d


# ─── 题目识别正则（与前端 pdf-parser.js 保持一致） ───

RE_QUESTION = re.compile(
    r'^(?:第?\s*(\d+)\s*[题、．.)]\s*|(\d+)\s*[、．.)]\s*|\(\s*(\d+)\s*\)\s*)'
)
RE_OPTION = re.compile(r'^([A-H])\s*[、．.)]\s*')
RE_ANSWER = re.compile(r'(?:答案|正确答案|参考答案)[：:]\s*(.+?)(?:\s|$)', re.IGNORECASE)
RE_ANALYSIS = re.compile(r'(?:解析|分析|解答|说明)[：:]\s*(.+)', re.IGNORECASE)
RE_DIFFICULTY = re.compile(r'(?:难度|等级)[：:]\s*(简单|中等|困难|易|中|难)', re.IGNORECASE)
RE_CATEGORY = re.compile(r'(?:分类|知识点|章节|模块)[：:]\s*(.+)', re.IGNORECASE)


class PdfEngine:
    """多策略PDF解析引擎"""

    # ─── 策略选择 ───

    @staticmethod
    def parse(file_path: str, strategy: str = "auto") -> list[dict]:
        """
        解析PDF文件，返回题目列表
        strategy: "mineru" | "pymupdf" | "pdfplumber" | "auto"
        """
        ext = Path(file_path).suffix.lower()[:4]  # ".pdf"

        if strategy == "auto":
            questions = PdfEngine._try_mineru(file_path)
            if questions:
                return questions
            questions = PdfEngine._try_pymupdf(file_path)
            if questions:
                return questions
            questions = PdfEngine._try_pdfplumber(file_path)
            if questions:
                return questions
            return PdfEngine._fallback_text(file_path)

        if strategy == "mineru":
            return PdfEngine._try_mineru(file_path) or []
        if strategy == "pymupdf":
            return PdfEngine._try_pymupdf(file_path) or []
        if strategy == "pdfplumber":
            return PdfEngine._try_pdfplumber(file_path) or []
        return PdfEngine._fallback_text(file_path)

    # ─── MinerU 策略（质量最高） ───

    @staticmethod
    def _try_mineru(file_path: str) -> Optional[list[dict]]:
        """使用 MinerU (magic-pdf) 解析"""
        try:
            from magic_pdf.data.data_reader_writer import DataBlock, DataWriter
            from magic_pdf.data.dataset import Dataset
            from magic_pdf.model.doc_analyze_by_custom_model import doc_analyze
            from magic_pdf.config.enums import SupportedPdfParseMethod

            # 读取PDF
            with open(file_path, "rb") as f:
                pdf_bytes = f.read()

            # 创建数据集
            ds = Dataset(pdf_bytes)

            # 分析文档
            model_list = doc_analyze(ds)

            # 使用 auto 模式解析
            method = SupportedPdfParseMethod.AUTO
            infer_result = ds.apply(method, model_list=model_list)

            # 拼接 Markdown
            full_md = []
            for page_num, page_data in enumerate(infer_result):
                if page_data and page_data.get("markdown"):
                    full_md.append(page_data["markdown"])
                if page_data and page_data.get("text"):
                    full_md.append(page_data["text"])

            text = "\n\n".join(full_md)
            if text.strip():
                return PdfEngine._extract_from_markdown(text)
        except ImportError:
            pass
        except Exception as e:
            print(f"[MinerU] 解析失败: {e}")
        return None

    @staticmethod
    def _try_mineru_cli(file_path: str) -> Optional[list[dict]]:
        """通过 MinerU CLI 解析（备用方式）"""
        import subprocess

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                result = subprocess.run(
                    ["magic-pdf", "parse", file_path, "-o", tmpdir, "-m", "auto"],
                    capture_output=True, text=True, timeout=300,
                )
                if result.returncode != 0:
                    return None

                # 找到输出的 markdown 文件
                md_files = list(Path(tmpdir).rglob("*.md"))
                if not md_files:
                    return None

                full_text = ""
                for md_file in sorted(md_files):
                    full_text += md_file.read_text(encoding="utf-8") + "\n"

                return PdfEngine._extract_from_markdown(full_text)
            except (FileNotFoundError, subprocess.TimeoutExpired):
                return None

    # ─── PyMuPDF 策略（品质好，轻量） ───

    @staticmethod
    def _try_pymupdf(file_path: str) -> Optional[list[dict]]:
        """使用 PyMuPDF (fitz) 解析，保留字符坐标便于版面分析"""
        try:
            import fitz

            doc = fitz.open(file_path)
            pages_text = []

            for page in doc:
                # 方法1: 按阅读顺序提取文本
                text = page.get_text("text", sort=True)
                if not text.strip():
                    # 方法2: 用 dict 提取并按 y,x 坐标排序
                    blocks = page.get_text("dict")["blocks"]
                    lines = []
                    for block in blocks:
                        if "lines" not in block:
                            continue
                        for line in block["lines"]:
                            line_text = " ".join(
                                span["text"] for span in line["spans"]
                            )
                            if line_text.strip():
                                y = line["bbox"][1]
                                x = line["bbox"][0]
                                lines.append((y, x, line_text.strip()))
                    lines.sort(key=lambda t: (round(t[0] / 15) * 15, t[1]))
                    text = "\n".join(l[2] for l in lines)

                pages_text.append(text)

            doc.close()
            full_text = "\n".join(pages_text)
            return PdfEngine._extract_lines(full_text)
        except ImportError:
            return None
        except Exception as e:
            print(f"[PyMuPDF] 解析失败: {e}")
            return None

    # ─── pdfplumber 策略 ───

    @staticmethod
    def _try_pdfplumber(file_path: str) -> Optional[list[dict]]:
        """使用 pdfplumber 解析（表格友好）"""
        try:
            import pdfplumber

            pages_text = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        # 表格特殊处理
                        tables = page.extract_tables()
                        for table in tables:
                            for row in table:
                                text += "\n" + " | ".join(
                                    str(cell) for cell in row if cell
                                )
                    pages_text.append(text or "")

            full_text = "\n".join(pages_text)
            return PdfEngine._extract_lines(full_text)
        except ImportError:
            return None
        except Exception as e:
            print(f"[pdfplumber] 解析失败: {e}")
            return None

    # ─── 纯文本 fallback ───

    @staticmethod
    def _fallback_text(file_path: str) -> list[dict]:
        """纯二进制读取（最后手段）"""
        import string

        with open(file_path, "rb") as f:
            data = f.read()
        text = data.decode("utf-8", errors="ignore")
        # 过滤掉不可打印字符（保留中英文+常用符号）
        printable = set(string.printable) | set(
            "，。、；：""''！？（）《》【】—…·￥"
            "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
            "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
            "０１２３４５６７８９"
        )
        text = "".join(c for c in text if c in printable)
        return PdfEngine._extract_lines(text)

    # ─── 核心提取逻辑 ───

    @staticmethod
    def _extract_from_markdown(md_text: str) -> list[dict]:
        """从 Markdown 中提取题目（MinerU 输出格式）"""
        # 将 Markdown 转为纯文本行进行处理
        # 去掉 Markdown 标记但保留结构
        lines = []
        for line in md_text.split("\n"):
            line = line.strip()
            if not line:
                continue
            # 去掉 Markdown 格式标记
            line = re.sub(r'\*\*(.+?)\*\*', r'\1', line)
            line = re.sub(r'\*(.+?)\*', r'\1', line)
            line = re.sub(r'`(.+?)`', r'\1', line)
            line = re.sub(r'^#{1,6}\s*', '', line)
            line = re.sub(r'^\s*[-*+]\s+', '• ', line)
            line = line.strip()
            if line:
                lines.append(line)

        return PdfEngine._extract_lines(lines)

    @staticmethod
    def _extract_lines(raw_text: str | list[str]) -> list[dict]:
        """从文本行列表中提取题目"""
        if isinstance(raw_text, str):
            lines = [
                l.strip()
                for l in raw_text.split("\n")
                if l.strip()
            ]
        else:
            lines = raw_text

        questions: list[Question] = []
        current: Optional[Question] = None
        in_options = False
        in_analysis = False

        def _save():
            nonlocal current, in_options, in_analysis
            if current and current.title.strip():
                PdfEngine._infer_type(current)
                questions.append(current.to_dict())
            current = None
            in_options = False
            in_analysis = False

        for line in lines:
            # ── 题号检测 ──
            qm = RE_QUESTION.match(line)
            if qm:
                _save()
                title = RE_QUESTION.sub("", line).strip()
                # 去掉可能的选项前缀
                title = re.sub(r'^[A-H][、．.)]\s*', '', title)
                current = Question(title=title)
                in_options = False
                in_analysis = False
                continue

            if current is None:
                continue

            # ── 答案行 ──
            am = RE_ANSWER.search(line)
            if am:
                ans = am.group(1).strip().upper()
                ans = re.sub(r'[^A-H√×对错正确错误是是否否0-9一-龥\w]', '', ans)
                if ans in ("对", "正确", "√"):
                    current.answer = "A"
                    current.type = "judge"
                elif ans in ("错", "错误", "×"):
                    current.answer = "B"
                    current.type = "judge"
                else:
                    current.answer = ans
                continue

            # ── 解析行 ──
            am2 = RE_ANALYSIS.match(line)
            if am2:
                current.analysis = am2.group(1).strip()
                in_analysis = True
                continue

            # ── 难度行 ──
            dm = RE_DIFFICULTY.search(line)
            if dm:
                d = dm.group(1)
                current.difficulty = {"易": "简单", "中": "中等", "难": "困难"}.get(d, d)
                continue

            # ── 分类行 ──
            cm = RE_CATEGORY.search(line)
            if cm:
                current.category = cm.group(1).strip()
                continue

            # ── 选项行 ──
            om = RE_OPTION.match(line)
            if om and len(line) < 300:
                in_options = True
                current.options.append({
                    "label": om.group(1),
                    "text": RE_OPTION.sub("", line).strip(),
                })
                continue

            # ── 未识别行 ──
            if in_analysis:
                current.analysis += " " + line
            elif in_options and len(line) < 100:
                # 可能是选项续行
                last_opt = current.options[-1] if current.options else None
                if last_opt:
                    last_opt["text"] += " " + line
            else:
                current.title += " " + line

        _save()  # 保存最后一题
        return questions

    @staticmethod
    def _infer_type(q: Question):
        """智能判断题型"""
        if q.type == "judge":
            return
        if len(q.options) == 0:
            q.type = "essay"
        elif len(q.answer) > 1 and all(c in "ABCDEFGH" for c in q.answer):
            q.type = "multiple"
        elif len(q.options) == 2 and (
            "正确" in q.options[0]["text"] or "对" in q.options[0]["text"] or
            "错误" in q.options[1]["text"] or "错" in q.options[1]["text"]
        ):
            q.type = "judge"
        else:
            q.type = "single"
