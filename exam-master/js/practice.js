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
  autoJump: false,           // 答题后自动跳转
  _touchStartX: 0,
  _touchStartY: 0,

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

  /** 保存自动跳转设置 */
  _saveAutoJump() {
    const el = document.getElementById('auto-jump');
    if (el) {
      this.autoJump = el.checked;
      localStorage.setItem('auto_jump', this.autoJump ? '1' : '0');
    }
  },

  /** 持久化练习进度到 sessionStorage */
  saveProgress() {
    if (this.questions.length === 0) return;
    const state = {
      questions: this.questions,
      currentIndex: this.currentIndex,
      mode: this.mode,
      userAnswers: this.userAnswers,
      bankFilter: this.bankFilter,
      categoryFilter: this.categoryFilter,
      typeFilter: this.typeFilter,
      practiceCount: this.practiceCount,
      skipPracticed: this.skipPracticed,
      autoJump: this.autoJump,
    };
    try { sessionStorage.setItem('practice_progress', JSON.stringify(state)); } catch (_) {}
  },

  /** 恢复练习进度 */
  restoreProgress() {
    try {
      const raw = sessionStorage.getItem('practice_progress');
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (!state.questions || state.questions.length === 0) return false;
      return state;
    } catch (_) { return false; }
  },

  /** 提示用户是否继续上次练习 */
  checkAndRestore() {
    const state = this.restoreProgress();
    if (!state) return;
    if (typeof Feedback !== 'undefined') {
      Feedback.confirmAction(`检测到上次未完成的练习（第 ${(state.currentIndex || 0) + 1}/${state.questions.length} 题），是否继续？`).then(yes => {
        if (yes) {
          this.questions = state.questions;
          this.currentIndex = state.currentIndex || 0;
          this.mode = state.mode || 'sequential';
          this.userAnswers = state.userAnswers || {};
          this.bankFilter = state.bankFilter || 'all';
          this.categoryFilter = state.categoryFilter || 'all';
          this.typeFilter = state.typeFilter || 'all';
          this.practiceCount = state.practiceCount || 20;
          this.skipPracticed = state.skipPracticed || false;
          this.autoJump = state.autoJump || false;
          this.showResult = false;
          this._startUI(this.questions, this.mode);
          sessionStorage.removeItem('practice_progress');
        } else {
          sessionStorage.removeItem('practice_progress');
        }
      });
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
    let cats = [...new Set(pool.map(q => q.category).filter(Boolean))];
    // 土木按章节排序
    if (this.bankFilter === 'tumu') {
      const order = QuestionBank.CHAPTER_ORDER;
      cats.sort((a, b) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else {
      cats.sort();
    }
    sel.innerHTML = '<option value="all">全部分类</option>' + cats.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`).join('');
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
    this.autoJump = localStorage.getItem('auto_jump') === '1';

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
    const autoJumpEl = document.getElementById('auto-jump');
    if (autoJumpEl) autoJumpEl.checked = this.autoJump;
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
      case 'memorize':
        questions = [...this._getFilteredPool()];
        if (this.bankFilter === 'tumu' || this.bankFilter === 'all') {
          questions = QuestionBank._sortByChapter(questions);
        }
        if (questions.length === 0) {
          App.showToast(this._poolDiagnose(), 'error');
          return;
        }
        if (this.practiceCount > 0 && questions.length > this.practiceCount) {
          questions = this._sampleByType(questions, this.practiceCount);
        }
        break;
      case 'plan':
        // Plan-aware mode: uses plan task's weak category and SM-2 due reviews
        questions = [...this._getFilteredPool()];
        // Prefer weak category questions first, then fill with rest
        const weakQ = questions.filter(q => q.category === this.categoryFilter);
        const otherQ = questions.filter(q => q.category !== this.categoryFilter);
        questions = [...weakQ, ...Utils.shuffle(otherQ)];
        if (questions.length === 0) {
          App.showToast(this._poolDiagnose(), 'error');
          return;
        }
        if (this.practiceCount > 0 && questions.length > this.practiceCount) {
          questions = this._sampleByType(questions, this.practiceCount);
        }
        break;
      case 'random':
        questions = Utils.shuffle([...this._getFilteredPool()]);
        if (questions.length === 0) {
          App.showToast(this._poolDiagnose(), 'error');
          return;
        }
        break;
      case 'smart':
        questions = this._getSmartQuestions();
        if (questions.length === 0) {
          App.showToast('暂无足够数据用于智能推荐（需要错题或练习记录）', 'info');
          return;
        }
        break;
      case 'category':
        // 专项练习由 PracticeModes.startCategoryPractice 预处理
        questions = [...this._getFilteredPool()];
        if (questions.length === 0) {
          Feedback.showToast('该分类下暂无题目', 'warning');
          return;
        }
        break;
      default: // sequential
        questions = [...this._getFilteredPool()];
        if (this.bankFilter === 'tumu' || this.bankFilter === 'all') {
          questions = QuestionBank._sortByChapter(questions);
        }
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
      const shuffled = Utils.shuffle([...typePool]);
      result.push(...shuffled.slice(0, take));
    });

    // 如果不够，从剩余题目中补足
    if (result.length < count) {
      const usedIds = new Set(result.map(q => q.id));
      const unused = pool.filter(q => !usedIds.has(q.id));
      const extra = Utils.shuffle(unused).slice(0, count - result.length);
      result.push(...extra);
    }

    // 按题型排序: 单选 → 多选 → 判断 → 填空 → 简答
    const typeOrder = { single: 0, multiple: 1, judge: 2, fill: 3, essay: 4 };
    result.sort((a, b) => (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5));

    return result.slice(0, count);
  },

  /** 跳转到指定题目 */
  goToQuestion(index) {
    if (index < 0 || index >= this.questions.length) return;
    this.saveProgress();
    this.currentIndex = index;
    this.showResult = this.userAnswers[this.questions[index].id] !== undefined;
    this.renderQuestion();
  },

  /** 将题目从练习记录中移除（标记为未练） */
  _markUnpracticed(questionId) {
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const before = log.length;
    const filtered = log.filter(e => e.questionId !== questionId);
    Storage.set(Storage.KEYS.PRACTICE_LOG, filtered);
    if (filtered.length < before) {
      App.showToast('已标记为未练', 'success');
      this.renderQuestion();
    }
  },

  /**
   * 用指定题目列表开始练习
   */
  _startUI(questions, mode) {
    // Clean up any old delegation handlers
    if (this._delegatedHandler) {
      document.removeEventListener('click', this._delegatedHandler, true);
      document.removeEventListener('keydown', this._keyHandler, true);
      this._delegatedHandler = null;
      this._keyHandler = null;
    }
    document.querySelectorAll('#page-practice .card-row').forEach(el => el.style.display = 'none');
    document.getElementById('practice-area').style.display = 'block';
    this._bindTouch();

    // 启动统计悬浮窗
    StatsWidget.start(questions.length, 0);

    // 重置答题卡
    AnswerSheet._marks = {};
    AnswerSheet._collapsed = false;

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
    this._startTime = Date.now();
    this._lastAnswerTime = 0;
    // 清除上次练习记录（新练习开始）
    localStorage.removeItem('practice_last_ids');
    this._startUI(questions, mode);
  },

  /**
   * 渲染当前题目 — 编排各子渲染器
   */
  renderQuestion() {
    const area = document.getElementById('practice-area');
    const q = this.questions[this.currentIndex];
    const total = this.questions.length;
    const current = this.currentIndex + 1;
    const progress = (current / total) * 100;

    const navHtml = this._renderNav();
    const notesEntry = (typeof PracticeNotes !== 'undefined') ? PracticeNotes.get(q.id) : null;
    const markIcon = notesEntry && notesEntry.mark
      ? { star: '⭐', question: '❓', important: '❗' }[notesEntry.mark] || ''
      : '';

    const html = `
      <div class="practice-container">
        ${this._renderProgress(current, total, progress)}
        ${navHtml}
        <div class="practice-question-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span class="question-type-badge">${App.getTypeName(q.type)}</span>
            ${markIcon ? `<span style="font-size:14px;" title="已标记">${markIcon}</span>` : ''}
            <span style="flex:1;"></span>
            <button class="btn-sm btn-outline" onclick="Practice._showNoteEditor('${q.id}')" style="font-size:10px;">📝 笔记</button>
          </div>
          <div class="question-text">${current}. ${Utils.escapeHtml(q.title)}</div>
          ${this._renderOptions(q)}
          ${this._renderResult(q)}
          ${this.showResult ? this._renderDifficultyFeedback(q) : ''}
        </div>
        ${this._renderActions(current, total)}
      </div>`;
    area.innerHTML = html;

    // 渲染答题卡
    if (typeof AnswerSheet !== 'undefined') {
      AnswerSheet.render(this.questions, this.userAnswers, this.currentIndex, 'practice');
    }
  },

  /** 题目列表导航栏 */
  _renderNav() {
    const icons = { single: '①', multiple: '②', judge: '③', fill: '④', essay: '⑤' };
    let h = '<div class="practice-nav" id="practice-nav">';
    this.questions.forEach((nq, ni) => {
      const answered = this.userAnswers[nq.id] !== undefined;
      const isCur = ni === this.currentIndex;
      h += `<button class="pq-nav-btn ${isCur ? 'pq-cur' : ''} ${answered ? 'pq-answered' : ''}"
        onclick="event.stopPropagation();Practice.goToQuestion(${ni})"
        title="${Utils.escapeHtml((nq.title||'').substring(0,40))}">${ni+1}${icons[nq.type]||''}</button>`;
    });
    return h + '</div>';
  },

  /** 进度条 */
  _renderProgress(current, total, progress) {
    return `<div class="practice-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      <span class="progress-text" onclick="const n=document.getElementById('practice-nav');n.style.display=n.style.display==='none'?'flex':'none'" style="cursor:pointer;" title="点击展开/收起题目列表">📋 ${current} / ${total}</span>
      <button class="btn btn-outline btn-sm" onclick="Practice.exit()">退出练习</button>
    </div>`;
  },

  /** 选择题选项 或 填空/简答文本输入 */
  _renderOptions(q) {
    if (!q.options || q.options.length === 0) {
      const saved = this.userAnswers[q.id] || '';
      return `<div class="form-group">
        <textarea id="essay-answer" rows="4" placeholder="请输入你的答案..." onchange="Practice.saveEssayAnswer('${q.id}', this.value)">${Utils.escapeHtml(saved)}</textarea>
      </div>`;
    }
    const savedAnswer = this.userAnswers[q.id] || '';
    const isMulti = q.type === 'multiple';
    const inputType = isMulti ? 'checkbox' : 'radio';
    let h = '<div class="options-list">';
    q.options.forEach(opt => {
      let cls = 'option-item';
      if (this.showResult) {
        const isCorrect = q.answer.includes(opt.label);
        const isSelected = savedAnswer.includes(opt.label);
        if (isCorrect && isSelected) cls += ' correct user-pick';
        else if (!isCorrect && isSelected) cls += ' wrong user-pick';
        else if (isCorrect) cls += ' correct-answer';
      } else if (savedAnswer.includes(opt.label)) {
        cls += ' selected';
      }
      h += `<div class="${cls}" onclick="Practice.selectOption('${q.id}','${opt.label}','${inputType}')">
        <input type="${inputType}" name="q_${q.id}" value="${opt.label}" ${savedAnswer.includes(opt.label)?'checked':''} style="pointer-events:none;">
        <span class="option-label">${opt.label}.</span> ${Utils.escapeHtml(opt.text)}
      </div>`;
    });
    return h + '</div>';
  },

  /** 答案结果 + 解析 + AI 按钮 + 编辑 */
  _renderResult(q) {
    if (!this.showResult && this.mode !== 'memorize') return '';
    const isCorrect = this.mode === 'memorize' ? true : this.checkAnswer(q, this.userAnswers[q.id] || '');
    const userAns = this.mode === 'memorize' ? '' : (this.userAnswers[q.id] || '');
    const isEssayType = q.type === 'essay' || q.type === 'fill';
    const boxStyle = this.mode === 'memorize'
      ? 'margin-top:16px;padding:16px;border-radius:8px;border-left:4px solid #667eea;background:#f0f5ff;'
      : `margin-top:16px;padding:16px;border-radius:8px;border-left:4px solid ${isCorrect?'var(--success)':'var(--danger)'};background:${isCorrect?'#f6ffed':'#fff2f0'};`;

    let h = `<div class="practice-result" style="${boxStyle}">`;
    if (this.mode === 'memorize') {
      h += `<div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#667eea;">📖 背题模式</div>`;
    } else {
      h += `<div style="font-size:18px;font-weight:700;margin-bottom:8px;">${isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}</div>
        <div style="margin-bottom:6px;"><strong>你的答案：</strong>${Utils.escapeHtml(userAns || '未作答')}</div>`;
    }
    h += `<div style="margin-bottom:6px;color:var(--success);"><strong>正确答案：</strong>${Utils.escapeHtml(q.answer)}</div>
      <div style="margin-bottom:6px;"><strong>题型：</strong>${App.getTypeName(q.type)}</div>`;

    // 解析 + AI 按钮
    if (q.analysis && q.analysis.trim().length > 5) {
      h += `<div style="margin-top:8px;padding:12px;background:#fff;border-radius:4px;line-height:1.8;"><strong>📖 解析：</strong><br>${Utils.escapeHtml(q.analysis)}</div>`;
      h += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiAnalyze('${q.id}')" style="margin-top:4px;color:var(--accent);border-color:var(--accent);font-size:11px;">🔄 AI重新解析</button><span id="ai-key-hint-${q.id}"></span>`;
      if (this._chatHistory) {
        h += `<div style="margin-top:6px;display:flex;gap:4px;"><input id="ai-followup-input-${q.id}" placeholder="追问AI..." onkeydown="if(event.key==='Enter'){event.preventDefault();Practice._aiFollowUp('${q.id}')}" style="flex:1;padding:3px 8px;border:1px solid #d9d9d9;border-radius:4px;font-size:12px;"><button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiFollowUp('${q.id}')" style="font-size:11px;color:var(--primary);">发送</button></div><div id="ai-followup-result-${q.id}"></div>`;
      }
    } else {
      h += `<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">（暂无详细解析）</div>`;
      h += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiAnalyze('${q.id}')" style="margin-top:4px;color:var(--accent);border-color:var(--accent);">🤖 AI解析此题</button><span id="ai-key-hint-${q.id}"></span>`;
    }

    // AI 批改（主观题）
    if (isEssayType && userAns && userAns.trim()) {
      h += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGradeEssay('${q.id}')" style="margin-top:4px;margin-left:4px;color:#722ed1;border-color:#722ed1;">📝 AI批改</button><div id="ai-grade-result-${q.id}" style="margin-top:8px;"></div>`;
    }

    // 编辑 + 取消已练
    const allLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const practiced = allLog.some(e => e.questionId === q.id);
    h += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._showEdit('${q.id}')" style="margin-top:4px;margin-left:4px;color:#666;border-color:#d9d9d9;font-size:11px;">✏️ 编辑</button>`;
    h += practiced
      ? `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._markUnpracticed('${q.id}')" style="margin-top:4px;margin-left:4px;color:#999;border-color:#d9d9d9;font-size:11px;">↩ 取消已练</button>`
      : `<span style="font-size:11px;color:#d9d9d9;margin-left:4px;">未练</span>`;
    h += `<div id="edit-area-${q.id}"></div>`;

    // 变体题（答错时）
    if (!isCorrect) {
      h += `<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGenVariant('${q.id}')" style="margin-top:4px;margin-left:4px;color:#eb2f96;border-color:#eb2f96;">🔄 生成变体题</button><div id="ai-variant-result-${q.id}" style="margin-top:8px;"></div>`;
    }
    return h + '</div>';
  },

  /** 数据质量检查 */
  _checkDataQuality(q) {
    const hasAns = q.answer && q.answer.trim();
    const hasOpts = q.options && q.options.length >= 2 && q.options[0].text && q.options[0].text.length > 2 && !q.options[0].text.startsWith('选项');
    const hasAnalysis = q.analysis && q.analysis.trim().length > 5;
    const ok = hasAns && hasOpts && hasAnalysis;
    const issues = [];
    if (!hasAns) issues.push('缺答案');
    if (!hasOpts) issues.push('选项为占位符');
    if (!hasAnalysis) issues.push('缺解析');
    return { ok, issues };
  },

  /** 操作按钮栏 */
  _renderActions(current, total) {
    const q = this.questions[this.currentIndex];
    const { ok, issues } = this._checkDataQuality(q);
    let h = `<div class="practice-actions">
      <button class="btn btn-outline" ${this.currentIndex === 0 ? 'disabled' : ''} onclick="Practice.prevQuestion()">上一题</button>`;
    if (this.mode === 'memorize') {
      h += `<span style="font-size:12px;color:#eb2f96;margin:0 8px;">📖 背题中</span>
        <button class="btn btn-primary" onclick="Practice.nextQuestion()">${current >= total ? '完成' : '下一题'}</button>`;
    } else if (!this.showResult) {
      h += `<button class="btn btn-primary" onclick="Practice.submitAnswer()">提交答案</button>
        <button class="btn btn-outline" style="color:#fa8c16;border-color:#fa8c16;" onclick="Practice.dontKnow()">不会</button>
        <button class="btn btn-outline" style="color:var(--text-secondary);" onclick="Practice.skipQuestion()">跳过</button>`;
    } else {
      h += `<button class="btn btn-primary" onclick="Practice.nextQuestion()">${current >= total ? '完成练习' : '下一题'}</button>`;
      h += ok
        ? `<span style="font-size:11px;color:var(--success);margin-left:8px;">✓ 数据完整</span>`
        : `<span style="font-size:11px;color:#faad14;margin-left:8px;">⚠ ${issues.join('/')}</span>`;
    }
    return h + '</div></div>';
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

    this.saveProgress();
    this.renderQuestion();

    // 更新悬浮窗
    const correctCount = Object.values(this.userAnswers).filter(ans => {
      const qq = this.questions.find(x => x.id === Object.keys(this.userAnswers).find(k => this.userAnswers[k] === ans));
      return qq && this.checkAnswer(qq, ans);
    }).length;
    StatsWidget.updateCorrect(
      Object.keys(this.userAnswers).filter(k => {
        const qq = this.questions.find(x => x.id === k);
        return qq && this.checkAnswer(qq, this.userAnswers[k]);
      }).length
    );

    // 自动跳转
    if (this.autoJump && q.type !== 'essay' && q.type !== 'fill') {
      setTimeout(() => {
        if (this.currentIndex < this.questions.length - 1) this.nextQuestion();
      }, 600);
    }
  },

  // ─── 笔记编辑 ──────────────────────────────────

  _showNoteEditor(questionId) {
    const notes = typeof PracticeNotes !== 'undefined' ? PracticeNotes : null;
    if (!notes) return;
    const entry = notes.get(questionId);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '10010';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header"><h3>📝 我的笔记</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
        <div class="modal-body">
          <div style="margin-bottom:12px;display:flex;gap:6px;">
            ${['star','question','important'].map(m => `
              <button class="btn-sm ${entry.mark === m ? 'btn-primary' : 'btn-outline'}" onclick="PracticeNotes.setMark('${questionId}','${m}');this.closest('.modal-overlay').remove();Practice.renderQuestion();" style="font-size:11px;">${{star:'⭐ 星标',question:'❓ 疑问',important:'❗ 重要'}[m]}</button>
            `).join('')}
          </div>
          <textarea id="note-textarea" rows="5" style="width:100%;padding:10px;border-radius:8px;border:1px solid #d9d9d9;font-size:14px;font-family:inherit;" placeholder="输入你的笔记...">${Utils.escapeHtml(entry.note || '')}</textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
            <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="PracticeNotes.saveNote('${questionId}',document.getElementById('note-textarea').value);this.closest('.modal-overlay').remove();Practice.renderQuestion();">保存笔记</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  },

  // ─── 难度反馈 ──────────────────────────────────

  _renderDifficultyFeedback(q) {
    return `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:12px;color:#999;">
      <span>难度反馈:</span>
      <button class="btn-sm btn-outline" onclick="Practice._feedbackDifficulty('${q.id}','easy')" style="font-size:10px;">😊 简单</button>
      <button class="btn-sm btn-outline" onclick="Practice._feedbackDifficulty('${q.id}','medium')" style="font-size:10px;">😐 一般</button>
      <button class="btn-sm btn-outline" onclick="Practice._feedbackDifficulty('${q.id}','hard')" style="font-size:10px;">😰 困难</button>
    </div>`;
  },

  _feedbackDifficulty(questionId, level) {
    try {
      const all = JSON.parse(localStorage.getItem('difficulty_feedback') || '{}');
      all[questionId] = level;
      localStorage.setItem('difficulty_feedback', JSON.stringify(all));
    } catch (_) {}
    Feedback.showToast({ easy: '标记为简单', medium: '标记为一般', hard: '标记为困难' }[level], 'info', 1200);
  },

  _getDifficultyFeedback(questionId) {
    try {
      return JSON.parse(localStorage.getItem('difficulty_feedback') || '{}')[questionId] || null;
    } catch (_) { return null; }
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
    // 立即反馈：更新按钮状态
    const btn = document.querySelector(`button[onclick*="_aiAnalyze('${id}')"]`);
    if (btn) { btn.textContent = '⏳ AI解析中...'; btn.disabled = true; }

    if (!ApiConfig.hasDeepSeekApiKey()) {
      const el = document.getElementById('ai-key-hint-' + id);
      if (el) el.innerHTML = '<span style="color:var(--danger);font-size:11px;">⚠ 请先配置DeepSeek API Key（点左下角 AI/Sync）</span>';
      if (btn) { btn.textContent = '🤖 AI解析此题'; btn.disabled = false; }
      return;
    }
    const q = QuestionBank.getById(id);
    if (!q) {
      if (btn) { btn.textContent = '🤖 AI解析此题'; btn.disabled = false; }
      return;
    }

    const el = document.getElementById('ai-key-hint-' + id);
    if (el) el.innerHTML = '';

    const hasAnalysis = q.analysis && q.analysis.trim().length > 5;
    if (hasAnalysis && !confirm('此题已有解析，确定重新AI分析吗？')) {
      if (btn) { btn.textContent = '🔄 AI重新解析'; btn.disabled = false; }
      return;
    }

    this._chatHistory = null;
    App.showToast('AI解析中...', 'info');
    try {
      const results = await ApiConfig.aiAnalyze([{
        id: q.id, title: q.title, type: q.type, options: q.options || [],
      }]);
      if (results.length > 0 && results[0].success) {
        const r = results[0];
        QuestionBank.update(id, { answer: r.answer, analysis: r.analysis });
        const idx = this.questions.findIndex(x => x.id === id);
        if (idx >= 0) {
          this.questions[idx].answer = r.answer;
          this.questions[idx].analysis = r.analysis;
        }
        // 保存对话历史
        this._chatHistory = [
          { role: 'user', content: '请解析这道题：' + q.title },
          { role: 'assistant', content: '答案: ' + r.answer + '\n解析: ' + r.analysis },
        ];
        this.renderQuestion();
        App.updateStats();
        Sync.push().catch(() => {});
      } else {
        if (btn) { btn.textContent = '🤖 AI解析此题'; btn.disabled = false; }
        App.showToast('AI解析失败: ' + (results[0]?.error || '未知错误'), 'error');
      }
    } catch(e) {
      if (btn) { btn.textContent = '🤖 AI解析此题'; btn.disabled = false; }
      App.showToast('AI解析失败: ' + e.message, 'error');
    }
  },

  /** AI追问 */
  async _aiFollowUp(id) {
    const input = document.getElementById('ai-followup-input-' + id);
    if (!input || !input.value.trim()) return;
    const question = input.value.trim();
    input.value = '';
    input.disabled = true;

    const resultDiv = document.getElementById('ai-followup-result-' + id);
    if (resultDiv) resultDiv.innerHTML = '<span style="font-size:11px;color:var(--text-secondary);">AI思考中...</span>';

    try {
      const answer = await ApiConfig.aiFollowUp(this._chatHistory, question);
      if (resultDiv) {
        resultDiv.innerHTML = `<div style="padding:8px;background:#fafafa;border-radius:4px;margin-top:4px;font-size:12px;line-height:1.6;border-left:2px solid var(--primary);">${Utils.escapeHtml(answer)}</div>`;
      }
      this._chatHistory.push({ role: 'user', content: question });
      this._chatHistory.push({ role: 'assistant', content: answer });
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = `<span style="color:var(--danger);font-size:11px;">追问失败: ${Utils.escapeHtml(e.message)}</span>`;
    }
    input.disabled = false;
    input.focus();
  },

  /** 键盘提交追问 */
  _onFollowUpKey(e, id) {
    if (e.key === 'Enter') { e.preventDefault(); this._aiFollowUp(id); }
  },

  /** 展开快速编辑面板 */
  _showEdit(id) {
    const q = QuestionBank.getById(id);
    if (!q) return;
    const div = document.getElementById('edit-area-' + id);
    if (!div) return;
    if (div.innerHTML) { div.innerHTML = ''; return; } // toggle

    const typeOpts = ['single','multiple','judge','fill','essay']
      .map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${App.getTypeName(t)}</option>`).join('');

    div.innerHTML = `
      <div style="padding:10px;background:#fafafa;border-radius:4px;margin-top:4px;font-size:13px;">
        <div style="font-weight:600;margin-bottom:6px;">编辑题目</div>
        <div class="form-group" style="margin-bottom:6px;">
          <label style="font-size:11px;">题型</label>
          <select id="edit-type-${id}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #d9d9d9;">${typeOpts}</select>
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label style="font-size:11px;">正确答案</label>
          <input id="edit-answer-${id}" value="${Utils.escapeHtml(q.answer || '')}" style="width:100%;padding:4px;border-radius:4px;border:1px solid #d9d9d9;">
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label style="font-size:11px;">解析</label>
          <textarea id="edit-analysis-${id}" rows="3" style="width:100%;padding:4px;border-radius:4px;border:1px solid #d9d9d9;">${Utils.escapeHtml(q.analysis || '')}</textarea>
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end;">
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._showEdit('${id}')">取消</button>
          <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();Practice._saveEdit('${id}')">保存</button>
        </div>
      </div>`;
  },

  /** 保存编辑 */
  _saveEdit(id) {
    const type = document.getElementById('edit-type-' + id)?.value;
    const answer = document.getElementById('edit-answer-' + id)?.value || '';
    const analysis = document.getElementById('edit-analysis-' + id)?.value || '';

    if (!answer.trim()) {
      App.showToast('答案不能为空', 'error');
      return;
    }

    QuestionBank.update(id, { type, answer: answer.trim(), analysis: analysis.trim() });
    // 同步更新当前练习缓存
    const idx = this.questions.findIndex(x => x.id === id);
    if (idx >= 0) {
      if (type) this.questions[idx].type = type;
      this.questions[idx].answer = answer.trim();
      this.questions[idx].analysis = analysis.trim();
    }
    this.renderQuestion();
    App.updateStats();
    Sync.push().catch(() => {});
    App.showToast('已保存并同步', 'success');
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
            <div style="margin-top:4px;"><strong>评语：</strong>${Utils.escapeHtml(result.feedback)}</div>
            ${result.correctAnswer ? `<div style="margin-top:4px;"><strong>标准要点：</strong>${Utils.escapeHtml(result.correctAnswer)}</div>` : ''}
          </div>`;
      }
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = `<span style="color:var(--danger);font-size:12px;">批改失败: ${Utils.escapeHtml(e.message)}</span>`;
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
            <div style="margin-top:4px;color:var(--primary);">${Utils.escapeHtml(variant.title)}</div>
            <div style="margin-top:4px;font-size:12px;color:var(--text-secondary);">答案: ${Utils.escapeHtml(variant.answer)} | 分类: ${Utils.escapeHtml(variant.category || q.category)}</div>
          </div>`;
      }
      App.updateStats();
      App.showToast('变体题已加入题库', 'success');
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = `<span style="color:var(--danger);font-size:12px;">生成失败: ${Utils.escapeHtml(e.message)}</span>`;
      App.showToast('变体题生成失败: ' + e.message, 'error');
    }
  },

  /** 不会 — 直接显示答案和解析，记录为错误 */
  dontKnow() {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    // 记录空作答
    this.userAnswers[q.id] = '';

    // 记录到练习日志
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    log.push({
      questionId: q.id,
      userAnswer: '',
      correct: false,
      timestamp: new Date().toISOString(),
      mode: this.mode,
    });
    Storage.set(Storage.KEYS.PRACTICE_LOG, log);

    // 加入错题本
    ErrorNotebook.addError(q.id, '');

    // 直接显示结果
    this.showResult = true;
    this.renderQuestion();
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

    if (this.mode === 'memorize') {
      const area = document.getElementById('practice-area');
      area.innerHTML = `
        <div class="practice-container">
          <div class="practice-question-card" style="text-align:center;">
            <h2 style="margin-bottom:8px;">📖 背题完成</h2>
            <p style="color:var(--text-secondary);margin-bottom:16px;">已浏览 ${total} 道题目</p>
            <div style="display:flex;gap:12px;justify-content:center;">
              <button class="btn btn-primary" onclick="Practice.start('memorize')">再来一轮</button>
              <button class="btn btn-outline" onclick="Practice.exit()">返回</button>
            </div>
          </div>
        </div>`;
      return;
    }

    let correct = 0;
    for (const q of this.questions) {
      const userAnswer = this.userAnswers[q.id] || '';
      if (this.checkAnswer(q, userAnswer)) correct++;
    }

    const accuracy = Math.round((correct / total) * 100);
    const area = document.getElementById('practice-area');
    const modeNames = { sequential:'顺序练习', random:'随机练习', errors:'错题重练', weak:'薄弱知识点', memorize:'背题模式', smart:'智能推荐', challenge:'闯关模式', review:'复习模式', category:'专项练习', assemble:'组卷练习' };

    area.innerHTML = `
      <div class="practice-container">
        <div class="practice-question-card" style="text-align:center;">
          <h2 style="margin-bottom:16px;">${modeNames[this.mode] || '练习'}完成！</h2>
          <div style="font-size:48px;font-weight:700;color:var(--primary);margin-bottom:8px;">${accuracy}%</div>
          <p style="color:var(--text-secondary);margin-bottom:16px;">正确 ${correct}/${total} 题</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="Practice.start('${this.mode}')">再来一轮</button>
            <button class="btn btn-outline" onclick="PracticeReport.showPracticeReport(Practice.questions, Practice.userAnswers, '${this.mode}', Practice._startTime)">📊 详细报告</button>
            <button class="btn btn-outline" onclick="Practice.exit()">返回</button>
          </div>
        </div>
      </div>`;

    StatsWidget.stop();
    // 显示报告（捕获变量避免 setTimeout 中 this 丢失）
    const _questions = this.questions;
    const _userAnswers = this.userAnswers;
    const _mode = this.mode;
    const _startTime = this._startTime;
    if (typeof PracticeReport !== 'undefined') {
      setTimeout(() => PracticeReport.showPracticeReport(_questions, _userAnswers, _mode, _startTime), 400);
    }

    // 闯关模式回调
    if (this.mode === 'challenge' && typeof PracticeModes !== 'undefined') {
      PracticeModes.onChallengeFinish(correct, total);
    }

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
    StatsWidget.stop();
    this.questions = [];
    this.currentIndex = 0;
    this.userAnswers = {};
    this.showResult = false;
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('answer-sheet-container').innerHTML = '';
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
    if (errors.length === 0) return [];

    const allQ = QuestionBank.getAll();
    const qMap = new Map(allQ.map(q => [q.id, q]));

    // 找到对应题目，按错误次数降序排列（原题再现）
    const errQuestions = errors
      .map(e => ({ ...e, question: qMap.get(e.questionId) }))
      .filter(e => e.question) // 只保留题库中存在的题目
      .sort((a, b) => (b.wrongCount || 1) - (a.wrongCount || 1));

    // 取前50道 + 错误最多的3个分类中补充至多30道
    const primary = errQuestions.slice(0, 50).map(e => e.question);

    // 补充同类题目：从错题最多的分类中抽取额外题目
    const usedIds = new Set(primary.map(q => q.id));
    const categoryCount = {};
    errors.forEach(e => {
      const cat = e.questionCategory || '未分类';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const topCats = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    const extra = Utils.shuffle(
      allQ.filter(q => topCats.includes(q.category) && !usedIds.has(q.id))
    ).slice(0, 30);

    return [...primary, ...extra];
  },

  /**
   * 智能推荐模式 — 根据错误次数和最近练习时间加权排序
   */
  _getSmartQuestions() {
    const pool = this._getFilteredPool();
    if (pool.length === 0) return [];

    const errors = ErrorNotebook.getAll();
    const errorMap = new Map();
    errors.forEach(e => { errorMap.set(e.questionId, (errorMap.get(e.questionId) || 0) + 1); });

    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const lastPractice = new Map();
    practiceLog.forEach(p => {
      const t = new Date(p.timestamp).getTime();
      if (!lastPractice.has(p.questionId) || t > lastPractice.get(p.questionId)) {
        lastPractice.set(p.questionId, t);
      }
    });

    const now = Date.now();
    const scored = pool.map(q => {
      const errCount = errorMap.get(q.id) || 0;
      const lastTime = lastPractice.get(q.id) || 0;
      const daysSince = lastTime ? (now - lastTime) / 86400000 : 30;
      const score = errCount * 2 + daysSince;
      return { q, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const limit = Math.min(this.practiceCount || 30, scored.length);
    return scored.slice(0, limit).map(s => s.q);
  },

  // ─── 触摸滑动切换题目 ──────────────────────────

  _bindTouch() {
    const area = document.getElementById('practice-area');
    if (!area) return;
    area.addEventListener('touchstart', (e) => {
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;
    }, { passive: true });
    area.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this._touchStartX;
      const dy = e.changedTouches[0].clientY - this._touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < -30) { // 左滑 → 下一题
          if (this.showResult || this.mode === 'memorize') this.nextQuestion();
          else if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.showResult = this.userAnswers[this.questions[this.currentIndex].id] !== undefined;
            this.renderQuestion();
          }
        } else if (dx > 30) { // 右滑 → 上一题
          if (this.currentIndex > 0) this.prevQuestion();
        }
      }
    }, { passive: true });
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
