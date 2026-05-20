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

  /** 题型图标 — 委托 CONFIG */
  get TYPE_ICONS() {
    const icons = {};
    for (const [k, v] of Object.entries(CONFIG.QUESTION_TYPES)) icons[k] = v.icon;
    return icons;
  },

  get TYPE_NAMES() {
    const names = {};
    for (const [k, v] of Object.entries(CONFIG.QUESTION_TYPES)) names[k] = v.name;
    return names;
  },

  get BANK_LABELS() {
    const labels = {};
    for (const [k, v] of Object.entries(CONFIG.BANKS)) labels[k] = v.label;
    return labels;
  },
};
