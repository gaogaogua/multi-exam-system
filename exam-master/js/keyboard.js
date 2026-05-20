/**
 * 键盘快捷键 — 练习/考试页面快捷键支持
 *
 * 练习/考试模式:
 *   1-4       选择对应选项
 *   Shift+1-4 多选题累积选择
 *   Enter     提交答案 或 下一题
 *   Escape    退出练习/考试
 *   ← →      上一题/下一题
 */

const Keyboard = {
  _bound: false,
  _handler: null,

  /** 初始化键盘监听（页面加载后调用） */
  init() {
    if (this._bound) return;
    this._handler = this._handleKey.bind(this);
    document.addEventListener('keydown', this._handler);
    this._bound = true;
  },

  /** 销毁键盘监听 */
  destroy() {
    if (this._handler) {
      document.removeEventListener('keydown', this._handler);
      this._handler = null;
      this._bound = false;
    }
  },

  /** 判断当前是否在练习/考试活动页面 */
  _isActive() {
    if (typeof App === 'undefined') return false;
    const page = App.currentPage;
    if (page === 'practice') {
      const area = document.getElementById('practice-area');
      return area && area.style.display !== 'none' && typeof Practice !== 'undefined' && Practice.questions && Practice.questions.length > 0;
    }
    if (page === 'exam') {
      const area = document.getElementById('exam-area');
      return area && area.style.display !== 'none' && typeof Exam !== 'undefined' && !Exam.submitted;
    }
    return false;
  },

  _handleKey(e) {
    if (!this._isActive()) return;
    // 不在输入框内才响应
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const page = App.currentPage;
    const key = e.key;

    if (page === 'practice') {
      this._handlePracticeKey(e, key);
    } else if (page === 'exam') {
      this._handleExamKey(e, key);
    }
  },

  _handlePracticeKey(e, key) {
    const P = window.Practice;
    if (!P || !P.questions || P.questions.length === 0) return;

    const q = P.questions[P.currentIndex];
    if (!q) return;

    // 数字 1-4 选择选项
    if (/^[1-4]$/.test(key)) {
      e.preventDefault();
      const idx = parseInt(key) - 1;
      const hasOptions = q.options && q.options.length > 0;
      if (hasOptions && idx < q.options.length) {
        const label = q.options[idx].label;
        const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';

        if (e.shiftKey && q.type === 'multiple') {
          // Shift+数字：多选题累积
          P.selectOption(q.id, label, 'checkbox');
        } else {
          P.selectOption(q.id, label, inputType);
          // 自动跳转（如果开启了）
          if (P.autoJump && inputType === 'radio') {
            setTimeout(() => {
              if (!P.showResult) P.submitAnswer();
            }, 300);
          }
        }
      }
      return;
    }

    // Enter: 提交或下一题
    if (key === 'Enter') {
      e.preventDefault();
      if (!P.showResult && P.mode !== 'memorize') {
        P.submitAnswer();
      } else {
        P.nextQuestion();
      }
      return;
    }

    // Escape: 退出
    if (key === 'Escape') {
      e.preventDefault();
      P.exit();
      return;
    }

    // 左右箭头
    if (key === 'ArrowLeft') {
      e.preventDefault();
      if (P.currentIndex > 0) P.prevQuestion();
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      if (P.showResult || P.mode === 'memorize') {
        P.nextQuestion();
      } else if (P.currentIndex < P.questions.length - 1) {
        // 可以在不提交答案的情况下浏览
        P.currentIndex++;
        P.showResult = P.userAnswers[P.questions[P.currentIndex].id] !== undefined;
        P.renderQuestion();
      }
      return;
    }

    // A-D 键也映射到选项（备用）
    if (/^[a-d]$/i.test(key)) {
      e.preventDefault();
      const idx = key.toLowerCase().charCodeAt(0) - 97;
      const hasOptions = q.options && q.options.length > 0;
      if (hasOptions && idx < q.options.length) {
        const label = q.options[idx].label;
        const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
        if (e.shiftKey && q.type === 'multiple') {
          P.selectOption(q.id, label, 'checkbox');
        } else {
          P.selectOption(q.id, label, inputType);
          if (P.autoJump && inputType === 'radio') {
            setTimeout(() => { if (!P.showResult) P.submitAnswer(); }, 300);
          }
        }
      }
    }
  },

  _handleExamKey(e, key) {
    const E = window.Exam;
    if (!E || E.submitted) return;

    const idx = E.getCurrentIndex ? E.getCurrentIndex() : 0;
    const q = E.questions && E.questions[idx];
    if (!q) return;

    // 数字选择
    if (/^[1-4]$/.test(key)) {
      e.preventDefault();
      const optIdx = parseInt(key) - 1;
      if (q.options && optIdx < q.options.length) {
        const label = q.options[optIdx].label;
        const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
        if (e.shiftKey && q.type === 'multiple') {
          E.selectAnswer(q.id, label, 'checkbox');
        } else {
          E.selectAnswer(q.id, label, inputType);
        }
      }
      return;
    }

    // A-D 键
    if (/^[a-d]$/i.test(key)) {
      e.preventDefault();
      const optIdx = key.toLowerCase().charCodeAt(0) - 97;
      if (q.options && optIdx < q.options.length) {
        const label = q.options[optIdx].label;
        const inputType = q.type === 'multiple' ? 'checkbox' : 'radio';
        E.selectAnswer(q.id, label, inputType);
      }
      return;
    }

    // Enter → 下一题
    if (key === 'Enter') {
      e.preventDefault();
      if (idx < E.questions.length - 1) {
        E.goToQuestion(idx + 1);
      } else {
        if (!E.submitted) E.submit();
      }
      return;
    }

    // Escape → 退出
    if (key === 'Escape') {
      e.preventDefault();
      if (confirm('确定退出考试吗？已作答的题目不会丢失。')) {
        E.retry();
      }
      return;
    }

    // 左右箭头
    if (key === 'ArrowLeft') { e.preventDefault(); E.goToQuestion(idx - 1); return; }
    if (key === 'ArrowRight') { e.preventDefault(); E.goToQuestion(idx + 1); return; }
  },
};

window.Keyboard = Keyboard;
