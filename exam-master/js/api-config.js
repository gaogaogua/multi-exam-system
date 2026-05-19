/**
 * API配置 - MinerU后端连接设置 + DeepSeek AI分析
 */
const ApiConfig = {
  // 后端服务地址（修改为实际部署地址）
  BASE_URL: 'http://localhost:8765',

  // 解析策略: "auto" | "mineru" | "pymupdf" | "pdfplumber"
  STRATEGY: 'auto',

  // 请求超时(毫秒)
  TIMEOUT: 120000,

  // 后端是否可用（自动检测）
  _available: null,
  _checking: false,

  /**
   * 检测后端服务是否可用
   */
  async checkAvailability() {
    if (this._available !== null) return this._available;
    if (this._checking) return false;
    this._checking = true;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${this.BASE_URL}/api/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = await resp.json();
        this._available = data.status === 'ok';
        if (this._available) {
          console.log('[API] MinerU后端已连接，可用引擎:', data.engines);
        }
      } else {
        this._available = false;
      }
    } catch (e) {
      console.log('[API] MinerU后端不可用，将使用前端PDF.js解析');
      this._available = false;
    }
    this._checking = false;
    return this._available;
  },

  /**
   * 调用后端解析PDF
   */
  async parsePdf(file) {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const resp = await fetch(
        `${this.BASE_URL}/api/parse?strategy=${this.STRATEGY}`,
        { method: 'POST', body: formData, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      return {
        success: true,
        questions: data.questions,
        engine: resp.headers.get('X-Parse-Engine') || data.engine,
        elapsed: parseInt(resp.headers.get('X-Parse-Time') || '0'),
        total: data.total,
      };
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error('请求超时，PDF文件可能过大');
      }
      throw e;
    }
  },

  /**
   * 批量解析（后端支持的话一次发送多个文件）
   */
  async parsePdfBatch(files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT * 2);

    try {
      const resp = await fetch(
        `${this.BASE_URL}/api/parse/batch?strategy=${this.STRATEGY}`,
        { method: 'POST', body: formData, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      return await resp.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  },

  /**
   * 获取引擎信息
   */
  async getEngineInfo() {
    try {
      const resp = await fetch(`${this.BASE_URL}/api/health`);
      if (resp.ok) {
        const data = await resp.json();
        return data.engines;
      }
    } catch (e) { /* ignore */ }
    return null;
  },

  // ─── DeepSeek AI 配置 ──────────────────────────────
  _deepseekApiKey: null,
  _deepseekApiKeyLoaded: false,

  /**
   * 获取 DeepSeek API Key
   */
  getDeepSeekApiKey() {
    if (this._deepseekApiKeyLoaded) return this._deepseekApiKey;
    this._deepseekApiKey = localStorage.getItem('deepseek_api_key') || '';
    this._deepseekApiKeyLoaded = true;
    return this._deepseekApiKey;
  },

  /**
   * 保存 DeepSeek API Key
   */
  setDeepSeekApiKey(key) {
    this._deepseekApiKey = key;
    localStorage.setItem('deepseek_api_key', key);
  },

  /**
   * 是否有可用的 API Key
   */
  hasDeepSeekApiKey() {
    return !!this.getDeepSeekApiKey();
  },

  /**
   * 调用后端AI分析（优先），失败时直连DeepSeek API
   */
  async aiAnalyze(questions, onProgress) {
    const apiKey = this.getDeepSeekApiKey();
    if (!apiKey) {
      throw new Error('请先配置DeepSeek API Key');
    }

    // 尝试后端
    const backendOk = await this.checkAvailability();
    if (backendOk) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);
        const resp = await fetch(`${this.BASE_URL}/api/ai/analyze/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions, api_key: apiKey }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const data = await resp.json();
          return data.results;
        }
      } catch (e) {
        console.warn('后端AI分析失败，尝试直连DeepSeek API:', e.message);
      }
    }

    // 直连 DeepSeek API
    return this._aiAnalyzeDirect(questions, apiKey, onProgress);
  },

  /**
   * 直连 DeepSeek API 逐题分析
   */
  async _aiAnalyzeDirect(questions, apiKey, onProgress) {
    const results = [];
    const total = questions.length;

    for (let i = 0; i < total; i++) {
      const q = questions[i];
      try {
        const result = await this._callDeepSeekSingle(q, apiKey);
        results.push({ id: q.id, ...result, success: true });
      } catch (e) {
        results.push({ id: q.id, answer: '', analysis: '', success: false, error: e.message });
      }
      if (onProgress) onProgress(i + 1, total);
    }
    return results;
  },

  /**
   * 调用 DeepSeek API 分析单道题
   */
  async _callDeepSeekSingle(q, apiKey) {
    const typeNames = {
      single: '单选题', multiple: '多选题', judge: '判断题',
      fill: '填空题', essay: '问答题',
    };
    const typeName = typeNames[q.type] || '单选题';

    let optionsText = '';
    if (q.options && q.options.length > 0) {
      optionsText = '\n选项：\n' + q.options.map(o => `${o.label}. ${o.text}`).join('\n');
    }

    const answerHints = {
      single: '返回单个选项字母，如 A',
      multiple: '返回多个选项字母，如 ABD（按字母顺序排列）',
      judge: '返回 A（正确/对）或 B（错误/错）',
      fill: '返回填空答案文本',
      essay: '返回参考答案要点',
    };

    const prompt = `你是一个专业的考试题目解析助手。请分析以下题目并提供正确答案和详细解析。

题目类型：${typeName}
题目内容：${q.title}${optionsText}

请以JSON格式返回（只返回JSON，不要包含其他内容）：
{"answer": "正确答案", "analysis": "详细解析"}

要求：
1. 答案格式：${answerHints[q.type] || '返回选项字母'}
2. 解析要详细、准确，解释选择该答案的原因，对选择题需逐一分析每个选项
3. 对于判断题，A表示正确/对，B表示错误/错`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的考试题目解析助手，只返回JSON格式的结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API请求失败 (${resp.status})`);
    }

    const data = await resp.json();
    let content = data.choices[0].message.content.trim();

    // 提取JSON
    if (content.startsWith('```')) {
      const lines = content.split('\n');
      content = lines.slice(1).join('\n');
      if (content.endsWith('```')) content = content.slice(0, -3).trim();
    }
    if (content.includes('{')) {
      content = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    }

    return JSON.parse(content);
  },

  /**
   * AI 智能批改主观题（简答/填空）
   * 对比用户答案和标准答案，给出评分和反馈
   */
  async aiGradeEssay(question, userAnswer) {
    const apiKey = this.getDeepSeekApiKey();
    if (!apiKey) throw new Error('请先配置DeepSeek API Key');

    const typeName = question.type === 'essay' ? '简答题' : '填空题';
    let optionsText = '';
    if (question.options && question.options.length > 0) {
      optionsText = '\n选项：\n' + question.options.map(o => `${o.label}. ${o.text}`).join('\n');
    }

    const prompt = `你是一个严格的考试阅卷老师。请批改以下${typeName}的作答。

题目：${question.title}${optionsText}
标准答案：${question.answer || '（无标准答案）'}
考生作答：${userAnswer}

请以JSON格式返回批改结果：
{
  "score": 数字(0-100),
  "isCorrect": true或false,
  "feedback": "评语：指出得分点和不足之处，50字以内",
  "correctAnswer": "标准答案要点"
}

要求：
1. 对简答题，按要点给分，不必逐字完全一致
2. 对填空题，关键信息正确即可
3. 给出有建设性的反馈，帮助考生改进`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个严格的考试阅卷老师，只返回JSON格式的批改结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API请求失败 (${resp.status})`);
    }

    const data = await resp.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/```\w*\n?/g, '').replace(/```/g, '');
    }
    return JSON.parse(content);
  },

  /**
   * AI 根据错题生成同类变体题
   */
  async aiGenerateVariant(wrongQuestion) {
    const apiKey = this.getDeepSeekApiKey();
    if (!apiKey) throw new Error('请先配置DeepSeek API Key');

    const typeNames = {
      single: '单选题', multiple: '多选题', judge: '判断题',
      fill: '填空题', essay: '问答题',
    };
    const typeName = typeNames[wrongQuestion.type] || '单选题';

    let optionsText = '';
    if (wrongQuestion.options && wrongQuestion.options.length > 0) {
      optionsText = '\n原题选项：\n' + wrongQuestion.options.map(o => `${o.label}. ${o.text}`).join('\n');
    }

    const prompt = `你是一个专业考试出题老师。请根据以下错题，生成一道同类型、同知识点、不同表述的变体题。

原题类型：${typeName}
原题：${wrongQuestion.title}${optionsText}
原题答案：${wrongQuestion.answer || ''}
原题解析：${wrongQuestion.analysis || ''}
知识点：${wrongQuestion.category || ''}

请以JSON格式返回变体题：
{
  "title": "变体题题目",
  "type": "${wrongQuestion.type}",
  "options": [{"label": "A", "text": "选项A"}, {"label": "B", "text": "选项B"}, ...],
  "answer": "正确答案",
  "analysis": "详细解析",
  "category": "${wrongQuestion.category || ''}",
  "difficulty": "中等"
}

要求：
1. 考察同一个知识点，但题目表述要不同
2. 选项要合理，有干扰项
3. 答案和解析要准确
4. 如果是判断题，options仅A和B`;

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业考试出题老师，只返回JSON格式的题目。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API请求失败 (${resp.status})`);
    }

    const data = await resp.json();
    let content = data.choices[0].message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/```\w*\n?/g, '').replace(/```/g, '');
    }
    return JSON.parse(content);
  },

  /**
   * AI 追问 — 在已有解析基础上进行深入讨论
   */
  async aiFollowUp(chatHistory, question) {
    const apiKey = this.getDeepSeekApiKey();
    if (!apiKey) throw new Error('请先配置DeepSeek API Key');

    const messages = [
      { role: 'system', content: '你是一个专业的考试辅导老师。结合前面的题目解析，简洁回答学生的追问。回答要准确、有深度，100字以内。' },
      ...chatHistory,
      { role: 'user', content: question },
    ];

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.5,
        max_tokens: 512,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API请求失败 (${resp.status})`);
    }

    const data = await resp.json();
    return data.choices[0].message.content.trim();
  },
};
