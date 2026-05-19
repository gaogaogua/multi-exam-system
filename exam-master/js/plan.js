/**
 * 学习计划模块 v2 — 多时间维度 + 智能编排
 *
 * - 今日计划: 通盘考虑练习进度/SM-2复习/薄弱项/AI写作题/时段已过检测
 * - 明日计划: 预览次日安排
 * - 本周计划: 7日汇总 + 周目标
 * - 本月计划: 月度里程碑 + 长期进度
 * - 写作训练: AI生成题目或节选优质题
 * - 过时检测: 已过时段灰掉不可点击
 */

const Plan = {
  PLANS_KEY: 'exam_plans',
  PROGRESS_KEY: 'today_progress',
  MONTHLY_GOALS_KEY: 'monthly_goals',

  // ─── 时间槽 ───
  TIME_SLOTS: [
    { time: '7:30-8:00',  type: 'warmup', label: '晨间唤醒',       taskType: 'recall' },
    { time: '8:00-9:00',  type: 'memory',  label: '黄金记忆①',     taskType: 'memory' },
    { time: '9:15-10:15', type: 'logic',   label: '逻辑高峰①',     taskType: 'logic' },
    { time: '10:30-11:30',type: 'normal',  label: '普通学习①',     taskType: 'normal' },
    { time: '14:00-15:00',type: 'normal',  label: '普通学习②',     taskType: 'normal' },
    { time: '15:15-16:15',type: 'logic',   label: '逻辑高峰②',     taskType: 'logic' },
    { time: '16:30-17:30',type: 'normal',  label: '普通学习③',     taskType: 'output' },
    { time: '19:00-20:00',type: 'memory',  label: '黄金记忆②',     taskType: 'memory' },
    { time: '20:15-21:15',type: 'normal',  label: '普通学习④',     taskType: 'normal' },
    { time: '21:30-22:30',type: 'review',  label: '复盘总结',       taskType: 'review' },
  ],

  REST_SLOTS: [
    '8:00前 起床洗漱早餐', '9:00-9:15 休息', '10:15-10:30 休息', '11:30-14:00 午餐午休',
    '15:00-15:15 休息', '16:15-16:30 休息', '17:30-19:00 晚餐休息', '20:00-20:15 休息', '21:15-21:30 休息', '22:30 就寝',
  ],

  ALL_TAGS: ['#一建', '#公基', '#国考', '#土木专业', '#写作', '#时政', '#错题复盘', '#模考'],

  TASK_POOL: {
    '公基': {
      memory: ['法律法条背诵（{weak}）', '时政热点记忆（{weak}）', '公文格式规范背诵', '哲学原理口诀记忆', '经济学术语背诵', '党史重大事件时间线记忆', '湖南省情常识记忆', '管理学原理要点背诵'],
      logic: ['哲学多选题辨析专项', '法律案例分析练习', '公文改错专项训练', '经济图表分析题', '行政管理情景题'],
      normal: ['公基选择题刷题（{weak}）', '公基多选题专项', '公基判断题专项', '公基错题重练', '公基全科模拟卷一套', '公基章节练习'],
      output: ['公基错题笔记整理输出', '今日错题口头复述'],
    },
    '一建': {
      memory: ['施工规范条文背诵（{weak}）', '材料性能参数记忆', '建筑构造节点名称', '法规标准条款记忆', '口诀简答背诵', '安全施工要点记忆'],
      logic: ['结构力学计算题专项', '施工技术案例分析', '工程管理进度网络图', '造价计算练习', '施工组织设计分析'],
      normal: ['一建选择题刷题（{weak}）', '一建案例题专项', '一建错题重练', '一建模拟卷一套', '一建章节练习'],
      output: ['一建案例题答题模板输出', '施工流程图默画'],
    },
    '国考': {
      memory: ['常识判断高频考点记忆', '申论金句素材背诵', '成语词语积累', '资料分析公式记忆', '逻辑判断规则记忆'],
      logic: ['数量关系专项练习', '资料分析速算训练', '图形推理专项', '逻辑判断专项训练'],
      normal: ['行测套题练习', '申论小题专项', '国考错题重练', '言语理解专项', '判断推理专项'],
      output: ['申论大作文一篇', '申论小题逐字稿输出'],
    },
    '土木': {
      memory: ['土木施工规范条文背诵', '材料性能参数记忆', '结构设计参数记忆', '法规标准条款记忆', '口诀简答背诵'],
      logic: ['结构力学计算题', '土力学计算专项', '施工技术案例分析', '工程管理计算题'],
      normal: ['土木选择题刷题（{weak}）', '土木案例题专项', '土木错题重练', '土木模拟卷一套', '土木章节练习'],
      output: ['土木计算题步骤整理', '施工流程图默画'],
    },
    '写作': {
      memory: ['申论规范表述背诵', '公文常用语积累', '写作模板记忆'],
      logic: ['申论材料分析训练', '文章结构拆解练习'],
      normal: ['时评文章阅读摘抄', '写作素材整理'],
      output: ['申论大作文一篇（60min）', '公文写作练习一篇', '案例分析作答一篇', '时事评论一篇'],
    },
  },

  PHASE_ORDER: ['logic', 'memory', 'normal', 'output', 'review'],

  SUBJECT_TAGS: {
    '公基': ['#公基'], '一建': ['#一建'], '国考': ['#国考'], '土木': ['#土木专业'], '写作': ['#写作'],
  },

  // 当前查看的计划类型
  viewMode: 'today', // today | tomorrow | week | month

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

  _getGoals() {
    try { return JSON.parse(localStorage.getItem(this.MONTHLY_GOALS_KEY)) || []; }
    catch (e) { return []; }
  },
  _saveGoals(g) { localStorage.setItem(this.MONTHLY_GOALS_KEY, JSON.stringify(g)); },

  _getExamTargets() {
    try { return JSON.parse(localStorage.getItem('exam_targets')) || null; }
    catch (e) { return null; }
  },
  _saveExamTargets(t) { localStorage.setItem('exam_targets', JSON.stringify(t)); },

  /** 已知考试来源列表 */
  KNOWN_EXAMS: [
    { id: 'zhuhui',    name: '衡阳珠晖区事业单位',  subject: '公基', region: '衡阳', date: '2026-05-24', files: ['珠晖区', '珠晖区_新', '珠晖区_zips'] },
    { id: 'wangcheng', name: '长沙望城区事业单位',  subject: '公基', region: '长沙', date: '2026-05-17', files: ['望城区'] },
    { id: 'suining',   name: '张家界绥宁事业单位',  subject: '公基', region: '张家界', date: null },
    { id: 'liuyang',   name: '长沙浏阳事业单位',    subject: '公基', region: '长沙', date: null },
    { id: 'huaihua',   name: '怀化沅陵事业单位',    subject: '公基', region: '怀化', date: null },
    { id: 'yijian',    name: '一级建造师实务',       subject: '一建', date: '2026-09-05' },
    { id: 'guokao',    name: '国家公务员考试',       subject: '国考', date: '2026-11-30' },
    { id: 'tumu',      name: '土木专业知识',         subject: '土木', date: null },
    { id: 'gongji_err',name: '公基错题合集',        subject: '公基' },
  ],

  /** 判断时间段是否已过 */
  _isSlotPast(slotTime, dateStr) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    // 非今日的计划不过时
    if (dateStr !== today) return false;
    const [endHour, endMin] = slotTime.split('-')[1].split(':').map(Number);
    const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMin, 0);
    return now > slotEnd;
  },

  /** 确定目标日期 */
  _getDate(mode) {
    const d = new Date();
    if (mode === 'tomorrow') d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  },

  /** 获取本周日期范围 */
  _getWeekRange() {
    const now = new Date();
    const day = now.getDay() || 7; // 周日=7
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return {
      start: mon.toISOString().split('T')[0],
      end: sun.toISOString().split('T')[0],
      days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        return d.toISOString().split('T')[0];
      }),
    };
  },

  // ══════════════════════════════════════════
  // 计划生成
  // ══════════════════════════════════════════

  /** 生成今日或明日计划 */
  generateForDate(mode, gongjiRatio, tumuRatio) {
    const date = this._getDate(mode);
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;

    const plans = this._getPlans();
    const existing = plans.find(p => p.date === date);
    if (existing) {
      if (!confirm(`${mode === 'tomorrow' ? '明日' : '今日'}计划已存在，重新生成会覆盖。确定吗？`)) return;
      plans.splice(plans.indexOf(existing), 1);
    }

    const allQuestions = QuestionBank.getAll();
    const errors = ErrorNotebook.getAll();
    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];

    const bankCounts = { '公基': 0, '一建': 0, '国考': 0, '土木': 0 };
    allQuestions.forEach(q => { if (bankCounts[q.bank] !== undefined) bankCounts[q.bank]++; });

    const weakByBank = {};
    for (const bank of ['公基', '土木']) {
      weakByBank[bank] = this._getWeakCategories(bank, errors);
    }

    const dueReviews = ErrorNotebook.getDueReviews();
    const sm2Stats = ErrorNotebook.getSM2Stats();

    // 收集昨日练习统计，影响今日安排
    const yesterdayStats = this._getYesterdayStats(practiceLog, errors);

    const primaryBanks = [];
    if (bankCounts['公基'] > 0) primaryBanks.push('公基');
    if (bankCounts['土木'] > 0) primaryBanks.push('土木');
    if (primaryBanks.length === 0) primaryBanks.push('公基', '土木');

    const totalSlots = this.TIME_SLOTS.length;
    const gjSlots = Math.max(1, Math.round(totalSlots * gongjiRatio / 100));
    const tmSlots = totalSlots - gjSlots;

    const tasks = this.TIME_SLOTS.map((slot, i) => {
      let subject;
      if (slot.type === 'review') {
        subject = '公基';
      } else if (slot.type === 'memory') {
        subject = primaryBanks[0];
      } else if (slot.type === 'logic') {
        subject = primaryBanks.length > 1 ? primaryBanks[1] : primaryBanks[0];
      } else if (slot.type === 'normal' && slot.taskType === 'output') {
        subject = '写作';
      } else {
        const slotIdx = this.TIME_SLOTS.filter((s, j) => j < i && s.type === 'normal' && s.taskType !== 'output').length;
        subject = slotIdx % 2 === 0 ? primaryBanks[0] : (primaryBanks[1] || primaryBanks[0]);
      }

      return this._buildTask(slot, subject, weakByBank, dueReviews, sm2Stats, i, date, yesterdayStats, isToday);
    });

    // 保证 !1 ≥60%
    let p1Count = tasks.filter(t => t.priority === '!1').length;
    if (p1Count / tasks.length < 0.6) {
      const candidates = tasks.filter(t => t.priority === '!2');
      candidates.sort((a, b) => {
        const typeOrder = { memory: 0, logic: 0, review: 0, normal: 1, output: 1 };
        return (typeOrder[a.slotType] || 2) - (typeOrder[b.slotType] || 2);
      });
      let needed = Math.ceil(tasks.length * 0.6) - p1Count;
      for (const t of candidates) {
        if (needed <= 0) break;
        t.priority = '!1'; needed--;
      }
    }

    const plan = {
      date, tasks, gongjiRatio, tumuRatio, type: mode,
      createdAt: new Date().toISOString(),
      yesterdayStats,
    };
    plans.push(plan);
    this._savePlans(plans);

    if (isToday) {
      this._saveProgress({
        date,
        tasksCompleted: 0,
        totalTasks: tasks.length,
        bankProgress: {
          gongji: { done: 0, total: tasks.filter(t => t.subject === '公基').length },
          tumu: { done: 0, total: tasks.filter(t => t.subject === '土木').length },
        },
      });
    }

    this.viewMode = mode;
    this.render();
  },

  /** 收集昨日练习统计 */
  _getYesterdayStats(log, errors) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().split('T')[0];
    const ydLog = log.filter(l => l.timestamp && l.timestamp.startsWith(yd));
    const ydCorrect = ydLog.filter(l => l.correct).length;
    return {
      total: ydLog.length,
      correct: ydCorrect,
      accuracy: ydLog.length > 0 ? Math.round(ydCorrect / ydLog.length * 100) : null,
      newErrors: errors.filter(e => e.firstWrongAt && e.firstWrongAt.startsWith(yd)).length,
    };
  },

  /** 构建单个任务 */
  _buildTask(slot, subject, weakByBank, dueReviews, sm2Stats, slotIndex, date, yestStats, isToday) {
    const pool = this.TASK_POOL[subject] || this.TASK_POOL['公基'];
    const weakCats = weakByBank[subject] || [];
    const weakStr = weakCats.length > 0 ? weakCats[0] : '基础知识';

    let desc, source = '';
    const totalDue = dueReviews ? dueReviews.length : 0;
    const reviewDue = dueReviews ? dueReviews.filter(d => {
      return d.question && (d.question.bank === subject || (subject === '写作' && d.question.bank === '公基'));
    }) : [];
    const overdueCount = dueReviews ? dueReviews.filter(d => d.nextReviewAt < date).length : 0;

    if (slot.type === 'review') {
      desc = `错题复盘整理（SM-2间隔复习 ${totalDue} 题${overdueCount > 0 ? '，' + overdueCount + '题逾期' : ''}）`;
      if (weakCats.length > 0) desc += ` + ${weakStr}巩固`;
      const avgInt = sm2Stats ? sm2Stats.avgInterval : 0;
      source = `SM-2动态间隔: ${totalDue}题待复习（逾期${overdueCount}，均隔${avgInt}天）`;
    } else if (slot.taskType === 'output') {
      desc = this._pickWritingTask(yestStats);
      source = '写作薄弱项专项训练（每日≥1h）';
    } else if (reviewDue.length > 0 && slot.type === 'normal') {
      desc = `${subject}错题重练（${reviewDue.length}题待复习）`;
      source = `复习优先: SM-2待复习${reviewDue.length}题`;
    } else {
      const tasksForType = pool[slot.taskType] || pool.normal;
      desc = tasksForType[Math.floor(Math.random() * tasksForType.length)];
      desc = desc.replace('{weak}', weakStr);
      source = weakCats.length > 0 ? `薄弱: ${weakStr}` : '常规学习';
    }

    // 昨日练习反馈 → 调整任务描述
    if (yestStats && yestStats.accuracy !== null && slot.type === 'normal' && slotIndex === 3) {
      if (yestStats.accuracy < 50) {
        source += ' | ⚠️ 昨日正确率' + yestStats.accuracy + '%，今日多练';
      } else if (yestStats.accuracy >= 80) {
        source += ' | 昨日正确率良好，可推进';
      }
    }

    const tags = [...(this.SUBJECT_TAGS[subject] || [])];
    if (slot.type === 'review') tags.push('#错题复盘');
    if (desc.includes('模拟卷')) tags.push('#模考');
    if (desc.includes('时政') || desc.includes('申论')) tags.push('#时政');

    let priority;
    if (slot.type === 'memory' || slot.type === 'logic' || slot.type === 'review') {
      priority = '!1';
    } else if (slot.taskType === 'output') {
      priority = '!1';
    } else if (reviewDue.length > 0 && reviewDue.some(r => r.nextReviewAt < date)) {
      priority = '!1';
    } else if (reviewDue.length > 0) {
      priority = '!2';
    } else {
      priority = '!2';
    }

    const isPast = isToday ? this._isSlotPast(slot.time, date) : false;

    // 计算实际可用题量
    const bankMap = { '公基': 'gongji', '土木': 'tumu', '一建': 'tumu', '国考': 'gongji', '写作': 'gongji' };
    const bank = bankMap[subject] || 'gongji';
    const allQ = QuestionBank.getAll().filter(q => q.bank === bank);
    const weakCat = weakCats.length > 0 ? weakCats[0] : null;
    let availableQ = allQ;
    if (weakCat) availableQ = allQ.filter(q => q.category === weakCat);
    if (availableQ.length === 0) availableQ = allQ;

    // SM-2 due reviews count toward expected
    const dueForSubject = dueReviews ? dueReviews.filter(d => d.question && d.question.bank === bank).length : 0;

    // Calculate expected count: target 20-30 questions per hour slot, adjusted by availability
    let expected = Math.min(30, Math.max(10, Math.round(availableQ.length * 0.1)));
    if (slot.type === 'review') expected = dueForSubject > 0 ? Math.min(dueForSubject, 30) : 0;
    if (reviewDue.length > 0 && slot.type === 'normal') expected = Math.min(reviewDue.length, 25);

    return {
      time: slot.time, label: slot.label, type: slot.type, taskType: slot.taskType,
      subject, priority, tags, desc, source,
      expectedCount: expected,
      weakCategory: weakCat || '',
      dueReviewCount: dueForSubject,
      completed: false, correct: 0, total: 0,
      isPast,
    };
  },

  /** 写作任务选择（带AI建议） */
  _pickWritingTask(yestStats) {
    const outputTasks = this.TASK_POOL['写作'].output || [];
    // AI写作建议（如果有缓存）
    const aiTopic = localStorage.getItem('plan_ai_writing_topic');
    if (aiTopic) {
      localStorage.removeItem('plan_ai_writing_topic');
      return aiTopic;
    }
    return outputTasks[Math.floor(Math.random() * outputTasks.length)] || '写作输出练习';
  },

  /** AI生成写作题目 */
  async aiGenerateWritingTopic() {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      App.showToast('请先配置DeepSeek API Key', 'error');
      return;
    }
    App.showToast('AI生成写作题目中...', 'info');
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + ApiConfig.getDeepSeekApiKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是公考/事业编考试写作辅导老师。出1道写作题，只返回题目文本，不要多余的话。' },
            { role: 'user', content: '请出一道适合公务员考试申论或事业单位公文写作的题目。可以是申论大作文题、公文写作题、案例分析题或时事评论题。题目要有明确的材料背景或情景设置，50-100字。' },
          ],
          temperature: 0.8, max_tokens: 256,
        }),
      });
      const data = await resp.json();
      const topic = data.choices[0].message.content.trim();
      localStorage.setItem('plan_ai_writing_topic', 'AI写作: ' + topic);
      App.showToast('AI写作题目已生成，重新生成计划即可使用', 'success');
    } catch (e) {
      App.showToast('AI出题失败: ' + e.message, 'error');
    }
  },

  // ══════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════

  render() {
    const container = document.getElementById('plan-content');
    if (!container) return;

    // 自动修正：如果今日计划已过期，自动切到今日并重新生成
    this._autoAdjust();

    const mode = this.viewMode;
    let html = this._renderTabs();

    if (mode === 'week') {
      html += this._renderWeekView();
    } else if (mode === 'month') {
      html += this._renderMonthView();
    } else {
      html += this._renderDayView(mode);
    }

    container.innerHTML = html;
  },

  /** 自动调整计划 */
  _autoAdjust() {
    const today = new Date().toISOString().split('T')[0];
    const plans = this._getPlans();
    const todayPlan = plans.find(p => p.date === today);

    // 今日无计划 → 自动生成
    if (!todayPlan) {
      const yesterdayPlan = plans.find(p => {
        const d = new Date(); d.setDate(d.getDate() - 1);
        return p.date === d.toISOString().split('T')[0];
      });
      const ratio = yesterdayPlan
        ? { gj: yesterdayPlan.gongjiRatio, tm: yesterdayPlan.tumuRatio }
        : { gj: 30, tm: 70 };
      this.generateForDate('today', ratio.gj, ratio.tm);
      return;
    }

    // 检查已过时段，更新 isPast 标记
    let changed = false;
    todayPlan.tasks.forEach(t => {
      const wasPast = t.isPast;
      t.isPast = this._isSlotPast(t.time, today);
      if (wasPast !== t.isPast) changed = true;
    });
    if (changed) this._savePlans(plans);
  },

  _renderTabs() {
    const modes = [
      { key: 'today',    label: '今日' },
      { key: 'tomorrow', label: '明日' },
      { key: 'week',     label: '本周' },
      { key: 'month',    label: '本月' },
    ];
    const tabs = modes.map(m => {
      const active = m.key === this.viewMode ? 'active' : '';
      return `<button class="plan-tab ${active}" onclick="Plan.viewMode='${m.key}';Plan.render();">${m.label}</button>`;
    }).join('');

    return `<div class="plan-tabs">${tabs}</div>`;
  },

  /** 日视图（今日/明日） */
  _renderDayView(mode) {
    const date = this._getDate(mode);
    const today = new Date().toISOString().split('T')[0];
    const isToday = date === today;
    const plans = this._getPlans();
    const plan = plans.find(p => p.date === date);

    if (!plan) {
      return this._renderEmptyState(mode, date);
    }

    const completedTasks = plan.tasks.filter(t => t.completed).length;
    const totalTasks = plan.tasks.length;
    const activeTasks = plan.tasks.filter(t => !t.isPast).length;
    const pastCount = plan.tasks.filter(t => t.isPast).length;
    const p1Count = plan.tasks.filter(t => t.priority === '!1').length;

    let html = `
      <div class="card plan-summary-card">
        <div class="plan-summary-header">
          <div>
            <strong>${isToday ? '今日' : '明日'}计划</strong>
            <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">${date}</span>
            ${plan.yesterdayStats && plan.yesterdayStats.accuracy !== null ? `
              <span style="font-size:12px;color:${plan.yesterdayStats.accuracy >= 60 ? 'var(--success)' : 'var(--danger)'};margin-left:8px;">
                昨日${plan.yesterdayStats.total}题 正确率${plan.yesterdayStats.accuracy}%
              </span>` : ''}
          </div>
          <span style="font-size:13px;color:var(--text-secondary);">${completedTasks}/${totalTasks} · !1×${p1Count}(${Math.round(p1Count/totalTasks*100)}%) · ${pastCount}已过时</span>
        </div>
        <div class="plan-summary-banks">
          ${['公基','土木','写作'].map(s => {
            const st = plan.tasks.filter(t => t.subject === s);
            const sd = st.filter(t => t.completed).length;
            return `<span class="plan-bank-stat" style="color:${this._subjectColor(s)};">${s} ${sd}/${st.length}</span>`;
          }).join('')}
        </div>
        <div class="plan-progress-track">
          ${['公基','土木','写作'].map(s => {
            const sd = plan.tasks.filter(t => t.subject === s && t.completed).length;
            const w = totalTasks > 0 ? (sd / totalTasks * 100) : 0;
            return `<div class="plan-progress-bar" style="width:${w}%;background:${this._subjectColor(s)};"></div>`;
          }).join('')}
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);line-height:1.6;">
          ${this.REST_SLOTS.join(' | ')}
        </div>
      </div>

      <div class="plan-timeline">`;

    plan.tasks.forEach((task, i) => {
      const statusIcon = task.isPast ? '⏰' : task.completed ? '✅' : (i === completedTasks ? '▶' : '○');
      const cls = task.isPast ? 'plan-task-past' : task.completed ? 'plan-task-done' : (i === completedTasks ? 'plan-task-active' : 'plan-task-pending');
      const bankColor = this._subjectColor(task.subject);

      html += `
        <div class="plan-task ${cls}" style="border-left:3px solid ${bankColor};${task.isPast ? 'opacity:0.45;' : ''}" id="plan-task-${i}">
          <div class="plan-task-header">
            <span class="plan-task-time">${task.time}</span>
            <span class="plan-task-prio" style="background:${task.priority==='!1'?'#ff4d4f':'#faad14'};color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;">${task.priority}</span>
            <span style="font-size:11px;color:${bankColor};font-weight:600;">${task.subject}</span>
            <span style="font-size:10px;color:var(--text-secondary);">${task.label}</span>
            ${task.tags.map(t => `<span class="plan-task-tag">${t}</span>`).join('')}
            <span style="font-size:18px;margin-left:auto;">${statusIcon}</span>
          </div>
          <div class="plan-task-body">
            <strong>${this._esc(task.desc)}</strong>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${task.source} | 预计${task.expectedCount}题</p>
            ${task.completed ? `<p style="font-size:12px;color:var(--success);margin-top:2px;">✓ ${task.correct}/${task.total}</p>` : ''}
            ${task.isPast ? '<p style="font-size:11px;color:#999;">⏰ 已过时</p>' : ''}
          </div>
          ${!task.completed && !task.isPast && isToday ? `<div class="plan-task-actions"><button class="btn btn-sm btn-primary" onclick="Plan.startTask(${i})">开始练习</button></div>` : ''}
        </div>`;
    });

    html += `</div>` + this._renderControls(plan) + this._renderAIChat() + this._renderExamSection(isToday);
    return html;
  },

  /** 空状态 */
  _renderEmptyState(mode, date) {
    const modeLabel = mode === 'tomorrow' ? '明日' : '今日';
    const ratio = mode === 'tomorrow'
      ? (this._getPlans().find(p => p.date === new Date().toISOString().split('T')[0]) || { gongjiRatio: 30, tumuRatio: 70 })
      : { gongjiRatio: 30, tumuRatio: 70 };
    return `
      <div class="card" style="text-align:center;padding:48px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d9d9d9" stroke-width="1"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p style="color:var(--text-secondary);margin:16px 0;">暂无${modeLabel}计划</p>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">SM-2间隔复习 · 番茄60+15 · 记忆逻辑交替 · 写作≥1h</p>
        <div style="margin-bottom:16px;">
          <span style="font-size:12px;color:var(--text-secondary);">公基</span>
          <input type="range" id="plan-gj-ratio" value="${ratio.gongjiRatio}" min="0" max="100" step="5" style="width:100px;vertical-align:middle;margin:0 6px;" oninput="document.getElementById('plan-tm-pct').textContent=100-this.value+'%';document.getElementById('plan-gj-pct').textContent=this.value+'%';">
          <span id="plan-gj-pct" style="font-size:12px;font-weight:600;">${ratio.gongjiRatio}%</span>
          <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">土木</span>
          <span id="plan-tm-pct" style="font-size:12px;font-weight:600;">${ratio.tumuRatio}%</span>
        </div>
        <button class="btn btn-primary" onclick="Plan.generateForDate('${mode}', parseInt(document.getElementById('plan-gj-ratio').value), 100-parseInt(document.getElementById('plan-gj-ratio').value))">生成${modeLabel}计划</button>
        <button class="btn btn-outline" onclick="Plan.aiGenerateWritingTopic()" style="margin-left:8px;color:#722ed1;border-color:#d9b3ff;">🤖 AI出写作题</button>
      </div>`;
  },

  /** 控制栏 */
  _renderControls(plan) {
    return `
      <div class="card" style="margin-top:16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-weight:600;">计划设置</span>
          <span style="font-size:13px;color:var(--text-secondary);">公基${plan.gongjiRatio}% / 土木${plan.tumuRatio}%</span>
          <button class="btn btn-sm btn-outline" onclick="Plan.generateForDate('${plan.type}', ${plan.gongjiRatio}, ${plan.tumuRatio})">重新生成</button>
          <button class="btn btn-sm btn-outline" onclick="Plan.aiGenerateWritingTopic()" style="color:#722ed1;border-color:#d9b3ff;">🤖 AI出写作题</button>
          <button class="btn btn-sm btn-default" onclick="Plan.exportTickTick()">📋 TickTick</button>
          <button class="btn btn-sm btn-default" onclick="Plan.exportText()">📝 下载</button>
        </div>
      </div>`;
  },

  /** 周视图 */
  _renderWeekView() {
    const week = this._getWeekRange();
    const plans = this._getPlans();
    const allQ = QuestionBank.getAll();
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const errors = ErrorNotebook.getAll();

    let html = `<div class="card" style="margin-bottom:16px;">
      <div class="plan-summary-header">
        <strong>本周计划</strong>
        <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">${week.start} ~ ${week.end}</span>
      </div>`;

    // 每日汇总
    html += '<div class="week-grid">';
    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    week.days.forEach((day, i) => {
      const plan = plans.find(p => p.date === day);
      const dayLog = log.filter(l => l.timestamp && l.timestamp.startsWith(day));
      const dayCorrect = dayLog.filter(l => l.correct).length;
      const today = new Date().toISOString().split('T')[0];
      const isCurrentDay = day === today;
      const isPast = day < today;

      let status = '';
      if (plan) {
        const done = plan.tasks.filter(t => t.completed).length;
        status = `计划${plan.tasks.length}时段 · 完成${done}`;
      }
      const practiceInfo = dayLog.length > 0 ? `练习${dayLog.length}题 正确率${Math.round(dayCorrect/dayLog.length*100)}%` : '';

      html += `
        <div class="week-day-card ${isCurrentDay ? 'week-today' : ''} ${isPast ? 'week-past' : ''}">
          <div class="week-day-header">周${dayNames[i]} ${day.slice(5)} ${isCurrentDay ? '📍' : ''}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${status || '未安排'}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${practiceInfo || '未练习'}</div>
        </div>`;
    });
    html += '</div>';

    // 自动生成建议：对未安排的日子给出建议
    html += '<div style="margin-top:12px;font-size:12px;color:var(--text-secondary);">';
    const emptyDays = week.days.filter(d => d >= new Date().toISOString().split('T')[0] && !plans.find(p => p.date === d));
    if (emptyDays.length > 0) {
      html += `⚠️ ${emptyDays.length}天未安排计划。`;
      html += ` <button class="btn btn-sm btn-primary" onclick="Plan._autoGenerateWeek('${week.start}')">一键生成周计划</button>`;
    } else {
      html += '✅ 本周每日均已安排计划';
    }
    html += '</div>';

    // 周统计
    const weekLog = log.filter(l => l.timestamp && l.timestamp >= week.start && l.timestamp <= week.end + 'T23:59:59');
    const wkCorrect = weekLog.filter(l => l.correct).length;
    const wkAccuracy = weekLog.length > 0 ? Math.round(wkCorrect / weekLog.length * 100) : 0;
    const weekErrors = errors.filter(e => e.firstWrongAt && e.firstWrongAt >= week.start && e.firstWrongAt <= week.end + 'T23:59:59').length;

    html += `
      <div class="week-stats" style="margin-top:16px;display:flex;gap:16px;flex-wrap:wrap;">
        <div class="week-stat-item"><strong>${weekLog.length}</strong><span>本周练习</span></div>
        <div class="week-stat-item"><strong style="color:${wkAccuracy>=60?'var(--success)':'var(--danger)'};">${wkAccuracy}%</strong><span>正确率</span></div>
        <div class="week-stat-item"><strong>${weekErrors}</strong><span>新增错题</span></div>
        <div class="week-stat-item"><strong>${allQ.length}</strong><span>题库总数</span></div>
      </div></div>`;

    // 周目标
    html += this._renderGoalsSection();
    return html;
  },

  /** 月视图 */
  _renderMonthView() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const plans = this._getPlans();
    const goals = this._getGoals();

    const monthLog = log.filter(l => l.timestamp && l.timestamp >= monthStart && l.timestamp <= monthEnd + 'T23:59:59');
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const planDays = plans.filter(p => p.date >= monthStart && p.date <= monthEnd).length;
    const practicedDays = new Set(monthLog.map(l => (l.timestamp || '').slice(0, 10))).size;
    const correct = monthLog.filter(l => l.correct).length;

    let html = `<div class="card plan-summary-card">
      <div class="plan-summary-header">
        <strong>本月概览</strong>
        <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">${monthStart} ~ ${monthEnd}</span>
      </div>
      <div class="week-stats" style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;">
        <div class="week-stat-item"><strong>${monthLog.length}</strong><span>月练习量</span></div>
        <div class="week-stat-item"><strong>${correct}</strong><span>答对</span></div>
        <div class="week-stat-item"><strong>${practicedDays}/${totalDays}</strong><span>打卡天数</span></div>
        <div class="week-stat-item"><strong>${planDays}</strong><span>计划日</span></div>
      </div>

      <div class="month-track" style="margin-top:16px;">
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">本月打卡 ${Math.round(practicedDays/totalDays*100)}%</div>
        <div class="month-track-bar"><div class="month-track-fill" style="width:${Math.round(practicedDays/totalDays*100)}%;"></div></div>
      </div>
    </div>`;

    html += this._renderGoalsSection();
    return html;
  },

  /** 考试来源管理卡片 */
  _renderExamSection(isToday) {
    const allExams = (typeof ExamDates !== 'undefined') ? ExamDates.exams : this.KNOWN_EXAMS;
    const allQ = QuestionBank.getAll();
    const errors = ErrorNotebook.getAll();
    const today = new Date().toISOString().split('T')[0];

    // 分离：考试 vs 里程碑、即将 vs 已完成
    const isUpcoming = e => e.status === 0 && e.date >= today;
    const upcoming = allExams.filter(isUpcoming).sort((a, b) => a.date.localeCompare(b.date));
    const exams = upcoming.filter(e => !e.milestone);
    const milestones = upcoming.filter(e => e.milestone);
    const completed = allExams.filter(e => e.status === 2).sort((a, b) => b.date.localeCompare(a.date));
    if (upcoming.length === 0 && completed.length === 0) return '';

    let html = `<div class="card" style="margin-top:16px;">
      <div class="plan-summary-header">
        <strong>📑 考试日历</strong>
        <span style="font-size:11px;color:var(--text-secondary);">同步自滴答清单</span>
      </div>`;

    // 里程碑（报名、确认、准考证）
    if (milestones.length > 0) {
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
      milestones.forEach(m => {
        const days = ExamDates.countdown ? ExamDates.countdown(m.date) : this._getDays(today, m.date);
        const urgency = days === 0 ? '今天!' : `${days}天后`;
        html += `
          <div style="padding:6px 12px;border-radius:6px;background:${days===0?'#fff2f0':'#fff7e6'};border:1px solid ${days===0?'#ff4d4f':'#fa8c16'};font-size:12px;">
            <strong>📌 ${m.name}</strong>
            <span style="color:${days===0?'#ff4d4f':'#fa8c16'};margin-left:4px;">${m.date} ${urgency}</span>
            <span style="font-size:10px;color:var(--text-secondary);margin-left:4px;">${m.milestone}</span>
          </div>`;
      });
      html += `</div>`;
    }

    // 考试
    if (exams.length > 0) {
      html += `<div class="exam-target-list" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">`;
      exams.forEach(exam => {
        const days = ExamDates.countdown ? ExamDates.countdown(exam.date) : this._getDays(today, exam.date);
        let urgency, bg;
        if (days <= 3) { urgency = `${days}天!`; bg = '#fff2f0'; }
        else if (days <= 7) { urgency = `${days}天`; bg = '#fff7e6'; }
        else { urgency = `${days}天`; bg = '#f0f5ff'; }

        const bank = exam.subject.includes('一建') || exam.subject.includes('土木') ? 'tumu' : 'gongji';
        const bankQ = allQ.filter(q => q.bank === bank);
        const errCount = errors.filter(e => !e.mastered).length;

        html += `
          <div class="exam-target-card" style="flex:1;min-width:170px;max-width:260px;padding:12px;border-radius:8px;border:1px solid ${days<=3?'#ff4d4f':days<=7?'#fa8c16':'var(--border)'};background:${bg};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:13px;">${exam.name}</strong>
              <span style="font-size:11px;color:var(--text-secondary);">${exam.subject}</span>
            </div>
            <div style="margin-top:4px;font-size:12px;font-weight:600;color:${days<=3?'#ff4d4f':days<=7?'#fa8c16':'var(--primary)'};">
              📅 ${exam.date} · ${urgency}
            </div>
            <div style="margin-top:6px;font-size:11px;color:var(--text-secondary);line-height:1.6;">
              题库: ${bankQ.length}题 | 待复习: ${errCount}题
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;

    // 已完成
    if (completed.length > 0) {
      html += `<div class="card" style="margin-top:8px;opacity:0.7;">
        <div class="plan-summary-header" style="margin-bottom:6px;">
          <strong style="font-size:13px;color:var(--text-secondary);">✅ 已完成考试</strong>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--text-secondary);">`;
      completed.forEach(e => {
        html += `<span style="padding:2px 8px;background:#f6ffed;border-radius:4px;">${e.name} ${e.date}</span>`;
      });
      html += `</div></div>`;
    }

    return html;
  },

  _getDays(today, date) {
    return Math.ceil((new Date(date) - new Date(today)) / 86400000);
  },

  /** 一键生成整周计划 */
  _autoGenerateWeek(startDate) {
    const week = this._getWeekRange();
    const upcoming = (typeof ExamDates !== 'undefined') ? ExamDates.getUpcoming() : [];
    const plans = this._getPlans();
    let generated = 0;

    week.days.forEach(day => {
      if (day < new Date().toISOString().split('T')[0]) return; // 跳过已过
      if (plans.find(p => p.date === day)) return; // 已有计划

      // 确认当天是否有考试，调整科目比例
      const examOnDay = upcoming.find(e => e.date === day);
      let gjRatio = 30, tmRatio = 70;
      if (examOnDay) {
        if (examOnDay.subject.includes('一建') || examOnDay.subject.includes('土木')) {
          gjRatio = 20; tmRatio = 80;
        } else {
          gjRatio = 60; tmRatio = 40;
        }
      }
      this.generateForDate(day === new Date().toISOString().split('T')[0] ? 'today' : 'tomorrow', gjRatio, tmRatio);
      generated++;
    });

    this.viewMode = 'week';
    this.render();
    App.showToast(`已生成 ${generated} 天计划`, 'success');
  },

  /** AI 对话修改计划 */
  _chatHistory: [], // AI 对话历史

  async _aiModifyPlan() {
    if (!ApiConfig.hasDeepSeekApiKey()) {
      App.showToast('请先配置DeepSeek API Key', 'error');
      return;
    }
    const input = document.getElementById('plan-ai-input');
    if (!input || !input.value.trim()) return;
    const msg = input.value.trim();
    input.value = '';
    input.disabled = true;

    const chatDiv = document.getElementById('plan-ai-chat');
    if (chatDiv) chatDiv.innerHTML += `<div style="margin-top:4px;font-size:12px;color:var(--primary);">🙋 ${this._esc(msg)}</div><div class="ai-thinking" style="font-size:11px;color:var(--text-secondary);">AI 思考中...</div>`;

    const date = this._getDate(this.viewMode);
    const plans = this._getPlans();
    const plan = plans.find(p => p.date === date);
    const planSummary = plan
      ? plan.tasks.map(t => `${t.time} ${t.priority} ${t.subject} ${t.desc} (来源:${t.source})`).join('\n')
      : '尚未生成计划';

    const examInfo = (typeof ExamDates !== 'undefined')
      ? ExamDates.getUpcoming().map(e => `${e.name} ${e.date} ${ExamDates.countdown(e.date)}天后`).join('\n')
      : '';

    try {
      const result = await ApiConfig.aiModifyPlan(msg, planSummary, examInfo, date, this._chatHistory);
      const reply = result.reply || result;

      if (chatDiv) {
        chatDiv.innerHTML = chatDiv.innerHTML.replace(/<div class="ai-thinking".*?<\/div>/, '');
        chatDiv.innerHTML += `<div style="margin-top:4px;padding:8px;background:#f0f5ff;border-radius:6px;font-size:12px;line-height:1.6;">🤖 ${this._esc(reply)}</div>`;
      }

      // 保存对话历史
      this._chatHistory.push({ role: 'user', content: msg });
      this._chatHistory.push({ role: 'assistant', content: reply });
      // 限制历史长度
      if (this._chatHistory.length > 10) this._chatHistory = this._chatHistory.slice(-10);

      // 自动应用修改
      if (plan && result.changes && result.changes.length > 0) {
        this._applyAISuggestions(result.changes, plan);
      } else {
        // 尝试从文本中解析
        const parsed = this._parseChanges(reply, plan);
        if (parsed.length > 0) {
          this._applyAISuggestions(parsed, plan);
        }
      }
    } catch(e) {
      if (chatDiv) chatDiv.innerHTML += `<div style="color:var(--danger);font-size:11px;">AI 请求失败: ${this._esc(e.message)}</div>`;
    }
    input.disabled = false;
    input.focus();
  },

  /** 解析 AI 回复中的修改建议 */
  _parseChanges(reply, plan) {
    const changes = [];
    const lines = reply.split('\n');
    const timeRegex = /(\d{1,2}:\d{2}-\d{1,2}:\d{2})/;
    const timeSlots = new Set(plan.tasks.map(t => t.time));

    lines.forEach(line => {
      const match = line.match(timeRegex);
      if (match) {
        const time = match[1];
        if (timeSlots.has(time)) {
          const desc = line.replace(timeRegex, '').replace(/^[：:\s]+/, '').replace(/^[-—–]\s*/, '').trim();
          if (desc) changes.push({ time, desc });
        }
      }
    });

    // 如果没有时段匹配，尝试关键词修改
    if (changes.length === 0) {
      const lower = reply.toLowerCase();
      plan.tasks.forEach(t => {
        // 检测到对特定时段的描述
        if (lower.includes(t.time) || lower.includes(t.label)) {
          // 从上下文中提取描述
          const sentences = reply.split(/[。；\n]/);
          for (const s of sentences) {
            if (s.includes(t.time) || s.includes(t.label)) {
              const desc = s.replace(/^[•\-\*\d\.\s]+/, '').replace(t.time, '').replace(t.label, '').replace(/[：:，,]\s*/g, '').trim();
              if (desc.length > 2) changes.push({ time: t.time, desc });
              break;
            }
          }
        }
      });
    }

    return changes;
  },

  /** 应用修改 */
  _applyAISuggestions(changes, plan) {
    if (!plan) return;
    let applied = 0;
    changes.forEach(c => {
      const task = plan.tasks.find(t => t.time === c.time);
      if (task) {
        task.desc = c.desc;
        task.source = 'AI 建议修改';
        applied++;
      }
    });
    if (applied === 0) return;
    this._savePlans(this._getPlans().map(p => p.date === plan.date ? plan : p));
    this.render();
    App.showToast(`计划已调整 ${applied} 个时段`, 'success');
    Sync.push().catch(() => {});
  },

  /** 渲染 AI 对话区 */
  _renderAIChat() {
    return `
      <div class="card" style="margin-top:16px;">
        <div class="plan-summary-header">
          <strong>🤖 AI 计划助手</strong>
          <span style="font-size:11px;color:var(--text-secondary);">自然语言修改计划</span>
        </div>
        <div id="plan-ai-chat" style="max-height:300px;overflow-y:auto;margin-bottom:8px;"></div>
        <div style="display:flex;gap:6px;">
          <input id="plan-ai-input" placeholder="例：把上午的写作调到晚上、增加公基法律训练、明天考前冲刺..." style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;" onkeydown="if(event.key==='Enter'){event.preventDefault();Plan._aiModifyPlan();}">
          <button class="btn btn-sm btn-primary" onclick="Plan._aiModifyPlan()">发送</button>
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--text-secondary);">
          你可以说：调整时间段内容、增加某科目、考前冲刺、改优先级、换写作题
        </div>
      </div>`;
  },

  /** 编辑考试目标 */
  _editExamTargets() {
    const targets = this._getExamTargets() || { active: ['zhuhui', 'wangcheng', 'yijian', 'tumu'], customDate: {} };

    let msg = '选择本月备考目标（输入序号用逗号分隔）：\n\n';
    this.KNOWN_EXAMS.forEach((e, i) => {
      const active = targets.active.includes(e.id) ? ' ✓' : '';
      const d = targets.customDate[e.id] || e.date || '待定';
      msg += `${i + 1}. ${e.name} (${e.subject}) ${d}${active}\n`;
    });

    const input = prompt(msg, targets.active.map(id => this.KNOWN_EXAMS.findIndex(e => e.id === id) + 1).join(','));
    if (input === null) return;

    const indices = input.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < this.KNOWN_EXAMS.length);
    const newActive = indices.map(i => this.KNOWN_EXAMS[i].id);

    // Ask for custom dates
    if (!targets.customDate) targets.customDate = {};
    for (const i of indices) {
      const exam = this.KNOWN_EXAMS[i];
      const currentDate = targets.customDate[exam.id] || exam.date || '';
      const newDate = prompt(`${exam.name} 考试日期（留空=待定）：`, currentDate);
      if (newDate !== null) targets.customDate[exam.id] = newDate || null;
    }

    targets.active = newActive;
    this._saveExamTargets(targets);
    this.render();
    App.showToast('考试目标已更新', 'success');
  },

  _renderGoalsSection() {
    const goals = this._getGoals();
    const currentGoal = goals.find(g => {
      const now = new Date(); const m = now.getMonth() + 1;
      return g.month === m && g.year === now.getFullYear();
    });

    let html = `<div class="card" style="margin-top:16px;">
      <div class="plan-summary-header">
        <strong>📌 本月目标</strong>
      </div>`;

    if (currentGoal) {
      html += `
        <div style="margin-top:8px;font-size:13px;line-height:1.8;">
          <p>🎯 <strong>总目标：</strong>${this._esc(currentGoal.text || '未设定')}</p>
          <p>📊 练习目标: <strong>${currentGoal.practiceTarget || 0}</strong> 题 |
             打卡目标: <strong>${currentGoal.checkinTarget || 0}</strong> 天 |
             掌握目标: <strong>${currentGoal.masterTarget || 0}</strong> 题</p>
        </div>
        <button class="btn btn-sm btn-outline" onclick="Plan._editGoal()" style="margin-top:8px;">✏️ 编辑目标</button>`;
    } else {
      html += `
        <p style="color:var(--text-secondary);font-size:13px;margin:12px 0;">尚未设定本月目标</p>
        <button class="btn btn-sm btn-primary" onclick="Plan._editGoal()">设定本月目标</button>`;
    }

    html += '</div>';
    return html;
  },

  /** 编辑月度目标 */
  _editGoal() {
    const now = new Date();
    const goals = this._getGoals();
    let goal = goals.find(g => g.month === now.getMonth() + 1 && g.year === now.getFullYear());
    if (!goal) {
      goal = { year: now.getFullYear(), month: now.getMonth() + 1, text: '', practiceTarget: 500, checkinTarget: 20, masterTarget: 200 };
      goals.push(goal);
    }

    const text = prompt('本月总目标（如"公基法律模块 + 一建施工技术"）：', goal.text || '');
    if (text === null) return;
    const practiceTarget = parseInt(prompt('本月练习题目数目标：', goal.practiceTarget || 500)) || 0;
    const checkinTarget = parseInt(prompt('本月打卡天数目标：', goal.checkinTarget || 20)) || 0;
    const masterTarget = parseInt(prompt('本月掌握题目数目标：', goal.masterTarget || 200)) || 0;

    goal.text = text;
    goal.practiceTarget = practiceTarget;
    goal.checkinTarget = checkinTarget;
    goal.masterTarget = masterTarget;
    this._saveGoals(goals);
    this.render();
    App.showToast('目标已保存', 'success');
  },

  // ══════════════════════════════════════════

  startTask(taskIndex) {
    const plans = this._getPlans();
    const date = this._getDate(this.viewMode);
    const plan = plans.find(p => p.date === date);
    if (!plan || !plan.tasks[taskIndex]) return;
    const task = plan.tasks[taskIndex];
    if (task.isPast) { App.showToast('该时段已过', 'error'); return; }

    const bankMap = { '公基': 'gongji', '土木': 'tumu', '一建': 'tumu', '国考': 'gongji', '写作': 'gongji' };
    const bank = bankMap[task.subject] || 'all';

    // Configure practice for this plan task
    Practice.bankFilter = bank;
    Practice.categoryFilter = task.weakCategory || 'all';
    Practice.practiceCount = task.expectedCount || 20;
    Practice.skipPracticed = true; // Don't repeat already-practiced questions

    localStorage.setItem('practice_bank_filter', bank);
    localStorage.setItem('practice_cat_filter', task.weakCategory || 'all');
    localStorage.setItem('practice_count', task.expectedCount || 20);

    // Store task context for auto-adjust after practice
    this._activeTaskIndex = taskIndex;

    App.navigateTo('practice');
    // Use targeted mode: review questions first, then weak category questions
    if (task.source.includes('SM-2') || task.source.includes('复习优先')) {
      Practice.start('errors');
    } else {
      Practice.start('plan'); // New mode: respects plan task parameters
    }
  },

  /** After practice, auto-adjust remaining plan tasks */
  _adjustAfterPractice(correct, total, bank) {
    const today = new Date().toISOString().split('T')[0];
    const plans = this._getPlans();
    const plan = plans.find(p => p.date === today);
    if (!plan) return;

    // Find and complete the next uncompleted same-subject task
    const subjMap = { gongji: '公基', tumu: '土木' };
    const subject = subjMap[bank] || '公基';
    const idx = plan.tasks.findIndex(t => !t.completed && t.subject === subject);
    if (idx >= 0) {
      plan.tasks[idx].completed = true;
      plan.tasks[idx].correct = correct;
      plan.tasks[idx].total = total;
    }

    // Reduce expectedCount for remaining same-subject tasks
    const accuracy = total > 0 ? Math.round(correct / total * 100) : 0;
    plan.tasks.forEach(t => {
      if (!t.completed && t.subject === subject && t.expectedCount > 0) {
        if (accuracy >= 80) {
          t.expectedCount = Math.max(5, Math.round(t.expectedCount * 0.7));
          t.source = t.source.replace('常规学习', '正确率高，减量') || t.source;
        } else if (accuracy < 50) {
          t.expectedCount = Math.round(t.expectedCount * 1.3);
          t.source = t.source.replace('常规学习', '正确率低，加量') || t.source;
        }
      }
    });

    this._savePlans(plans);

    // Update progress record
    const progress = this._getProgress() || { date: today, tasksCompleted: 0, totalTasks: plan.tasks.length, bankProgress: { gongji: { done: 0, total: 0 }, tumu: { done: 0, total: 0 } } };
    progress.tasksCompleted = plan.tasks.filter(t => t.completed).length;
    const gj = plan.tasks.filter(t => t.subject === '公基');
    const tm = plan.tasks.filter(t => t.subject === '土木');
    progress.bankProgress.gongji = { done: gj.filter(t => t.completed).length, total: gj.length };
    progress.bankProgress.tumu = { done: tm.filter(t => t.completed).length, total: tm.length };
    this._saveProgress(progress);

    if (App.updateStats) App.updateStats();
  },

  updateProgress(bank, correct, total) {
    // Delegate to auto-adjust
    this._adjustAfterPractice(correct, total, bank);
  },

    const subjMap = { gongji: '公基', tumu: '土木' };
    const subject = subjMap[bank] || '公基';
    const idx = plan.tasks.findIndex(t => !t.completed && t.subject === subject);
    if (idx === -1) return;

    plan.tasks[idx].completed = true;
    plan.tasks[idx].correct = correct;
    plan.tasks[idx].total = total;
    this._savePlans(plans);

    const progress = this._getProgress() || { date: today, tasksCompleted: 0, totalTasks: plan.tasks.length, bankProgress: { gongji: { done: 0, total: 0 }, tumu: { done: 0, total: 0 } } };
    progress.tasksCompleted = plan.tasks.filter(t => t.completed).length;
    const gj = plan.tasks.filter(t => t.subject === '公基');
    const tm = plan.tasks.filter(t => t.subject === '土木');
    progress.bankProgress.gongji = { done: gj.filter(t => t.completed).length, total: gj.length };
    progress.bankProgress.tumu = { done: tm.filter(t => t.completed).length, total: tm.length };
    this._saveProgress(progress);

    if (App.updateStats) App.updateStats();
  },

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

  // ══════════════════════════════════════════
  // 导出
  // ══════════════════════════════════════════

  exportTickTick() {
    const date = this._getDate(this.viewMode);
    const plan = this._getPlans().find(p => p.date === date);
    if (!plan) { alert('请先生成计划'); return; }

    const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    let text = `【${dateStr} 学习计划】\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    plan.tasks.forEach(t => {
      if (!t.isPast) text += `${t.time} ${t.priority} ${t.tags.join(' ')} ${t.desc}\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    const p1 = plan.tasks.filter(t => t.priority === '!1').length;
    text += `${plan.tasks.length}时段 · !1:${p1}个(${Math.round(p1/plan.tasks.length*100)}%)\n规则：番茄60+15 · 记忆逻辑交替 · 写作≥1h · 复习优先`;

    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板！');
    }).catch(() => {
      const el = document.createElement('textarea'); el.value = text;
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      alert('已复制到剪贴板！');
    });
  },

  exportText() {
    const date = this._getDate(this.viewMode);
    const plan = this._getPlans().find(p => p.date === date);
    if (!plan) { alert('请先生成计划'); return; }

    let text = `学习计划 - ${date}\n\n`;
    text += `休息: ${this.REST_SLOTS.join(' | ')}\n\n`;
    plan.tasks.forEach(t => {
      text += `${t.time} [${t.priority}] ${t.subject} ${t.label}\n  ${t.desc}  [${t.tags.join(' ')}]\n  来源: ${t.source}`;
      if (t.completed) text += `\n  ✓ ${t.correct}/${t.total}`;
      if (t.isPast) text += `\n  ⏰ 已过时`;
      text += `\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `学习计划_${date}.txt`;
    a.click(); URL.revokeObjectURL(url);
  },

  _subjectColor(subj) {
    const map = { '公基': '#722ed1', '一建': '#eb2f96', '国考': '#fa8c16', '土木': '#13c2c2', '写作': '#fa541c' };
    return map[subj] || '#666';
  },
  _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
};
