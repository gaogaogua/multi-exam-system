/**
 * 答题卡组件 — 侧边/底部网格，显示题目状态并支持跳转
 *
 * 用法:
 *   AnswerSheet.render(questions, userAnswers, currentIndex, mode)
 *   AnswerSheet.toggle() — 折叠/展开
 *   AnswerSheet.markQuestion(index) — 标记题目
 */

const AnswerSheet = {
  _collapsed: false,
  _marks: {},          // { questionIndex: 'star'|'question'|'important' }
  _mode: 'practice',   // 'practice' | 'exam'

  /** 渲染答题卡 */
  render(questions, userAnswers, currentIndex, mode = 'practice') {
    this._mode = mode;
    const container = document.getElementById('answer-sheet-container');
    if (!container) return;

    const total = questions.length;
    const answered = Object.keys(userAnswers).length;

    let h = `
      <div class="answer-sheet-header" onclick="AnswerSheet.toggle()" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 12px;">
        <span style="font-size:13px;font-weight:600;">📋 答题卡 <span style="color:#999;font-weight:400;">${answered}/${total}</span></span>
        <span style="font-size:11px;color:#999;">${this._collapsed ? '展开 ▼' : '折叠 ▲'}</span>
      </div>`;

    if (!this._collapsed) {
      h += '<div class="answer-sheet-grid" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;max-height:200px;overflow-y:auto;">';
      for (let i = 0; i < total; i++) {
        const q = questions[i];
        const id = q.id;
        const userAns = userAnswers[id];
        const isCurrent = i === currentIndex;
        const isMarked = !!this._marks[i];

        let status = 'unanswered';
        if (userAns !== undefined) {
          const correct = Practice.checkAnswer(q, userAns);
          status = correct ? 'correct' : 'wrong';
        }

        const colors = {
          unanswered: { bg: '#f0f0f0', text: '#999', border: '#d9d9d9' },
          correct:    { bg: '#f6ffed', text: '#52c41a', border: '#b7eb8f' },
          wrong:      { bg: '#fff2f0', text: '#ff4d4f', border: '#ffa39e' },
        };
        const c = colors[status];

        h += `<div class="as-cell" style="
          width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:600;cursor:pointer;transition:.15s;
          background:${c.bg};color:${c.text};border:2px solid ${isCurrent ? '#1890ff' : c.border};
          ${isCurrent ? 'box-shadow:0 0 0 2px rgba(24,144,255,.3);transform:scale(1.1);' : ''}
          ${isMarked ? 'position:relative;' : ''}
        " onclick="${mode === 'exam' ? 'Exam' : 'Practice'}.goToQuestion(${i})" title="第${i + 1}题${isMarked ? ' (已标记)' : ''}">
          ${i + 1}
          ${isMarked ? `<span style="position:absolute;top:-4px;right:-4px;font-size:8px;">${this._marks[i] === 'star' ? '⭐' : this._marks[i] === 'important' ? '❗' : '❓'}</span>` : ''}
        </div>`;
      }
      h += '</div>';

      // 图例 & 标记按钮
      h += `
        <div style="display:flex;gap:12px;align-items:center;padding:4px 12px 8px;font-size:11px;color:#999;flex-wrap:wrap;">
          <span>⬜ 未做</span><span>🟢 答对</span><span>🔴 答错</span>
          <span style="margin-left:auto;display:flex;gap:4px;">
            <button class="btn-sm btn-outline" onclick="AnswerSheet.markCurrent('star')" style="font-size:10px;">⭐ 标记</button>
            <button class="btn-sm btn-outline" onclick="AnswerSheet.markCurrent('question')" style="font-size:10px;">❓ 疑问</button>
            <button class="btn-sm btn-outline" onclick="AnswerSheet.markCurrent('important')" style="font-size:10px;">❗ 重要</button>
            <button class="btn-sm btn-outline" onclick="AnswerSheet.clearMarks()" style="font-size:10px;">清除</button>
          </span>
        </div>`;
    }

    container.innerHTML = h;
  },

  /** 折叠/展开 */
  toggle() {
    this._collapsed = !this._collapsed;
    if (this._mode === 'practice' && typeof Practice !== 'undefined') {
      Practice.renderQuestion();
    } else if (this._mode === 'exam' && typeof Exam !== 'undefined') {
      Exam.renderExam();
    }
  },

  /** 标记当前题目 */
  markCurrent(type = 'star') {
    let currentIndex;
    if (this._mode === 'practice') currentIndex = Practice.currentIndex;
    else if (this._mode === 'exam') currentIndex = Exam.getCurrentIndex ? Exam.getCurrentIndex() : 0;

    if (currentIndex === undefined) return;
    this._marks[currentIndex] = type;

    if (this._mode === 'practice') Practice.renderQuestion();
    else if (this._mode === 'exam') Exam.renderExam();

    // 如果题目有 ID，保存标记到笔记系统
    const q = this._mode === 'practice'
      ? (Practice.questions && Practice.questions[currentIndex])
      : (Exam.questions && Exam.questions[currentIndex]);
    if (q && typeof PracticeNotes !== 'undefined') {
      PracticeNotes.setMark(q.id, type);
    }

    Feedback.showToast(
      { star: '已标记为星标', question: '已标记为疑问', important: '已标记为重要' }[type] || '已标记',
      'info', 1200
    );
  },

  /** 清除所有标记 */
  clearMarks() {
    this._marks = {};
    if (this._mode === 'practice') Practice.renderQuestion();
    else if (this._mode === 'exam') Exam.renderExam();
  },

  /** 获取带标记的题目索引列表 */
  getMarkedIndices() {
    return Object.keys(this._marks).map(Number);
  },
};

window.AnswerSheet = AnswerSheet;
