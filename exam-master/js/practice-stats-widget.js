/**
 * 答题统计悬浮窗 + 练习休息提醒
 *
 * 悬浮窗: 右下角显示正确/总数、正确率、用时，可拖拽
 * 休息提醒: 连续练习 60 分钟弹窗提醒
 */

const StatsWidget = {
  _timer: null,
  _startTime: 0,
  _elapsed: 0,
  _total: 0,
  _correct: 0,
  _active: false,
  _dragging: false,
  _dragX: 0,
  _dragY: 0,
  _restTimer: null,
  _restWarned: false,

  /** 开始计时 & 显示悬浮窗 */
  start(total, correct = 0) {
    this._total = total;
    this._correct = correct;
    this._startTime = Date.now();
    this._active = true;
    this._restWarned = false;
    this._render();
    this._startTimer();

    // 休息提醒定时器
    this._restTimer = setTimeout(() => {
      if (this._active) {
        this._restWarned = true;
        Feedback.showToast('⏰ 已连续练习 60 分钟，建议休息一下！', 'warning', 5000);
      }
    }, 60 * 60 * 1000);
  },

  /** 更新正确数 */
  updateCorrect(correct) {
    this._correct = correct;
    this._render();
  },

  /** 停止 & 隐藏 */
  stop() {
    this._active = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._restTimer) { clearTimeout(this._restTimer); this._restTimer = null; }
    const el = document.getElementById('stats-widget');
    if (el) el.remove();
  },

  /** 获取已用秒数 */
  getElapsed() {
    return Math.round((Date.now() - this._startTime) / 1000);
  },

  // ── 内部 ──

  _startTimer() {
    this._timer = setInterval(() => this._render(), 1000);
  },

  _render() {
    const elapsed = this.getElapsed();
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const acc = this._total > 0 ? Math.round(this._correct / this._total * 100) : 0;

    let el = document.getElementById('stats-widget');
    if (!el) {
      el = document.createElement('div');
      el.id = 'stats-widget';
      el.style.cssText = `
        position:fixed;bottom:80px;right:20px;z-index:500;
        background:rgba(0,0,0,.75);color:#fff;border-radius:12px;
        padding:10px 14px;font-size:13px;line-height:1.8;
        box-shadow:0 4px 16px rgba(0,0,0,.3);
        cursor:move;user-select:none;backdrop-filter:blur(8px);
        min-width:130px;
      `;
      document.body.appendChild(el);

      // 拖拽
      el.addEventListener('mousedown', (e) => {
        this._dragging = true;
        this._dragX = e.clientX - el.offsetLeft;
        this._dragY = e.clientY - el.offsetTop;
        el.style.transition = 'none';
      });
      document.addEventListener('mousemove', (e) => {
        if (!this._dragging) return;
        el.style.left = (e.clientX - this._dragX) + 'px';
        el.style.top = (e.clientY - this._dragY) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      });
      document.addEventListener('mouseup', () => { this._dragging = false; });

      // 触摸拖拽
      el.addEventListener('touchstart', (e) => {
        this._dragging = true;
        this._dragX = e.touches[0].clientX - el.offsetLeft;
        this._dragY = e.touches[0].clientY - el.offsetTop;
        el.style.transition = 'none';
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        if (!this._dragging) return;
        el.style.left = (e.touches[0].clientX - this._dragX) + 'px';
        el.style.top = (e.touches[0].clientY - this._dragY) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }, { passive: true });
      document.addEventListener('touchend', () => { this._dragging = false; });
    }

    const accColor = acc >= 80 ? '#52c41a' : acc >= 50 ? '#faad14' : '#ff4d4f';
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:2px;">
        <span style="color:${accColor};font-size:20px;">${acc}%</span>
        <span style="font-size:11px;color:#bbb;">正确率</span>
      </div>
      <div style="font-size:11px;color:#bbb;">
        ✅ ${this._correct}/<span style="color:#fff;">${this._total}</span> &nbsp;|&nbsp; ⏱ ${mins}:${String(secs).padStart(2,'0')}
      </div>
      ${this._restWarned ? '<div style="font-size:10px;color:#faad14;margin-top:2px;">⏰ 建议休息</div>' : ''}
    `;
  },
};

window.StatsWidget = StatsWidget;
