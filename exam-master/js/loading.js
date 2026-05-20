/**
 * 全局 Loading 工具 — 进度条 + 骨架屏
 * 用法:
 *   Loading.progress('正在解析PDF...', 50);
 *   Loading.skeleton('#bank-list', 5);
 *   Loading.hide();
 */
const Loading = {
  _bar: null,
  _text: null,
  _timer: null,

  /** 初始化 DOM（首次调用时自动创建） */
  _ensure() {
    if (this._bar) return;
    this._bar = document.createElement('div');
    this._bar.id = 'loading-bar';
    this._bar.innerHTML = '<div class="loading-bar-fill"></div>';
    this._text = document.createElement('div');
    this._text.id = 'loading-text';
    Object.assign(this._bar.style, {
      position: 'fixed', top: '0', left: '0', height: '3px',
      background: '#f0f0f0', zIndex: '99999', width: '100%',
    });
    Object.assign(this._bar.firstChild.style, {
      height: '100%', width: '0%',
      background: 'linear-gradient(90deg, var(--primary), var(--accent))',
      transition: 'width 0.3s ease',
    });
    Object.assign(this._text.style, {
      position: 'fixed', top: '6px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '99999', fontSize: '12px', color: 'var(--primary)',
      fontWeight: '600', display: 'none',
    });
    document.body.appendChild(this._bar);
    document.body.appendChild(this._text);
  },

  /** 显示进度条 + 可选文字 */
  progress(msg, percent = null) {
    this._ensure();
    if (msg) {
      this._text.style.display = 'block';
      this._text.textContent = msg;
    }
    if (percent !== null) {
      this._bar.firstChild.style.width = Math.min(100, Math.max(0, percent)) + '%';
    } else {
      // 自动推进（模拟）
      this._bar.firstChild.style.width = '0%';
      this._autoAdvance();
    }
    this._bar.style.display = 'block';
  },

  /** 自动推进进度条（不确定进度时用） */
  _autoAdvance() {
    clearInterval(this._timer);
    let w = 0;
    this._timer = setInterval(() => {
      w += (100 - w) * 0.08;
      if (w > 95) { clearInterval(this._timer); return; }
      this._bar.firstChild.style.width = w + '%';
    }, 300);
  },

  /** 隐藏 */
  hide(delay = 0) {
    clearInterval(this._timer);
    setTimeout(() => {
      if (this._bar) {
        this._bar.firstChild.style.width = '100%';
        setTimeout(() => {
          this._bar.style.display = 'none';
          this._text.style.display = 'none';
        }, 200);
      }
    }, delay);
  },

  /** 骨架屏 — 在容器内生成占位卡片 */
  skeleton(selector, count = 3) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    el._skeletonOriginal = el.innerHTML;
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `<div class="skeleton-card" style="height:60px;margin-bottom:8px;border-radius:8px;background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:skeleton-shimmer 1.5s infinite;"></div>`;
    }
    el.innerHTML = html;
  },

  /** 恢复骨架屏原始内容 */
  restore(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el && el._skeletonOriginal) {
      el.innerHTML = el._skeletonOriginal;
      delete el._skeletonOriginal;
    }
  },

  /** 包装异步操作的 loading 状态 */
  async wrap(promise, msg) {
    this.progress(msg);
    try { return await promise; }
    finally { this.hide(300); }
  },
};

// 骨架屏动画
const skelStyle = document.createElement('style');
skelStyle.textContent = '@keyframes skeleton-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
document.head.appendChild(skelStyle);
