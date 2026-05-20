/**
 * 本地存储管理模块 — 兼容层
 *
 * 底层数据由 DataStore (IndexedDB + 内存缓存) 管理。
 * 本模块保留原有 KEYS 和同步 get/set API，内部桥接到 DataStore 缓存，
 * 确保现有模块无需改动即可获得 IDB 的大容量和缓存速度。
 *
 * DataStore 初始化完成后，所有读写走内存缓存 + 后台 IDB；
 * 初始化之前退回 localStorage（兼容极端情况）。
 */
const Storage = {
  KEYS: {
    QUESTIONS: 'exam_questions',
    ERROR_BOOK: 'exam_error_book',
    PRACTICE_LOG: 'exam_practice_log',
    EXAM_LOG: 'exam_exam_log',
    CATEGORIES: 'exam_categories',
  },

  /** KEYS → DataStore store 名映射 */
  _keyToStore: {
    exam_questions:      'questions',
    exam_error_book:     'errorBook',
    exam_practice_log:   'practiceLog',
    exam_exam_log:       'examLog',
    exam_categories:     'categories',
    exam_import_batches: 'importBatches',
    exam_plans:          'plans',
    today_progress:      'todayProgress',
  },

  _toStore(key) {
    return this._keyToStore[key] || null;
  },

  /** 同步读取 — 优先从 DataStore 缓存，退回 localStorage */
  get(key) {
    const store = this._toStore(key);

    if (store && DataStore.isReady()) {
      const cached = DataStore.cache[store];
      if (store === 'categories') {
        // categories 在 IDB 中存为 [{id, value}]，对外暴露为 string[]
        return (cached || []).map(r => r.value || r.id).filter(Boolean);
      }
      if (store === 'todayProgress') {
        // todayProgress 存为 [{id:'_current', ...}]，对外暴露为单对象
        const cur = cached.find(r => r.id === '_current');
        return cur || null;
      }
      return cached || [];
    }

    // 回退 localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage read error:', e);
      return null;
    }
  },

  /** 写入 — 乐观：先写缓存发射事件，后台写 IDB + 同步 localStorage */
  set(key, value) {
    const store = this._toStore(key);

    // 同步 localStorage（过渡期双写，确保旧代码在 DataStore 未就绪时也能读到）
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('Storage full');
        return false;
      }
      throw e;
    }

    // 同步更新 DataStore 缓存 + 后台持久化到 IDB
    if (store && DataStore.isReady()) {
      try {
        if (store === 'categories') {
          const items = (Array.isArray(value) ? value : [])
            .filter(Boolean)
            .map(v => ({ id: v, value: v }));
          DataStore.commit(store, items);
        } else if (store === 'todayProgress') {
          const items = value ? [{ id: '_current', ...value }] : [];
          DataStore.commit(store, items);
        } else if (Array.isArray(value)) {
          DataStore.commit(store, value);
        }
      } catch (e) {
        console.warn('[Storage] DataStore commit 失败:', store, e);
      }
    }

    return true;
  },

  remove(key) {
    localStorage.removeItem(key);
    const store = this._toStore(key);
    if (store && DataStore.isReady()) {
      DataStore.clear(store).catch(e =>
        console.warn('[Storage] DataStore 清除失败:', store, e)
      );
    }
  },

  getUsage() {
    let total = 0;
    for (const k in localStorage) {
      if (localStorage.hasOwnProperty(k)) {
        total += localStorage[k].length * 2;
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
