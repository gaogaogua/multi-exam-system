/**
 * 题目标记 & 笔记系统
 *
 * 标记: star(星标) / question(疑问) / important(重要)
 * 笔记: 富文本（纯文本），关联题目 ID
 *
 * 数据存储: DataStore (IndexedDB)，兼容 localStorage 回退
 */

const PracticeNotes = {
  NOTES_KEY: 'exam_question_notes',

  /** 获取某题的标记和笔记 */
  get(questionId) {
    const all = this._getAll();
    let entry = all.find(n => n.questionId === questionId);
    if (!entry) {
      entry = { questionId, mark: null, note: '', createdAt: new Date().toISOString(), updatedAt: '' };
    }
    return entry;
  },

  /** 设置标记 */
  setMark(questionId, markType) {
    const all = this._getAll();
    let entry = all.find(n => n.questionId === questionId);
    if (!entry) {
      entry = { questionId, mark: markType, note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      all.push(entry);
    } else {
      entry.mark = entry.mark === markType ? null : markType; // 再次点击取消
      entry.updatedAt = new Date().toISOString();
    }
    this._saveAll(all);
    return entry;
  },

  /** 保存笔记 */
  saveNote(questionId, noteText) {
    const all = this._getAll();
    let entry = all.find(n => n.questionId === questionId);
    if (!entry) {
      entry = { questionId, mark: null, note: noteText, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      all.push(entry);
    } else {
      entry.note = noteText;
      entry.updatedAt = new Date().toISOString();
    }
    this._saveAll(all);
    Feedback.showToast('笔记已保存', 'success', 1500);
    return entry;
  },

  /** 获取所有有标记的题目 ID */
  getMarkedQuestionIds(markType) {
    const all = this._getAll();
    if (markType) return all.filter(n => n.mark === markType).map(n => n.questionId);
    return all.filter(n => n.mark).map(n => n.questionId);
  },

  /** 获取所有有笔记的题目 */
  getNotedQuestions() {
    return this._getAll().filter(n => n.note && n.note.trim());
  },

  /** 获取某道题的笔记文本 */
  getNote(questionId) {
    const entry = this._getAll().find(n => n.questionId === questionId);
    return entry ? entry.note || '' : '';
  },

  /** 删除笔记 */
  deleteNote(questionId) {
    const all = this._getAll().filter(n => n.questionId !== questionId);
    this._saveAll(all);
  },

  /** 获取统计 */
  getStats() {
    const all = this._getAll();
    return {
      totalMarks: all.filter(n => n.mark).length,
      starCount: all.filter(n => n.mark === 'star').length,
      questionCount: all.filter(n => n.mark === 'question').length,
      importantCount: all.filter(n => n.mark === 'important').length,
      totalNotes: all.filter(n => n.note && n.note.trim()).length,
    };
  },

  // ── 内部 ──

  _getAll() {
    // 优先从 DataStore 读取
    if (typeof DataStore !== 'undefined' && DataStore.isReady()) {
      try {
        const cached = DataStore.cache[this.NOTES_KEY];
        if (cached) return cached;
      } catch (_) {}
    }
    // 回退 localStorage
    try {
      return JSON.parse(localStorage.getItem(this.NOTES_KEY) || '[]');
    } catch (_) { return []; }
  },

  _saveAll(all) {
    // 写入 DataStore
    if (typeof DataStore !== 'undefined' && DataStore.isReady()) {
      try {
        DataStore.commit(this.NOTES_KEY, all);
      } catch (_) {}
    }
    // 同步 localStorage
    try {
      localStorage.setItem(this.NOTES_KEY, JSON.stringify(all));
    } catch (_) {}
  },
};

window.PracticeNotes = PracticeNotes;
