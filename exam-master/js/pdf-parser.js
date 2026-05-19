/**
 * PDF解析模块 - 后端MinerU优先，前端PDF.js降级
 *
 * 解析链路:
 *   1. MinerU API (magic-pdf) — 最高精度，版面+公式+表格
 *   2. PyMuPDF API (fitz)     — 轻量快速，坐标排序
 *   3. pdfplumber API         — 对表格友好
 *   4. PDF.js (浏览器本地)    — 纯前端零依赖降级
 */

const PdfParser = {
  PATTERNS: {
    QUESTION_START: /^(?:第?\s*(\d+)\s*[题、．.)]\s*|(\d+)\s*[、．.)]\s*|\(\s*(\d+)\s*\)\s*)/,
    OPTION_LETTER: /^([A-H])\s*[、．.)]\s*/,
    ANSWER_KEY: /(?:答案|正确答案|参考答案)[：:]\s*([A-H]+|[√×对错正确错误是是否否]+|[一-龥]+)/i,
    ANALYSIS_KEY: /(?:解析|分析|解答|说明)[：:]\s*/i,
    DIFFICULTY_KEY: /(?:难度|等级)[：:]\s*(简单|中等|困难|易|中|难)/i,
    CATEGORY_KEY: /(?:分类|知识点|章节|模块)[：:]\s*([一-龥\w]+)/i,
  },

  /**
   * 解析单个PDF — 自动选择后端/前端引擎
   */
  async parsePdf(file) {
    // 尝试后端API（MinerU > PyMuPDF > pdfplumber）
    try {
      const available = await ApiConfig.checkAvailability();
      if (available) {
        console.log('[PdfParser] 使用后端API解析:', file.name);
        const result = await ApiConfig.parsePdf(file);
        if (result.success && result.questions.length > 0) {
          console.log(`[PdfParser] 后端引擎 ${result.engine} 解析出 ${result.total} 道题 (${result.elapsed}ms)`);

          // 后端返回的题目补充ID和时间戳
          return result.questions.map(q => ({
            ...q,
            id: q.id || this.generateId(),
            source: 'pdf_import',
            createdAt: q.createdAt || new Date().toISOString(),
            _engine: result.engine,
          }));
        }
        console.log('[PdfParser] 后端解析结果为空，降级到前端PDF.js');
      }
    } catch (e) {
      console.warn('[PdfParser] 后端API调用失败，降级到前端PDF.js:', e.message);
    }

    // 降级：浏览器端 PDF.js
    return this._parseWithPdfJs(file);
  },

  /**
   * 批量解析 — 优先用后端批量接口
   */
  async parsePdfBatch(files) {
    try {
      const available = await ApiConfig.checkAvailability();
      if (available) {
        const result = await ApiConfig.parsePdfBatch(files);
        if (result.success && result.questions.length > 0) {
          return result.questions.map(q => ({
            ...q,
            id: q.id || this.generateId(),
            source: 'pdf_import',
            createdAt: q.createdAt || new Date().toISOString(),
          }));
        }
      }
    } catch (e) {
      console.warn('[PdfParser] 后端批量解析失败，逐个降级处理');
    }

    // 降级：逐个用前端解析
    const allQuestions = [];
    for (const file of files) {
      const questions = await this.parsePdf(file);
      allQuestions.push(...questions);
    }
    return allQuestions;
  },

  /**
   * PDF.js 浏览器端解析（降级方案）
   */
  async _parseWithPdfJs(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js 未加载，且后端API不可用');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // PDF.js items 没有直接的坐标信息用于排序
      // 使用 items 原始顺序（通常是阅读顺序）
      const pageText = content.items
        .map(item => {
          // 利用 transform 矩阵的 ty (y平移) 尝试近似分行
          const y = Math.round(item.transform[5] * 10) / 10;
          return { y, str: item.str };
        })
        .reduce((acc, item) => {
          // 按 y 坐标分组（容差5个单位）
          const key = Math.round(item.y / 5) * 5;
          if (!acc[key]) acc[key] = [];
          acc[key].push(item.str);
          return acc;
        }, {});

      // 按 y 坐标从大到小（从上到下）排序
      const sortedKeys = Object.keys(pageText)
        .map(Number)
        .sort((a, b) => b - a);

      for (const key of sortedKeys) {
        fullText += pageText[key].join(' ') + '\n';
      }
    }

    return this.extractQuestions(fullText);
  },

  /**
   * 从纯文本中提取题目
   */
  extractQuestions(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const questions = [];
    let current = null;
    let currentOptions = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qMatch = line.match(this.PATTERNS.QUESTION_START);

      if (qMatch) {
        if (current && current.title) {
          current.options = currentOptions;
          questions.push(this.finalizeQuestion(current));
        }
        current = {
          number: parseInt(qMatch[1] || qMatch[2] || qMatch[3]),
          title: line.replace(this.PATTERNS.QUESTION_START, '').trim(),
          type: 'single',
          options: [],
          answer: '',
          analysis: '',
          difficulty: '中等',
          category: '未分类',
        };
        currentOptions = [];
        continue;
      }

      if (!current) continue;

      const optMatch = line.match(this.PATTERNS.OPTION_LETTER);
      if (optMatch && line.length < 200) {
        currentOptions.push({
          label: optMatch[1],
          text: line.replace(this.PATTERNS.OPTION_LETTER, '').trim(),
        });
        continue;
      }

      const ansMatch = line.match(this.PATTERNS.ANSWER_KEY);
      if (ansMatch) {
        current.answer = ansMatch[1].trim().toUpperCase();
        if (current.answer.includes('对') || current.answer.includes('正确') || current.answer === '√') {
          current.answer = 'A';
          current.type = 'judge';
          if (currentOptions.length === 0) {
            currentOptions = [
              { label: 'A', text: '正确' },
              { label: 'B', text: '错误' },
            ];
          }
        } else if (current.answer.includes('错') || current.answer.includes('错误') || current.answer === '×') {
          current.answer = 'B';
          current.type = 'judge';
          if (currentOptions.length === 0) {
            currentOptions = [
              { label: 'A', text: '正确' },
              { label: 'B', text: '错误' },
            ];
          }
        }
        continue;
      }

      if (line.match(this.PATTERNS.ANALYSIS_KEY)) {
        current.analysis = line.replace(this.PATTERNS.ANALYSIS_KEY, '').trim();
        let j = i + 1;
        while (j < lines.length &&
          !lines[j].match(this.PATTERNS.QUESTION_START) &&
          !lines[j].match(this.PATTERNS.OPTION_LETTER) &&
          !lines[j].match(this.PATTERNS.ANSWER_KEY)) {
          current.analysis += ' ' + lines[j];
          j++;
        }
        i = j - 1;
        continue;
      }

      const diffMatch = line.match(this.PATTERNS.DIFFICULTY_KEY);
      if (diffMatch) {
        current.difficulty = diffMatch[1];
        continue;
      }

      const catMatch = line.match(this.PATTERNS.CATEGORY_KEY);
      if (catMatch) {
        current.category = catMatch[1];
        continue;
      }

      if (currentOptions.length === 0 && !current.answer) {
        current.title += ' ' + line;
      }
    }

    if (current && current.title) {
      current.options = currentOptions;
      questions.push(this.finalizeQuestion(current));
    }

    return questions;
  },

  finalizeQuestion(q) {
    if (q.type !== 'judge') {
      if (q.options.length === 0) {
        q.type = 'essay';
      } else if (q.answer.length > 1 && q.answer.split('').every(c => /[A-H]/.test(c))) {
        q.type = 'multiple';
      } else if (q.options.length === 2 &&
        (q.options[0].text.includes('正确') || q.options[0].text.includes('对') ||
         q.options[1].text.includes('错误') || q.options[1].text.includes('错'))) {
        q.type = 'judge';
      } else {
        q.type = 'single';
      }
    }

    q.id = this.generateId();
    q.source = 'pdf_import';
    q.createdAt = new Date().toISOString();
    return q;
  },

  generateId() {
    return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  },
};
