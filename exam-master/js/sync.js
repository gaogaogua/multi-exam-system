/**
 * 跨设备同步模块 — 用 GitHub 仓库同步错题本和练习记录
 *
 * 读取（公开仓库无需认证）：
 *   GET https://raw.githubusercontent.com/gaogaogua/multi-exam-system/master/sync/data.json
 *
 * 写入（需要 GitHub Token，scope: repo）：
 *   PUT https://api.github.com/repos/gaogaogua/multi-exam-system/contents/sync/data.json
 *
 * Token 存在 localStorage 'github_token'，在 API Key 设置页面管理
 */

const Sync = {
  REPO: 'gaogaogua/multi-exam-system',
  SYNC_PATH: 'sync/data.json',
  RAW_URL: 'https://raw.githubusercontent.com/gaogaogua/multi-exam-system/master/sync/data.json',
  API_URL: 'https://api.github.com/repos/gaogaogua/multi-exam-system/contents/sync/data.json',

  _token: null,
  _tokenLoaded: false,

  getToken() {
    if (this._tokenLoaded) return this._token;
    this._token = localStorage.getItem('github_token') || '';
    this._tokenLoaded = true;
    return this._token;
  },

  setToken(t) { this._token = t; this._tokenLoaded = true; localStorage.setItem('github_token', t); },
  hasToken() { return !!this.getToken(); },

  /**
   * 拉取远程数据并合并到本地
   */
  async pull() {
    try {
      const resp = await fetch(this.RAW_URL + '?t=' + Date.now());
      if (!resp.ok) {
        console.log('[Sync] 远程无同步数据');
        return { merged: 0, remote: null };
      }
      const remote = await resp.json();
      const result = this._merge(remote);
      console.log('[Sync] 合并完成: +' + result.mergedErrors + '错题, +' + result.mergedPractice + '练习');
      return { merged: result.mergedErrors + result.mergedPractice, remote };
    } catch (e) {
      console.warn('[Sync] 拉取失败:', e.message);
      return { merged: 0, remote: null, error: e.message };
    }
  },

  /**
   * 推送本地数据到远程
   */
  async push() {
    const token = this.getToken();
    if (!token) {
      console.warn('[Sync] 未配置 GitHub Token，跳过推送');
      return { pushed: false, error: '未配置Token' };
    }

    const data = this._collect();
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

    // 获取远程文件 SHA（更新需要）
    let sha = null;
    try {
      const head = await fetch(this.API_URL, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (head.ok) {
        const info = await head.json();
        sha = info.sha;
      }
    } catch (e) { /* 文件不存在，新建 */ }

    try {
      const body = { message: 'sync: auto sync', content };
      if (sha) body.sha = sha;

      const resp = await fetch(this.API_URL, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'HTTP ' + resp.status);
      }

      console.log('[Sync] 推送成功');
      return { pushed: true };
    } catch (e) {
      console.warn('[Sync] 推送失败:', e.message);
      return { pushed: false, error: e.message };
    }
  },

  /**
   * 自动同步：先拉后推
   */
  async autoSync() {
    const pullResult = await this.pull();
    if (pullResult.error) {
      App.showToast ? App.showToast('同步拉取失败: ' + pullResult.error, 'error') : null;
    } else if (pullResult.merged > 0) {
      App.showToast ? App.showToast('同步: 合并了 ' + pullResult.merged + ' 条记录', 'success') : null;
      App.updateStats ? App.updateStats() : null;
      App.renderErrorList ? App.renderErrorList() : null;
    }

    // 仅当有数据变更时才推送
    if (this.hasToken()) {
      const pushResult = await this.push();
      if (pushResult.error) {
        App.showToast ? App.showToast('同步推送失败: ' + pushResult.error, 'error') : null;
      }
    }
  },

  // ── 内部 ──

  /** 收集本地数据 */
  _collect() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      errors: Storage.get(Storage.KEYS.ERROR_BOOK) || [],
      practiceLog: Storage.get(Storage.KEYS.PRACTICE_LOG) || [],
      examLog: Storage.get(Storage.KEYS.EXAM_LOG) || [],
    };
  },

  /** 合并远程数据到本地（取并集，远程优先保留 errorId） */
  _merge(remote) {
    if (!remote || !remote.version) return { mergedErrors: 0, mergedPractice: 0 };

    let mergedErrors = 0;
    const localErrors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    const remoteErrors = remote.errors || [];
    const errorMap = new Map();
    localErrors.forEach(e => errorMap.set(e.id, e));
    remoteErrors.forEach(e => {
      if (!errorMap.has(e.id)) {
        errorMap.set(e.id, e);
        mergedErrors++;
      } else {
        // 合并：保留 mastered 状态、最新 reviewCount
        const local = errorMap.get(e.id);
        if (e.mastered && !local.mastered) local.mastered = true;
        if (e.reviewCount > (local.reviewCount || 0)) local.reviewCount = e.reviewCount;
        if (e.sm2 && !local.sm2) local.sm2 = e.sm2;
      }
    });
    Storage.set(Storage.KEYS.ERROR_BOOK, [...errorMap.values()]);

    let mergedPractice = 0;
    const localPractice = Storage.get(Storage.KEYS.PRACTICE_LOG) || [];
    const remotePractice = remote.practiceLog || [];
    const practiceSet = new Set(localPractice.map(p => p.questionId + '_' + p.timestamp));
    remotePractice.forEach(p => {
      const key = p.questionId + '_' + (p.timestamp || '');
      if (!practiceSet.has(key)) {
        localPractice.push(p);
        mergedPractice++;
        practiceSet.add(key);
      }
    });
    Storage.set(Storage.KEYS.PRACTICE_LOG, localPractice);

    return { mergedErrors, mergedPractice };
  },
};
