/**
 * 智能练习模块 - 多种练习模式
 */
const Practice = {
  questions: [],
  currentIndex: 0,
  mode: 'sequential',
  userAnswers: {},
  showResult: false,
  bankFilter: 'all',
  categoryFilter: 'all',
  typeFilter: 'all',

  /**
   * 获取当前所有过滤后的题目池
   */
  _getFilteredPool() {
    let pool = QuestionBank.getAll();
    if (this.bankFilter !== 'all') pool = pool.filter(q => q.bank === this.bankFilter);
    if (this.categoryFilter !== 'all') pool = pool.filter(q => q.category === this.categoryFilter);
    if (this.typeFilter !== 'all') pool = pool.filter(q => q.type === this.typeFilter);
    return pool;
  },

  /**
   * 保存bank过滤选择
   */
  _saveBankFilter() {
    const checked = document.querySelector('input[name="bank-filter"]:checked');
    if (checked) {
      this.bankFilter = checked.value;
      localStorage.setItem('practice_bank_filter', checked.value);
      this._refreshCategoryOptions();
      this._updateBankCounts();
    }
  },

  /**
   * 保存分类/题型过滤
   */
  _saveFilters() {
    const catSel = document.getElementById('practice-category');
    const typeSel = document.getElementById('practice-type');
    if (catSel) { this.categoryFilter = catSel.value; localStorage.setItem('practice_cat_filter', catSel.value); }
    if (typeSel) { this.typeFilter = typeSel.value; localStorage.setItem('practice_type_filter', typeSel.value); }
    this._updateBankCounts();
  },

  /**
   * 根据当前bank刷新分类下拉选项
   */
  _refreshCategoryOptions() {
    const sel = document.getElementById('practice-category');
    if (!sel) return;
    const all = QuestionBank.getAll();
    const pool = this.bankFilter === 'all' ? all : all.filter(q => q.bank === this.bankFilter);
    const cats = [...new Set(pool.map(q => q.category).filter(Boolean))].sort();
    sel.innerHTML = '<option value="all">全部分类</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    // Restore saved
    const saved = localStorage.getItem('practice_cat_filter');
    if (saved && cats.includes(saved)) sel.value = saved;
    else if (this.categoryFilter !== 'all') sel.value = this.categoryFilter;
  },

  /**
   * 更新bank计数显示
   */
  _updateBankCounts() {
    const el = document.getElementById('bank-counts');
    if (!el) return;
    const all = QuestionBank.getAll();
    const gj = all.filter(q => q.bank === 'gongji').length;
    const tm = all.filter(q => q.bank === 'tumu').length;
    const cur = this._getFilteredPool().length;
    const filters = [];
    if (this.bankFilter !== 'all') filters.push(this.bankFilter === 'gongji' ? '公基' : '土木');
    if (this.categoryFilter !== 'all') filters.push(this.categoryFilter);
    if (this.typeFilter !== 'all') {
      const tNames = {single:'单选',multiple:'多选',judge:'判断',fill:'填空',essay:'简答'};
      filters.push(tNames[this.typeFilter] || this.typeFilter);
    }
    const filterStr = filters.length > 0 ? ' | 筛选:' + filters.join('+') : '';
    el.textContent = `可选 ${cur} 题（公基${gj}+土木${tm}${filterStr}）`;
  },

  /**
   * 开始练习
   */
  start(mode) {
    // Restore saved filters
    const savedBank = localStorage.getItem('practice_bank_filter');
    if (savedBank) {
      this.bankFilter = savedBank;
      const radio = document.querySelector(`input[name="bank-filter"][value="${savedBank}"]`);
      if (radio) radio.checked = true;
    }
    const savedCat = localStorage.getItem('practice_cat_filter');
    if (savedCat) this.categoryFilter = savedCat;
    const savedType = localStorage.getItem('practice_type_filter');
    if (savedType) this.typeFilter = savedType;

    // Refresh category dropdown
    this._refreshCategoryOptions();

    // Restore dropdown selections
    const catSel = document.getElementById('practice-category');
    if (catSel && this.categoryFilter !== 'all') catSel.value = this.categoryFilter;
    const typeSel = document.getElementById('practice-type');
    if (typeSel && this.typeFilter !== 'all') typeSel.value = this.typeFilter;

    this._updateBankCounts();

    let questions;
    switch (mode) {
      case 'errors': {
        let errQuestions = ErrorNotebook.getReviewList().map(r => r.question).filter(Boolean);
        // Filter errors by bank too
        if (this.bankFilter !== 'all') {
          errQuestions = errQuestions.filter(q => q.bank === this.bankFilter);
        }
        questions = errQuestions;
        if (questions.length === 0) {
          App.showToast('没有需要复习的错题', 'info');
          return;
        }
        break;
      }
      case 'weak':
        questions = this.getWeakQuestions();
        // Filter weak by bank too
        if (this.bankFilter !== 'all') {
          questions = questions.filter(q => q.bank === this.bankFilter);
        }
        if (questions.length === 0) {
          App.showToast('暂无薄弱知识点题目，请先完成一些练习', 'info');
          return;
        }
        break;
      case 'random':
        questions = this._getFilteredPool();
        if (questions.length === 0) {
          App.showToast('该题库为空，请先导入题目', 'info');
          return;
        }
        questions = this.shuffle([...questions]);
        break;
      default:
        questions = this._getFilteredPool();
        if (questions.length === 0) {
          App.showToast('该题库为空，请先导入题目', 'info');
          return;
        }
        break;
    }

    this.startWithQuestions(questions, mode);
  },

  /**
   * 用指定题目列表开始练习
   */
  startWithQuestions(questions, mode = 'custom') {
    if (!questions || questions.length === 0) {
      App.showToast('没有可练习的题目', 'info');
      return;
    }

    this.questions = questions;
    this.currentIndex = 0;
    this.mode = mode;
    this.userAnswers = {};
    this.showResult = false;

    document.querySelectorAll('#page-practice .card-row').forEach(el => el.style.display = 'none');
    document.getElementById('practice-area').style.display = 'block';
    this.renderQuestion();
  },

  /**
   * 渲染当前题目
   */
  renderQuestion() {
    const area = document.getElementById('practice-area');
    const q = this.questions[this.currentIndex];
    const total = this.questions.length;
    const current = this.currentIndex + 1;
    const progress = (current / total) * 100;

    let html = `
      <div class="practice-container">
        <div class="practice-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span class="progress-text">${current} / ${total}</span>
          <button class="btn btn-outline btn-sm" onclick="Practice.exit()">退出练习</button>
        </div>
        <div class="practice-question-card">
          <span class="question-type-badge">${App.getTypeName(q.type)}</span>
          <div class="question-text">${current}. ${this.escapeHtml(q.title)}</div>`;

    if (q.options && q.options.length > 0) {
      html += `<div class="options-list">`;
      const savedAnswer = this.userAnswers[q.id] || '';
      const isMulti = q.type === 'multiple';
      const inputType = isMulti ? 'checkbox' : 'radio';

      q.options.forEach(opt => {
        let optClass = 'option-item';
        if (this.showResult) {
          const isCorrect = q.answer.includes(opt.label);
          const isSelected = savedAnswer.includes(opt.label);
          if (isCorrect && isSelected) optClass += ' correct';
          else if (!isCorrect && isSelected) optClass += ' wrong';
          else if (isCorrect) optClass += ' correct';
        } else if (savedAnswer.includes(opt.label)) {
          optClass += ' selected';
        }

        html += `
          <div class="${optClass}" onclick="Practice.selectOption('${q.id}', '${opt.label}', '${inputType}')">
            <input type="${inputType}" name="q_${q.id}" value="${opt.label}" ${savedAnswer.includes(opt.label) ? 'checked' : ''} style="pointer-events:none;">
            <span class="option-label">${opt.label}.</span> ${this.escapeHtml(opt.text)}
          </div>`;
      });
      html += `</div>`;
    } else {
      // 填空题/问答题 - 文本输入
      const savedAnswer = this.userAnswers[q.id] || '';
      html += `
        <div class="form-group">
          <textarea id="essay-answer" rows="4" placeholder="请输入你的答案..." onchange="Practice.saveEssayAnswer('${q.id}', this.value)">${this.escapeHtml(savedAnswer)}</textarea>
        </div>`;
    }

    // 显示结果和解析
    if (this.showResult) {
      const isCorrect = this.checkAnswer(q, this.userAnswers[q.id] || '');
      const userAns = this.userAnswers[q.id] || '';
      const typeName = App.getTypeName(q.type);
      const isEssayType = q.type === 'essay' || q.type === 'fill';
      html += `
        <div class="practice-result ${isCorrect ? 'result-correct' : 'result-wrong'}" style="margin-top:16px;padding:16px;border-radius:8px;border-left:4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};background:${isCorrect ? '#f6ffed' : '#fff2f0'};">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">${isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}</div>
          <div style="margin-bottom:6px;"><strong>你的答案：</strong>${this.escapeHtml(userAns || '未作答')}</div>
          <div style="margin-bottom:6px;color:var(--success);"><strong>正确答案：</strong>${this.escapeHtml(q.answer)}</div>
          <div style="margin-bottom:6px;"><strong>题型：</strong>${typeName}</div>`;
      if (q.analysis && q.analysis.trim()) {
        html += `<div style="margin-top:8px;padding:12px;background:#fff;border-radius:4px;line-height:1.8;"><strong>📖 解析：</strong><br>${this.escapeHtml(q.analysis)}</div>`;
      } else {
        html += `<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">（暂无详细解析）</div>`;
        html += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiAnalyze('${q.id}')" style="margin-top:4px;color:var(--accent);border-color:var(--accent);">🤖 AI解析此题</button>`;
      }
      // AI 批改按钮（主观题）
      if (isEssayType && userAns && userAns.trim()) {
        html += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGradeEssay('${q.id}')" style="margin-top:4px;margin-left:4px;color:#722ed1;border-color:#722ed1;">📝 AI批改</button>`;
        html += `<div id="ai-grade-result-${q.id}" style="margin-top:8px;"></div>`;
      }
      // 变体题按钮（答错时）
      if (!isCorrect) {
        html += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGenVariant('${q.id}')" style="margin-top:4px;margin-left:4px;color:#eb2f96;border-color:#eb2f96;">🔄 生成变体题</button>`;
        html += `<div id="ai-variant-result-${q.id}" style="margin-top:8px;"></div>`;
      }
      html += `</div>`;
    }

    // ── 题目数据质量标记 ──
    const hasAns = q.answer && q.answer.trim();
    const hasOpts = q.options && q.options.length >= 2 && q.options[0].text && q.options[0].text.length > 2 && !q.options[0].text.startsWith('选项');
    const hasAnalysis = q.analysis && q.analysis.trim().length > 5;
    const dataOK = hasAns && hasOpts && hasAnalysis;
    const dataIssues = [];
    if (!hasAns) dataIssues.push('缺答案');
    if (!hasOpts) dataIssues.push('选项为占位符');
    if (!hasAnalysis) dataIssues.push('缺解析');

    html += `</div>
        <div class="practice-actions">
          <button class="btn btn-outline" ${this.currentIndex === 0 ? 'disabled' : ''} onclick="Practice.prevQuestion()">上一题</button>`;

    if (!this.showResult) {
      html += `<button class="btn btn-primary" onclick="Practice.submitAnswer()">提交答案</button>`;
      html += `<button class="btn btn-outline" style="color:var(--text-secondary);" onclick="Practice.skipQuestion()">跳过</button>`;
    }

    if (this.showResult) {
      html += `<button class="btn btn-primary" onclick="Practice.nextQuestion()">${current >= total ? '完成练习' : '下一题'}</button>`;
      // 数据质量标记
      if (!dataOK) {
        html += `<span style="font-size:11px;color:#faad14;margin-left:8px;">⚠ ${dataIssues.join('/')}</span>`;
      } else {
        html += `<span style="font-size:11px;color:var(--success);margin-left:8px;">✓ 数据完整</span>`;
      }
    }

    html += `</div></div>`;
    area.innerHTML = html;
  },

  /**
   * 选择选项
   */
  selectOption(questionId, label, inputType) {
    if (this.showResult) return;

    if (inputType === 'radio') {
      this.userAnswers[questionId] = label;
    } else {
      // 多选切换
      const current = this.userAnswers[questionId] || '';
      this.userAnswers[questionId] = current.includes(label)
        ? current.replace(label, '')
        : (current + label).split('').sort().join('');
    }
    this.renderQuestion();
  },

  /**
   * 保存问答题答案
   */
  saveEssayAnswer(questionId, value) {
    this.userAnswers[questionId] = value;
  },

  /**
   * 提交答案
   */
  submitAnswer() {
    const q = this.questions[this.currentIndex];
    const userAnswer = this.userAnswers[q.id] || '';

    if (!userAnswer && q.type !== 'essay') {
      App.showToast('请先选择答案', 'info');
      return;
    }

    this.showResult = true;
    const isCorrect = this.checkAnswer(q, userAnswer);

    // 记录练习
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    log.push({
      questionId: q.id,
      userAnswer,
      correct: isCorrect,
      timestamp: new Date().toISOString(),
      mode: this.mode,
    });
    Storage.set(Storage.KEYS.PRACTICE_LOG, log);

    // 如果答错，加入错题本
    if (!isCorrect) {
      ErrorNotebook.addError(q.id, userAnswer);
    }

    this.renderQuestion();
  },

  /**
   * 检查答案
   */
  checkAnswer(question, userAnswer) {
    if (question.type === 'essay' || question.type === 'fill') {
      // 简答题：包含关键词即算对
      if (!userAnswer) return false;
      const correct = question.answer.toLowerCase().trim();
      const user = userAnswer.toLowerCase().trim();
      if (correct === user) return true;
      // 检查是否包含核心答案（50%以上字符匹配）
      let matchCount = 0;
      for (const ch of correct) {
        if (user.includes(ch)) matchCount++;
      }
      return matchCount / correct.length >= 0.5;
    }

    // 选择题：排序后比较
    const correct = question.answer.split('').sort().join('');
    const user = userAnswer.split('').sort().join('');
    return correct === user;
  },

  /**
   * 下一题
   */
  nextQuestion() {
    if (this.currentIndex >= this.questions.length - 1) {
      this.finish();
      return;
    }
    this.currentIndex++;
    this.showResult = false;
    this.renderQuestion();
  },

  /**
   * AI解析当前题目 — 静默保存，原地刷新
   */
  async _aiAnalyze(id) {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      App.showToast('请先配置DeepSeek API Key', 'error');
      return;
    }
    const q = QuestionBank.getById(id);
    if (!q) return;

    App.showToast('AI解析中...', 'info');
    try {
      const results = await ApiConfig.aiAnalyze([{
        id: q.id, title: q.title, type: q.type, options: q.options || [],
      }]);
      if (results.length > 0 && results[0].success) {
        const r = results[0];
        QuestionBank.update(id, { answer: r.answer, analysis: r.analysis });
        // 更新当前题目缓存
        const idx = this.questions.findIndex(x => x.id === id);
        if (idx >= 0) {
          this.questions[idx].answer = r.answer;
          this.questions[idx].analysis = r.analysis;
        }
        // 原地刷新，不弹窗
        this.renderQuestion();
        App.updateStats();
      } else {
        App.showToast('AI解析失败: ' + (results[0]?.error || '未知错误'), 'error');
      }
    } catch(e) {
      App.showToast('AI解析失败: ' + e.message, 'error');
    }
  },

  /**
   * AI 批改主观题 — 对比用户答案和标准答案
   */
  async _aiGradeEssay(id) {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      App.showToast('请先配置DeepSeek API Key', 'error');
      return;
    }
    const q = QuestionBank.getById(id);
    const userAnswer = this.userAnswers[id] || '';
    if (!q || !userAnswer.trim()) return;

    const resultDiv = document.getElementById(`ai-grade-result-${id}`);
    if (resultDiv) resultDiv.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">AI批改中...</span>';

    App.showToast('AI批改中...', 'info');
    try {
      const result = await ApiConfig.aiGradeEssay({
        title: q.title, type: q.type, options: q.options || [], answer: q.answer,
      }, userAnswer);
      const scoreColor = result.score >= 80 ? 'var(--success)' : result.score >= 60 ? '#faad14' : 'var(--danger)';
      if (resultDiv) {
        resultDiv.innerHTML = `
          <div style="padding:10px;background:#fff;border-radius:4px;border-left:3px solid ${scoreColor};margin-top:6px;font-size:13px;line-height:1.6;">
            <strong>AI评分：</strong><span style="color:${scoreColor};font-size:16px;font-weight:700;">${result.score}分</span>
            ${result.isCorrect ? ' ✓' : ''}
            <div style="margin-top:4px;"><strong>评语：</strong>${this.escapeHtml(result.feedback)}</div>
            ${result.correctAnswer ? `<div style="margin-top:4px;"><strong>标准要点：</strong>${this.escapeHtml(result.correctAnswer)}</div>` : ''}
          </div>`;
      }
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = `<span style="color:var(--danger);font-size:12px;">批改失败: ${this.escapeHtml(e.message)}</span>`;
      App.showToast('AI批改失败: ' + e.message, 'error');
    }
  },

  /**
   * AI 根据错题生成同类变体题
   */
  async _aiGenVariant(id) {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      App.showToast('请先配置DeepSeek API Key', 'error');
      return;
    }
    const q = QuestionBank.getById(id);
    if (!q) return;

    const resultDiv = document.getElementById(`ai-variant-result-${id}`);
    if (resultDiv) resultDiv.innerHTML = '<span style="font-size:12px;color:var(--text-secondary);">生成变体题中...</span>';

    App.showToast('AI生成变体题中...', 'info');
    try {
      const variant = await ApiConfig.aiGenerateVariant({
        title: q.title, type: q.type, options: q.options || [],
        answer: q.answer, analysis: q.analysis, category: q.category,
      });
      // 添加到题库
      const newId = QuestionBank.add({
        title: variant.title,
        type: variant.type,
        options: variant.options || [],
        answer: variant.answer,
        analysis: variant.analysis,
        category: variant.category || q.category,
        difficulty: variant.difficulty || '中等',
        bank: q.bank || 'gongji',
        source: 'ai-variant',
        createdAt: new Date().toISOString(),
      });
      if (resultDiv) {
        resultDiv.innerHTML = `
          <div style="padding:10px;background:#fff;border-radius:4px;border-left:3px solid #722ed1;margin-top:6px;font-size:13px;line-height:1.6;">
            <strong>✓ 变体题已生成并加入题库</strong>
            <div style="margin-top:4px;color:var(--primary);">${this.escapeHtml(variant.title)}</div>
            <div style="margin-top:4px;font-size:12px;color:var(--text-secondary);">答案: ${this.escapeHtml(variant.answer)} | 分类: ${this.escapeHtml(variant.category || q.category)}</div>
          </div>`;
      }
      App.updateStats();
      App.showToast('变体题已加入题库', 'success');
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = `<span style="color:var(--danger);font-size:12px;">生成失败: ${this.escapeHtml(e.message)}</span>`;
      App.showToast('变体题生成失败: ' + e.message, 'error');
    }
  },

  /**
   * 跳过当前题目（不提交答案，直接下一题）
   */
  skipQuestion() {
    if (this.currentIndex >= this.questions.length - 1) {
      this.finish();
      return;
    }
    this.currentIndex++;
    this.renderQuestion();
  },

  /**
   * 上一题
   */
  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.showResult = this.userAnswers[this.questions[this.currentIndex].id] !== undefined;
      this.renderQuestion();
    }
  },

  /**
   * 完成练习
   */
  finish() {
    const total = this.questions.length;
    let correct = 0;
    for (const q of this.questions) {
      const userAnswer = this.userAnswers[q.id] || '';
      if (this.checkAnswer(q, userAnswer)) correct++;
    }

    const accuracy = Math.round((correct / total) * 100);
    const area = document.getElementById('practice-area');
    area.innerHTML = `
      <div class="practice-container">
        <div class="practice-question-card" style="text-align:center;">
          <h2 style="margin-bottom:16px;">练习完成！</h2>
          <div style="font-size:48px;font-weight:700;color:var(--primary);margin-bottom:8px;">${accuracy}%</div>
          <p style="color:var(--text-secondary);margin-bottom:16px;">正确 ${correct}/${total} 题</p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-primary" onclick="Practice.start('${this.mode}')">再来一轮</button>
            <button class="btn btn-outline" onclick="Practice.exit()">返回</button>
          </div>
        </div>
      </div>`;

    App.updateStats();

    // 联动计划：更新今日计划进度
    if (typeof Plan !== 'undefined') {
      const bank = this.bankFilter !== 'all' ? this.bankFilter : null;
      if (bank) Plan.updateProgress(bank, correct, total);
    }
  },

  /**
   * 退出练习
   */
  exit() {
    this.questions = [];
    this.currentIndex = 0;
    this.userAnswers = {};
    this.showResult = false;
    document.getElementById('practice-area').style.display = 'none';
    document.querySelectorAll('#page-practice .card-row').forEach(el => el.style.display = 'grid');
    App.updateStats();
  },

  /**
   * 获取薄弱知识点题目
   */
  getWeakQuestions() {
    const errors = ErrorNotebook.getAll().filter(e => !e.mastered);
    const categoryCount = {};
    errors.forEach(e => {
      const cat = e.questionCategory || '未分类';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    // 找出错题最多的分类
    const weakCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    const questions = QuestionBank.getAll();
    return questions.filter(q => weakCategories.includes(q.category));
  },

  /**
   * 洗牌算法
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /**
   * HTML转义
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
