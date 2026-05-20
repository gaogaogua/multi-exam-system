/**
 * 全局错误处理 — window.onerror + unhandledrejection
 *
 * 捕获未处理的错误和 Promise 拒绝，显示友好提示，记录到 localStorage 错误日志。
 * 错误日志上限 100 条，自动裁剪最早记录。
 */

const ErrorHandler = (() => {
  const LOG_KEY = 'exam_error_log';
  const MAX_LOG = 100;
  const MAX_CRITICAL = 5; // 单页会话内严重错误上限（防抖）

  let _criticalCount = 0;
  let _criticalTimer = null;

  // ── 初始化 ────────────────────────────────────────

  function init() {
    _restoreCriticalCount();

    window.addEventListener('error', (event) => {
      // 仅处理运行时错误（非资源加载错误）
      if (event.error || event.message) {
        _handleError({
          type: 'runtime',
          message: event.message || 'Unknown error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error ? event.error.stack : null,
          timestamp: new Date().toISOString(),
        });
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      _handleError({
        type: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason || 'Promise rejected'),
        stack: reason instanceof Error ? reason.stack : null,
        timestamp: new Date().toISOString(),
      });
    });

    console.log('[ErrorHandler] 全局错误捕获已启用');
  }

  // ── 错误处理 ─────────────────────────────────────

  function _handleError(err) {
    // 记录到日志
    _log(err);

    // 网络错误静默（fetch 失败已有 UI 提示）
    if (_isNetworkError(err)) return;

    // 严重错误弹窗
    const isCritical = _isCritical(err);
    if (isCritical) {
      _criticalCount++;
      if (_criticalCount <= MAX_CRITICAL) {
        _showErrorModal(err);
      }
      // 重置计数器（10 秒窗口）
      clearTimeout(_criticalTimer);
      _criticalTimer = setTimeout(() => { _criticalCount = 0; }, 10000);

      // 持久化计数（防止刷新后错误循环）
      try {
        sessionStorage.setItem('exam_critical_count', String(_criticalCount));
      } catch (_) {}
    } else {
      _showErrorToast(err);
    }
  }

  /** 判断是否为网络相关错误（不需要弹窗） */
  function _isNetworkError(err) {
    const msg = (err.message || '').toLowerCase();
    return /network|fetch|timeout|abort|failed to fetch|net::err/i.test(msg);
  }

  /** 判断是否为严重错误 */
  function _isCritical(err) {
    const msg = (err.message || '').toLowerCase();
    if (/quotaexceeded|storage.*full|indexeddb.*error|out of memory/i.test(msg)) return true;
    if (err.type === 'runtime' && err.stack && err.stack.includes('DataStore')) return true;
    return false;
  }

  // ── UI 提示 ──────────────────────────────────────

  function _showErrorToast(err) {
    const msg = _formatMessage(err);
    // 复用 App.showToast（如果可用）
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(msg, 'error');
    } else {
      _fallbackToast(msg);
    }
  }

  function _showErrorModal(err) {
    // 移除已有的错误弹窗
    const existing = document.querySelector('.error-modal-overlay');
    if (existing) existing.remove();

    const msg = _formatMessage(err);
    const stack = err.stack ? err.stack.substring(0, 300) : '';

    const overlay = document.createElement('div');
    overlay.className = 'error-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100000;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;max-width:480px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,.2);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#fff2f0;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">&#9888;</div>
          <div>
            <h3 style="margin:0;font-size:16px;color:#cf1322;">系统错误</h3>
            <p style="margin:4px 0 0;font-size:13px;color:#666;">${_escapeHtml(msg)}</p>
          </div>
        </div>
        ${stack ? `<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:12px;color:#999;">技术详情</summary><pre style="font-size:11px;color:#666;max-height:120px;overflow:auto;background:#fafafa;padding:8px;border-radius:4px;margin-top:4px;">${_escapeHtml(stack)}</pre></details>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="error-modal-close" style="padding:6px 20px;border-radius:4px;border:1px solid #d9d9d9;background:#fff;cursor:pointer;font-size:13px;">关闭</button>
          <button class="error-modal-refresh" style="padding:6px 20px;border-radius:4px;border:none;background:#1890ff;color:#fff;cursor:pointer;font-size:13px;">刷新页面</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.error-modal-close').onclick = () => overlay.remove();
    overlay.querySelector('.error-modal-refresh').onclick = () => location.reload();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function _fallbackToast(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;background:#ff4d4f;color:#fff;border-radius:6px;z-index:100001;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.15);animation:fadeIn .3s;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 4000);
  }

  function _formatMessage(err) {
    const msg = err.message || '未知错误';
    if (msg.length > 120) return msg.substring(0, 117) + '...';
    return msg;
  }

  function _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 错误日志 ──────────────────────────────────────

  function _log(err) {
    try {
      const logs = _getLogs();
      logs.push({
        type: err.type,
        message: err.message || 'Unknown',
        filename: err.filename || '',
        lineno: err.lineno || 0,
        timestamp: err.timestamp || new Date().toISOString(),
      });

      // 裁剪到上限
      while (logs.length > MAX_LOG) logs.shift();

      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      // 日志写入失败（如 localStorage 满），静默
    }
  }

  function _getLogs() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  /** 获取错误日志（供外部查看） */
  function getLogs(limit = 50) {
    const logs = _getLogs();
    return logs.slice(-limit).reverse();
  }

  /** 清空错误日志 */
  function clearLogs() {
    localStorage.removeItem(LOG_KEY);
  }

  /** 获取错误日志统计 */
  function getLogStats() {
    const logs = _getLogs();
    const byType = {};
    logs.forEach(l => {
      byType[l.type] = (byType[l.type] || 0) + 1;
    });
    return {
      total: logs.length,
      byType,
      latestAt: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
    };
  }

  /** 渲染错误日志查看器 */
  function renderLogViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const logs = getLogs(50);
    if (logs.length === 0) {
      container.innerHTML = '<p style="color:#999;font-size:13px;padding:16px;">暂无错误记录</p>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:#999;">共 ${logs.length} 条记录</span>
        <button class="btn btn-sm btn-outline" onclick="ErrorHandler.clearLogs(); if(document.getElementById('${containerId}')) ErrorHandler.renderLogViewer('${containerId}');" style="font-size:11px;">清空日志</button>
      </div>
      ${logs.map((l, i) => `
        <div style="padding:6px 8px;margin-bottom:4px;background:#fafafa;border-radius:4px;font-size:12px;border-left:3px solid ${l.type === 'unhandledrejection' ? '#faad14' : '#ff4d4f'};">
          <span style="color:#999;">[${new Date(l.timestamp).toLocaleTimeString('zh-CN')}]</span>
          <span style="margin-left:8px;color:#333;">${_escapeHtml(l.message)}</span>
          ${l.filename ? `<span style="color:#999;margin-left:4px;">@ ${l.filename}:${l.lineno}</span>` : ''}
        </div>
      `).join('')}`;
  }

  // ── 辅助 ──────────────────────────────────────────

  function _restoreCriticalCount() {
    try {
      _criticalCount = parseInt(sessionStorage.getItem('exam_critical_count') || '0');
    } catch (_) {
      _criticalCount = 0;
    }
  }

  return {
    init,
    getLogs,
    clearLogs,
    getLogStats,
    renderLogViewer,
  };
})();
