/**
 * 导入管理器 - 批次追踪、合并管理、批量删除
 *
 * 数据结构:
 *   ImportBatch {
 *     id: string,
 *     filename: string,
 *     fileSize: number,
 *     questionCount: number,
 *     questionIds: string[],
 *     engine: string,
 *     importedAt: string (ISO),
 *     tags: string[],
 *   }
 */

const ImportManager = {
  STORAGE_KEY: 'exam_import_batches',

  /**
   * 获取所有导入记录
   */
  getAll() {
    return Storage.get(this.STORAGE_KEY) || [];
  },

  /**
   * 记录一次导入
   */
  recordImport(filename, fileSize, questionIds, engine = '') {
    const batches = this.getAll();
    const batch = {
      id: 'imp_' + Date.now().toString(36),
      filename,
      fileSize,
      questionCount: questionIds.length,
      questionIds,
      engine,
      importedAt: new Date().toISOString(),
    };
    batches.push(batch);
    Storage.set(this.STORAGE_KEY, batches);
    return batch;
  },

  /**
   * 删除一个导入批次（及其所有题目）
   */
  deleteBatch(batchId) {
    const batches = this.getAll();
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return { removed: 0 };

    // 删除题库中该批次的题目
    const questions = QuestionBank.getAll();
    const removeSet = new Set(batch.questionIds);
    const filtered = questions.filter(q => !removeSet.has(q.id));
    Storage.set(Storage.KEYS.QUESTIONS, filtered);

    // 同步清理错题本
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    Storage.set(Storage.KEYS.ERROR_BOOK, errors.filter(e => !removeSet.has(e.questionId)));

    // 同步清理练习记录
    const practiceLog = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    Storage.set(Storage.KEYS.PRACTICE_LOG, practiceLog.filter(p => !removeSet.has(p.questionId)));

    // 移除该批次记录
    Storage.set(this.STORAGE_KEY, batches.filter(b => b.id !== batchId));

    // 更新分类
    QuestionBank.updateCategories(filtered);

    return { removed: batch.questionIds.length, filename: batch.filename };
  },

  /**
   * 清空所有导入记录（不删除题目）
   */
  clearHistory() {
    Storage.set(this.STORAGE_KEY, []);
  },

  /**
   * 获取所有导入的题目总数
   */
  getTotalImported() {
    return this.getAll().reduce((sum, b) => sum + b.questionCount, 0);
  },

  /**
   * 按文件名搜索导入记录
   */
  search(keyword) {
    const batches = this.getAll();
    if (!keyword) return batches;
    const kw = keyword.toLowerCase();
    return batches.filter(b => b.filename.toLowerCase().includes(kw));
  },

  /**
   * 获取导入统计
   */
  getStats() {
    const batches = this.getAll();
    const byEngine = {};
    let totalFiles = batches.length;
    let totalQuestions = 0;
    let totalSize = 0;

    for (const b of batches) {
      totalQuestions += b.questionCount;
      totalSize += (b.fileSize || 0);
      const eng = b.engine || 'unknown';
      byEngine[eng] = (byEngine[eng] || 0) + 1;
    }

    return { totalFiles, totalQuestions, totalSize, byEngine };
  },
};
