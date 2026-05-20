/**
 * 题库管理模块 - 题目的增删改查、分类管理
 */
const QuestionBank = {
  CHAPTER_ORDER: CONFIG.TUMU_CHAPTERS,

  /** 按章节排序土木题目 */
  _sortByChapter(questions) {
    const order = this.CHAPTER_ORDER;
    return [...questions].sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      if (ai === -1 && bi === -1) return (a.category || '').localeCompare(b.category || '');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  },

  /**
   * 获取所有题目
   */
  getAll() {
    return Storage.get(Storage.KEYS.QUESTIONS) || [];
  },

  /**
   * 按ID获取题目
   */
  getById(id) {
    const questions = this.getAll();
    return questions.find(q => q.id === id);
  },

  /**
   * 添加题目（带去重检查）
   */
  add(question) {
    const questions = this.getAll();

    // 去重检查
    const dup = Dedup.checkDuplicate(question, questions);
    if (dup) {
      return { success: false, duplicate: dup, message: '已存在相似题目' };
    }

    // 题目纠错
    const issues = Dedup.validateQuestion(question);
    if (issues.length > 0) {
      return { success: false, issues, message: '题目存在格式问题：' + issues.join('；') };
    }

    question.id = 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    question.createdAt = question.createdAt || new Date().toISOString();
    questions.push(question);
    Storage.set(Storage.KEYS.QUESTIONS, questions);

    // 更新分类
    this.updateCategories(questions);

    return { success: true, question };
  },

  /**
   * 更新题目
   */
  update(id, updates) {
    const questions = this.getAll();
    const idx = questions.findIndex(q => q.id === id);
    if (idx === -1) return false;

    questions[idx] = { ...questions[idx], ...updates, updatedAt: new Date().toISOString() };
    Storage.set(Storage.KEYS.QUESTIONS, questions);
    this.updateCategories(questions);
    return true;
  },

  /**
   * 删除题目
   */
  remove(id) {
    const questions = this.getAll();
    const filtered = questions.filter(q => q.id !== id);
    Storage.set(Storage.KEYS.QUESTIONS, filtered);

    // 同步删除错题记录
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    Storage.set(Storage.KEYS.ERROR_BOOK, errors.filter(e => e.questionId !== id));

    this.updateCategories(filtered);
  },

  /**
   * 批量导入题目
   */
  batchImport(newQuestions) {
    const questions = this.getAll();
    let added = 0;
    let skipped = 0;
    let skippedDup = 0;

    for (const q of newQuestions) {
      const dup = Dedup.checkDuplicate(q, questions);
      if (dup) {
        skippedDup++;
        continue;
      }
      const issues = Dedup.validateQuestion(q);
      if (issues.length > 0) {
        skipped++;
        continue;
      }
      q.id = 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6) + '_' + added;
      q.createdAt = new Date().toISOString();
      questions.push(q);
      added++;
    }

    Storage.set(Storage.KEYS.QUESTIONS, questions);
    this.updateCategories(questions);
    return { added, skipped, skippedDup };
  },

  /**
   * 搜索和过滤题目
   */
  search({ keyword, category, type, bank, page = 1, pageSize = 20 } = {}) {
    let questions = this.getAll();

    if (bank) {
      questions = questions.filter(q => q.bank === bank);
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      questions = questions.filter(q =>
        q.title.toLowerCase().includes(kw) ||
        (q.analysis && q.analysis.toLowerCase().includes(kw)) ||
        (q.options && q.options.some(o => o.text.toLowerCase().includes(kw)))
      );
    }

    if (category) {
      questions = questions.filter(q => q.category === category);
    }

    if (type) {
      if (type === 'missing') {
        questions = questions.filter(q => !q.answer || !q.analysis);
      } else {
        questions = questions.filter(q => q.type === type);
      }
    }

    // 土木题库按章节排序
    if (bank === 'tumu' || (!bank && questions.length > 0 && questions[0].bank === 'tumu')) {
      questions = this._sortByChapter(questions);
    }

    const total = questions.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = questions.slice(start, start + pageSize);

    return { items, total, totalPages, page };
  },

  /**
   * 获取所有分类
   */
  getCategories() {
    return Storage.get(Storage.KEYS.CATEGORIES) || [];
  },

  /**
   * 更新分类列表
   */
  updateCategories(questions) {
    const categories = [...new Set(questions.map(q => q.category).filter(Boolean))];
    Storage.set(Storage.KEYS.CATEGORIES, categories);
  },

  /**
   * 获取题目统计
   */
  getStats() {
    const questions = this.getAll();
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];

    const total = questions.length;
    const errorCount = errors.filter(e => !e.mastered).length;
    const masteredCount = errors.filter(e => e.mastered).length;
    const practicedIds = new Set(practiceLog.map(p => p.questionId));
    const practiced = practicedIds.size;

    let accuracy = 0;
    if (practiceLog.length > 0) {
      const correct = practiceLog.filter(p => p.correct).length;
      accuracy = Math.round((correct / practiceLog.length) * 100);
    }

    return { total, practiced, errorCount, masteredCount, accuracy };
  },
};
