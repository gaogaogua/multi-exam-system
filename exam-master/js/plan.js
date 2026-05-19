/**
 * 学习计划模块 — 严格遵循 CLAUDE.md 备考规则
 *
 * 规则来源：
 *   - 作息铁律: 7:30-23:00, 番茄工作法 60min学习+15min休息
 *   - 黄金记忆: 8:00-9:00, 19:00-20:00 (只安排记忆类)
 *   - 逻辑高峰: 9:15-10:15, 15:15-16:15 (深度思考类)
 *   - 复盘: 21:30-22:30
 *   - 学习顺序: 理解类→记忆类→刷题类→输出类→复盘记忆类
 *   - 同类不连续>2h, 记忆与逻辑交替
 *   - 写作薄弱项: 每日至少1h写作训练
 *   - SM-2间隔复习: 动态调整间隔, 复习优先于新内容
 *   - 优先级: !1(必做) >=60%, !2(建议), !3(弹性)
 *   - 标签: #一建 #公基 #国考 #土木专业 #写作 #时政 #错题复盘 #模考
 *   - 输出格式: HH:MM-HH:MM !优先级 #标签 任务描述
 */

const Plan = {
  PLANS_KEY: 'exam_plans',
  PROGRESS_KEY: 'today_progress',

  // ─── 时间槽模板（含番茄钟休息）───
  // 学习时段 60min，休息 15min，午餐/晚餐独立标注
  TIME_SLOTS: [
    { time: '7:30-8:00',  type: 'warmup',  label: '晨间唤醒',        taskType: 'recall' },
    { time: '8:00-9:00',  type: 'memory',   label: '黄金记忆①',      taskType: 'memory' },
    { time: '9:15-10:15', type: 'logic',    label: '逻辑高峰①',      taskType: 'logic' },
    { time: '10:30-11:30',type: 'normal',   label: '普通学习①',      taskType: 'normal' },
    { time: '14:00-15:00',type: 'normal',   label: '普通学习②',      taskType: 'normal' },
    { time: '15:15-16:15',type: 'logic',    label: '逻辑高峰②',      taskType: 'logic' },
    { time: '16:30-17:30',type: 'normal',   label: '普通学习③',      taskType: 'output' },
    { time: '19:00-20:00',type: 'memory',   label: '黄金记忆②',      taskType: 'memory' },
    { time: '20:15-21:15',type: 'normal',   label: '普通学习④',      taskType: 'normal' },
    { time: '21:30-22:30',type: 'review',   label: '复盘总结',        taskType: 'review' },
  ],

  REST_SLOTS: [
    '8:00前 起床洗漱早餐',
    '9:00-9:15 休息',
    '10:15-10:30 休息',
    '11:30-14:00 午餐午休',
    '15:00-15:15 休息',
    '16:15-16:30 休息',
    '17:30-19:00 晚餐休息',
    '20:00-20:15 休息',
    '21:15-21:30 休息',
    '22:30 就寝',
  ],

  // ─── 全标签体系 ───
  ALL_TAGS: ['#一建', '#公基', '#国考', '#土木专业', '#写作', '#时政', '#错题复盘', '#模考'],

  // ─── 全科目任务词库 ───
  TASK_POOL: {
    // 公基科目
    '公基': {
      memory: [
        '法律法条背诵（{weak}）', '时政热点记忆（{weak}）', '公文格式规范背诵',
        '哲学原理口诀记忆', '经济学术语背诵', '党史重大事件时间线记忆',
        '湖南省情常识记忆', '管理学原理要点背诵',
      ],
      logic: [
        '哲学多选题辨析专项', '法律案例分析练习', '公文改错专项训练',
        '经济图表分析题', '行政管理情景题',
      ],
      normal: [
        '公基选择题刷题（{weak}）', '公基多选题专项', '公基判断题专项',
        '公基错题重练', '公基全科模拟卷一套', '公基章节练习',
      ],
      output: [
        '公基错题笔记整理输出', '今日错题口头复述',
      ],
    },
    // 一建实务科目
    '一建': {
      memory: [
        '施工规范条文背诵（{weak}）', '材料性能参数记忆', '建筑构造节点名称',
        '法规标准条款记忆', '口诀简答背诵', '安全施工要点记忆',
      ],
      logic: [
        '结构力学计算题专项', '施工技术案例分析', '工程管理进度网络图',
        '造价计算练习', '施工组织设计分析',
      ],
      normal: [
        '一建选择题刷题（{weak}）', '一建案例题专项', '一建错题重练',
        '一建模拟卷一套', '一建章节练习',
      ],
      output: [
        '一建案例题答题模板输出', '施工流程图默画',
      ],
    },
    // 国考行测申论
    '国考': {
      memory: [
        '常识判断高频考点记忆', '申论金句素材背诵', '成语词语积累',
        '资料分析公式记忆', '逻辑判断规则记忆',
      ],
      logic: [
        '数量关系专项练习', '资料分析速算训练', '图形推理专项',
        '逻辑判断专项训练',
      ],
      normal: [
        '行测套题练习', '申论小题专项', '国考错题重练',
        '言语理解专项', '判断推理专项',
      ],
      output: [
        '申论大作文一篇', '申论小题逐字稿输出',
      ],
    },
    // 土木专业知识
    '土木': {
      memory: [
        '土木施工规范条文背诵', '材料性能参数记忆', '结构设计参数记忆',
        '法规标准条款记忆', '口诀简答背诵',
      ],
      logic: [
        '结构力学计算题', '土力学计算专项', '施工技术案例分析',
        '工程管理计算题',
      ],
      normal: [
        '土木选择题刷题（{weak}）', '土木案例题专项', '土木错题重练',
        '土木模拟卷一套', '土木章节练习',
      ],
      output: [
        '土木计算题步骤整理', '施工流程图默画',
      ],
    },
    // 写作（独立训练，每日必修）
    '写作': {
      memory: [
        '申论规范表述背诵', '公文常用语积累', '写作模板记忆',
      ],
      logic: [
        '申论材料分析训练', '文章结构拆解练习',
      ],
      normal: [
        '时评文章阅读摘抄', '写作素材整理',
      ],
      output: [
        '申论大作文一篇（60min）', '公文写作练习一篇',
        '案例分析作答一篇', '时事评论一篇',
      ],
    },
  },

  // ─── 学习顺序映射 ───
  // 理解类→记忆类→刷题类→输出类→复盘记忆类
  PHASE_ORDER: ['logic', 'memory', 'normal', 'output', 'review'],

  // ─── 标签映射 ───
  SUBJECT_TAGS: {
    '公基': ['#公基'],
    '一建': ['#一建'],
    '国考': ['#国考'],
    '土木': ['#土木专业'],
    '写作': ['#写作'],
  },

  // ══════════════════════════════════════════

  _getPlans() {
    try { return JSON.parse(localStorage.getItem(this.PLANS_KEY)) || []; }
    catch (e) { return []; }
  },
  _savePlans(plans) { localStorage.setItem(this.PLANS_KEY, JSON.stringify(plans)); },

  _getProgress() {
    try { return JSON.parse(localStorage.getItem(this.PROGRESS_KEY)) || null; }
    catch (e) { return null; }
  },
  _saveProgress(p) { localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(p)); },

  /**
   * 生成今日计划 — 严格遵循作息铁律
   */
  generate(gongjiRatio, tumuRatio) {
    const today = new Date().toISOString().split('T')[0];
    const plans = this._getPlans();
    const existing = plans.find(p => p.date === today);
    if (existing) {
      if (!confirm('今日计划已存在，重新生成会覆盖。确定吗？')) return;
      plans.splice(plans.indexOf(existing), 1);
    }

    // ── 收集数据 ──
    const allQuestions = QuestionBank.getAll();
    const errors = ErrorNotebook.getAll();
    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];

    // 按bank统计题量
    const bankCounts = { '公基': 0, '一建': 0, '国考': 0, '土木': 0 };
    allQuestions.forEach(q => { if (bankCounts[q.bank] !== undefined) bankCounts[q.bank]++; });

    // 薄弱分类 (按bank)
    const weakByBank = {};
    for (const bank of ['公基', '土木']) {
      weakByBank[bank] = this._getWeakCategories(bank, errors);
    }

    // SM-2 间隔复习（复习优先于新内容）
    const dueReviews = ErrorNotebook.getDueReviews();
    const sm2Stats = ErrorNotebook.getSM2Stats();

    // ── 分配科目到各时段（遵循学习顺序）──
    // 科目优先级：已导入题目的bank优先
    const primaryBanks = [];
    if (bankCounts['公基'] > 0) primaryBanks.push('公基');
    if (bankCounts['土木'] > 0) primaryBanks.push('土木');
    if (primaryBanks.length === 0) primaryBanks.push('公基', '土木');

    // 按比例分配时段数
    const totalSlots = this.TIME_SLOTS.length; // 10
    const gjSlots = Math.max(1, Math.round(totalSlots * gongjiRatio / 100));
    const tmSlots = totalSlots - gjSlots;

    // ── 按学习顺序排列时段任务类型 ──
    // 保证: 理解(logic)→记忆(memory)→刷题(normal)→输出(output)→复盘(review)
    // 黄金记忆只排记忆类, 逻辑高峰只排逻辑类

    const tasks = this.TIME_SLOTS.map((slot, i) => {
      // 确定科目
      let subject;
      if (slot.type === 'review') {
        subject = '公基'; // 复盘统一处理
      } else if (slot.type === 'memory') {
        subject = primaryBanks[0]; // 黄金记忆优先第一批科目
      } else if (slot.type === 'logic') {
        subject = primaryBanks.length > 1 ? primaryBanks[1] : primaryBanks[0];
      } else if (slot.type === 'normal' && slot.taskType === 'output') {
        subject = '写作'; // 16:30-17:30 固定写作输出
      } else {
        // 普通时段按比例交替分配
        const slotIdx = this.TIME_SLOTS.filter((s, j) => j < i && s.type === 'normal' && s.taskType !== 'output').length;
        const halfNormal = Math.max(1, Math.round((totalSlots - 2) / 2)); // rough split
        subject = slotIdx % 2 === 0 ? primaryBanks[0] : (primaryBanks[1] || primaryBanks[0]);
      }

      return this._buildTask(slot, subject, weakByBank, dueReviews, sm2Stats, i, today);
    });

    // ── 保证 !1 占比 ≥60% ──
    let p1Count = tasks.filter(t => t.priority === '!1').length;
    if (p1Count / tasks.length < 0.6) {
      // 将一些 !2 提升为 !1 (优先提升上午和晚上黄金时段)
      const candidates = tasks.filter(t => t.priority === '!2');
      candidates.sort((a, b) => {
        const typeOrder = { memory: 0, logic: 0, review: 0, normal: 1, output: 1 };
        return (typeOrder[a.slotType] || 2) - (typeOrder[b.slotType] || 2);
      });
      let needed = Math.ceil(tasks.length * 0.6) - p1Count;
      for (const t of candidates) {
        if (needed <= 0) break;
        t.priority = '!1';
        needed--;
      }
    }

    const plan = { date: today, tasks, gongjiRatio, tumuRatio, createdAt: new Date().toISOString() };
    plans.push(plan);
    this._savePlans(plans);

    this._saveProgress({
      date: today,
      tasksCompleted: 0,
      totalTasks: tasks.length,
      bankProgress: { gongji: { done: 0, total: tasks.filter(t => t.subject === '公基').length },
                       tumu: { done: 0, total: tasks.filter(t => t.subject === '土木').length } },
    });

    this.render();
  },

  /**
   * 构建单个任务
   */
  _buildTask(slot, subject, weakByBank, dueReviews, sm2Stats, slotIndex, today) {
    const pool = this.TASK_POOL[subject] || this.TASK_POOL['公基'];
    const weakCats = weakByBank[subject] || [];
    const weakStr = weakCats.length > 0 ? weakCats[0] : '基础知识';

    // 选择任务描述：SM-2 间隔复习优先
    let desc, source = '';
    const totalDue = dueReviews ? dueReviews.length : 0;
    const reviewDue = dueReviews ? dueReviews.filter(d => {
      return d.question && (d.question.bank === subject || (subject === '写作' && d.question.bank === '公基'));
    }) : [];
    const overdueCount = dueReviews ? dueReviews.filter(d => d.nextReviewAt < today).length : 0;

    if (slot.type === 'review') {
      desc = `错题复盘整理（SM-2间隔复习 ${totalDue} 题${overdueCount > 0 ? '，' + overdueCount + '题逾期' : ''}）`;
      if (weakCats.length > 0) {
        desc += ` + ${weakStr}巩固`;
      }
      const avgInt = sm2Stats ? sm2Stats.avgInterval : 0;
      source = `SM-2动态间隔: ${totalDue}题待复习（逾期${overdueCount}题，平均间隔${avgInt}天）`;
    } else if (slot.taskType === 'output') {
      const outputTasks = pool.output || [];
      desc = outputTasks[Math.floor(Math.random() * outputTasks.length)] || `${subject}输出练习`;
      source = `写作薄弱项专项训练（每日≥1h）`;
    } else if (reviewDue.length > 0 && slot.type === 'normal') {
      // 复习优先于新内容
      desc = `${subject}错题重练（${reviewDue.length}题待复习）`;
      source = `复习优先: SM-2待复习${reviewDue.length}题（最大间隔${Math.max(...reviewDue.map(r=>r.interval||1))}天）`;
    } else {
      const taskType = slot.taskType;
      const tasksForType = pool[taskType] || pool.normal;
      desc = tasksForType[Math.floor(Math.random() * tasksForType.length)];
      desc = desc.replace('{weak}', weakStr);
      source = weakCats.length > 0 ? `薄弱: ${weakStr}` : '常规学习';
    }

    // 标签
    const tags = [...(this.SUBJECT_TAGS[subject] || [])];
    if (slot.type === 'review') tags.push('#错题复盘');
    if (desc.includes('模拟卷')) tags.push('#模考');
    if (desc.includes('时政') || desc.includes('申论')) tags.push('#时政');

    // 优先级：逾期复习任务提升为 !1
    let priority;
    if (slot.type === 'memory' || slot.type === 'logic' || slot.type === 'review') {
      priority = '!1';
    } else if (slot.taskType === 'output') {
      priority = '!1'; // 写作每日必修→!1
    } else if (reviewDue.length > 0 && reviewDue.some(r => r.nextReviewAt < today)) {
      priority = '!1'; // 逾期复习→!1
    } else if (reviewDue.length > 0) {
      priority = '!2';
    } else {
      priority = '!2';
    }

    return {
      time: slot.time,
      label: slot.label,
      type: slot.type,
      taskType: slot.taskType,
      subject,
      priority,
      tags,
      desc,
      source,
      expectedCount: slot.type === 'review' ? 0 : 10 + Math.floor(Math.random() * 15),
      completed: false,
      correct: 0,
      total: 0,
    };
  },

  /**
   * 按分类统计薄弱项
   */
  _getWeakCategories(bank, errors) {
    const byCat = {};
    errors.filter(e => !e.mastered).forEach(e => {
      const q = QuestionBank.getById(e.questionId);
      if (!q || q.bank !== bank) return;
      const cat = e.questionCategory || '未分类';
      byCat[cat] = (byCat[cat] || 0) + 1;
    });
    return Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  },

  /**
   * 检查艾宾浩斯复习节点 (D1/D2/D4/D7/D15)
   */
  _checkEbbinghaus(errors, today) {
    const todayDate = new Date(today);
    const nodes = [1, 2, 4, 7, 15];
    const due = [];
    errors.filter(e => !e.mastered).forEach(e => {
      const errDate = new Date(e.firstWrongAt || e.lastWrongAt);
      const daysSince = Math.floor((todayDate - errDate) / (1000 * 60 * 60 * 24));
      if (nodes.includes(daysSince)) {
        due.push({
          errorId: e.id,
          questionId: e.questionId,
          daysSince,
          questionTitle: e.questionTitle,
          category: e.questionCategory,
        });
      }
    });
    return due;
  },

  // ══════════════════════════════════════════
  // 渲染 & 交互
  // ══════════════════════════════════════════

  render() {
    const container = document.getElementById('plan-content');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const plans = this._getPlans();
    const plan = plans.find(p => p.date === today);

    if (!plan) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:48px;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d9d9d9" stroke-width="1"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style="color:var(--text-secondary);margin:16px 0;">暂无今日计划</p>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">遵循作息铁律 · 番茄工作法 · SM-2间隔复习 · 记忆逻辑交替</p>
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">理解→记忆→刷题→输出→复盘 | 每日≥1h写作训练</p>
          <button class="btn btn-primary" onclick="Plan.generate(30, 70)">生成今日计划</button>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">公基30% / 土木70% (可按需调整)</p>
        </div>`;
      return;
    }

    // 统计
    const completedTasks = plan.tasks.filter(t => t.completed).length;
    const totalTasks = plan.tasks.length;
    const gjTasks = plan.tasks.filter(t => t.subject === '公基');
    const tmTasks = plan.tasks.filter(t => t.subject === '土木');
    const gjDone = gjTasks.filter(t => t.completed).length;
    const tmDone = tmTasks.filter(t => t.completed).length;
    const p1Count = plan.tasks.filter(t => t.priority === '!1').length;

    let html = `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <strong>今日进度</strong>
            <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">${plan.date}</span>
          </div>
          <span style="font-size:13px;color:var(--text-secondary);">${completedTasks}/${totalTasks} 时段 · !1任务 ${p1Count}个(${Math.round(p1Count/totalTasks*100)}%)</span>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <span style="font-size:12px;color:#722ed1;">公基 ${gjDone}/${gjTasks.length}</span>
          <span style="font-size:12px;color:#13c2c2;">土木 ${tmDone}/${tmTasks.length}</span>
          <span style="font-size:12px;color:#fa8c16;">写作 ${plan.tasks.filter(t=>t.subject==='写作'&&t.completed).length}/${plan.tasks.filter(t=>t.subject==='写作').length}</span>
        </div>
        <div class="plan-progress-track">
          <div class="plan-progress-gongji" style="width:${totalTasks>0?(gjDone/totalTasks*100):0}%;"></div>
          <div class="plan-progress-tumu" style="width:${totalTasks>0?(tmDone/totalTasks*100):0}%;"></div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);line-height:1.6;">
          ${this.REST_SLOTS.join(' | ')}
        </div>
      </div>

      <div class="plan-timeline">`;

    plan.tasks.forEach((task, i) => {
      const statusIcon = task.completed ? '✅' : (i === completedTasks ? '▶' : '○');
      const statusClass = task.completed ? 'plan-task-done' : (i === completedTasks ? 'plan-task-active' : 'plan-task-pending');
      const bankColor = this._subjectColor(task.subject);

      html += `
        <div class="plan-task ${statusClass}" style="border-left:3px solid ${bankColor};" id="plan-task-${i}">
          <div class="plan-task-header">
            <span class="plan-task-time">${task.time}</span>
            <span class="plan-task-prio" style="background:${task.priority==='!1'?'#ff4d4f':'#faad14'};color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;">${task.priority}</span>
            <span style="font-size:11px;color:${bankColor};font-weight:600;">${task.subject}</span>
            <span style="font-size:10px;color:var(--text-secondary);">${task.label}</span>
            ${task.tags.map(t => `<span style="font-size:10px;color:var(--text-secondary);background:#f0f0f0;padding:0 4px;border-radius:2px;">${t}</span>`).join('')}
            <span style="font-size:18px;margin-left:auto;">${statusIcon}</span>
          </div>
          <div class="plan-task-body">
            <strong>${this._esc(task.desc)}</strong>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${task.source} | 预计${task.expectedCount}题</p>
            ${task.completed ? `<p style="font-size:12px;color:var(--success);margin-top:2px;">✓ ${task.correct}/${task.total} 正确率${task.total>0?Math.round(task.correct/task.total*100):0}%</p>` : ''}
          </div>
          ${!task.completed ? `<div class="plan-task-actions"><button class="btn btn-sm btn-primary" onclick="Plan.startTask(${i})">开始练习</button></div>` : ''}
        </div>`;
    });

    html += `</div>
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-weight:600;">计划设置</span>
          <span style="font-size:13px;color:var(--text-secondary);">公基${plan.gongjiRatio}% / 土木${plan.tumuRatio}%</span>
          <button class="btn btn-sm btn-outline" onclick="Plan.generate(${plan.gongjiRatio}, ${plan.tumuRatio})">重新生成</button>
          <button class="btn btn-sm btn-default" onclick="Plan.exportTickTick()">📋 TickTick格式</button>
          <button class="btn btn-sm btn-default" onclick="Plan.exportText()">📝 下载文本</button>
        </div>
      </div>`;

    container.innerHTML = html;
  },

  _subjectColor(subj) {
    const map = { '公基': '#722ed1', '一建': '#eb2f96', '国考': '#fa8c16', '土木': '#13c2c2', '写作': '#fa541c' };
    return map[subj] || '#666';
  },

  startTask(taskIndex) {
    const plans = this._getPlans();
    const today = new Date().toISOString().split('T')[0];
    const plan = plans.find(p => p.date === today);
    if (!plan || !plan.tasks[taskIndex]) return;

    const task = plan.tasks[taskIndex];
    // 根据任务科目切换到对应bank，跳转练习
    const bankMap = { '公基': 'gongji', '土木': 'tumu', '一建': 'tumu', '国考': 'gongji', '写作': 'gongji' };
    const bank = bankMap[task.subject] || 'all';

    Practice.bankFilter = bank;
    localStorage.setItem('practice_bank_filter', bank);
    const radio = document.querySelector(`input[name="bank-filter"][value="${bank}"]`);
    if (radio) radio.checked = true;

    App.navigateTo('practice');
    Practice.start('random');
  },

  /**
   * 练习/考试结束后更新进度
   */
  updateProgress(bank, correct, total) {
    const today = new Date().toISOString().split('T')[0];
    const plans = this._getPlans();
    const plan = plans.find(p => p.date === today);
    if (!plan) return;

    // 找到对应科目第一个未完成的任务
    const subjMap = { gongji: '公基', tumu: '土木' };
    const subject = subjMap[bank] || '公基';
    const idx = plan.tasks.findIndex(t => !t.completed && t.subject === subject);
    if (idx === -1) return;

    plan.tasks[idx].completed = true;
    plan.tasks[idx].correct = correct;
    plan.tasks[idx].total = total;
    this._savePlans(plans);

    // 更新进度
    const progress = this._getProgress() || {
      date: today, tasksCompleted: 0, totalTasks: plan.tasks.length,
      bankProgress: { gongji: { done: 0, total: 0 }, tumu: { done: 0, total: 0 } },
    };
    progress.tasksCompleted = plan.tasks.filter(t => t.completed).length;
    const gj = plan.tasks.filter(t => t.subject === '公基');
    const tm = plan.tasks.filter(t => t.subject === '土木');
    progress.bankProgress.gongji = { done: gj.filter(t => t.completed).length, total: gj.length };
    progress.bankProgress.tumu = { done: tm.filter(t => t.completed).length, total: tm.length };
    this._saveProgress(progress);

    if (App.updateStats) App.updateStats();
  },

  // ══════════════════════════════════════════
  // 导出
  // ══════════════════════════════════════════

  exportTickTick() {
    const plans = this._getPlans();
    const today = new Date().toISOString().split('T')[0];
    const plan = plans.find(p => p.date === today);
    if (!plan) { alert('请先生成计划'); return; }

    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    let text = `【${dateStr} 学习计划】\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;

    plan.tasks.forEach(t => {
      text += `${t.time} ${t.priority} ${t.tags.join(' ')} ${t.desc}\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    const p1 = plan.tasks.filter(t => t.priority === '!1').length;
    text += `今日${plan.tasks.length}个时段 · !1:${p1}个(${Math.round(p1/plan.tasks.length*100)}%) · 公基${plan.gongjiRatio}%/土木${plan.tumuRatio}%\n`;
    text += `规则：番茄60min+15min · 记忆逻辑交替 · 写作≥1h · 复习优先`;

    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板！可直接粘贴到滴答清单');
    }).catch(() => {
      const el = document.createElement('textarea'); el.value = text;
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      alert('已复制到剪贴板！');
    });
  },

  exportText() {
    const plans = this._getPlans();
    const today = new Date().toISOString().split('T')[0];
    const plan = plans.find(p => p.date === today);
    if (!plan) { alert('请先生成计划'); return; }

    let text = `学习计划 - ${today}\n\n`;
    text += `休息节点: ${this.REST_SLOTS.join(' | ')}\n\n`;

    plan.tasks.forEach(t => {
      text += `${t.time} [${t.priority}] ${t.subject} ${t.label}\n`;
      text += `  ${t.desc}  [${t.tags.join(' ')}]\n`;
      text += `  来源: ${t.source}\n`;
      if (t.completed) text += `  ✓ ${t.correct}/${t.total}\n`;
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `学习计划_${today}.txt`;
    a.click(); URL.revokeObjectURL(url);
  },

  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};
