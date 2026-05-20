/**
 * 按钮加载状态 — withLoading 包装器
 *
 * withLoading(btnEl, asyncFn, loadingText)
 *   点击后按钮 disabled，文案替换，操作完成后恢复。
 *
 * 用法（内联 onclick）:
 *   onclick="LoadingUtils.withLoading(this, async () => { ... }, '处理中...')"
 */

const LoadingUtils = {
  /**
   * 为按钮包装异步操作的加载状态
   * @param {HTMLElement} btn 按钮元素
   * @param {Function|Promise} fn 异步函数或返回 Promise 的函数
   * @param {string} loadingText 加载中文案
   */
  async withLoading(btn, fn, loadingText = '处理中...') {
    if (!btn || btn.disabled) return;
    const origText = btn.textContent || btn.innerText || '';
    const origHTML = btn.innerHTML;

    // 设置加载状态
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.opacity = '0.7';
    try {
      // 保留图标，仅替换文字
      const svgMatch = origHTML.match(/<svg[\s\S]*?<\/svg>/);
      const iconPart = svgMatch ? svgMatch[0] : '';
      btn.innerHTML = iconPart + ' ' + this._escapeHtml(loadingText);
    } catch (_) {
      btn.textContent = loadingText;
    }

    try {
      const result = typeof fn === 'function' ? fn() : fn;
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (e) {
      throw e;
    } finally {
      // 恢复
      btn.disabled = false;
      btn.style.cursor = '';
      btn.style.opacity = '';
      btn.innerHTML = origHTML;
    }
  },

  /**
   * 为按钮创建带加载态的点击处理器（返回函数，适合 onclick 属性）
   * @param {Function} handler 原处理函数
   * @param {string} loadingText
   * @returns {Function} 包装后的函数
   */
  wrap(handler, loadingText = '处理中...') {
    const self = this;
    return function(event) {
      return self.withLoading(this, () => handler.call(this, event), loadingText);
    };
  },

  _escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};

window.LoadingUtils = LoadingUtils;
