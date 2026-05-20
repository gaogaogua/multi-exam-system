/**
 * 学习分析模块 - 数据可视化、趋势分析、薄弱点诊断
 */
const Analysis = {
  _charts: {},

  /**
   * 渲染分析页面
   */
  render() {
    this._destroyCharts();
    this.renderTrendChart();
    this.renderAccuracyChart();
    this.renderTypeChart();
    this.renderDailyActivityChart();
    this.renderWeakCategories();
  },

  _destroyCharts() {
    Object.values(this._charts).forEach(c => { try { c.destroy(); } catch (_) {} });
    this._charts = {};
  },

  /** 按题型正确率条形图 */
  renderTypeChart() {
    const container = document.getElementById('trend-chart');
    if (!container) return;
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    if (log.length < 5) {
      // reuse trend container if chart not applicable
      return;
    }
    const allQ = QuestionBank.getAll();
    const qMap = new Map(allQ.map(q => [q.id, q]));

    const byType = { single: { total: 0, correct: 0 }, multiple: { total: 0, correct: 0 }, judge: { total: 0, correct: 0 } };
    log.forEach(l => {
      const q = qMap.get(l.questionId);
      const t = q ? q.type : 'single';
      if (byType[t]) { byType[t].total++; if (l.correct) byType[t].correct++; }
    });

    const labels = ['单选题', '多选题', '判断题'];
    const data = labels.map(l => {
      const key = l === '单选题' ? 'single' : l === '多选题' ? 'multiple' : 'judge';
      const d = byType[key];
      return d.total > 0 ? Math.round(d.correct / d.total * 100) : 0;
    });

    // Insert chart canvas after trend chart container
    let canvas = document.getElementById('type-chart-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'type-chart-canvas';
      canvas.style.maxHeight = '200px';
      container.parentNode.insertBefore(canvas, container.nextSibling);
    }

    if (typeof Chart === 'undefined') return;
    this._charts.typeChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '正确率 %',
          data,
          backgroundColor: ['#667eea', '#764ba2', '#52c41a'],
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } },
      },
    });
  },

  /** 每日练习数量柱状图 */
  renderDailyActivityChart() {
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    if (log.length < 3) return;

    const byDay = {};
    log.forEach(l => {
      const day = (l.timestamp || '').split('T')[0];
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    });
    const days = Object.keys(byDay).sort().slice(-14);
    const data = days.map(d => byDay[d]);

    let canvas = document.getElementById('daily-activity-canvas');
    if (!canvas) {
      const container = document.getElementById('accuracy-chart');
      if (!container) return;
      canvas = document.createElement('canvas');
      canvas.id = 'daily-activity-canvas';
      canvas.style.maxHeight = '200px';
      canvas.style.marginTop = '16px';
      container.parentNode.insertBefore(canvas, container.nextSibling);
    }

    if (typeof Chart === 'undefined') return;
    this._charts.dailyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [{
          label: '练习题数',
          data,
          backgroundColor: '#1890ff',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
  },
    this.renderWeakCategories();
  },

  /**
   * 练习趋势图
   */
  renderTrendChart() {
    const container = document.getElementById('trend-chart');
    const log = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];

    if (log.length < 3) {
      container.innerHTML = '<p class="empty-state">需要更多练习数据（至少3次）</p>';
      return;
    }

    // 按天聚合
    const byDay = {};
    log.forEach(entry => {
      const day = entry.timestamp.split('T')[0];
      if (!byDay[day]) byDay[day] = { total: 0, correct: 0 };
      byDay[day].total++;
      if (entry.correct) byDay[day].correct++;
    });

    const days = Object.keys(byDay).sort().slice(-14); // 最近14天

    let html = '';
    days.forEach(day => {
      const data = byDay[day];
      const pct = Math.round((data.correct / data.total) * 100);
      const barColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      html += `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${day.slice(5)}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;background:${barColor};">${pct}% (${data.correct}/${data.total})</div>
          </div>
        </div>`;
    });

    container.innerHTML = html || '<p class="empty-state">暂无数据</p>';
  },

  /**
   * 正确率变化图
   */
  renderAccuracyChart() {
    const container = document.getElementById('accuracy-chart');
    const examLog = Storage.get(Storage.KEYS.EXAM_LOG) || [];

    if (examLog.length === 0) {
      container.innerHTML = '<p class="empty-state">需要更多考试数据</p>';
      return;
    }

    // 最近10次考试
    const recent = examLog.slice(-10);

    let html = '';
    recent.forEach((exam, i) => {
      const date = exam.date.split('T')[0];
      const barColor = exam.accuracy >= 80 ? 'var(--success)' : exam.accuracy >= 50 ? 'var(--warning)' : 'var(--danger)';
      html += `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${date.slice(5)}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${exam.accuracy}%;background:${barColor};">${exam.accuracy}% (${exam.correct}/${exam.total})</div>
          </div>
        </div>`;
    });

    container.innerHTML = html || '<p class="empty-state">暂无考试记录</p>';
  },

  /**
   * 易错知识点排行
   */
  renderWeakCategories() {
    const container = document.getElementById('weak-categories');
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];

    if (errors.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无错题数据</p>';
      return;
    }

    const byCategory = {};
    errors.forEach(e => {
      const cat = e.questionCategory || '未分类';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, mastered: 0 };
      byCategory[cat].total++;
      if (e.mastered) byCategory[cat].mastered++;
    });

    const sorted = Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total);

    let html = '';
    sorted.forEach(([cat, data]) => {
      const pct = Math.round((data.total / errors.length) * 100);
      html += `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${cat}</span>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${pct}%;">${data.total} 题 (已掌握: ${data.mastered})</div>
          </div>
        </div>`;
    });

    container.innerHTML = html || '<p class="empty-state">暂无数据</p>';
  },

  /**
   * 生成学习建议
   */
  getRecommendations() {
    const stats = QuestionBank.getStats();
    const errors = ErrorNotebook.getAll();
    const examLog = Storage.get(Storage.KEYS.EXAM_LOG) || [];

    const recommendations = [];

    if (stats.accuracy < 60) {
      recommendations.push('正确率偏低，建议从基础题目开始，多做错题复习。');
    }

    if (errors.length > 0 && errors.filter(e => !e.mastered).length > errors.length * 0.7) {
      recommendations.push('大部分错题尚未掌握，建议集中复习错题本。');
    }

    if (examLog.length >= 3) {
      const recent = examLog.slice(-3);
      const trend = recent[recent.length - 1].accuracy - recent[0].accuracy;
      if (trend < -10) {
        recommendations.push('近期正确率呈下降趋势，注意调整学习节奏。');
      } else if (trend > 10) {
        recommendations.push('正确率稳步提升，保持良好的学习状态！');
      }
    }

    // 检查高频错题分类
    const byCategory = {};
    errors.filter(e => !e.mastered).forEach(e => {
      const cat = e.questionCategory || '未分类';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    const topWeak = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    if (topWeak && topWeak[1] >= 3) {
      recommendations.push(`"${topWeak[0]}"是你的薄弱知识点（${topWeak[1]}道错题），建议专项练习。`);
    }

    return recommendations.length > 0 ? recommendations : ['继续保持当前的学习状态！'];
  },
};
