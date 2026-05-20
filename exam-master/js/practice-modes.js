/**
 * 练习模式扩展 — 专项练习 / 组卷练习 / 闯关模式 / 复习模式
 *
 * 所有方法挂载到 window.PracticeModes，供 Practice.start() 和内联 onclick 调用。
 * 依赖: QuestionBank, ErrorNotebook, DataStore, Practice, Feedback
 */

const PracticeModes = {

  // ═══════════════════════════════════════════════════
  // 1. 专项练习（按知识点/章节标签）
  // ═══════════════════════════════════════════════════

  /** 获取所有可用的知识点/章节标签及其统计 */
  getCategoryStats() {
    const all = QuestionBank.getAll();
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const errors = ErrorNotebook.getAll();

    const stats = {};
    all.forEach(q => {
      const cat = q.category || '未分类';
      if (!stats[cat]) stats[cat] = { total: 0, done: 0, correct: 0, errors: 0, label: cat };
      stats[cat].total++;
    });

    // 练习统计
    const qMap = new Map(all.map(q => [q.id, q]));
    const doneSet = new Set();
    log.forEach(l => {
      const q = qMap.get(l.questionId);
      if (!q) return;
      const cat = q.category || '未分类';
      if (stats[cat]) {
        if (!doneSet.has(l.questionId)) {
          stats[cat].done++;
          doneSet.add(l.questionId);
        }
        if (l.correct) stats[cat].correct++;
      }
    });

    // 错题统计
    errors.forEach(e => {
      const cat = e.questionCategory || '未分类';
      if (stats[cat]) stats[cat].errors++;
    });

    // 计算正确率
    Object.values(stats).forEach(s => {
      s.accuracy = s.done > 0 ? Math.round(s.correct / s.done * 100) : 0;
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  },

  /** 启动专项练习（按分类标签） */
  startCategoryPractice(category, typeFilter = 'all') {
    let pool = QuestionBank.getAll().filter(q => (q.category || '未分类') === category);
    if (typeFilter !== 'all') pool = pool.filter(q => q.type === typeFilter);
    if (pool.length === 0) {
      Feedback.showToast(`"${category}" 下暂无题目`, 'warning');
      return;
    }
    Practice.categoryFilter = category;
    Practice.typeFilter = typeFilter;
    Practice.questions = Utils.shuffle([...pool]);
    Practice.currentIndex = 0;
    Practice.mode = 'category';
    Practice.userAnswers = {};
    Practice.showResult = false;
    Practice.startWithQuestions(Practice.questions, 'category');
    Feedback.showToast(`专项练习: ${category} (${pool.length}题)`, 'info');
  },

  // ═══════════════════════════════════════════════════
  // 2. 组卷练习（自定义混合）
  // ═══════════════════════════════════════════════════

  /** 保存组卷模板 */
  saveTemplate(name, config) {
    const templates = this._getTemplates();
    templates.push({ id: Utils.generateId('tpl_'), name, config, createdAt: new Date().toISOString() });
    localStorage.setItem('exam_templates', JSON.stringify(templates));
    Feedback.showToast('模板已保存', 'success');
  },

  _getTemplates() {
    try { return JSON.parse(localStorage.getItem('exam_templates') || '[]'); } catch (_) { return []; }
  },

  getTemplates() { return this._getTemplates(); },

  deleteTemplate(id) {
    const templates = this._getTemplates().filter(t => t.id !== id);
    localStorage.setItem('exam_templates', JSON.stringify(templates));
  },

  /** 根据组卷配置生成题目集 */
  assembleExam(config) {
    const all = QuestionBank.getAll();
    let pool = [...all];

    // 按题库筛选
    if (config.bank && config.bank !== 'all') {
      pool = pool.filter(q => q.bank === config.bank);
    }

    // 按分类筛选（多选）
    if (config.categories && config.categories.length > 0) {
      pool = pool.filter(q => config.categories.includes(q.category || '未分类'));
    }

    const result = [];
    const typeConfigs = config.types || [
      { type: 'single', count: 10 },
      { type: 'multiple', count: 5 },
      { type: 'judge', count: 5 },
    ];

    const usedIds = new Set();

    typeConfigs.forEach(tc => {
      const typePool = pool.filter(q => q.type === tc.type && !usedIds.has(q.id));
      const selected = Utils.shuffle(typePool).slice(0, tc.count || 0);
      selected.forEach(q => usedIds.add(q.id));
      result.push(...selected);
    });

    return Utils.shuffle(result);
  },

  /** 启动组卷练习 */
  startAssemble(config) {
    const questions = this.assembleExam(config);
    if (questions.length === 0) {
      Feedback.showToast('没有匹配的题目，请调整筛选条件', 'warning');
      return;
    }
    Practice.questions = questions;
    Practice.currentIndex = 0;
    Practice.mode = 'assemble';
    Practice.userAnswers = {};
    Practice.showResult = false;
    Practice.startWithQuestions(questions, 'assemble');
    Feedback.showToast(`组卷练习: ${questions.length}题`, 'info');
  },

  /** 渲染组卷设置模态框 */
  showAssembleModal() {
    Modal.show({
      title: '📋 组卷练习',
      size: 'lg',
      body: this._assembleModalHTML(),
      onReady: () => {
        document.getElementById('assemble-save-btn').onclick = () => {
          const config = this._readAssembleConfig();
          const name = prompt('模板名称:') || '默认模板';
          this.saveTemplate(name, config);
        };
        document.getElementById('assemble-start-btn').onclick = () => {
          Modal.close();
          this.startAssemble(this._readAssembleConfig());
        };
        this._renderTemplateList();
      },
    });
  },

  _assembleModalHTML() {
    const all = QuestionBank.getAll();
    const banks = [...new Set(all.map(q => q.bank).filter(Boolean))];
    const cats = [...new Set(all.map(q => q.category).filter(Boolean))].sort();
    const types = ['single', 'multiple', 'judge', 'fill', 'essay'];
    const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', fill: '填空题', essay: '简答题' };

    let h = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <label style="font-weight:600;display:block;margin-bottom:4px;">题库</label>
          <select id="asm-bank" style="width:100%;padding:8px;border-radius:6px;border:1px solid #d9d9d9;">
            <option value="all">全部题库</option>
            ${banks.map(b => `<option value="${b}">${b === 'gongji' ? '公基' : b === 'tumu' ? '土木' : b}</option>`).join('')}
          </select>
        </div>
        <div style="flex:2;min-width:250px;">
          <label style="font-weight:600;display:block;margin-bottom:4px;">分类（可多选，留空=全部）</label>
          <div style="max-height:120px;overflow-y:auto;border:1px solid #d9d9d9;border-radius:6px;padding:8px;">
            ${cats.map(c => `<label style="display:block;font-size:13px;cursor:pointer;padding:2px 0;"><input type="checkbox" class="asm-cat" value="${Utils.escapeHtml(c)}"> ${Utils.escapeHtml(c)}</label>`).join('')}
          </div>
        </div>
      </div>
      <div style="margin-top:14px;">
        <label style="font-weight:600;display:block;margin-bottom:8px;">题型与数量</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${types.map((t, i) => `
            <div style="flex:1;min-width:100px;text-align:center;padding:8px;border:1px solid #d9d9d9;border-radius:8px;">
              <div style="font-size:12px;color:#666;margin-bottom:4px;">${typeNames[t]}</div>
              <input type="number" class="asm-type-count" data-type="${t}" value="${[10,5,5,2,1][i]}" min="0" max="100" style="width:60px;text-align:center;padding:4px;border-radius:4px;border:1px solid #d9d9d9;">
            </div>
          `).join('')}
        </div>
      </div>
      <div style="margin-top:14px;">
        <label style="font-weight:600;display:block;margin-bottom:4px;">保存的模板</label>
        <div id="template-list" style="font-size:13px;color:#999;">加载中...</div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-outline" id="assemble-save-btn">💾 保存模板</button>
        <button class="btn btn-primary" id="assemble-start-btn">开始组卷</button>
      </div>`;
    return h;
  },

  _readAssembleConfig() {
    const bank = document.getElementById('asm-bank')?.value || 'all';
    const catChecks = document.querySelectorAll('.asm-cat:checked');
    const categories = Array.from(catChecks).map(cb => cb.value);
    const typeEls = document.querySelectorAll('.asm-type-count');
    const types = Array.from(typeEls)
      .map(el => ({ type: el.dataset.type, count: parseInt(el.value) || 0 }))
      .filter(t => t.count > 0);
    return { bank, categories, types };
  },

  _renderTemplateList() {
    const templates = this.getTemplates();
    const el = document.getElementById('template-list');
    if (!el) return;
    if (templates.length === 0) { el.textContent = '暂无模板'; return; }
    el.innerHTML = templates.map(t => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;">
        <span style="flex:1;cursor:pointer;color:#1890ff;" onclick="PracticeModes._loadTemplate('${t.id}')">${Utils.escapeHtml(t.name)}</span>
        <span style="font-size:11px;color:#999;">${(t.config.types || []).map(x => x.type + '×' + x.count).join(', ') || 'N/A'}</span>
        <button class="btn-del-mini" onclick="PracticeModes.deleteTemplate('${t.id}');PracticeModes._renderTemplateList();">×</button>
      </div>`).join('');
  },

  _loadTemplate(id) {
    const t = this.getTemplates().find(x => x.id === id);
    if (!t) return;
    // 填写配置到表单
    if (t.config.bank) {
      const sel = document.getElementById('asm-bank');
      if (sel) sel.value = t.config.bank;
    }
    if (t.config.categories) {
      document.querySelectorAll('.asm-cat').forEach(cb => {
        cb.checked = t.config.categories.includes(cb.value);
      });
    }
    if (t.config.types) {
      document.querySelectorAll('.asm-type-count').forEach(el => {
        const tc = t.config.types.find(x => x.type === el.dataset.type);
        if (tc) el.value = tc.count;
      });
    }
    Feedback.showToast(`模板 "${t.name}" 已加载`, 'info');
  },

  // ═══════════════════════════════════════════════════
  // 3. 闯关模式（积分/等级/关卡地图）
  // ═══════════════════════════════════════════════════

  /** 获取闯关状态 */
  getChallengeState() {
    try {
      return JSON.parse(localStorage.getItem('challenge_state') || 'null') || {
        currentLevel: 1, history: [], totalStars: 0
      };
    } catch (_) { return { currentLevel: 1, history: [], totalStars: 0 }; }
  },

  _saveChallengeState(state) { localStorage.setItem('challenge_state', JSON.stringify(state)); },

  /** 每关题量递进 */
  _levelSize(level) { return Math.min(8 + level * 3, 50); },

  /** 生成当前关卡题目 */
  _generateChallengeLevel(level) {
    const count = this._levelSize(level);
    const all = QuestionBank.getAll();
    const errors = ErrorNotebook.getAll();
    const errorMap = new Map();
    errors.forEach(e => { errorMap.set(e.questionId, (errorMap.get(e.questionId) || 0) + 1); });

    // 优先出错题多的知识点
    const pool = [...all].sort((a, b) => {
      const ea = errorMap.get(a.id) || 0;
      const eb = errorMap.get(b.id) || 0;
      if (ea !== eb) return eb - ea;
      // 其次偏好更高难度
      const diffOrder = { '困难': 3, '中等': 2, '简单': 1 };
      return (diffOrder[b.difficulty] || 2) - (diffOrder[a.difficulty] || 2);
    });

    if (pool.length <= count) return Utils.shuffle(pool);
    // 取前 70% 高优先级 + 后 30% 随机混入
    const topN = Math.floor(count * 0.7);
    const top = pool.slice(0, Math.max(topN, count));
    const selected = Utils.shuffle(top).slice(0, count);
    return selected;
  },

  /** 启动/继续闯关 */
  startChallenge() {
    const state = this.getChallengeState();
    const questions = this._generateChallengeLevel(state.currentLevel);
    if (questions.length === 0) {
      Feedback.showToast('题库为空，请先导入题目', 'warning');
      return;
    }
    Practice.questions = questions;
    Practice.currentIndex = 0;
    Practice.mode = 'challenge';
    Practice.userAnswers = {};
    Practice.showResult = false;
    Practice.startWithQuestions(questions, 'challenge');
    Feedback.showToast(`🏆 第 ${state.currentLevel} 关 · ${questions.length} 题`, 'info');
  },

  /** 闯关完成回调（由 Practice.finish 调用） */
  onChallengeFinish(correct, total) {
    const acc = Math.round(correct / total * 100);
    const state = this.getChallengeState();
    const passed = acc >= 80;

    // 星级评定
    let stars = 0;
    if (acc >= 95) stars = 3;
    else if (acc >= 85) stars = 2;
    else if (acc >= 80) stars = 1;

    state.history.push({
      level: state.currentLevel,
      date: new Date().toISOString(),
      correct, total, accuracy: acc, stars, passed,
    });
    state.totalStars += stars;

    if (passed) {
      state.currentLevel++;
      Feedback.showToast(`🎉 通关！获得 ${stars} 星 · 进入第 ${state.currentLevel} 关`, 'success');
    } else {
      Feedback.showToast(`未通过（需 80%），当前正确率 ${acc}%，请重试`, 'warning');
    }
    this._saveChallengeState(state);
    PracticeReport.showChallengeResult(correct, total, state.currentLevel, passed, stars);
  },

  /** 渲染关卡地图 */
  renderChallengeMap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const state = this.getChallengeState();
    const maxShow = Math.max(state.currentLevel + 3, 12);

    const historyMap = new Map();
    state.history.forEach(h => historyMap.set(h.level, h));

    let h = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
    for (let lv = 1; lv <= maxShow; lv++) {
      const record = historyMap.get(lv);
      const unlocked = lv <= state.currentLevel;
      const stars = record ? record.stars : 0;
      const color = !unlocked ? '#e0e0e0'
        : stars >= 3 ? '#ffc107' : stars >= 2 ? '#b0bec5' : stars >= 1 ? '#cd7f32' : '#667eea';
      h += `<div style="width:56px;height:56px;border-radius:12px;background:${color};
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        color:#fff;font-weight:700;cursor:${unlocked?'pointer':'default'};opacity:${unlocked?1:0.5};
        font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);"
        ${unlocked ? `onclick="PracticeModes.startChallengeLevel(${lv})"` : ''}
        title="第${lv}关${record ? ' · '+record.accuracy+'%' : ''}">
        <span style="font-size:16px;">${lv <= state.currentLevel - 1 ? '★' : lv}</span>
        <span style="font-size:9px;">${stars ? '★'.repeat(stars) : '—'}</span>
      </div>`;
    }
    h += '</div>';
    container.innerHTML = h;
  },

  /** 从指定关卡开始（重玩） */
  startChallengeLevel(level) {
    const state = this.getChallengeState();
    if (level > state.currentLevel) return;
    state.currentLevel = level;
    this._saveChallengeState(state);
    this.startChallenge();
  },

  // ═══════════════════════════════════════════════════
  // 4. 复习模式（SM-2 间隔重复）
  // ═══════════════════════════════════════════════════

  /** 获取今日应复习的题目（基于 SM-2 调度） */
  getDueReviews() {
    return ErrorNotebook.getDueReviews();
  },

  /** 获取今日应复习数量 */
  getDueReviewCount() {
    return ErrorNotebook.getDueReviews().length;
  },

  /** 启动今日复习 */
  startReview() {
    const due = this.getDueReviews();
    if (due.length === 0) {
      Feedback.showToast('今日无待复习题目，太棒了！', 'success');
      return;
    }
    const questions = due.map(d => d.question).filter(Boolean);
    const sm2Data = {};
    due.forEach(d => { if (d.question) sm2Data[d.question.id] = d; });

    Practice.questions = questions;
    Practice.currentIndex = 0;
    Practice.mode = 'review';
    Practice.userAnswers = {};
    Practice.showResult = false;
    Practice._reviewSM2Data = sm2Data;
    Practice.startWithQuestions(questions, 'review');
    Feedback.showToast(`📖 今日复习: ${questions.length} 题`, 'info');
  },

  /** 复习模式下提交答案后更新 SM-2 状态（由 Practice.submitAnswer 调用） */
  updateSM2AfterReview(questionId, correct) {
    const errors = ErrorNotebook.getAll();
    const err = errors.find(e => e.questionId === questionId);
    if (!err) return;
    const quality = correct ? (Practice._lastAnswerTime < 3000 ? 5 : 4) : 1;
    ErrorNotebook.recordReview(err.id, correct);
  },
};

window.PracticeModes = PracticeModes;
