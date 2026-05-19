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
  async init() {
    // 设置PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

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
    badge.textContent = '引擎: PDF.js (浏览器)';
    badge.style.display = 'inline';
    badge.style.color = 'var(--text-secondary)';
  },

  /**
   * 初始化演示数据（仅首次）
   */
  initDemoData() {
    if (Storage.get(Storage.KEYS.QUESTIONS)) return;

    const demoQuestions = [
      { title:'以下哪个是HTTP状态码中"未找到"的含义？', type:'single', options:[{label:'A',text:'200'},{label:'B',text:'301'},{label:'C',text:'404'},{label:'D',text:'500'}], answer:'C', analysis:'404 Not Found 表示服务器无法找到请求的资源。200表示成功，301表示永久重定向，500表示服务器内部错误。', category:'计算机网络', difficulty:'简单' },
      { title:'TCP协议中，三次握手的目的是什么？', type:'single', options:[{label:'A',text:'传输数据'},{label:'B',text:'建立可靠连接'},{label:'C',text:'关闭连接'},{label:'D',text:'加密通信'}], answer:'B', analysis:'TCP三次握手的目的是在通信双方之间建立可靠的连接，同步序列号，确保双方都能发送和接收数据。', category:'计算机网络', difficulty:'中等' },
      { title:'下列哪些属于NoSQL数据库？', type:'multiple', options:[{label:'A',text:'MongoDB'},{label:'B',text:'MySQL'},{label:'C',text:'Redis'},{label:'D',text:'Cassandra'}], answer:'ACD', analysis:'MongoDB是文档型NoSQL，Redis是键值存储NoSQL，Cassandra是列族NoSQL。MySQL是关系型数据库。', category:'数据库', difficulty:'中等' },
      { title:'JavaScript中，===运算符会进行类型转换后再比较。', type:'judge', options:[{label:'A',text:'正确'},{label:'B',text:'错误'}], answer:'B', analysis:'===是严格相等运算符，不会进行类型转换。== 才会进行类型转换后再比较。', category:'前端开发', difficulty:'简单' },
      { title:'CSS中，以下哪个属性用于设置元素的外边距？', type:'single', options:[{label:'A',text:'padding'},{label:'B',text:'margin'},{label:'C',text:'border'},{label:'D',text:'outline'}], answer:'B', analysis:'margin 设置元素的外边距（元素边框外的空间），padding 设置内边距（内容与边框之间的空间）。', category:'前端开发', difficulty:'简单' },
      { title:'在Python中，列表(list)和元组(tuple)的主要区别是什么？', type:'single', options:[{label:'A',text:'列表有序，元组无序'},{label:'B',text:'列表可变，元组不可变'},{label:'C',text:'列表可以包含不同类型，元组不可以'},{label:'D',text:'没有区别'}], answer:'B', analysis:'列表是可变的（可以增删改元素），元组是不可变的（创建后不能修改）。两者都是有序的，都可以包含不同类型的元素。', category:'Python', difficulty:'简单' },
      { title:'下列关于RESTful API设计的描述，正确的有哪些？', type:'multiple', options:[{label:'A',text:'使用HTTP动词表示操作类型'},{label:'B',text:'所有请求都应该使用POST方法'},{label:'C',text:'URL应该使用名词而非动词'},{label:'D',text:'状态信息应保存在服务端Session中'}], answer:'AC', analysis:'RESTful的核心原则：使用HTTP动词(GET/POST/PUT/DELETE)表示操作，URL使用名词表示资源，服务端应为无状态（客户端保存会话状态）。', category:'后端开发', difficulty:'中等' },
      { title:'算法的空间复杂度是指算法执行所需的____空间。', type:'fill', options:[], answer:'存储（内存）', analysis:'空间复杂度衡量算法运行过程中临时占用的存储空间大小，包括算法本身、输入数据和额外辅助空间。', category:'数据结构与算法', difficulty:'中等' },
      { title:'什么是闭包（Closure）？请简要说明其原理和应用场景。', type:'essay', options:[], answer:'闭包是指函数能够访问其外部作用域中的变量，即使外部函数已经返回。原理是内部函数维持对外部函数作用域的引用。常用于数据封装、回调函数、模块模式等。', analysis:'闭包的核心是函数作用域链：内部函数保留了对外部函数变量对象的引用，阻止垃圾回收。常见应用：私有变量、工厂函数、事件处理器、异步编程中的回调。', category:'前端开发', difficulty:'困难' },
      { title:'Git中，git merge和git rebase的主要区别是什么？', type:'single', options:[{label:'A',text:'merge会保留分支历史，rebase会创建线性历史'},{label:'B',text:'merge更快，rebase更慢'},{label:'C',text:'merge只能用于本地分支'},{label:'D',text:'rebase会丢失所有提交'}], answer:'A', analysis:'merge 创建一个新的合并提交，保留完整的分支历史。rebase 将当前分支的提交"移植"到目标分支之上，创建线性历史，但会改写提交记录。', category:'DevOps', difficulty:'中等' },
      { title:'在SQL中，以下哪些操作会使用索引？', type:'multiple', options:[{label:'A',text:'WHERE子句中的条件列'},{label:'B',text:'ORDER BY排序列'},{label:'C',text:'SELECT后的列名'},{label:'D',text:'JOIN的连接列'}], answer:'ABD', analysis:'索引主要用于加速WHERE过滤、ORDER BY排序和JOIN连接操作。单纯SELECT后面的列名不会直接使用索引（除非是覆盖索引场景）。', category:'数据库', difficulty:'中等' },
      { title:'Docker容器的数据在容器删除后仍然保留。', type:'judge', options:[{label:'A',text:'正确'},{label:'B',text:'错误'}], answer:'B', analysis:'默认情况下，Docker容器删除后其内部数据会丢失。如需持久化数据，应使用Volume（数据卷）或Bind Mount将数据存储在宿主机上。', category:'DevOps', difficulty:'简单' },
      { title:'React中，以下哪个Hook用于在函数组件中管理状态？', type:'single', options:[{label:'A',text:'useEffect'},{label:'B',text:'useContext'},{label:'C',text:'useState'},{label:'D',text:'useRef'}], answer:'C', analysis:'useState 是React中最基本的状态管理Hook。useEffect处理副作用，useContext访问上下文，useRef创建可变引用。', category:'前端开发', difficulty:'简单' },
      { title:'下列排序算法中，平均时间复杂度为O(n log n)的有哪些？', type:'multiple', options:[{label:'A',text:'快速排序'},{label:'B',text:'冒泡排序'},{label:'C',text:'归并排序'},{label:'D',text:'堆排序'}], answer:'ACD', analysis:'快速排序平均O(n log n)，归并排序始终O(n log n)，堆排序始终O(n log n)。冒泡排序平均和最坏都是O(n²)。', category:'数据结构与算法', difficulty:'中等' },
      { title:'HTTPS相比HTTP增加了____层来保证通信安全。', type:'fill', options:[], answer:'SSL/TLS', analysis:'HTTPS = HTTP + SSL/TLS。TLS（传输层安全协议）在HTTP和TCP之间添加了加密、身份验证和数据完整性保护。', category:'计算机网络', difficulty:'简单' },
    ];

    // 补 bank 字段
    demoQuestions.forEach(q => { q.bank = q.bank || 'gongji'; });
    const saved = QuestionBank.batchImport(demoQuestions);
    // Auto-categorize demo data
    const questions = QuestionBank.getAll();
    AutoCategorizer.classify(questions);
    // Save classified back
    Storage.set(Storage.KEYS.QUESTIONS, questions);
    QuestionBank.updateCategories(questions);
    console.log(`Demo data loaded: ${saved.added} questions (auto-categorized)`);
  },

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
  updateStats() {
    const stats = QuestionBank.getStats();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-practiced').textContent = stats.practiced;

    // SM-2 待复习数量（优先展示）
    const sm2Stats = ErrorNotebook.getSM2Stats();
    const reviewEl = document.getElementById('stat-errors');
    if (sm2Stats.total > 0) {
      reviewEl.textContent = `${sm2Stats.dueToday + sm2Stats.overdue}待复习/${sm2Stats.total}`;
      reviewEl.title = `SM-2间隔复习: ${sm2Stats.dueToday}题今日到期, ${sm2Stats.overdue}题已逾期, 平均间隔${sm2Stats.avgInterval}天`;
    } else {
      reviewEl.textContent = '0';
    }

    document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
  },

  /**
   * 更新存储信息
   */
  updateStorageInfo() {
    const usage = Storage.getUsage();
    document.getElementById('storage-usage').textContent = Storage.formatBytes(usage);
  },

  /**
   * 渲染题目列表
   */
  renderQuestionBank() {
    const bank = document.getElementById('bank-bank-filter')?.value || '';
    const keyword = document.getElementById('bank-search')?.value || '';
    const category = document.getElementById('bank-category-filter')?.value || '';
    const type = document.getElementById('bank-type-filter')?.value || '';

    // 根据选中的bank更新分类选项
    let allQuestions = QuestionBank.getAll();
    if (bank) allQuestions = allQuestions.filter(q => q.bank === bank);
    const categories = [...new Set(allQuestions.map(q => q.category).filter(Boolean))].sort();
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
            ${this.escapeHtml(q.title)}
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
            <div class="question-title">${this.escapeHtml(title)}</div>
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
  async handlePdfUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    const engineBadge = document.getElementById('engine-badge');
    this.showToast(`正在解析 ${files.length} 个PDF文件...`, 'info');

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalDup = 0;
    let engineUsed = '';
    const importedQuestionIds = [];

    // 优先使用后端批量接口
    const backendAvailable = await ApiConfig.checkAvailability();
    if (backendAvailable && files.length > 1) {
      try {
        const batchResult = await PdfParser.parsePdfBatch(files);
        if (batchResult.length > 0) {
          engineUsed = 'backend';
          // 自动分类
          AutoCategorizer.classify(batchResult);
          const result = QuestionBank.batchImport(batchResult);
          totalAdded += result.added;
          totalSkipped += result.skipped;
          totalDup += result.skippedDup;
          // 记录导入的题目ID
          const allQuestions = QuestionBank.getAll();
          importedQuestionIds.push(...allQuestions.slice(-result.added).map(q => q.id));
        }
      } catch (e) {
        console.warn('批量解析失败，逐个处理:', e.message);
        engineUsed = '';
      }
    }

    // 如果批量失败或单文件，逐个解析
    if (engineUsed !== 'backend') {
      for (const file of files) {
        try {
          const questions = await PdfParser.parsePdf(file);
          if (questions.length > 0) {
            if (questions[0]._engine) engineUsed = questions[0]._engine;
            // 自动分类
            AutoCategorizer.classify(questions);
            const result = QuestionBank.batchImport(questions);
            totalAdded += result.added;
            totalSkipped += result.skipped;
            totalDup += result.skippedDup;
            // 记录题目ID
            const allQuestions = QuestionBank.getAll();
            importedQuestionIds.push(...allQuestions.slice(-result.added).map(q => q.id));
          }
        } catch (err) {
          console.error('PDF解析失败:', file.name, err);
          this.showToast(`解析失败: ${file.name} - ${err.message}`, 'error');
        }
      }
    }

    // 记录导入批次
    if (importedQuestionIds.length > 0) {
      const totalSize = files.reduce((s, f) => s + f.size, 0);
      const displayName = files.length === 1 ? files[0].name : `${files.length} 个文件`;
      ImportManager.recordImport(displayName, totalSize, importedQuestionIds, engineUsed);
    }

    // 更新引擎标识
    if (engineUsed && engineBadge) {
      engineBadge.textContent = `引擎: ${engineUsed}`;
      engineBadge.style.display = 'inline';
      engineBadge.style.color = 'var(--success)';
    }

    if (totalAdded > 0) {
      const cats = AutoCategorizer.KNOWLEDGE_BASE;
      const catCount = Object.keys(cats).length;
      this.showToast(`成功导入 ${totalAdded} 道题目（已自动分类到${catCount}个领域）${totalDup > 0 ? `，跳过 ${totalDup} 道重复` : ''}`, 'success');

      // 检查新导入的题目是否缺少答案/解析
      const missingAnswer = importedQuestionIds.filter(id => {
        const q = QuestionBank.getById(id);
        return q && (!q.answer || !q.analysis);
      });
      if (missingAnswer.length > 0 && ApiConfig.hasDeepSeekApiKey()) {
        setTimeout(() => {
          if (confirm(`新导入的题目中有 ${missingAnswer.length} 道缺少答案或解析。\n是否使用AI智能分析自动补全？`)) {
            this.aiAnalyzeMissing();
          }
        }, 500);
      } else if (missingAnswer.length > 0) {
        setTimeout(() => {
          if (confirm(`新导入的题目中有 ${missingAnswer.length} 道缺少答案或解析。\n配置DeepSeek API Key后可使用AI自动补全。\n是否现在配置？`)) {
            this.showApiKeyModal();
          }
        }, 500);
      }
    } else {
      this.showToast(`未能导入新题目（${totalDup} 道重复，${totalSkipped} 道格式有误）`, 'info');
    }

    input.value = '';
    this.renderQuestionBank();
    this.renderImportHistory();
    this.updateStats();
    this.updateStorageInfo();
  },

  /**
   * 显示题目详情
   */
  /**
   * 渲染导入历史
   */
  renderImportHistory() {
    const container = document.getElementById('import-history-list');
    if (!container) return;

    const batches = ImportManager.getAll();
    if (batches.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:16px;">暂无导入记录</p>';
      this.updateImportSummary(batches);
      return;
    }

    // 最新在前
    const sorted = [...batches].reverse();

    container.innerHTML = sorted.map(b => {
      const date = new Date(b.importedAt).toLocaleString('zh-CN');
      const sizeStr = b.fileSize > 1048576
        ? (b.fileSize / 1048576).toFixed(1) + ' MB'
        : (b.fileSize / 1024).toFixed(0) + ' KB';
      return `
        <div class="import-batch-item" id="batch-${b.id}">
          <div class="import-batch-info">
            <span class="import-batch-name" title="${this.escapeHtml(b.filename)}">${this.escapeHtml(b.filename.length > 28 ? b.filename.slice(0,28) + '...' : b.filename)}</span>
            <span class="import-batch-meta">${b.questionCount} 题 | ${sizeStr} | ${date}</span>
            ${b.engine ? `<span class="question-tag tag-type" style="font-size:10px;">${b.engine}</span>` : ''}
          </div>
          <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="App.deleteImportBatch('${b.id}')" title="删除该批次全部题目">删除</button>
        </div>`;
    }).join('');

    this.updateImportSummary(batches);
  },

  /**
   * 更新导入汇总
   */
  updateImportSummary(batches) {
    const summary = document.getElementById('import-summary');
    if (!summary) return;
    if (batches.length === 0) {
      summary.textContent = '';
      return;
    }
    const totalQ = batches.reduce((s, b) => s + b.questionCount, 0);
    summary.textContent = `共 ${batches.length} 次导入，合计 ${totalQ} 道题目`;
  },

  /**
   * 删除导入批次
   */
  async deleteImportBatch(batchId) {
    const batch = ImportManager.getAll().find(b => b.id === batchId);
    if (!batch) return;

    if (!confirm(`确定删除导入批次"${batch.filename}"吗？\n该批次下的 ${batch.questionCount} 道题目将被全部移除，错题和练习记录也会同步清理。\n此操作不可恢复！`)) return;

    const result = ImportManager.deleteBatch(batchId);
    this.showToast(`已删除批次"${result.filename}"，移除 ${result.removed} 道题目`, 'info');
    this.renderQuestionBank();
    this.renderImportHistory();
    this.updateStats();
    this.updateStorageInfo();
  },

  showQuestionDetail(id) {
    const q = QuestionBank.getById(id);
    if (!q) return;

    let html = `
      <div style="margin-bottom:16px;">
        <span class="question-tag tag-type">${this.getTypeName(q.type)}</span>
        <span class="question-tag tag-category">${q.category || '未分类'}</span>
        ${q.difficulty ? `<span class="question-tag tag-difficulty">${q.difficulty}</span>` : ''}
      </div>
      <p style="font-size:16px;font-weight:600;margin-bottom:16px;line-height:1.7;">${this.escapeHtml(q.title)}</p>`;

    if (q.options && q.options.length > 0) {
      html += `<div style="margin-bottom:16px;">`;
      q.options.forEach(opt => {
        html += `<p style="padding:6px 0;${q.answer.includes(opt.label) ? 'color:var(--success);font-weight:600;' : ''}">${opt.label}. ${this.escapeHtml(opt.text)}</p>`;
      });
      html += `</div>`;
    }

    if (!q.answer && !q.analysis) {
      html += `<p style="color:var(--warning);margin-bottom:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        此题缺少答案和解析
      </p>`;
    }

    html += `<p style="margin-bottom:8px;"><strong>正确答案：</strong><span style="color:var(--success);font-weight:600;">${q.answer || '（无）'}</span></p>`;

    if (q.analysis) {
      html += `<div style="background:#f8f9ff;padding:14px;border-radius:8px;margin-top:12px;">
        <strong>解析：</strong><br>${this.escapeHtml(q.analysis)}
      </div>`;
    }

    if (!q.answer || !q.analysis) {
      html += `<div style="margin-top:12px;text-align:right;">
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.aiAnalyzeSingle('${q.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          AI智能解析
        </button>
      </div>`;
    }

    document.getElementById('modal-title').textContent = '题目详情';
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';
  },

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
        <textarea id="q-title" rows="3" placeholder="请输入题目内容...">${q ? this.escapeHtml(q.title) : ''}</textarea>
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
        <input type="text" class="option-text" value="${this.escapeHtml(opt.text)}" placeholder="选项${opt.label}内容...">
      </div>`).join('');
  },

  /**
   * 添加选项行
   */
  addOptionRow() {
    const editor = document.getElementById('options-editor');
    const rows = editor.querySelectorAll('.option-editor-row');
    const nextLabel = String.fromCharCode(65 + rows.length); // A, B, C, ...
    const row = document.createElement('div');
    row.className = 'option-editor-row';
    row.innerHTML = `
      <input type="checkbox" class="option-correct-toggle" title="标记正确答案">
      <strong style="width:20px;text-align:center;">${nextLabel}</strong>
      <input type="text" class="option-text" placeholder="选项${nextLabel}内容...">`;
    editor.appendChild(row);
  },

  /**
   * 题型切换
   */
  onTypeChange() {
    const type = document.getElementById('q-type').value;
    const optionsContainer = document.getElementById('options-container');
    const addBtn = document.getElementById('add-option-btn');
    if (type === 'essay' || type === 'fill') {
      optionsContainer.style.display = 'none';
    } else {
      optionsContainer.style.display = 'block';
      if (type === 'judge') {
        const editor = document.getElementById('options-editor');
        editor.innerHTML = `
          <div class="option-editor-row">
            <input type="checkbox" class="option-correct-toggle" title="标记正确答案" checked>
            <strong style="width:20px;text-align:center;">A</strong>
            <input type="text" class="option-text" value="正确">
          </div>
          <div class="option-editor-row">
            <input type="checkbox" class="option-correct-toggle" title="标记正确答案">
            <strong style="width:20px;text-align:center;">B</strong>
            <input type="text" class="option-text" value="错误">
          </div>`;
      }
    }
  },

  /**
   * 保存题目
   */
  saveQuestion(editId) {
    const type = document.getElementById('q-type').value;
    const title = document.getElementById('q-title').value.trim();
    const answer = document.getElementById('q-answer').value.trim().toUpperCase();
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
  renderRecentPractice() {
    const container = document.getElementById('recent-practice');
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];

    if (log.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无练习记录</p>';
      return;
    }

    const recent = log.slice(-10).reverse();
    const questions = QuestionBank.getAll();
    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q; });

    container.innerHTML = recent.map(entry => {
      const q = questionMap[entry.questionId];
      const title = q ? q.title : '(题目已删除)';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:12px;">${this.escapeHtml(title.substring(0, 50))}</span>
          <span style="font-size:12px;color:${entry.correct ? 'var(--success)' : 'var(--danger)'};font-weight:600;white-space:nowrap;">${entry.correct ? '✓ 正确' : '✗ 错误'}</span>
        </div>`;
    }).join('');
  },

  /**
   * 渲染分类统计
   */
  renderCategoryChart() {
    const container = document.getElementById('category-chart');
    const questions = QuestionBank.getAll();
    const stats = QuestionBank.getStats();

    if (questions.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无数据</p>';
      return;
    }

    const byCategory = {};
    questions.forEach(q => {
      const cat = q.category || '未分类';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);

    container.innerHTML = sorted.map(([cat, count]) => {
      const pct = Math.round((count / questions.length) * 100);
      return `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${cat}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;">${count} 题</div>
          </div>
        </div>`;
    }).join('') || '<p class="empty-state">暂无数据</p>';
  },

  /**
   * 关闭详情模态框
   */
  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  },

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

  showApiKeyModal() {
    const currentKey = ApiConfig.getDeepSeekApiKey();
    const masked = currentKey ? currentKey.slice(0, 6) + '****' + currentKey.slice(-4) : '';
    const ghToken = Sync.getToken();
    const ghMasked = ghToken ? ghToken.slice(0, 4) + '****' + ghToken.slice(-4) : '';
    document.getElementById('apikey-modal-title').textContent = 'API 设置';
    document.getElementById('apikey-modal-body').innerHTML = `
      <div class="form-group">
        <label>🤖 DeepSeek API Key <small>(AI智能解析)</small></label>
        <input type="password" id="apikey-input" value="${currentKey}" placeholder="sk-xxxxxxxxxxxxxxxx" autocomplete="off">
        ${currentKey ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">当前: ${masked}</p>` : ''}
        <div class="api-key-help" style="font-size:12px;margin-top:4px;">
          获取: <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a> | 费用 ¥1/百万token
        </div>
      </div>
      <hr style="margin:16px 0;border:none;border-top:1px solid #f0f0f0;">
      <div class="form-group">
        <label>🔄 Gitee Token <small>(跨设备同步)</small></label>
        <input type="password" id="github-token-input" value="${ghToken}" placeholder="gitee_token_xxxxxxxx" autocomplete="off">
        ${ghToken ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">当前: ${ghMasked}</p>` : ''}
        <div class="api-key-help" style="font-size:12px;margin-top:4px;">
          获取: <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">创建 Gitee Token</a> (勾选 projects) → 复制粘贴到这里
        </div>
        ${ghToken ? '<button class="btn btn-sm btn-outline" onclick="Sync.push().then(r=>App.showToast(r.pushed?\'同步成功\':\'同步失败:\'+r.error,r.pushed?\'success\':\'error\'))" style="margin-top:8px;">🔄 手动同步</button>' : ''}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        ${currentKey || ghToken ? '<button class="btn btn-outline btn-danger" onclick="App.clearAllKeys()">清除全部</button>' : ''}
        <button class="btn btn-outline" onclick="App.closeApiKeyModal()">取消</button>
        <button class="btn btn-primary" onclick="App.saveApiKey()">保存</button>
      </div>`;
    document.getElementById('apikey-modal-overlay').style.display = 'flex';
  },

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
      this.closeAiProgress();
      this.renderQuestionBank();
      this.updateStats();
      this.showToast(`AI分析完成：成功 ${applied.success} 道，失败 ${applied.failed} 道`, applied.failed > 0 ? 'info' : 'success');
    } catch (e) {
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
    this.showToast('正在AI分析题目...', 'info');

    try {
      const results = await ApiConfig.aiAnalyze([{
        id: q.id, title: q.title, type: q.type, options: q.options || [],
      }]);

      if (results.length > 0 && results[0].success) {
        const r = results[0];
        QuestionBank.update(id, { answer: r.answer, analysis: r.analysis });
        this.renderQuestionBank();
        this.updateStats();
        this.showToast('AI解析完成！', 'success');
        // 重新打开详情
        this.showQuestionDetail(id);
      } else {
        this.showToast('AI分析失败: ' + (results[0]?.error || '未知错误'), 'error');
      }
    } catch (e) {
      this.showToast('AI分析失败: ' + e.message, 'error');
    }
  },

  /**
   * 显示AI分析进度
   */
  showAiProgress(total) {
    document.getElementById('ai-progress-body').innerHTML = `
      <div class="ai-progress-list" id="ai-progress-list">
        ${Array.from({ length: total }, (_, i) => `
          <div class="ai-progress-item" id="ai-item-${i}">
            <div class="ai-progress-status pending">${i + 1}</div>
            <span class="ai-progress-title">等待分析...</span>
          </div>
        `).join('')}
      </div>
      <div class="ai-progress-summary" id="ai-progress-summary">
        正在分析... 0 / ${total}
      </div>`;
    document.getElementById('ai-progress-close').style.display = 'none';
    document.getElementById('ai-progress-overlay').style.display = 'flex';
  },

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
  closeAiProgress() {
    document.getElementById('ai-progress-overlay').style.display = 'none';
  },

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
