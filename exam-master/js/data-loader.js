/**
 * 题库自动加载器 — 手机首次访问时自动从服务器拉取题库数据
 * 在 storage.js 之后加载，question-bank.js 之前加载
 */
const DataLoader = {
  /**
   * 检查并自动加载缺失的题库数据
   */
  async autoLoad() {
    const questions = Storage.get(Storage.KEYS.QUESTIONS);
    if (questions && questions.length > 0) {
      console.log('[DataLoader] 题库已有 ' + questions.length + ' 题，跳过加载');
      return;
    }

    console.log('[DataLoader] 题库为空，从服务器加载...');

    const banks = [
      { key: '公基', file: '考试资料/最终题库/公基错题合集_complete.json' },
      { key: '土木', file: '考试资料/最终题库/土木_questions_complete.json' },
    ];

    let allQuestions = [];

    for (const bank of banks) {
      try {
        const resp = await fetch(bank.file);
        if (resp.ok) {
          const data = await resp.json();
          const questions = Array.isArray(data) ? data : (data.questions || data.data || []);
          // 确保每题有 bank 标记
          questions.forEach(q => { if (!q.bank) q.bank = bank.key === '公基' ? 'gongji' : 'tumu'; });
          allQuestions = allQuestions.concat(questions);
          console.log(`[DataLoader] ${bank.key}: 加载 ${questions.length} 题`);
        } else {
          console.warn(`[DataLoader] ${bank.key}: HTTP ${resp.status}`);
        }
      } catch (e) {
        console.warn(`[DataLoader] ${bank.key} 加载失败:`, e.message);
      }
    }

    if (allQuestions.length > 0) {
      // 去重后存入
      const existing = QuestionBank.getAll();
      if (existing.length === 0) {
        QuestionBank.batchImport(allQuestions);
        console.log('[DataLoader] 题库初始化完成: ' + allQuestions.length + ' 题');
        // 刷新分类筛选
        if (App.populateCategoryFilters) App.populateCategoryFilters();
        if (App.updateStats) App.updateStats();
        if (App.renderQuestionBank) App.renderQuestionBank();
      }
    }
  },
};
