/**
 * 全局交互反馈 — 增强 Toast + 确认对话框
 *
 * showToast(message, type, duration)  — 最多同时 3 条，超出排队
 * confirmAction(message, onConfirm)   — 自定义确认弹窗
 */

const Feedback = {
  _queue: [],
  _active: 0,
  _maxActive: 3,

  /**
   * 显示 Toast 通知
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration ms
   */
  showToast(message, type = 'info', duration = 2000) {
    if (this._active >= this._maxActive) {
      this._queue.push({ message, type, duration });
      return;
    }
    this._renderToast(message, type, duration);
  },

  _renderToast(message, type, duration) {
    this._active++;
    const container = document.getElementById('toast-container');
    if (!container) return this._active--;

    const colors = {
      success: { bg: '#52c41a', icon: '✓' },
      error:   { bg: '#ff4d4f', icon: '✗' },
      warning: { bg: '#faad14', icon: '⚠' },
      info:    { bg: '#1890ff', icon: 'ℹ' },
    };
    const c = colors[type] || colors.info;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.style.cssText = `
      display:flex;align-items:center;gap:8px;padding:10px 18px;margin-bottom:8px;
      background:${c.bg};color:#fff;border-radius:8px;font-size:14px;
      box-shadow:0 4px 12px rgba(0,0,0,.15);animation:toastIn .3s ease;
      pointer-events:auto;max-width:360px;
    `;
    el.innerHTML = `<span style="font-weight:700;font-size:16px;">${c.icon}</span><span>${this._escapeHtml(message)}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = '0.3s ease';
      setTimeout(() => {
        el.remove();
        this._active--;
        this._drainQueue();
      }, 300);
    }, duration);
  },

  _drainQueue() {
    if (this._queue.length > 0 && this._active < this._maxActive) {
      const { message, type, duration } = this._queue.shift();
      this._renderToast(message, type, duration);
    }
  },

  /**
   * 确认对话框（替代原生 confirm）
   * @returns {Promise<boolean>}
   */
  confirmAction(message = '确定要执行此操作吗？此操作不可撤销。') {
    return new Promise((resolve) => {
      const existing = document.querySelector('.feedback-confirm-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.className = 'feedback-confirm-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100001;';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,.2);text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
          <p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.6;">${this._escapeHtml(message)}</p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button class="feedback-confirm-cancel" style="padding:8px 28px;border-radius:6px;border:1px solid #d9d9d9;background:#fff;cursor:pointer;font-size:14px;color:#666;">取消</button>
            <button class="feedback-confirm-ok" style="padding:8px 28px;border-radius:6px;border:none;background:#ff4d4f;color:#fff;cursor:pointer;font-size:14px;">确认删除</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.querySelector('.feedback-confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('.feedback-confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  },

  _escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

// 挂载到 window，兼容内联 onclick
window.Feedback = Feedback;

// 保留 App.showToast 兼容性（如果 App 还未定义则在 init 时桥接）
if (typeof App !== 'undefined') {
  App.showToast = (msg, type, dur) => Feedback.showToast(msg, type, dur);
}
