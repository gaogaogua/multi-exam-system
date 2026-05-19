/**
 * 模拟考试模块 - 限时考试、自动评分
 */
const Exam = {
  questions: [],
  userAnswers: {},
  timer: null,
  timeLeft: 0,
  totalTime: 0,
  submitted: false,

  /**
   * 开始考试
   */
  start() {
    const count = parseInt(document.getElementById('exam-count').value) || 20;
    const time = parseInt(document.getElementById('exam-time').value) || 0;
    const source = document.getElementById('exam-source').value;
    const gongjiRatio = parseInt(document.getElementById('exam-gongji-ratio')?.value || '30');

    let pool;
    if (source === 'errors') {
      pool = ErrorNotebook.getReviewList().map(r => r.question).filter(Boolean);
    } else {
      pool = QuestionBank.getAll();
    }

    if (pool.length === 0) {
      App.showToast('没有可用的题目', 'info');
      return;
    }

    // Split pool by bank if source is 'all'
    if (source === 'all') {
      const gongji = pool.filter(q => q.bank === 'gongji');
      const tumu = pool.filter(q => q.bank === 'tumu');
      const other = pool.filter(q => !q.bank || (q.bank !== 'gongji' && q.bank !== 'tumu'));

      // If both banks are present, sample proportionally
      if (gongji.length > 0 && tumu.length > 0) {
        const gongjiCount = Math.round(count * gongjiRatio / 100);
        const tumuCount = count - gongjiCount;

        const shuffledGongji = Practice.shuffle([...gongji]).slice(0, Math.min(gongjiCount, gongji.length));
        const shuffledTumu = Practice.shuffle([...tumu]).slice(0, Math.min(tumuCount, tumu.length));

        let combined = [...shuffledGongji, ...shuffledTumu];
        // If not enough from target banks, fill from other
        if (combined.length < count) {
          const fill = Practice.shuffle([...other, ...gongji.slice(shuffledGongji.length), ...tumu.slice(shuffledTumu.length)])
            .slice(0, count - combined.length);
          combined = [...combined, ...fill];
        }
        this.questions = Practice.shuffle(combined).slice(0, count);
        App.showToast(`公基 ${shuffledGongji.length} 题 + 土木 ${shuffledTumu.length} 题（${gongjiRatio}/${100-gongjiRatio}）`, 'info');
      } else {
        // One bank not available, fall back to random from whatever is present
        this.questions = this.shuffle([...pool]).slice(0, Math.min(count, pool.length));
        if (gongji.length === 0 && tumu.length === 0) {
          App.showToast('题库未标记bank，使用随机抽题', 'info');
        }
      }
    } else {
      this.questions = this.shuffle([...pool]).slice(0, Math.min(count, pool.length));
    }

    if (this.questions.length === 0) {
      App.showToast('没有足够的题目', 'info');
      return;
    }

    this.userAnswers = {};
    this.submitted = false;
    this.totalTime = time * 60;
    this.timeLeft = this.totalTime;

    document.getElementById('exam-setup').style.display = 'none';
    document.getElementById('exam-area').style.display = 'block';
    this.renderExam();

    if (time > 0) {
      this.startTimer();
    }
  },

  /**
   * 开始计时器
   */
  startTimer() {
    this.updateTimer();
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateTimer();
      if (this.timeLeft <= 0) {
        this.autoSubmit();
      }
    }, 1000);
  },

  /**
   * 更新计时器显示
   */
  updateTimer() {
    const mins = Math.floor(this.timeLeft / 60);
    const secs = this.timeLeft % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('exam-timer-display');
    if (el) {
      el.textContent = display;
      if (this.timeLeft < 300) el.classList.add('warning');
    }
  },

  /**
   * 渲染考试界面
   */
  renderExam() {
    const area = document.getElementById('exam-area');
    const current = this.userAnswers ? Object.keys(this.userAnswers).length : 0;
    const total = this.questions.length;

    let html = `
      <div class="practice-container">
        <div class="exam-header">
          <div>
            <strong>模拟考试</strong>
            <span style="color:var(--text-secondary);margin-left:8px;">${total} 题</span>
          </div>
          ${this.totalTime > 0 ? `<div class="exam-timer" id="exam-timer-display">--:--</div>` : '<span style="color:var(--text-secondary);">不限时</span>'}
          <button class="btn btn-primary" onclick="Exam.submit()">交卷</button>
        </div>
        <div class="exam-quick-nav" id="exam-quick-nav">
          ${this.questions.map((q, i) => `
            <div class="exam-nav-btn" id="nav-btn-${i}" onclick="Exam.goToQuestion(${i})">${i + 1}</div>
          `).join('')}
        </div>
        <div id="exam-current-question"></div>
        <div class="practice-actions">
          <button class="btn btn-outline" id="exam-prev-btn" onclick="Exam.goToQuestion(${this.getCurrentIndex() - 1})">上一题</button>
          <span style="padding:8px 16px;font-size:14px;color:var(--text-secondary);" id="exam-progress-text">${current}/${total}</span>
          <button class="btn btn-outline" id="exam-next-btn" onclick="Exam.goToQuestion(${this.getCurrentIndex() + 1})">下一题</button>
        </div>
      </div>`;

    area.innerHTML = html;
    this.goToQuestion(0);
  },

  /**
   * 获取当前显示的题目索引
   */
  getCurrentIndex() {
    const el = document.getElementById('exam-current-question');
    return el ? parseInt(el.dataset.index || '0') : 0;
  },

  /**
   * 跳转到指定题目
   */
  goToQuestion(index) {
    if (index < 0 || index >= this.questions.length) return;

    const container = document.getElementById('exam-current-question');
    if (!container) return;

    container.dataset.index = index;
    const q = this.questions[index];
    const savedAnswer = this.userAnswers[q.id] || '';
    const answered = Object.keys(this.userAnswers).filter(k => this.userAnswers[k]).length;

    // 更新导航按钮状态
    document.querySelectorAll('.exam-nav-btn').forEach((btn, i) => {
      btn.classList.remove('current');
      if (this.userAnswers[this.questions[i].id]) btn.classList.add('answered');
    });
    const navBtn = document.getElementById(`nav-btn-${index}`);
    if (navBtn) navBtn.classList.add('current');

    // 更新进度
    const progressEl = document.getElementById('exam-progress-text');
    if (progressEl) progressEl.textContent = `${answered}/${this.questions.length}`;

    // 更新按钮状态
    const prevBtn = document.getElementById('exam-prev-btn');
    const nextBtn = document.getElementById('exam-next-btn');
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index >= this.questions.length - 1 ? '最后一题' : '下一题';

    let html = `
      <div class="practice-question-card">
        <span class="question-type-badge">${App.getTypeName(q.type)} | ${q.category || '未分类'}</span>
        <div class="question-text">${index + 1}. ${Practice.escapeHtml(q.title)}</div>`;

    if (q.options && q.options.length > 0) {
      html += `<div class="options-list">`;
      const isMulti = q.type === 'multiple';
      const inputType = isMulti ? 'checkbox' : 'radio';
      q.options.forEach(opt => {
        const selected = savedAnswer.includes(opt.label);
        html += `
          <div class="option-item ${selected ? 'selected' : ''}" onclick="Exam.selectAnswer('${q.id}', '${opt.label}', '${inputType}')">
            <input type="${inputType}" name="exam_q_${q.id}" value="${opt.label}" ${selected ? 'checked' : ''} style="pointer-events:none;">
            <span class="option-label">${opt.label}.</span> ${Practice.escapeHtml(opt.text)}
          </div>`;
      });
      html += `</div>`;
    } else {
      html += `
        <div class="form-group">
          <textarea rows="4" placeholder="请输入答案..." onchange="Exam.saveTextAnswer('${q.id}', this.value)">${Practice.escapeHtml(savedAnswer)}</textarea>
        </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  },

  /**
   * 选择答案
   */
  selectAnswer(questionId, label, inputType) {
    if (this.submitted) return;
    if (inputType === 'radio') {
      this.userAnswers[questionId] = label;
    } else {
      const current = this.userAnswers[questionId] || '';
      this.userAnswers[questionId] = current.includes(label)
        ? current.replace(label, '')
        : (current + label).split('').sort().join('');
    }
    this.goToQuestion(this.getCurrentIndex());
  },

  /**
   * 保存文本答案
   */
  saveTextAnswer(questionId, value) {
    this.userAnswers[questionId] = value;
  },

  /**
   * 提交考试
   */
  submit() {
    const answered = Object.values(this.userAnswers).filter(a => a && a.trim()).length;
    if (answered < this.questions.length) {
      if (!confirm(`还有 ${this.questions.length - answered} 题未作答，确定交卷吗？`)) return;
    }
    this.autoSubmit();
  },

  /**
   * 自动交卷
   */
  autoSubmit() {
    if (this.submitted) return;
    this.submitted = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    let correct = 0;
    const results = this.questions.map(q => {
      const userAnswer = this.userAnswers[q.id] || '';
      const isCorrect = Practice.checkAnswer(q, userAnswer);
      if (isCorrect) correct++;

      // 记录错题
      if (!isCorrect) {
        ErrorNotebook.addError(q.id, userAnswer);
      }

      return { questionId: q.id, userAnswer, correct: isCorrect };
    });

    // 保存考试记录
    const examLog = Storage.get(Storage.KEYS.EXAM_LOG) || [];
    examLog.push({
      date: new Date().toISOString(),
      total: this.questions.length,
      correct,
      accuracy: Math.round((correct / this.questions.length) * 100),
      timeUsed: this.totalTime - this.timeLeft,
      results,
    });
    Storage.set(Storage.KEYS.EXAM_LOG, examLog);

    // 保存练习记录
    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    results.forEach(r => {
      practiceLog.push({
        questionId: r.questionId,
        userAnswer: r.userAnswer,
        correct: r.correct,
        timestamp: new Date().toISOString(),
        mode: 'exam',
      });
    });
    Storage.set(Storage.KEYS.PRACTICE_LOG, practiceLog);

    this.showResult(correct);

    // 联动计划：考试完成后更新进度
    if (typeof Plan !== 'undefined') {
      // Try to detect bank from exam questions
      const gjCount = this.questions.filter(q => q.bank === 'gongji').length;
      const tmCount = this.questions.filter(q => q.bank === 'tumu').length;
      const mainBank = gjCount >= tmCount ? 'gongji' : 'tumu';
      Plan.updateProgress(mainBank, correct, this.questions.length);
    }

    // 跨设备同步
    Sync.push().catch(() => {});
  },

  /**
   * 显示考试成绩
   */
  showResult(correct) {
    const total = this.questions.length;
    const accuracy = Math.round((correct / total) * 100);
    const timeUsed = this.totalTime - this.timeLeft;
    const mins = Math.floor(timeUsed / 60);
    const secs = timeUsed % 60;

    let grade;
    if (accuracy >= 90) grade = '优秀';
    else if (accuracy >= 75) grade = '良好';
    else if (accuracy >= 60) grade = '合格';
    else grade = '需努力';

    const area = document.getElementById('exam-area');
    area.innerHTML = `
      <div class="practice-container">
        <div class="practice-question-card" style="text-align:center;">
          <h2 style="margin-bottom:24px;">考试结束</h2>
          <div style="font-size:56px;font-weight:700;color:${accuracy >= 60 ? 'var(--primary)' : 'var(--danger)'};margin-bottom:4px;">${accuracy}分</div>
          <span style="font-size:18px;color:var(--text-secondary);">${grade}</span>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0;">
            <div><div style="font-size:24px;font-weight:700;">${total}</div><small style="color:var(--text-secondary);">总题数</small></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--success);">${correct}</div><small style="color:var(--text-secondary);">正确</small></div>
            <div><div style="font-size:24px;font-weight:700;color:var(--danger);">${total - correct}</div><small style="color:var(--text-secondary);">错误</small></div>
          </div>
          ${this.totalTime > 0 ? `<p style="color:var(--text-secondary);font-size:14px;">用时：${mins}分${secs}秒</p>` : ''}
          <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
            <button class="btn btn-primary" onclick="Exam.review()">查看解析</button>
            <button class="btn btn-outline" onclick="Exam.retry()">重新考试</button>
          </div>
        </div>
      </div>`;

    App.updateStats();
  },

  /**
   * 查看解析
   */
  review() {
    let html = `<div class="practice-container"><h3 style="margin-bottom:16px;">全部题目解析</h3>
      <p style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);">`;
    const allQuestions = this.questions;
    const wrongQuestions = allQuestions.filter(q => {
      const userAnswer = this.userAnswers[q.id] || '';
      return !Practice.checkAnswer(q, userAnswer);
    });
    html += `共 ${allQuestions.length} 题，答错 ${wrongQuestions.length} 题</p>`;

    if (allQuestions.length === 0) {
      html += `<p class="empty-state">无题目</p>`;
    } else {
      allQuestions.forEach((q, i) => {
        const userAns = this.userAnswers[q.id] || '';
        const isCorrect = Practice.checkAnswer(q, userAns);
        html += `
          <div class="practice-question-card" style="border-left:3px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
            <div class="question-text">
              <span style="color:${isCorrect ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${isCorrect ? '✓' : '✗'}</span>
              ${i + 1}. ${Practice.escapeHtml(q.title)}
            </div>
            <p style="color:var(--text-secondary);font-size:13px;"><strong>你的答案：</strong>${userAns || '未作答'}</p>
            <p style="color:var(--success);"><strong>正确答案：</strong>${Practice.escapeHtml(q.answer)}</p>`;
        if (q.analysis) {
          html += `<div style="margin-top:8px;padding:12px;background:#fafafa;border-radius:4px;line-height:1.8;"><strong>📖 解析：</strong><br>${Practice.escapeHtml(q.analysis)}</div>`;
        }
        html += `</div>`;
      });
    }

    html += `
      <div class="practice-actions">
        <button class="btn btn-outline" onclick="Exam.retry()">重新考试</button>
        <button class="btn btn-outline" onclick="document.getElementById('exam-area').style.display='none';document.getElementById('exam-setup').style.display='block';">返回设置</button>
      </div></div>`;

    document.getElementById('exam-area').innerHTML = html;
  },

  /**
   * 重新考试
   */
  retry() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.submitted = false;
    this.questions = [];
    this.userAnswers = {};
    document.getElementById('exam-area').style.display = 'none';
    document.getElementById('exam-setup').style.display = 'block';
  },
};
