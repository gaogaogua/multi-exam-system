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
  practiceCount: 20,        // 0 = all
  skipPracticed: false,

  /**
   * 获取当前所有过滤后的题目池
   */
  _getFilteredPool() {
    let pool = QuestionBank.getAll();
    if (this.bankFilter !== 'all') pool = pool.filter(q => q.bank === this.bankFilter);
    if (this.categoryFilter !== 'all') pool = pool.filter(q => q.category === this.categoryFilter);
    if (this.typeFilter !== 'all') pool = pool.filter(q => q.type === this.typeFilter);
    // 跳过已练习题目
    if (this.skipPracticed) {
      const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
      const practicedIds = new Set(log.map(l => l.questionId));
      pool = pool.filter(q => !practicedIds.has(q.id));
    }
    return pool;
  },

  /** 保存题量设置 */
  _savePracticeCount() {
    const el = document.getElementById('practice-count');
    if (el) {
      this.practiceCount = parseInt(el.value) || 0;
      localStorage.setItem('practice_count', this.practiceCount);
    }
  },

  /** 保存跳过已练设置 */
  _saveSkipPracticed() {
    const el = document.getElementById('skip-practiced');
    if (el) {
      this.skipPracticed = el.checked;
      localStorage.setItem('skip_practiced', this.skipPracticed ? '1' : '0');
    }
  },

  /** 恢复上次练习位置 */
  _saveProgress() {
    if (this.questions.length === 0) return;
    const ids = this.questions.map(q => q.id);
    localStorage.setItem('practice_last_ids', JSON.stringify(ids));
    localStorage.setItem('practice_last_index', this.currentIndex);
    localStorage.setItem('practice_last_mode', this.mode);
    localStorage.setItem('practice_last_userAnswers', JSON.stringify(this.userAnswers));
  },

  /** 显示上次练习提示 */
  _showResumeHint() {
    const ids = localStorage.getItem('practice_last_ids');
    if (!ids) return;
    try {
      const parsed = JSON.parse(ids);
      const idx = parseInt(localStorage.getItem('practice_last_index') || '0');
      const mode = localStorage.getItem('practice_last_mode') || 'sequential';
      if (parsed.length === 0) return;
      const el = document.getElementById('resume-hint');
      if (el) {
        el.style.display = 'inline';
        el.textContent = `上次练习到 ${idx + 1}/${parsed.length} 题（${mode === 'random' ? '随机' : '顺序'}），点此继续`;
      }
    } catch (e) { /* ignore */ }
  },

  /** 继续上次练习 */
  _resumeLast() {
    try {
      const ids = JSON.parse(localStorage.getItem('practice_last_ids') || '[]');
      const idx = parseInt(localStorage.getItem('practice_last_index') || '0');
      const mode = localStorage.getItem('practice_last_mode') || 'sequential';
      const answers = JSON.parse(localStorage.getItem('practice_last_userAnswers') || '{}');
      if (ids.length === 0) return;

      // 从题库中找到对应题目
      const all = QuestionBank.getAll();
      const questionMap = new Map(all.map(q => [q.id, q]));
      const questions = ids.map(id => questionMap.get(id)).filter(Boolean);

      if (questions.length === 0) {
        App.showToast('上次练习的题目已不存在', 'error');
        return;
      }

      this.questions = questions;
      this.currentIndex = Math.min(idx, questions.length - 1);
      this.mode = mode;
      this.userAnswers = answers;
      this.showResult = false;
      this._startUI(questions, mode);
    } catch (e) {
      App.showToast('恢复失败', 'error');
    }
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
    const savedCount = localStorage.getItem('practice_count');
    if (savedCount !== null) this.practiceCount = parseInt(savedCount) || 0;
    this.skipPracticed = localStorage.getItem('skip_practiced') === '1';

    // Restore UI elements
    this._refreshCategoryOptions();
    const catSel = document.getElementById('practice-category');
    if (catSel && this.categoryFilter !== 'all') catSel.value = this.categoryFilter;
    const typeSel = document.getElementById('practice-type');
    if (typeSel && this.typeFilter !== 'all') typeSel.value = this.typeFilter;
    const countEl = document.getElementById('practice-count');
    if (countEl) countEl.value = this.practiceCount;
    const skipEl = document.getElementById('skip-practiced');
    if (skipEl) skipEl.checked = this.skipPracticed;
    this._updateBankCounts();
    this._showResumeHint();

    let questions;
    switch (mode) {
      case 'errors': {
        let errQuestions = ErrorNotebook.getReviewList().map(r => r.question).filter(Boolean);
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
        if (this.bankFilter !== 'all') {
          questions = questions.filter(q => q.bank === this.bankFilter);
        }
        if (questions.length === 0) {
          App.showToast('暂无薄弱知识点题目，请先完成一些练习', 'info');
          return;
        }
        break;
      case 'random':
        questions = this.shuffle([...this._getFilteredPool()]);
        if (questions.length === 0) {
          App.showToast(this._poolDiagnose(), 'error');
          return;
        }
        break;
      default:
        questions = [...this._getFilteredPool()];
        if (questions.length === 0) {
          App.showToast(this._poolDiagnose(), 'error');
          return;
        }
        break;
    }

    // 限制题量（按题型比例分配）
    if (this.practiceCount > 0 && questions.length > this.practiceCount) {
      questions = this._sampleByType(questions, this.practiceCount);
    }

    this.startWithQuestions(questions, mode);
  },

  /** 诊断题库为空的原因 */
  _poolDiagnose() {
    const all = QuestionBank.getAll();
    if (all.length === 0) return '题库完全为空，请导入题目';
    const parts = ['题库共' + all.length + '题'];
    // 检查 bank 分布
    const banks = {};
    all.forEach(q => { const b = q.bank || '未标记'; banks[b] = (banks[b] || 0) + 1; });
    parts.push('题库分布: ' + Object.entries(banks).map(([k, v]) => k + ' ' + v + '题').join(', '));
    // 检查当前筛选
    if (this.bankFilter !== 'all') parts.push('当前筛选题库=' + this.bankFilter);
    if (this.categoryFilter !== 'all') parts.push('分类=' + this.categoryFilter);
    if (this.typeFilter !== 'all') parts.push('题型=' + this.typeFilter);
    if (this.skipPracticed) parts.push('跳过已练题目');
    return parts.join('; ');
  },

  /**
   * 按题型比例采样 — 确保单选/多选/判断/简答占比合理
   */
  _sampleByType(pool, count) {
    const byType = {};
    pool.forEach(q => {
      const t = q.type || 'single';
      if (!byType[t]) byType[t] = [];
      byType[t].push(q);
    });

    const types = Object.keys(byType);
    const total = pool.length;

    // 每种题型至少 1 题，剩余按比例分配
    let allocated = types.length; // 每种至少1题
    const remaining = count - allocated;

    const result = [];
    types.forEach(t => {
      const typePool = byType[t];
      const proportion = typePool.length / total;
      const extra = Math.round(remaining * proportion);
      const take = Math.min(1 + extra, typePool.length);
      const shuffled = this.shuffle([...typePool]);
      result.push(...shuffled.slice(0, take));
    });

    // 如果不够，从剩余题目中补足
    if (result.length < count) {
      const usedIds = new Set(result.map(q => q.id));
      const unused = pool.filter(q => !usedIds.has(q.id));
      const extra = this.shuffle(unused).slice(0, count - result.length);
      result.push(...extra);
    }

    return this.shuffle(result).slice(0, count);
  },

  /**
   * 用指定题目列表开始练习
   */
  _startUI(questions, mode) {
    document.querySelectorAll('#page-practice .card-row').forEach(el => el.style.display = 'none');
    document.getElementById('practice-area').style.display = 'block';
    this.renderQuestion();
  },

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
    // 清除上次练习记录（新练习开始）
    localStorage.removeItem('practice_last_ids');
    this._startUI(questions, mode);
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
    this._saveProgress();
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
    // 清除进度（练习已完成）
    localStorage.removeItem('practice_last_ids');
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

    // 跨设备同步：推送错题本和练习记录
    Sync.push().catch(() => {});
  },

  /**
   * 退出练习
   */
  exit() {
    // 保存进度再退出
    if (this.questions.length > 0 && this.currentIndex > 0) {
      this._saveProgress();
    }
    this.questions = [];
    this.currentIndex = 0;
    this.userAnswers = {};
    this.showResult = false;
    document.getElementById('practice-area').style.display = 'none';
    document.querySelectorAll('#page-practice .card-row').forEach(el => el.style.display = 'grid');
    // 显示继续提示
    this._showResumeHint();
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
