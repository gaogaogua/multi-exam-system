/**
 * 共享工具函数 — 消除跨模块重复代码
 * 在 index.html 中于 storage.js 之后、其他模块之前加载
 */
const Utils = {
  /** HTML 转义 — 纯字符串实现，不依赖 DOM */
  escapeHtml(str) {
    const s = String(str || '');
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** Fisher-Yates 洗牌 — 防御 null/undefined 输入 */
  shuffle(arr) {
    const a = [...(arr || [])];
    if (a.length === 0) return [];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  /** 生成唯一 ID */
  generateId(prefix) {
    return (prefix || 'id_') + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  },

  /** 题型图标 */
  TYPE_ICONS: { single: '①', multiple: '②', judge: '③', fill: '④', essay: '⑤' },

  /** 题型名称 */
  TYPE_NAMES: { single: '单选题', multiple: '多选题', judge: '判断题', fill: '填空题', essay: '问答题' },

  /** 题库标签 */
  BANK_LABELS: { gongji: '公基', tumu: '土木' },
};
