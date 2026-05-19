/**
 * 题库自动加载器 — 首次访问时自动从服务器拉取题库数据
 * 按 bank 粒度检测，确保公基和土木各加载一次
 */
const DataLoader = {
  _loadedBanks: {},

  async autoLoad() {
    const banks = [
      { key: '公基', bank: 'gongji', file: 'data/gongji.json' },
      { key: '土木', bank: 'tumu',   file: 'data/tumu.json' },
    ];

    const questions = Storage.get(Storage.KEYS.QUESTIONS) || [];
    let needReload = false;
    let totalLoaded = 0;

    for (const bank of banks) {
      // 检查该 bank 是否已加载（至少 10 题）
      const bankExists = questions.filter(q => q.bank === bank.bank).length >= 10;
      if (bankExists) {
        console.log('[DataLoader] ' + bank.key + ' 题库已存在，跳过');
        continue;
      }

      console.log('[DataLoader] ' + bank.key + ' 题库缺失，开始加载...');
      this._showStatus('正在加载' + bank.key + '题库...');

      try {
        const resp = await fetch(bank.file);
        if (!resp.ok) {
          console.warn('[DataLoader] ' + bank.key + ' HTTP ' + resp.status);
          continue;
        }
        const data = await resp.json();
        const qs = Array.isArray(data) ? data : (data.questions || data.data || []);
        qs.forEach(q => { q.bank = q.bank || bank.bank; });

        const current = Storage.get(Storage.KEYS.QUESTIONS) || [];
        Storage.set(Storage.KEYS.QUESTIONS, current.concat(qs));

        totalLoaded += qs.length;
        needReload = true;
        console.log('[DataLoader] ' + bank.key + ': ' + qs.length + ' 题');
      } catch (e) {
        console.warn('[DataLoader] ' + bank.key + ' 加载失败:', e.message);
        this._showStatus(bank.key + '题库加载失败: ' + e.message);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (needReload) {
      this._showStatus('题库更新完成: +' + totalLoaded + ' 题，刷新中...');
      Storage.remove('exam_categories');
      setTimeout(() => { window.location.reload(); }, 600);
    } else if (questions.length === 0) {
      this._showStatus('题库加载失败，请检查网络连接');
      this._hideStatus(4000);
    } else {
      this._hideStatus(1);
    }
  },

  _showStatus(msg) {
    let el = document.getElementById('dataloader-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dataloader-status';
      el.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:#667eea;color:#fff;text-align:center;z-index:99999;font-size:14px;font-weight:600;';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent = msg;
  },

  _hideStatus(delay) {
    setTimeout(() => {
      const el = document.getElementById('dataloader-status');
      if (el) el.remove();
    }, delay);
  },
};
