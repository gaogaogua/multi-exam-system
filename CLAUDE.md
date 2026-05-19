# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

多考试同步备考自动化系统 — a vanilla JS SPA for simultaneous preparation of Chinese civil/professional exams (公基, 一建实务, 国考, 土木专业). No framework, no build step, no server DB — all data in browser localStorage. Questions sourced from PDF exam papers (MinerU OCR), auto-categorized by keyword matching, AI-powered answer generation via DeepSeek API.

## Commands

```bash
# Frontend — open in browser (no build step)
open exam-master/index.html

# Mobile/server access
node exam-master/server.js            # Start HTTP server on :8080
node exam-master/server.js & ngrok http 8080  # Public URL via ngrok

# Tools (Node.js — all in tools/)
node tools/parse_gongji_errors.js     # 公基 OCR markdown → JSON
node tools/parse_tumu.js              # 土木 MinerU JSON → JSON (point to 考试资料/原始文件/土木原数据/)
node tools/batch_ai_analyze.js        # AI answers for 公基 (reads 中间产物 → writes 最终题库)
node tools/batch_ai_tumu.js           # AI answers for 土木
node tools/categorize_all.js          # Classify both banks by keyword
node tools/fix_options_expert.js      # Extract/replace question options from source + expert knowledge
node tools/ai_gen_options.js          # AI-generate missing option text
node tools/classify_tumu_chapters.js  # Re-classify 土木 by exam chapter (1-13)
```

## Architecture

**Page flow**: 7 SPA pages (dashboard → bank → errors → practice → exam → analysis → plan), navigated by `App.navigateTo()`. Each page is a dedicated JS module loaded in order from `index.html`.

**Critical module order**: `storage.js` → `api-config.js` → `auto-categorizer.js` → `import-manager.js` → `pdf-parser.js` → `dedup.js` → `question-bank.js` → `error-notebook.js` → `practice.js` → `exam.js` → `analysis.js` → `plan.js` → `app.js`

**Data layer**: All localStorage. `Storage.KEYS` defines the keys: `exam_questions`, `exam_error_book`, `exam_practice_log`, `exam_exam_log`, `exam_categories`. Plan module adds `exam_plans` and `today_progress`.

**Question object**: `{id, title, type(single|multiple|judge|essay|fill), options[{label,text}], answer, analysis, category, difficulty, bank(gongji|tumu), source, createdAt}`

**Bank separation**: Questions tagged with `bank: 'gongji'` or `bank: 'tumu'`. Practice/exam support per-bank filtering. Import tool auto-tags by filename (含"公基"→gongji, 含"土木"→tumu).

**Classification**: 公基 uses keyword matching against 10 knowledge domains (马哲, 党史, 中特, 法律, 经济, 公文, 管理, 文史, 时政). 土木 uses 11 exam chapters (建筑设计技术, 建筑材料, 施工技术, 法规标准, 项目管理等).

## Key behaviors to preserve

- **Import duplicates UPDATE existing** (import-json.html:228-247): When re-importing JSON, duplicates are found by title fingerprint. Instead of skipping, the importer updates the existing question's `bank`, `category`, `options`, `answer`, `analysis` fields. This is intentional — users re-import to get updated classifications and options.
- **Import auto-tags bank** by filename: `/公基|gongji/i` → gongji, `/土木|tumu/i` → tumu.
- **Practice skip button** (`practice.js:skipQuestion`) advances without submitting an answer.
- **AI analysis in practice** (`practice.js:_aiAnalyze`) saves to localStorage and refreshes inline — no modal.
- **Multiple-choice rendering**: `q.type === 'multiple'` → checkboxes. `q.type === 'single'` → radio buttons. Without options, falls back to textarea (confusing for users — ensure options exist).

## Critical bugs fixed (do not reintroduce)

1. **MinerU answer-zone skip**: `parseWithAnswerSections` must track `skipZone` state machine, not just `continue` on the single "答案及解析" line. Otherwise answer-section numbered lines (1.【答案】D) are parsed as new questions.
2. **Answer regex must match both formats**: `^(?:【答案】[：:]?|答案[：:])` — 口诀500问 uses `【答案】` (bracketed) for most questions, not plain `答案：`.
3. **RS file has two "参考答案" sections**: First (line ~20) is table of contents. Real answers start at the second occurrence (~line 2407). Skip the first.
4. **`_sourceFile` field lost on JSON round-trip**: `JSON.stringify` drops `undefined` values. Always verify `_sourceFile` is a string before serializing.
5. **`getElementById` null refs**: Any call to `document.getElementById(...).property` without null check crashes the page. Always guard with `if (el)`.

## Question bank files

```
考试资料/最终题库/
├── 公基错题合集_complete.json   (1,164 questions, 100% answered, 8 knowledge categories)
└── 土木_questions_complete.json (1,998 questions, 100% answered, 11 chapter categories)
```

Both files can be imported via `import-json.html`. Source PDFs and MinerU JSONs are in `考试资料/原始文件/`.
