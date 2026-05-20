/**
 * 错题本模块 - 错题记录、复习、掌握度追踪
 *
 * 内置 SM-2 间隔复习算法（SuperMemo 2）替代固定艾宾浩斯节点
 * - 每次复习后根据答题质量动态调整下次复习间隔
 * - 答对的题目间隔逐渐拉长，答错的题目重新回到短间隔
 * - 质量评分: 5=完美, 4=犹豫后正确, 3=困难正确, 2=答错但记得答案, 1=答错且陌生, 0=完全遗忘
 */
const ErrorNotebook = {

  // SM-2 默认参数
  SM2_DEFAULTS: {
    interval: 1,       // 当前间隔（天）
    repetition: 0,     // 连续答对次数
    efactor: 2.5,      // 难度因子（最小 1.3）
    nextReviewAt: null, // ISO 日期 YYYY-MM-DD
  },

  /**
   * 获取所有错题
   */
  getAll() {
    return Storage.get(Storage.KEYS.ERROR_BOOK) || [];
  },

  /**
   * 添加错题记录
   */
  addError(questionId, userAnswer, notes = '') {
    const errors = this.getAll();
    const question = QuestionBank.getById(questionId);
    if (!question) return;

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const existing = errors.find(e => e.questionId === questionId);
    if (existing) {
      existing.wrongCount = (existing.wrongCount || 1) + 1;
      existing.lastWrongAt = new Date().toISOString();
      existing.userAnswer = userAnswer;
      if (notes) existing.notes = notes;
      existing.mastered = false;
      // 重置 SM-2 状态：答错回到短间隔
      if (!existing.sm2) existing.sm2 = { ...this.SM2_DEFAULTS };
      existing.sm2.interval = 1;
      existing.sm2.repetition = 0;
      existing.sm2.efactor = Math.max(1.3, existing.sm2.efactor - 0.2);
      existing.sm2.nextReviewAt = tomorrow;
    } else {
      errors.push({
        id: 'err_' + Date.now().toString(36),
        questionId,
        questionTitle: question.title.substring(0, 100),
        questionType: question.type,
        questionCategory: question.category,
        correctAnswer: question.answer,
        userAnswer,
        notes,
        wrongCount: 1,
        firstWrongAt: new Date().toISOString(),
        lastWrongAt: new Date().toISOString(),
        mastered: false,
        reviewCount: 0,
        sm2: {
          interval: 1,
          repetition: 0,
          efactor: 2.5,
          nextReviewAt: tomorrow, // 首次错误 → 明天复习
        },
      });
    }

    Storage.set(Storage.KEYS.ERROR_BOOK, errors);
  },

  /**
   * 标记错题已掌握
   */
  markMastered(errorId) {
    const errors = this.getAll();
    const err = errors.find(e => e.id === errorId);
    if (err) {
      err.mastered = true;
      err.masteredAt = new Date().toISOString();
      Storage.set(Storage.KEYS.ERROR_BOOK, errors);
    }
  },

  /**
   * SM-2 算法核心：根据质量评分计算下次复习间隔
   * 质量: 5=完美, 4=犹豫后正确, 3=困难正确, 2=答错但记得, 1=答错且陌生, 0=完全遗忘
   */
  _sm2Schedule(sm2, quality, todayStr) {
    if (!sm2) sm2 = { ...this.SM2_DEFAULTS };

    if (quality >= 3) {
      if (sm2.repetition === 0) {
        sm2.interval = 1;
      } else if (sm2.repetition === 1) {
        sm2.interval = 6;
      } else {
        sm2.interval = Math.round(sm2.interval * sm2.efactor);
      }
      sm2.repetition++;
    } else {
      sm2.repetition = 0;
      sm2.interval = 1;
    }

    sm2.efactor = sm2.efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (sm2.efactor < 1.3) sm2.efactor = 1.3;

    const nextDate = new Date(todayStr + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + sm2.interval);
    sm2.nextReviewAt = nextDate.toISOString().split('T')[0];

    return sm2;
  },

  /**
   * 记录复习（带 SM-2 间隔更新）
   */
  recordReview(errorId, correct) {
    const errors = this.getAll();
    const err = errors.find(e => e.id === errorId);
    if (err) {
      err.reviewCount = (err.reviewCount || 0) + 1;
      err.lastReviewAt = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];

      if (!err.sm2) err.sm2 = { ...this.SM2_DEFAULTS };

      // 答对→质量4(犹豫后正确), 答错→质量1
      const quality = correct ? 4 : 1;
      this._sm2Schedule(err.sm2, quality, today);

      if (correct) {
        err.consecutiveCorrect = (err.consecutiveCorrect || 0) + 1;
        if (err.consecutiveCorrect >= 3) {
          err.mastered = true;
          err.masteredAt = new Date().toISOString();
        }
      } else {
        err.consecutiveCorrect = 0;
      }
      Storage.set(Storage.KEYS.ERROR_BOOK, errors);
    }
  },

  /**
   * 获取今日应复习的错题（基于 SM-2 调度）
   */
  getDueReviews() {
    const today = new Date().toISOString().split('T')[0];
    const errors = this.getAll().filter(e => !e.mastered);

    // 初始化缺失 sm2 的旧记录
    let updated = false;
    errors.forEach(e => {
      if (!e.sm2 || !e.sm2.nextReviewAt) {
        e.sm2 = {
          interval: 1,
          repetition: 0,
          efactor: 2.5,
          nextReviewAt: today, // 旧记录立即排入复习队列
        };
        updated = true;
      }
    });
    if (updated) Storage.set(Storage.KEYS.ERROR_BOOK, errors);

    const due = errors.filter(e => e.sm2.nextReviewAt <= today);
    const questions = QuestionBank.getAll();

    return due.map(e => {
      const q = questions.find(q => q.id === e.questionId);
      return {
        errorId: e.id,
        questionId: e.questionId,
        nextReviewAt: e.sm2.nextReviewAt,
        interval: e.sm2.interval,
        repetition: e.sm2.repetition,
        efactor: e.sm2.efactor,
        questionTitle: e.questionTitle,
        category: e.questionCategory,
        question: q || null,
      };
    }).filter(e => e.question);
  },

  /**
   * 获取 SM-2 复习统计
   */
  getSM2Stats() {
    const errors = this.getAll().filter(e => !e.mastered && e.sm2);
    const today = new Date().toISOString().split('T')[0];
    const overdue = errors.filter(e => e.sm2.nextReviewAt < today).length;
    const dueToday = errors.filter(e => e.sm2.nextReviewAt === today).length;
    const upcoming = errors.filter(e => e.sm2.nextReviewAt > today).length;
    return {
      total: errors.length,
      overdue,           // 逾期未复习
      dueToday,          // 今日应复习
      upcoming,          // 未来待复习
      avgInterval: errors.length > 0
        ? Math.round(errors.reduce((s, e) => s + (e.sm2.interval || 1), 0) / errors.length * 10) / 10
        : 0,
    };
  },

  /**
   * 获取待复习错题
   */
  getReviewList() {
    const errors = this.getAll().filter(e => !e.mastered);
    const questions = QuestionBank.getAll();
    return errors.map(e => {
      const q = questions.find(q => q.id === e.questionId);
      return { ...e, question: q };
    }).filter(e => e.question); // 只返回题库中仍存在的题目
  },

  /**
   * 开始错题复习
   */
  startReview() {
    const reviewList = this.getReviewList();
    if (reviewList.length === 0) {
      App.showToast('没有需要复习的错题', 'info');
      return;
    }
    App.navigateTo('practice');
    Practice.startWithQuestions(reviewList.map(r => r.question), 'errors');
  },

  /**
   * 导出错题（JSON格式）
   */
  exportErrors() {
    const errors = this.getAll();
    if (errors.length === 0) {
      App.showToast('暂无错题可导出', 'info');
      return;
    }

    const exportData = errors.map(e => {
      const q = QuestionBank.getById(e.questionId);
      return {
        title: q ? q.title : e.questionTitle,
        type: e.questionType,
        answer: e.correctAnswer,
        options: q ? q.options : [],
        analysis: q ? q.analysis : '',
        wrongCount: e.wrongCount,
        userAnswer: e.userAnswer,
        mastered: e.mastered,
      };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `错题本_${new Date().toLocaleDateString('zh-CN')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('错题导出成功', 'success');
  },

  /**
   * 清空错题本
   */
  async clearAll() {
    const ok = typeof Feedback !== 'undefined'
      ? await Feedback.confirmAction('确定要清空所有错题记录吗？此操作不可恢复。')
      : confirm('确定要清空所有错题记录吗？此操作不可恢复。');
    if (!ok) return;
    Storage.set(Storage.KEYS.ERROR_BOOK, []);
    (Feedback || App).showToast('错题本已清空', 'success');
    App.renderErrorList();
    App.updateStats();
  },

  /**
   * 获取错题统计
   */
  getStats() {
    const errors = this.getAll();
    return {
      total: errors.length,
      unmastered: errors.filter(e => !e.mastered).length,
      mastered: errors.filter(e => e.mastered).length,
      byCategory: errors.reduce((acc, e) => {
        const cat = e.questionCategory || '未分类';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {}),
    };
  },

  /**
   * 按掌握度排序
   */
  sortByDifficulty(errors) {
    return [...errors].sort((a, b) => {
      // 错题次数多的优先
      if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount;
      // 复习次数少的优先
      return (a.reviewCount || 0) - (b.reviewCount || 0);
    });
  },
};
