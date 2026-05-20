/**
 * 统一 Modal 管理器 — 替换分散的 4 个模态框
 * 用法:
 *   Modal.open({ id:'my-modal', title:'标题', body:'<p>内容</p>', size:'lg', onClose:()=>{} });
 *   Modal.close('my-modal');
 */
const Modal = {
  _stack: [],

  /**
   * @param opts.id        - 唯一标识
   * @param opts.title     - 标题文字
   * @param opts.body      - 内容 HTML
   * @param opts.size      - 'sm' | '' | 'lg' (默认 '')
   * @param opts.closable  - 是否显示 X 按钮 (默认 true)
   * @param opts.backdrop  - 点背景是否关闭 (默认 true)
   * @param opts.onClose   - 关闭回调
   */
  open(opts = {}) {
    let overlay = document.getElementById(`modal-overlay-${opts.id}`);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = `modal-overlay-${opts.id}`;
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div class="modal ${opts.size === 'lg' ? 'modal-lg' : ''}">
          <div class="modal-header">
            <h3 id="modal-title-${opts.id}">${opts.title || ''}</h3>
            ${opts.closable !== false ? `<button class="modal-close" data-modal-close="${opts.id}">&times;</button>` : ''}
          </div>
          <div class="modal-body" id="modal-body-${opts.id}">${opts.body || ''}</div>
        </div>`;
      if (opts.backdrop !== false) {
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(opts.id); });
      }
      overlay.addEventListener('click', (e) => {
        if (e.target.dataset.modalClose === opts.id) this.close(opts.id);
      });
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
      const titleEl = document.getElementById(`modal-title-${opts.id}`);
      const bodyEl = document.getElementById(`modal-body-${opts.id}`);
      if (titleEl && opts.title !== undefined) titleEl.textContent = opts.title;
      if (bodyEl && opts.body !== undefined) bodyEl.innerHTML = opts.body;
    }

    if (!this._stack.includes(opts.id)) this._stack.push(opts.id);
    overlay._onClose = opts.onClose;
  },

  /** 更新已有 modal 的内容 */
  update(id, { title, body }) {
    const overlay = document.getElementById(`modal-overlay-${id}`);
    if (!overlay) return;
    if (title !== undefined) {
      const el = document.getElementById(`modal-title-${id}`);
      if (el) el.textContent = title;
    }
    if (body !== undefined) {
      const el = document.getElementById(`modal-body-${id}`);
      if (el) el.innerHTML = body;
    }
  },

  /** 关闭 */
  close(id) {
    // 无参数时关闭最近打开的 modal
    if (!id) {
      if (this._stack.length > 0) id = this._stack[this._stack.length - 1];
      else return;
    }
    const overlay = document.getElementById(`modal-overlay-${id}`);
    if (!overlay) return;
    if (overlay._onClose) { overlay._onClose(); delete overlay._onClose; }
    overlay.style.display = 'none';
    this._stack = this._stack.filter(s => s !== id);
  },

  // ── 便捷 API（兼容 practice-modes / practice-report 调用） ──

  /**
   * 简化版 show，自动生成 ID
   * @param opts.title / opts.body / opts.size / opts.onReady
   */
  show(opts = {}) {
    const id = opts.id || 'modal_' + Date.now().toString(36);
    this.open({
      id,
      title: opts.title || '',
      body: opts.body || '',
      size: opts.size || '',
      closable: opts.closable !== false,
      backdrop: opts.backdrop !== false,
      onClose: opts.onClose,
    });
    // onReady callback — 在下一帧执行（DOM 已挂载）
    if (opts.onReady) {
      requestAnimationFrame(() => opts.onReady());
    }
    return id;
  },

  /** 关闭全部 */
  closeAll() {
    [...this._stack].forEach(id => this.close(id));
  },

  /** 是否存在指定 modal */
  isOpen(id) {
    const overlay = document.getElementById(`modal-overlay-${id}`);
    return overlay && overlay.style.display !== 'none';
  },
};
