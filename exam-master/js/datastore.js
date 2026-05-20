/**
 * DataStore — IndexedDB + 内存缓存 + 版本管理 + 发布订阅 + 乐观更新 + 断点续传
 *
 * 全局单例，管理所有持久化数据。替换原有的 localStorage 直接读写模式。
 *
 * Store 列表:
 *   questions, errorBook, practiceLog, examLog, categories,
 *   importBatches, plans, todayProgress
 *
 * 事件 (EventTarget):
 *   <store>:changed   — 数据变更，detail: { action, id, store }
 *   datastore:ready   — 初始化完成
 *   datastore:error   — 后台写库失败，detail: { store, action, error }
 *   datastore:import-progress — 导入进度，detail: { store, imported, total }
 *
 * 使用方式:
 *   await DataStore.init();
 *   const all = DataStore.cache.questions;          // 同步读缓存
 *   await DataStore.add('questions', question);     // 异步写库（乐观更新）
 *   DataStore.on('questions:changed', () => {...}); // 订阅变更
 */
const DataStore = (() => {
  const DB_NAME = 'exam_system_db';
  const SCHEMA_VERSION = 1;
  const BATCH_SIZE = 50;       // 批量写入阈值
  const IMPORT_CHUNK = 100;    // 导入分块大小

  // ── Store 定义 ──────────────────────────────────────
  const STORE_DEFS = {
    questions:     { keyPath: 'id', indexes: ['bank', 'category', 'type'] },
    errorBook:     { keyPath: 'id', indexes: ['questionId', 'mastered'] },
    practiceLog:   { keyPath: 'id', autoIncrement: true, indexes: ['questionId', 'timestamp'] },
    examLog:       { keyPath: 'id', autoIncrement: true, indexes: ['date'] },
    categories:    { keyPath: 'id' },
    importBatches: { keyPath: 'id' },
    plans:         { keyPath: 'id' },
    todayProgress: { keyPath: 'id' },
    exam_question_notes: { keyPath: 'questionId' },
  };

  const STORE_NAMES = Object.keys(STORE_DEFS);

  // ── 内部状态 ───────────────────────────────────────
  const _emitter = new EventTarget();
  /** @type {IDBDatabase|null} */ let _db = null;
  let _ready = false;
  let _initPromise = null;

  // 内存缓存 — 同步访问
  /** @type {Object<string, any[]>} */
  const _cache = {};
  STORE_NAMES.forEach(s => { _cache[s] = []; });

  // 应用层数据版本号
  let _dataVersion = 0;

  // ── 公共 API ───────────────────────────────────────

  /** 只读内存缓存，调用方不应直接修改 */
  const cache = {};
  STORE_NAMES.forEach(s => {
    Object.defineProperty(cache, s, { get: () => _cache[s], enumerable: true });
  });

  /**
   * 初始化 — 打开数据库，加载全部数据到缓存
   * 多次调用安全（幂等），返回同一个 Promise
   */
  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = _doInit();
    return _initPromise;
  }

  function isReady() { return _ready; }

  /**
   * 获取数据版本号（应用层，非 IDB schema version）
   */
  function getVersion() {
    return _dataVersion;
  }

  // ── 事件订阅 ───────────────────────────────────────

  /** 订阅事件 */
  function on(event, callback) {
    _emitter.addEventListener(event, callback);
  }

  /** 取消订阅 */
  function off(event, callback) {
    _emitter.removeEventListener(event, callback);
  }

  // ── 泛型 CRUD ─────────────────────────────────────

  /** 按 ID 获取单条记录（从缓存） */
  function get(store, id) {
    _assertStore(store);
    return _cache[store].find(item => item.id === id) || null;
  }

  /**
   * 添加一条记录 — 乐观更新
   * @returns {Promise<Object>} 添加的记录（含生成的 id）
   */
  async function add(store, item) {
    _assertStore(store);
    _assertReady();
    const now = Date.now();
    const def = STORE_DEFS[store];

    // 生成 ID（如果需要）
    if (!item.id) {
      item.id = _generateId(store, now);
    }
    if (!item.createdAt && def.keyPath === 'id') {
      item.createdAt = new Date().toISOString();
    }

    // 1. 乐观更新缓存
    const snapshot = _clone(item);
    _cache[store].push(item);
    _emitChange(store, 'add', item.id);

    // 2. 后台写 IDB
    try {
      await _idbPut(store, item);
    } catch (e) {
      // 3. 回滚
      const idx = _cache[store].findIndex(x => x.id === item.id);
      if (idx >= 0) _cache[store].splice(idx, 1);
      _emitChange(store, 'add-rollback', item.id);
      _emitError(store, 'add', e);
      throw e;
    }

    return _clone(item);
  }

  /**
   * 更新一条记录 — 乐观更新（浅合并）
   * @returns {Promise<boolean>}
   */
  async function update(store, id, updates) {
    _assertStore(store);
    _assertReady();

    const idx = _cache[store].findIndex(x => x.id === id);
    if (idx === -1) return false;

    // 1. 乐观更新缓存
    const oldSnapshot = _clone(_cache[store][idx]);
    Object.assign(_cache[store][idx], updates, { updatedAt: new Date().toISOString() });
    _emitChange(store, 'update', id);

    // 2. 后台写 IDB
    try {
      await _idbPut(store, _cache[store][idx]);
    } catch (e) {
      // 3. 回滚
      _cache[store][idx] = oldSnapshot;
      _emitChange(store, 'update-rollback', id);
      _emitError(store, 'update', e);
      throw e;
    }

    return true;
  }

  /**
   * 删除一条记录 — 乐观更新
   */
  async function remove(store, id) {
    _assertStore(store);
    _assertReady();

    const idx = _cache[store].findIndex(x => x.id === id);
    if (idx === -1) return;

    // 1. 乐观更新缓存
    const snapshot = _cache[store][idx];
    _cache[store].splice(idx, 1);
    _emitChange(store, 'remove', id);

    // 2. 后台删 IDB
    try {
      await _idbDelete(store, id);
    } catch (e) {
      // 3. 回滚
      _cache[store].splice(idx, 0, snapshot);
      _emitChange(store, 'remove-rollback', id);
      _emitError(store, 'remove', e);
      throw e;
    }
  }

  /**
   * 批量添加 — 乐观更新（全量入缓存后逐批写 IDB）
   * @param {Function} [dedupFn] 可选的去重函数 (newItem, existingItems) => duplicate | null
   * @returns {Promise<{added: number, skipped: number}>}
   */
  async function batchAdd(store, items, { dedupFn, onProgress } = {}) {
    _assertStore(store);
    _assertReady();

    let added = 0;
    let skipped = 0;
    const existing = _cache[store];

    // 去重 & ID 生成
    const toAdd = [];
    for (const item of items) {
      if (dedupFn) {
        const dup = dedupFn(item, existing.concat(toAdd));
        if (dup) { skipped++; continue; }
      }
      if (!item.id) item.id = _generateId(store, Date.now() + toAdd.length);
      if (!item.createdAt) item.createdAt = new Date().toISOString();
      toAdd.push(item);
    }

    if (toAdd.length === 0) return { added: 0, skipped };

    // 1. 乐观入缓存
    _cache[store].push(...toAdd.map(_clone));
    _emitChange(store, 'batch-add', toAdd.map(x => x.id));
    added = toAdd.length;

    // 2. 分批写 IDB
    for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
      const batch = toAdd.slice(i, i + BATCH_SIZE);
      try {
        await _idbBatchPut(store, batch);
      } catch (e) {
        // 回滚当前及后续未写入的
        const failedIds = new Set(toAdd.slice(i).map(x => x.id));
        _cache[store] = _cache[store].filter(x => !failedIds.has(x.id));
        added -= (toAdd.length - i);
        _emitChange(store, 'batch-add-rollback');
        _emitError(store, 'batchAdd', e);
        throw e;
      }
      if (onProgress) onProgress({ added: i + batch.length, total: toAdd.length });
    }

    return { added, skipped };
  }

  /**
   * 清空一个 store — 乐观更新
   */
  async function clear(store) {
    _assertStore(store);
    _assertReady();

    const snapshot = [..._cache[store]];
    _cache[store].length = 0;
    _emitChange(store, 'clear');

    try {
      await _idbClear(store);
    } catch (e) {
      _cache[store] = snapshot;
      _emitChange(store, 'clear-rollback');
      _emitError(store, 'clear', e);
      throw e;
    }
  }

  /**
   * 写入整个 store（替换所有数据）— 乐观更新
   */
  async function setAll(store, items) {
    _assertStore(store);
    _assertReady();

    const snapshot = [..._cache[store]];
    _cache[store] = items.map(_clone);
    _emitChange(store, 'setAll');

    try {
      await _idbClear(store);
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        await _idbBatchPut(store, items.slice(i, i + BATCH_SIZE));
      }
    } catch (e) {
      _cache[store] = snapshot;
      _emitChange(store, 'setAll-rollback');
      _emitError(store, 'setAll', e);
      throw e;
    }
  }

  /**
   * 同步写入缓存 + 发射事件，返回后台持久化的 Promise。
   * 供 Storage 兼容层使用：确保 Storage.set() 后立即 Storage.get() 能读到新数据。
   * 自动为缺少 id 的记录生成 ID（兼容 practiceLog/examLog 等无 key 的旧数据）。
   * @returns {Promise<void>} 后台 IDB 持久化 Promise（不阻塞调用方）
   */
  function commit(store, items) {
    _assertStore(store);
    _assertReady();

    // 确保每条记录都有 id（旧 practiceLog/examLog 条目无 id）
    const now = Date.now();
    items.forEach((item, i) => {
      if (!item.id) item.id = _generateId(store, now + i);
    });

    _cache[store] = items.map(_clone);
    _emitChange(store, 'commit');

    return _persistStore(store);
  }

  /**
   * 同步追加一条记录到缓存 + 发射事件，返回后台持久化 Promise
   */
  function commitAdd(store, item) {
    _assertStore(store);
    _assertReady();

    if (!item.id) item.id = _generateId(store, Date.now());
    if (!item.createdAt) item.createdAt = new Date().toISOString();

    _cache[store].push(_clone(item));
    _emitChange(store, 'add', item.id);

    return _idbPut(store, item).catch(e => {
      _emitError(store, 'commitAdd', e);
      console.warn('[DataStore] commitAdd 持久化失败:', store, e);
    });
  }

  /** 后台持久化整个 store */
  async function _persistStore(store) {
    try {
      await _idbClear(store);
      const items = _cache[store];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        await _idbBatchPut(store, items.slice(i, i + BATCH_SIZE));
      }
    } catch (e) {
      _emitError(store, 'persist', e);
      console.warn('[DataStore] 持久化失败:', store, e.message);
    }
  }

  // ── 计数器（无 keyPath store 专用） ──────────────

  /** 获取 store 记录数 */
  function count(store) {
    _assertStore(store);
    return _cache[store].length;
  }

  // ── JSON 导入/导出（断点续传） ─────────────────────

  /**
   * 导出指定 store 为 JSON 字符串
   */
  function exportJSON(stores) {
    const names = stores || STORE_NAMES;
    const result = {
      version: getVersion(),
      exportedAt: new Date().toISOString(),
    };
    for (const s of names) {
      if (_cache[s]) result[s] = _cache[s];
    }
    return JSON.stringify(result, null, 2);
  }

  /**
   * 导出并下载
   */
  function exportToFile(stores, filename) {
    const json = exportJSON(stores);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `exam_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 导入 JSON 数据 — 支持断点续传
   * @param {Object} jsonData 解析后的 JSON
   * @param {Object} options
   * @param {string} options.store  目标 store 名（必填）
   * @param {Function} options.dedupFn  去重函数
   * @param {Function} options.onProgress  进度回调 ({imported, total, phase})
   * @param {boolean} options.resume  是否从上次断点续传（默认 true）
   * @returns {Promise<{imported: number, skipped: number, failed: number, errors: Array}>}
   */
  async function importJSON(jsonData, options = {}) {
    const { store, dedupFn, onProgress, resume = true } = options;
    _assertStore(store);
    _assertReady();

    // 解析数据
    let items;
    if (store === 'categories') {
      // categories 特殊处理：可能是顶层数组或 store 里的值
      items = Array.isArray(jsonData) ? jsonData
        : (jsonData[store] || jsonData.values || []);
      // 标准化为存储格式
      items = items.map(v => typeof v === 'string' ? { id: v, value: v } : v);
    } else {
      items = Array.isArray(jsonData) ? jsonData : (jsonData[store] || []);
    }

    if (!items.length) return { imported: 0, skipped: 0, failed: 0, errors: [] };

    const total = items.length;
    const resumeKey = `ds_resume_${store}`;

    // 断点续传
    let startIdx = 0;
    if (resume) {
      try {
        const state = JSON.parse(localStorage.getItem(resumeKey) || 'null');
        if (state && state.total === total && state.imported < total) {
          startIdx = state.imported;
          if (onProgress) onProgress({ imported: startIdx, total, phase: 'resume' });
        }
      } catch (e) { /* ignore */ }
    }

    let imported = startIdx;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (let i = startIdx; i < total; i += IMPORT_CHUNK) {
      const chunk = items.slice(i, i + IMPORT_CHUNK);

      try {
        const result = await batchAdd(store, chunk, { dedupFn });
        imported += result.added;
        skipped += result.skipped;

        // 保存断点
        if (resume) {
          localStorage.setItem(resumeKey, JSON.stringify({ total, imported, timestamp: Date.now() }));
        }

        if (onProgress) onProgress({ imported, total, phase: 'importing' });
      } catch (e) {
        // 单批失败 — 逐个重试
        for (const item of chunk) {
          try {
            await add(store, item);
            imported++;
          } catch (innerErr) {
            failed++;
            errors.push({ item: item.id || item.title, error: innerErr.message });
          }
        }

        // 保存断点
        if (resume) {
          localStorage.setItem(resumeKey, JSON.stringify({ total, imported, timestamp: Date.now() }));
        }
        if (onProgress) onProgress({ imported, total, failed, phase: 'retrying' });
      }
    }

    // 清除断点
    if (resume && imported >= total) {
      localStorage.removeItem(resumeKey);
    }
    if (onProgress) onProgress({ imported, total, failed, phase: 'complete' });

    return { imported, skipped, failed, errors };
  }

  /**
   * 查询是否有未完成的导入
   * @returns {{store: string, state: object}[]}
   */
  function getResumeStates() {
    const results = [];
    for (const store of STORE_NAMES) {
      try {
        const raw = localStorage.getItem(`ds_resume_${store}`);
        if (raw) {
          const state = JSON.parse(raw);
          if (state.imported < state.total) {
            results.push({ store, state });
          }
        }
      } catch (e) { /* ignore */ }
    }
    return results;
  }

  /** 清除导入断点 */
  function clearResumeState(store) {
    localStorage.removeItem(`ds_resume_${store}`);
  }

  // ── 从 localStorage 迁移现有数据 ────────────────────

  /**
   * 将 localStorage 中的旧数据迁移到 IDB
   * 仅在首次初始化时调用（检测到 IDB 为空且有 localStorage 数据）
   */
  async function migrateFromLocalStorage() {
    const keyMap = {
      'exam_questions':      'questions',
      'exam_error_book':     'errorBook',
      'exam_practice_log':   'practiceLog',
      'exam_exam_log':       'examLog',
      'exam_categories':     'categories',
      'exam_import_batches': 'importBatches',
      'exam_plans':          'plans',
      'today_progress':      'todayProgress',
    };

    let migrated = 0;
    for (const [lsKey, store] of Object.entries(keyMap)) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (!data || (Array.isArray(data) && data.length === 0)) continue;

        // categories 特殊处理
        if (store === 'categories' && Array.isArray(data)) {
          const records = data.map(v => ({ id: v, value: v }));
          for (const r of records) {
            await _idbPut(store, r);
            _cache[store].push(r);
          }
        } else if (store === 'todayProgress' && data && !Array.isArray(data)) {
          const record = { id: '_current', ...data };
          await _idbPut(store, record);
          _cache[store].push(record);
        } else if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.id) {
              await _idbPut(store, item);
              _cache[store].push(item);
            }
          }
        }
        migrated += (Array.isArray(data) ? data.length : 1);
      } catch (e) {
        console.warn('[DataStore] 迁移失败:', lsKey, e.message);
        _emitError(store, 'migrate', e);
      }
    }

    if (migrated > 0) {
      console.log('[DataStore] 从 localStorage 迁移了 ' + migrated + ' 条记录');
    }
  }

  // ── 内部实现 ──────────────────────────────────────

  async function _doInit() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const [name, def] of Object.entries(STORE_DEFS)) {
          let store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, {
              keyPath: def.keyPath,
              autoIncrement: !!def.autoIncrement,
            });
          } else {
            // 已有 store，获取引用以添加索引
            store = e.target.transaction.objectStore(name);
          }
          // 确保索引存在
          if (def.indexes) {
            for (const idx of def.indexes) {
              if (!store.indexNames.contains(idx)) {
                try { store.createIndex(idx, idx, { unique: false }); } catch (_) {}
              }
            }
          }
        }
        // meta store 用于存储版本号
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        _db = e.target.result;
        _db.onerror = (ev) => console.error('[DataStore] IDB error:', ev.target.error);

        // 加载版本号
        try {
          const meta = await _idbGet('meta', 'version');
          if (meta) _dataVersion = meta.value || 0;
          if (_dataVersion === 0) {
            await _idbPut('meta', { key: 'version', value: 1 });
            _dataVersion = 1;
          }
        } catch (_) {
          await _idbPut('meta', { key: 'version', value: 1 });
          _dataVersion = 1;
        }

        // 加载全部数据到缓存
        await _loadAllToCache();

        // 如果缓存为空，尝试从 localStorage 迁移
        const hasData = STORE_NAMES.some(s => _cache[s].length > 0);
        if (!hasData) {
          await migrateFromLocalStorage();
        }

        _ready = true;
        _emitter.dispatchEvent(new CustomEvent('datastore:ready'));
        resolve();
      };

      request.onerror = (e) => {
        console.error('[DataStore] 打开数据库失败:', e.target.error);
        reject(e.target.error);
      };

      request.onblocked = () => {
        console.warn('[DataStore] 数据库被其他标签页阻塞');
      };
    });
  }

  /** 从 IDB 加载全部数据到内存缓存 */
  async function _loadAllToCache() {
    for (const store of STORE_NAMES) {
      try {
        const all = await _idbGetAll(store);
        _cache[store] = all || [];
      } catch (e) {
        console.warn('[DataStore] 加载 ' + store + ' 失败:', e.message);
        _cache[store] = [];
      }
    }
  }

  // ── IDB 底层操作（Promise 包装） ──────────────────

  function _idbGet(store, key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbGetAll(store) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbPut(store, item) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbBatchPut(store, items) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        let count = 0;
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        for (const item of items) {
          const req = os.put(item);
          req.onsuccess = () => { count++; };
          req.onerror = () => reject(req.error);
        }
      } catch (e) { reject(e); }
    });
  }

  function _idbDelete(store, key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  function _idbClear(store) {
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  // ── 工具函数 ──────────────────────────────────────

  function _assertStore(store) {
    if (!STORE_DEFS[store]) throw new Error('[DataStore] 未知 store: ' + store);
  }

  function _assertReady() {
    if (!_ready) throw new Error('[DataStore] 尚未初始化，请先 await DataStore.init()');
  }

  function _generateId(store, seed) {
    return store.replace(/[A-Z]/g, c => '_' + c.toLowerCase()) + '_'
      + (seed || Date.now()).toString(36) + '_'
      + Math.random().toString(36).substring(2, 6);
  }

  function _clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
  }

  function _emitChange(store, action, id) {
    const detail = { store, action, id, timestamp: Date.now() };
    _emitter.dispatchEvent(new CustomEvent(store + ':changed', { detail }));
    _emitter.dispatchEvent(new CustomEvent('datastore:changed', { detail }));
  }

  function _emitError(store, action, error) {
    const detail = { store, action, error: error.message || String(error), timestamp: Date.now() };
    _emitter.dispatchEvent(new CustomEvent('datastore:error', { detail }));
  }

  // ── 公开导出 ──────────────────────────────────────

  return {
    // 初始化
    init,
    isReady,

    // 缓存（只读）
    cache,

    // CRUD
    get,
    add,
    update,
    remove,
    batchAdd,
    clear,
    setAll,
    commit,
    commitAdd,
    count,

    // 事件
    on,
    off,

    // 导入导出
    exportJSON,
    exportToFile,
    importJSON,
    getResumeStates,
    clearResumeState,

    // 版本
    getVersion,

    // 工具
    storeNames: STORE_NAMES,
  };
})();
