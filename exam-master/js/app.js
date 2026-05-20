/**
 * 应用主控制器 - 导航、渲染、全局事件
 */
const App = {
  currentPage: 'dashboard',
  bankPage: 1,
  bankPageSize: 15,

  /**
   * 初始化
   */
  /** 按需加载 pdf.js（仅在用户点击上传PDF时） */
  async _ensurePdfJs() { return ImportController._ensurePdfJs(); },

  async init() {
    // 手机端首次访问时自动从服务器加载题库
    await DataLoader.autoLoad();

    // 首次加载时插入演示数据（仅当题库仍为空）
    this.initDemoData();

    // 跨设备同步：拉取远程数据
    Sync.pull().then(r => {
      if (r.merged > 0) { this.updateStats(); this.renderErrorList(); }
    });

    // 探测后端引擎
    this.detectEngine();

    // 绑定导航事件
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigateTo(page);
      });
    });

    // 更新统计
    this.updateStats();
    this.updateStorageInfo();
    this.updateApiKeyStatus();

    // 渲染默认页面
    this.renderRecentPractice();
    this.renderCategoryChart();
  },

  /**
   * 探测后端解析引擎并更新UI
   */
  async detectEngine() {
    const badge = document.getElementById('engine-badge');
    try {
      const engines = await ApiConfig.getEngineInfo();
      if (engines) {
        const active = Object.entries(engines).find(([, v]) => v.available);
        if (active) {
          badge.textContent = '引擎: ' + active[0];
          badge.style.display = 'inline';
          badge.style.color = 'var(--success)';
          return;
        }
      }
    } catch (e) { /* ignore */ }
    badge.textContent = '引擎: 点击上传加载';
    badge.style.display = 'inline';
    badge.style.color = 'var(--text-secondary)';
  },

  /**
   * 初始化演示数据（仅首次）
   */
    initDemoData() { Dashboard.initDemoData(); },

  /**
   * 页面导航
   */
  navigateTo(page) {
    this.currentPage = page;

    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // 切换页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // 根据页面加载数据
    switch (page) {
      case 'dashboard':
        this.updateStats();
        this.renderRecentPractice();
        this.renderCategoryChart();
        break;
      case 'bank':
        this.renderQuestionBank();
        this.renderImportHistory();
        break;
      case 'errors':
        this.renderErrorList();
        break;
      case 'practice':
        // 保持练习模式选择界面
        break;
      case 'exam':
        // 保持考试设置界面
        break;
      case 'analysis':
        Analysis.render();
        break;
      case 'plan':
        Plan.render();
        break;
    }
  },

  /**
   * 更新统计数字
   */
    updateStats() { Dashboard.updateStats(); },

  /**
   * 更新存储信息
   */
    updateStorageInfo() { Dashboard.updateStorageInfo(); },

  /**
   * 渲染题目列表
   */
  renderQuestionBank() {
    const bank = document.getElementById('bank-bank-filter')?.value || '';
    const keyword = document.getElementById('bank-search')?.value || '';
    const category = document.getElementById('bank-category-filter')?.value || '';
    const type = document.getElementById('bank-type-filter')?.value || '';

    // 根据选中的bank更新分类选项（土木按章节顺序）
    let allQuestions = QuestionBank.getAll();
    if (bank) allQuestions = allQuestions.filter(q => q.bank === bank);
    let categories = [...new Set(allQuestions.map(q => q.category).filter(Boolean))];
    if (bank === 'tumu') {
      const order = QuestionBank.CHAPTER_ORDER;
      categories.sort((a, b) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else {
      categories.sort();
    }
    const catSelect = document.getElementById('bank-category-filter');
    if (catSelect) {
      const prevVal = catSelect.value;
      catSelect.innerHTML = '<option value="">全部分类</option>' +
        categories.map(c => `<option value="${c}" ${c === prevVal ? 'selected' : ''}>${c}</option>`).join('');
    }

    const result = QuestionBank.search({ keyword, category, type, bank, page: this.bankPage, pageSize: this.bankPageSize });
    const container = document.getElementById('bank-list');
    const pagination = document.getElementById('bank-pagination');

    if (result.items.length === 0) {
      container.innerHTML = '<p class="empty-state">未找到匹配的题目，请上传PDF文件或手动添加题目</p>';
      pagination.innerHTML = '';
      return;
    }

    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const practicedSet = new Set(log.map(l => l.questionId));

    container.innerHTML = result.items.map((q, idx) => {
      const globalIdx = (this.bankPage - 1) * this.bankPageSize + idx + 1;
      const missing = (!q.answer || q.answer.trim().length < 1);
      const noAnalysis = (!q.analysis || q.analysis.trim().length < 5);
      const isPracticed = practicedSet.has(q.id);
      const typeIcon = { single: '①', multiple: '②', judge: '③', fill: '④', essay: '⑤' }[q.type] || '●';
      const bankLabel = q.bank === 'gongji' ? '公基' : q.bank === 'tumu' ? '土木' : '';

      return `
      <div class="question-item" onclick="App.showQuestionDetail('${q.id}')">
        <div class="question-num">${globalIdx}</div>
        <div class="question-content">
          <div class="question-title">
            ${Utils.escapeHtml(q.title)}
            ${missing ? '<span class="tag tag-danger">缺答案</span>' : ''}
            ${noAnalysis && !missing ? '<span class="tag tag-warning">缺解析</span>' : ''}
            ${isPracticed ? '<span class="tag tag-done">已练</span>' : ''}
          </div>
          <div class="question-meta">
            <span class="question-tag tag-type">${typeIcon} ${this.getTypeName(q.type)}</span>
            <span class="question-tag tag-category">${q.category || '未分类'}</span>
            ${bankLabel ? `<span class="question-tag tag-bank">${bankLabel}</span>` : ''}
            ${q.difficulty ? `<span class="question-tag tag-difficulty">${q.difficulty}</span>` : ''}
            ${q.answer ? `<span class="answer-hint">答案: ${q.answer.length > 10 ? q.answer.slice(0,10)+'...' : q.answer}</span>` : ''}
          </div>
        </div>
        <div class="question-actions" onclick="event.stopPropagation();">
          ${missing || noAnalysis ? `<button class="btn btn-sm btn-ai-mini" onclick="App.aiAnalyzeSingle('${q.id}')" title="AI解析">🤖</button>` : ''}
          <button class="btn btn-sm btn-edit-mini" onclick="App.editQuestion('${q.id}')" title="编辑">✏️</button>
          <button class="btn btn-sm btn-del-mini" onclick="App.deleteQuestion('${q.id}')" title="删除">🗑</button>
        </div>
      </div>
    `}).join('');

    // 分页
    let pageHtml = '<div class="pagination">';
    if (result.totalPages > 1) {
      const tp = result.totalPages;
      const cp = this.bankPage;

      pageHtml += `<button class="page-btn" onclick="App.goToPage(1)" ${cp===1?'disabled':''}>«</button>`;
      pageHtml += `<button class="page-btn" onclick="App.goToPage(${Math.max(1,cp-1)})" ${cp===1?'disabled':''}>‹</button>`;

      const start = Math.max(1, cp - 2);
      const end = Math.min(tp, cp + 2);
      if (start > 1) pageHtml += `<span class="page-dots">...</span>`;
      for (let i = start; i <= end; i++) {
        pageHtml += `<button class="page-btn ${i === cp ? 'active' : ''}" onclick="App.goToPage(${i})">${i}</button>`;
      }
      if (end < tp) pageHtml += `<span class="page-dots">...</span>`;

      pageHtml += `<button class="page-btn" onclick="App.goToPage(${Math.min(tp,cp+1)})" ${cp===tp?'disabled':''}>›</button>`;
      pageHtml += `<button class="page-btn" onclick="App.goToPage(${tp})" ${cp===tp?'disabled':''}>»</button>`;
      pageHtml += `<span class="page-info">${cp}/${tp} 页 · ${result.total} 题</span>`;
    }
    pageHtml += '</div>';
    pagination.innerHTML = pageHtml;

    // 更新统计栏
    this._updateBankStats(result, bank);
  },

  /**
   * 过滤题目
   */
  filterQuestions() {
    this.bankPage = 1;
    this.renderQuestionBank();
  },

  /**
   * 翻页
   */
  goToPage(page) {
    this.bankPage = page;
    this.renderQuestionBank();
  },

  /** 更新题库统计栏 */
  _updateBankStats(result, bankFilter) {
    const el = document.getElementById('bank-stats-summary');
    if (!el) return;
    const all = QuestionBank.getAll();
    const gj = all.filter(q => q.bank === 'gongji').length;
    const tm = all.filter(q => q.bank === 'tumu').length;
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const practiced = new Set(log.map(l => l.questionId)).size;
    const missing = all.filter(q => !q.answer || !q.answer.trim()).length;
    const parts = [
      `共 <strong>${all.length}</strong> 题 (公基${gj}+土木${tm})`,
      `已练 <strong>${practiced}</strong> 题`,
    ];
    if (missing > 0) parts.push(`<span style="color:var(--danger);">缺答案 ${missing} 题</span>`);
    if (bankFilter) parts.push(`当前: ${bankFilter === 'gongji' ? '公基' : '土木'}`);
    if (result.total !== all.length) parts.push(`匹配 ${result.total} 题`);
    el.innerHTML = parts.join(' &nbsp;|&nbsp; ');
  },

  /**
   * 渲染错题列表
   */
  renderErrorList() {
    const errors = ErrorNotebook.sortByDifficulty(ErrorNotebook.getAll());
    const container = document.getElementById('error-list');

    document.getElementById('error-count').textContent = errors.length;
    document.getElementById('mastered-count').textContent = errors.filter(e => e.mastered).length;
    document.getElementById('review-count').textContent = errors.filter(e => !e.mastered).length;

    if (errors.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无错题，继续保持！</p>';
      return;
    }

    const questions = QuestionBank.getAll();
    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q; });

    container.innerHTML = errors.map((e, idx) => {
      const q = questionMap[e.questionId];
      const title = q ? q.title : e.questionTitle;
      return `
        <div class="question-item" style="${e.mastered ? 'opacity:0.6;' : ''}" onclick="App.showQuestionDetail('${e.questionId}')">
          <div class="question-num">${idx + 1}</div>
          <div class="question-content">
            <div class="question-title">${Utils.escapeHtml(title)}</div>
            <div class="question-meta">
              <span class="question-tag tag-type">${this.getTypeName(e.questionType)}</span>
              <span class="question-tag tag-category">${e.questionCategory || '未分类'}</span>
              <span>错误 <strong>${e.wrongCount}</strong> 次</span>
              <span>正确答案: <strong style="color:var(--success);">${e.correctAnswer}</strong></span>
              <span>你的答案: <strong style="color:var(--danger);">${e.userAnswer || '未作答'}</strong></span>
              ${e.mastered ? '<span style="color:var(--success);">✓ 已掌握</span>' : '<span style="color:var(--warning);">待复习</span>'}
            </div>
          </div>
          <div class="question-actions" onclick="event.stopPropagation();">
            ${!e.mastered ? `<button class="btn btn-outline btn-sm" onclick="ErrorNotebook.markMastered('${e.id}');App.renderErrorList();App.updateStats();">标记掌握</button>` : ''}
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="App.removeError('${e.id}')">移除</button>
          </div>
        </div>`;
    }).join('');
  },

  /**
   * 移除单条错题记录
   */
  removeError(errorId) {
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    Storage.set(Storage.KEYS.ERROR_BOOK, errors.filter(e => e.id !== errorId));
    this.renderErrorList();
    this.updateStats();
    this.showToast('已移除错题记录', 'info');
  },

  /**
   * 处理PDF上传
   */
  async   handlePdfUpload(input) { ImportController.handlePdfUpload(input); },

  /** PDF解析核心逻辑：先批量后逐个 */
  async _processPdfFiles(files) { return ImportController._processPdfFiles(files); },

  /** 导入后处理：记录批次、更新UI、AI补全提示 */
    _finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup) { ImportController._finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup); },

  /** 提示AI补全缺失答案 */
    _promptAiForMissing(importedIds) { ImportController._promptAiForMissing(importedIds); },

  /**
   * 显示题目详情
   */
  /**
   * 渲染导入历史
   */
    renderImportHistory() { ImportController.renderImportHistory(); },

  /**
   * 更新导入汇总
   */
    updateImportSummary(batches) { ImportController._updateImportSummary(batches); },

  /**
   * 删除导入批次
   */
  async   deleteImportBatch(batchId) { ImportController.deleteImportBatch(batchId); },

    showQuestionDetail(id) { UIController.showQuestionDetail(id); },

  /**
   * 显示添加题目模态框
   */
  showAddQuestionModal(editId = null) {
    const isEdit = !!editId;
    const q = isEdit ? QuestionBank.getById(editId) : null;

    document.getElementById('add-modal-title').textContent = isEdit ? '编辑题目' : '添加题目';

    let html = `
      <div class="form-group">
        <label>题型</label>
        <select id="q-type" onchange="App.onTypeChange()">
          <option value="single" ${q && q.type === 'single' ? 'selected' : ''}>单选题</option>
          <option value="multiple" ${q && q.type === 'multiple' ? 'selected' : ''}>多选题</option>
          <option value="judge" ${q && q.type === 'judge' ? 'selected' : ''}>判断题</option>
          <option value="fill" ${q && q.type === 'fill' ? 'selected' : ''}>填空题</option>
          <option value="essay" ${q && q.type === 'essay' ? 'selected' : ''}>问答题</option>
        </select>
      </div>
      <div class="form-group">
        <label>题目内容</label>
        <textarea id="q-title" rows="3" placeholder="请输入题目内容...">${q ? Utils.escapeHtml(q.title) : ''}</textarea>
      </div>
      <div class="form-group" id="options-container" style="display:${q && (q.type === 'essay' || q.type === 'fill') ? 'none' : 'block'};">
        <label>选项 <small>(点击选项前字母标记正确答案)</small></label>
        <div class="options-editor" id="options-editor">
          ${this.renderOptionsEditor(q)}
        </div>
        <button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="App.addOptionRow()" id="add-option-btn">+ 添加选项</button>
      </div>
      <div class="form-group">
        <label>正确答案 <small>(单选题填A/B/C...，多选题如"ABD"，判断题填"A=对/B=错"，填空/简答填答案文本)</small></label>
        <input type="text" id="q-answer" value="${q ? q.answer : ''}" placeholder="如: A 或 ABD 或 正确答案文本">
      </div>
      <div class="form-group">
        <label>解析 <small>(选填)</small></label>
        <textarea id="q-analysis" rows="3" placeholder="题目解析...">${q ? q.analysis || '' : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>分类</label>
          <input type="text" id="q-category" value="${q ? q.category || '' : ''}" placeholder="如: 数学、英语、计算机..." list="category-list">
          <datalist id="category-list">
            ${QuestionBank.getCategories().map(c => `<option value="${c}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label>难度</label>
          <select id="q-difficulty">
            <option value="简单" ${q && q.difficulty === '简单' ? 'selected' : ''}>简单</option>
            <option value="中等" ${q && q.difficulty === '中等' ? 'selected' : ''} selected>中等</option>
            <option value="困难" ${q && q.difficulty === '困难' ? 'selected' : ''}>困难</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-outline" onclick="App.closeAddModal()">取消</button>
        <button class="btn btn-primary" onclick="App.saveQuestion('${editId || ''}')">${isEdit ? '保存修改' : '添加题目'}</button>
      </div>`;

    document.getElementById('add-modal-body').innerHTML = html;
    document.getElementById('add-modal-overlay').style.display = 'flex';
  },

  /**
   * 渲染选项编辑器
   */
  renderOptionsEditor(q) {
    if (!q || !q.options || q.options.length === 0) {
      // 默认4个选项
      return ['A', 'B', 'C', 'D'].map(l => `
        <div class="option-editor-row">
          <input type="checkbox" class="option-correct-toggle" title="标记正确答案" checked>
          <strong style="width:20px;text-align:center;">${l}</strong>
          <input type="text" class="option-text" placeholder="选项${l}内容...">
        </div>`).join('');
    }

    return q.options.map(opt => `
      <div class="option-editor-row">
        <input type="checkbox" class="option-correct-toggle" title="标记正确答案" ${q.answer.includes(opt.label) ? 'checked' : ''}>
        <strong style="width:20px;text-align:center;">${opt.label}</strong>
        <input type="text" class="option-text" value="${Utils.escapeHtml(opt.text)}" placeholder="选项${opt.label}内容...">
      </div>`).join('');
  },

  /**
   * 添加选项行
   */
    addOptionRow() { UIController.addOptionRow(); },

  /**
   * 题型切换
   */
    onTypeChange() { UIController.onTypeChange(); },

  /**
   * 保存题目
   */
  saveQuestion(editId) {
    const type = document.getElementById('q-type').value;
    const title = document.getElementById('q-title').value.trim();
    const rawAnswer = document.getElementById('q-answer').value.trim();
    const answer = ['single','multiple','judge'].includes(type) ? rawAnswer.toUpperCase() : rawAnswer;
    const analysis = document.getElementById('q-analysis').value.trim();
    const category = document.getElementById('q-category').value.trim();
    const difficulty = document.getElementById('q-difficulty').value;

    if (!title) { this.showToast('请输入题目内容', 'error'); return; }
    if (!answer) { this.showToast('请输入正确答案', 'error'); return; }

    let options = [];
    const optionsContainer = document.getElementById('options-container');
    if (optionsContainer.style.display !== 'none') {
      const rows = document.querySelectorAll('#options-editor .option-editor-row');
      rows.forEach((row, i) => {
        const label = String.fromCharCode(65 + i);
        const text = row.querySelector('.option-text').value.trim();
        if (text) options.push({ label, text });
      });
    }

    // 判断题自动设置选项
    if (type === 'judge' && options.length === 0) {
      options = [
        { label: 'A', text: '正确' },
        { label: 'B', text: '错误' },
      ];
    }

    const question = {
      title, type, options, answer, analysis, category, difficulty,
      source: 'manual',
    };

    if (editId) {
      const success = QuestionBank.update(editId, question);
      if (success) {
        this.showToast('题目已更新', 'success');
      } else {
        this.showToast('更新失败', 'error');
      }
    } else {
      const result = QuestionBank.add(question);
      if (result.success) {
        this.showToast('题目已添加', 'success');
      } else {
        this.showToast(result.message, 'error');
        if (result.duplicate) {
          // 不关闭模态框，让用户修改
          return;
        }
      }
    }

    this.closeAddModal();
    this.renderQuestionBank();
    this.updateStats();
  },

  /**
   * 编辑题目
   */
  editQuestion(id) {
    this.showAddQuestionModal(id);
  },

  /**
   * 删除题目
   */
  deleteQuestion(id) {
    if (!confirm('确定要删除这道题目吗？相关的错题记录也会被移除。')) return;
    QuestionBank.remove(id);
    this.renderQuestionBank();
    this.updateStats();
    this.showToast('题目已删除', 'info');
  },

  /**
   * 渲染最近练习记录
   */
    renderRecentPractice() { Dashboard.renderRecentPractice(); },

  /**
   * 渲染分类统计
   */
    renderCategoryChart() { Dashboard.renderCategoryChart(); },

  /**
   * 关闭详情模态框
   */
    closeModal() { UIController.closeModal(); },

  /**
   * 关闭添加模态框
   */
  closeAddModal() {
    document.getElementById('add-modal-overlay').style.display = 'none';
  },

  /**
   * 显示Toast通知
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  /**
   * 获取题型名称
   */
  getTypeName(type) {
    const names = {
      single: '单选题',
      multiple: '多选题',
      judge: '判断题',
      fill: '填空题',
      essay: '问答题',
    };
    return names[type] || type;
  },

  // ─── DeepSeek API Key 管理 ─────────────────────────

    showApiKeyModal() { UIController.showApiKeyModal(); },

  closeApiKeyModal() {
    document.getElementById('apikey-modal-overlay').style.display = 'none';
  },

  saveApiKey() {
    const dsKey = document.getElementById('apikey-input').value.trim();
    const ghKey = document.getElementById('github-token-input')?.value.trim() || '';

    let saved = 0;
    if (dsKey) {
      if (!dsKey.startsWith('sk-')) {
        this.showToast('DeepSeek Key 格式不正确，应以 sk- 开头', 'error');
        return;
      }
      ApiConfig.setDeepSeekApiKey(dsKey);
      saved++;
    }
    if (ghKey) {
      Sync.setToken(ghKey);
      saved++;
    }

    this.updateApiKeyStatus();
    this.closeApiKeyModal();
    if (saved > 0) {
      this.showToast('设置已保存' + (ghKey ? '（含同步Token）' : ''), 'success');
    } else {
      this.showToast('请至少填写一个 Key', 'error');
    }
  },

  clearAllKeys() {
    if (!confirm('确定清除所有 API Key 和同步 Token 吗？')) return;
    ApiConfig.setDeepSeekApiKey('');
    Sync.setToken('');
    this.updateApiKeyStatus();
    this.closeApiKeyModal();
    this.showToast('全部已清除', 'info');
  },

  updateApiKeyStatus() {
    const el = document.getElementById('api-key-status');
    const link = document.querySelector('.api-key-link');
    if (!el || !link) return;
    if (ApiConfig.hasDeepSeekApiKey() || Sync.hasToken()) {
      const parts = [];
      if (ApiConfig.hasDeepSeekApiKey()) parts.push('AI');
      if (Sync.hasToken()) parts.push('Sync');
      el.textContent = parts.join('/') + ' ✓';
      link.classList.add('configured');
    } else {
      el.textContent = 'AI/Sync';
      link.classList.remove('configured');
    }
  },

  // ─── AI 智能解析 ───────────────────────────────────

  /**
   * 查找缺少答案/解析的题目并批量AI分析
   */
  async aiAnalyzeMissing() {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      this.showToast('请先配置DeepSeek API Key（点击侧边栏底部"AI Key"）', 'error');
      this.showApiKeyModal();
      return;
    }

    const all = QuestionBank.getAll();
    const missing = all.filter(q => !q.answer || !q.analysis);

    if (missing.length === 0) {
      this.showToast('所有题目都已有答案和解析', 'info');
      return;
    }

    if (!confirm(`发现 ${missing.length} 道题目缺少答案或解析，是否使用AI智能分析补全？\n\n（每道题约需2-5秒，请耐心等待）`)) return;

    Loading.progress('AI 智能解析中...');
    this.showAiProgress(missing.length);

    try {
      const questions = missing.map(q => ({
        id: q.id,
        title: q.title,
        type: q.type,
        options: q.options || [],
      }));

      const results = await ApiConfig.aiAnalyze(questions, (current, total) => {
        this.updateAiProgress(current, total, missing[current - 1]?.title || '');
      });

      const applied = this.applyAiResults(results);
      Loading.hide();
      this.closeAiProgress();
      this.renderQuestionBank();
      this.updateStats();
      this.showToast(`AI分析完成：成功 ${applied.success} 道，失败 ${applied.failed} 道`, applied.failed > 0 ? 'info' : 'success');
    } catch (e) {
      Loading.hide();
      this.closeAiProgress();
      this.showToast('AI分析失败: ' + e.message, 'error');
    }
  },

  /**
   * AI分析单道题目
   */
  async aiAnalyzeSingle(id) {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      this.showToast('请先配置DeepSeek API Key', 'error');
      this.showApiKeyModal();
      return;
    }

    const q = QuestionBank.getById(id);
    if (!q) return;

    this.closeModal();
    Loading.progress('AI 解析中...');

    try {
      const results = await ApiConfig.aiAnalyze([{
        id: q.id, title: q.title, type: q.type, options: q.options || [],
      }]);

      Loading.hide();
      if (results.length > 0 && results[0].success) {
        const r = results[0];
        QuestionBank.update(id, { answer: r.answer, analysis: r.analysis });
        this.renderQuestionBank();
        this.updateStats();
        this.showToast('AI解析完成！', 'success');
        this.showQuestionDetail(id);
      } else {
        this.showToast('AI分析失败: ' + (results[0]?.error || '未知错误'), 'error');
      }
    } catch (e) {
      Loading.hide();
      this.showToast('AI分析失败: ' + e.message, 'error');
    }
  },

  /**
   * 显示AI分析进度
   */
  showAiProgress(total) { UIController.showAiProgress(total); },

  /**
   * 更新AI分析进度
   */
  updateAiProgress(current, total, title) {
    const item = document.getElementById(`ai-item-${current - 1}`);
    if (item) {
      item.querySelector('.ai-progress-status').className = 'ai-progress-status running';
      item.querySelector('.ai-progress-status').textContent = '⏳';
      item.querySelector('.ai-progress-title').textContent = title.substring(0, 60);
    }

    // 标记已完成的
    for (let i = 0; i < current - 1; i++) {
      const prevItem = document.getElementById(`ai-item-${i}`);
      if (prevItem) {
        prevItem.querySelector('.ai-progress-status').className = 'ai-progress-status done';
        prevItem.querySelector('.ai-progress-status').textContent = '✓';
      }
    }

    const summary = document.getElementById('ai-progress-summary');
    if (summary) summary.textContent = `正在分析... ${current} / ${total}`;
  },

  /**
   * 关闭AI分析进度
   */
    closeAiProgress() { UIController.closeAiProgress(); },

  /**
   * 将AI分析结果应用到题库
   */
  applyAiResults(results) {
    let success = 0;
    let failed = 0;

    // 更新进度条最终状态
    for (const r of results) {
      const idx = results.indexOf(r);
      const item = document.getElementById(`ai-item-${idx}`);
      if (item) {
        if (r.success) {
          item.querySelector('.ai-progress-status').className = 'ai-progress-status done';
          item.querySelector('.ai-progress-status').textContent = '✓';
        } else {
          item.querySelector('.ai-progress-status').className = 'ai-progress-status failed';
          item.querySelector('.ai-progress-status').textContent = '✗';
          item.querySelector('.ai-progress-title').textContent += ` (${r.error || '失败'})`;
        }
      }
    }

    const summary = document.getElementById('ai-progress-summary');
    if (summary) summary.textContent = `分析完成: 成功 ${results.filter(r => r.success).length} 道，失败 ${results.filter(r => !r.success).length} 道`;

    document.getElementById('ai-progress-close').style.display = 'block';

    // 应用结果
    for (const r of results) {
      if (r.success && r.id) {
        const updated = QuestionBank.update(r.id, { answer: r.answer, analysis: r.analysis });
        if (updated) success++;
        else failed++;
      } else {
        failed++;
      }
    }

    return { success, failed };
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());

// 暴露全局变量
window.App = App;
window.Practice = Practice;
window.Exam = Exam;
window.ErrorNotebook = ErrorNotebook;
window.QuestionBank = QuestionBank;
window.Dedup = Dedup;
window.Analysis = Analysis;
