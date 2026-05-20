/**
 * 练习报告模块 — 练习/考试后的详细分析报告
 *
 * 功能:
 *   showPracticeReport()  — 练习完成后显示详细报告
 *   showChallengeResult() — 闯关结算
 *   renderCalendarHeatmap() — 学习日历热力图
 *   renderRadarChart()    — 知识点能力雷达图
 */

const PracticeReport = {

  /** 显示练习详细报告 */
  showPracticeReport(questions, userAnswers, mode, startTime) {
    const total = questions.length;
    let correct = 0;
    const results = [];

    questions.forEach(q => {
      const userAns = userAnswers[q.id] || '';
      const isCorrect = Practice.checkAnswer(q, userAns);
      if (isCorrect) correct++;
      results.push({ q, userAns, isCorrect });
    });

    const accuracy = Math.round(correct / total * 100);
    const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    // 薄弱知识点
    const weakCats = {};
    results.filter(r => !r.isCorrect).forEach(r => {
      const cat = r.q.category || '未分类';
      weakCats[cat] = (weakCats[cat] || 0) + 1;
    });
    const sortedWeak = Object.entries(weakCats).sort((a, b) => b[1] - a[1]);

    // 历史对比
    const historyAvg = this._getHistoryAvg();

    // 等级评定
    let grade, gradeColor;
    if (accuracy >= 90) { grade = 'S · 卓越'; gradeColor = '#ffc107'; }
    else if (accuracy >= 80) { grade = 'A · 优秀'; gradeColor = '#52c41a'; }
    else if (accuracy >= 65) { grade = 'B · 良好'; gradeColor = '#1890ff'; }
    else if (accuracy >= 50) { grade = 'C · 一般'; gradeColor = '#faad14'; }
    else { grade = 'D · 需努力'; gradeColor = '#ff4d4f'; }

    const modeNames = {
      sequential: '顺序练习', random: '随机练习', errors: '错题重练',
      weak: '薄弱知识点', memorize: '背题模式', smart: '智能推荐',
      challenge: '闯关模式', review: '复习模式', category: '专项练习',
      assemble: '组卷练习', exam: '模拟考试',
    };

    Modal.show({
      title: `📊 ${modeNames[mode] || '练习'} · 报告`,
      size: 'lg',
      body: `
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:56px;font-weight:700;color:${gradeColor};line-height:1.2;">${accuracy}%</div>
          <div style="font-size:18px;color:${gradeColor};font-weight:600;">${grade}</div>
          <div style="color:#999;font-size:13px;margin-top:4px;">${correct}/${total} 正确 · 用时 ${mins}分${secs}秒</div>
          ${historyAvg > 0 ? `<div style="font-size:12px;color:${accuracy >= historyAvg ? '#52c41a' : '#ff4d4f'};margin-top:2px;">${accuracy >= historyAvg ? '↑' : '↓'} 历史平均 ${historyAvg}%</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
          <div style="text-align:center;padding:12px;background:#f6ffed;border-radius:8px;"><div style="font-size:20px;font-weight:700;color:#52c41a;">${correct}</div><div style="font-size:11px;color:#999;">正确</div></div>
          <div style="text-align:center;padding:12px;background:#fff2f0;border-radius:8px;"><div style="font-size:20px;font-weight:700;color:#ff4d4f;">${total - correct}</div><div style="font-size:11px;color:#999;">错误</div></div>
          <div style="text-align:center;padding:12px;background:#f0f5ff;border-radius:8px;"><div style="font-size:20px;font-weight:700;color:#1890ff;">${mins}:${String(secs).padStart(2,'0')}</div><div style="font-size:11px;color:#999;">用时</div></div>
        </div>

        ${sortedWeak.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-weight:600;margin-bottom:8px;">📉 薄弱知识点</div>
          ${sortedWeak.map(([cat, count]) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="flex:1;font-size:13px;cursor:pointer;color:#1890ff;" onclick="Modal.close();PracticeModes.startCategoryPractice('${Utils.escapeHtml(cat)}')">${Utils.escapeHtml(cat)}</span>
              <span style="font-size:12px;color:#ff4d4f;">${count} 错</span>
              <div style="width:${Math.min(100, count * 20)}px;height:8px;background:#ffa39e;border-radius:4px;"></div>
            </div>
          `).join('')}
        </div>` : ''}

        <details style="margin-bottom:16px;">
          <summary style="cursor:pointer;font-weight:600;font-size:14px;padding:8px 0;">📋 错题列表 (${total - correct}题)</summary>
          <div style="max-height:300px;overflow-y:auto;margin-top:8px;">
            ${results.filter(r => !r.isCorrect).map((r, i) => `
              <div style="padding:8px 12px;margin-bottom:6px;background:#fff2f0;border-radius:6px;border-left:3px solid #ff4d4f;font-size:13px;">
                <div style="font-weight:600;margin-bottom:4px;">${i + 1}. ${Utils.escapeHtml(r.q.title.substring(0, 80))}</div>
                <div>你的答案: <span style="color:#ff4d4f;">${Utils.escapeHtml(r.userAns || '未作答')}</span></div>
                <div>正确答案: <span style="color:#52c41a;">${Utils.escapeHtml(r.q.answer)}</span></div>
              </div>
            `).join('')}
          </div>
        </details>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-outline" onclick="Modal.close()">关闭</button>
          ${mode === 'challenge' ? `<button class="btn btn-primary" onclick="Modal.close();PracticeModes.startChallenge()">${accuracy >= 80 ? '下一关 →' : '重试本关'}</button>` : ''}
          <button class="btn btn-outline" onclick="Modal.close();PracticeModes.startCategoryPractice('${Utils.escapeHtml(sortedWeak[0]?.[0] || '')}')">专项突破 →</button>
        </div>`,
    });
  },

  /** 闯关结算界面 */
  showChallengeResult(correct, total, nextLevel, passed, stars) {
    const acc = Math.round(correct / total * 100);
    Modal.show({
      title: '🏆 闯关结算',
      body: `
        <div style="text-align:center;">
          <div style="font-size:64px;">${'⭐'.repeat(stars)}</div>
          <div style="font-size:40px;font-weight:700;color:${passed ? '#52c41a' : '#ff4d4f'};margin:8px 0;">${acc}%</div>
          <div style="font-size:16px;color:${passed ? '#52c41a' : '#ff4d4f'};font-weight:600;">${passed ? '🎉 通关！' : '未通过（需 80% 正确率）'}</div>
          <div style="color:#999;margin-top:4px;">获得 ${stars} 颗星 · 总分 ${PracticeModes.getChallengeState().totalStars} ⭐</div>
          ${passed ? `<div style="color:#1890ff;margin-top:8px;">下一关: 第 ${nextLevel} 关</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
          ${passed ? `<button class="btn btn-primary" onclick="Modal.close();PracticeModes.startChallenge()">进入第 ${nextLevel} 关</button>` : `<button class="btn btn-primary" onclick="Modal.close();PracticeModes.startChallenge()">重试本关</button>`}
          <button class="btn btn-outline" onclick="Modal.close()">返回</button>
        </div>`,
    });
  },

  _getHistoryAvg() {
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    if (log.length < 10) return 0;
    const recent = log.slice(-100);
    const correct = recent.filter(l => l.correct).length;
    return Math.round(correct / recent.length * 100);
  },

  // ═══════════════════════════════════════════════════
  // 学习日历热力图（类似 GitHub 贡献图）
  // ═══════════════════════════════════════════════════

  /** 渲染日历热力图 */
  renderCalendarHeatmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    if (log.length === 0) {
      container.innerHTML = '<p style="color:#999;font-size:13px;padding:16px;">暂无练习数据</p>';
      return;
    }

    // 统计每日练习量
    const byDay = {};
    log.forEach(l => {
      const day = (l.timestamp || '').split('T')[0];
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    });

    // 生成最近 20 周 x 7 天的网格（140 天）
    const now = new Date();
    const cols = 20;
    const rows = 7;
    const cellSize = 14;
    const gap = 3;
    const today = now.toISOString().split('T')[0];

    // 找到最近的周六作为最后一列（GitHub 风格）
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // next Saturday

    const weeks = [];
    for (let c = cols - 1; c >= 0; c--) {
      const week = [];
      for (let r = 0; r < rows; r++) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (c * 7) - (6 - r));
        const dayStr = d.toISOString().split('T')[0];
        const count = byDay[dayStr] || 0;
        week.push({ date: dayStr, count, isToday: dayStr === today, isFuture: dayStr > today });
      }
      weeks.push(week);
    }

    const maxCount = Math.max(1, ...Object.values(byDay));

    function color(level) {
      if (level === 0) return '#ebedf0';
      if (level <= 0.25) return '#c6e48b';
      if (level <= 0.5) return '#7bc96f';
      if (level <= 0.75) return '#239a3b';
      return '#196127';
    }

    const dayLabels = ['', '一', '', '三', '', '五', ''];

    let h = '<div style="display:flex;gap:4px;">';
    // 行标签
    h += '<div style="display:flex;flex-direction:column;gap:3px;margin-right:4px;font-size:10px;color:#999;padding-top:20px;">';
    dayLabels.forEach(l => { h += `<span style="height:${cellSize}px;line-height:${cellSize}px;">${l}</span>`; });
    h += '</div>';

    // 列
    weeks.forEach((week, wi) => {
      h += '<div style="display:flex;flex-direction:column;gap:3px;">';
      // 月份标签
      if (wi === 0 || new Date(week[0].date).getMonth() !== new Date(weeks[wi - 1]?.[0]?.date || '').getMonth()) {
        const m = new Date(week[0].date).getMonth() + 1;
        h += `<span style="font-size:10px;color:#999;height:16px;line-height:16px;">${m}月</span>`;
      } else {
        h += '<span style="height:16px;"></span>';
      }
      week.forEach(day => {
        const level = day.isFuture ? -1 : day.count / maxCount;
        const bg = day.isFuture ? 'transparent' : color(level);
        h += `<div style="width:${cellSize}px;height:${cellSize}px;border-radius:3px;background:${bg};
          ${day.isToday ? 'box-shadow:0 0 0 2px #1890ff;' : ''}
          cursor:${day.count > 0 ? 'pointer' : 'default'};"
          title="${day.date}: ${day.count} 题"
          ${day.count > 0 ? `onclick="PracticeReport._showDayDetail('${day.date}',${day.count})"` : ''}
        ></div>`;
      });
      h += '</div>';
    });
    h += '</div>';

    // 图例
    h += `<div style="display:flex;align-items:center;gap:4px;margin-top:8px;font-size:10px;color:#999;justify-content:flex-end;">
      少 ${[0, 0.25, 0.5, 0.75, 1].map(l => `<span style="width:${cellSize}px;height:${cellSize}px;border-radius:3px;background:${color(l)};"></span>`).join('')} 多
    </div>`;

    container.innerHTML = h;
  },

  _showDayDetail(date, count) {
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const dayLog = log.filter(l => (l.timestamp || '').startsWith(date));
    const correct = dayLog.filter(l => l.correct).length;
    Feedback.showToast(`${date}: ${dayLog.length} 题, 正确 ${correct}/${dayLog.length}`, 'info', 3000);
  },

  // ═══════════════════════════════════════════════════
  // 能力雷达图
  // ═══════════════════════════════════════════════════

  /** 渲染知识点雷达图 */
  renderRadarChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (typeof Chart === 'undefined') {
      container.innerHTML = '<p style="color:#999;font-size:13px;padding:16px;">需要 Chart.js</p>';
      return;
    }

    const all = QuestionBank.getAll();
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const qMap = new Map(all.map(q => [q.id, q]));

    // 统计各分类正确率
    const cats = {};
    log.forEach(l => {
      const q = qMap.get(l.questionId);
      if (!q) return;
      const cat = q.category || '未分类';
      if (!cats[cat]) cats[cat] = { total: 0, correct: 0 };
      cats[cat].total++;
      if (l.correct) cats[cat].correct++;
    });

    const sorted = Object.entries(cats)
      .map(([k, v]) => ({ label: k, value: v.total > 0 ? Math.round(v.correct / v.total * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (sorted.length < 3) {
      container.innerHTML = '<p style="color:#999;font-size:13px;padding:16px;">需要更多练习数据（至少3个知识点）</p>';
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.id = 'radar-chart-canvas';
    canvas.style.maxHeight = '320px';
    container.innerHTML = '';
    container.appendChild(canvas);

    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: sorted.map(s => s.label.length > 6 ? s.label.slice(0, 5) + '…' : s.label),
        datasets: [{
          label: '正确率 %',
          data: sorted.map(s => s.value),
          backgroundColor: 'rgba(102,126,234,0.2)',
          borderColor: '#667eea',
          borderWidth: 2,
          pointBackgroundColor: sorted.map(s => s.value >= 70 ? '#52c41a' : s.value >= 40 ? '#faad14' : '#ff4d4f'),
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { callbacks: { label: ctx => ctx.raw + '%' } },
        },
        scales: {
          r: { beginAtZero: true, max: 100, ticks: { stepSize: 20, backdropColor: 'transparent' } },
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const cat = sorted[idx]?.label;
            if (cat) PracticeModes.startCategoryPractice(cat);
          }
        },
      },
    });
  },
};

window.PracticeReport = PracticeReport;
