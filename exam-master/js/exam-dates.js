/**
 * 考试日期数据 — 从滴答清单同步
 * 每次滴答清单中更新考试任务后，在此处手动更新日期
 *
 * status: 0=即将, 2=已完成
 * dates are in YYYY-MM-DD format (Asia/Shanghai)
 */
const ExamDates = {
  // 滴答清单最后同步: 2026-05-19
  lastSync: '2026-05-19',

  exams: [
    { id: 'zhuhui',    name: '珠晖区考试',  subject: '公基',          date: '2026-05-16', status: 2, tags: ['#公基'] },
    { id: 'wangcheng', name: '望城区考试',  subject: '公基+一建专业',  date: '2026-05-17', status: 2, tags: ['#公基', '#土木专业'] },
    { id: 'yuanling',  name: '沅陵考试',    subject: '公基',          date: '2026-05-23', status: 0, tags: ['#公基'], priority: 5 },
    { id: 'suining2',  name: '绥宁考试',    subject: '一建专业知识',   date: '2026-05-29', status: 0, tags: ['#土木专业'] },
    { id: 'yijian',    name: '一建实务考试', subject: '一建',          date: '2026-09-05', status: 0, tags: ['#一建'] },
    { id: 'guokao',    name: '国家公务员考试', subject: '国考',        date: '2026-11-30', status: 0, tags: ['#国考'] },
  ],

  /** 获取即将到来的考试（按日期排序） */
  getUpcoming() {
    const today = new Date().toISOString().split('T')[0];
    return this.exams
      .filter(e => e.status === 0 && e.date && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /** 计算倒计时 */
  countdown(dateStr) {
    if (!dateStr) return null;
    const today = new Date().toISOString().split('T')[0];
    return Math.ceil((new Date(dateStr) - new Date(today)) / 86400000);
  },
};
