/**
 * 本地存储管理模块 - LocalStorage wrapper with quota management
 */
const Storage = {
  KEYS: {
    QUESTIONS: 'exam_questions',
    ERROR_BOOK: 'exam_error_book',
    PRACTICE_LOG: 'exam_practice_log',
    EXAM_LOG: 'exam_exam_log',
    CATEGORIES: 'exam_categories',
  },

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage read error:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('Storage full');
        return false;
      }
      throw e;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getUsage() {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16
      }
    }
    return total;
  },

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  },
};
