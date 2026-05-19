/**
 * 导入控制器 — PDF 上传解析、导入历史管理
 */
const ImportController = {

  /** 按需加载 pdf.js */
  async _ensurePdfJs() {
    if (typeof pdfjsLib !== 'undefined') return pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = () => reject(new Error('PDF.js 加载失败'));
      document.head.appendChild(script);
    });
  },

  /** 处理 PDF 上传 */
  async handlePdfUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    try {
      await this._ensurePdfJs();
      const badge = document.getElementById('engine-badge');
      if (badge) { badge.textContent = '引擎: PDF.js (已加载)'; badge.style.color = 'var(--success)'; }
    } catch (e) {
      App.showToast('PDF解析引擎加载失败，请检查网络', 'error');
      input.value = '';
      return;
    }

    App.showToast(`正在解析 ${files.length} 个PDF文件...`, 'info');
    const { totalAdded, totalDup, importedIds, engineUsed } = await this._processPdfFiles(files);
    this._finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup);
    input.value = '';
    App.renderQuestionBank();
    this.renderImportHistory();
    App.updateStats();
    App.updateStorageInfo();
  },

  async _processPdfFiles(files) {
    let totalAdded = 0, totalDup = 0, engineUsed = '';
    const importedIds = [];

    const backendOk = await ApiConfig.checkAvailability();
    if (backendOk && files.length > 1) {
      try {
        const batch = await PdfParser.parsePdfBatch(files);
        if (batch.length > 0) {
          engineUsed = 'backend';
          const classified = AutoCategorizer.classify([...batch]);
          const r = QuestionBank.batchImport(classified);
          totalAdded += r.added; totalDup += r.skippedDup;
          if (r.added > 0) { const all = QuestionBank.getAll(); importedIds.push(...all.slice(-r.added).map(q => q.id)); }
        }
      } catch (e) { console.warn('批量解析失败，逐个处理:', e.message); }
    }

    if (engineUsed !== 'backend') {
      for (const file of files) {
        try {
          const qs = await PdfParser.parsePdf(file);
          if (qs.length > 0) {
            if (qs[0]._engine) engineUsed = qs[0]._engine;
            const classified = AutoCategorizer.classify([...qs]);
            const r = QuestionBank.batchImport(classified);
            totalAdded += r.added; totalDup += r.skippedDup;
            if (r.added > 0) { const all = QuestionBank.getAll(); importedIds.push(...all.slice(-r.added).map(q => q.id)); }
          }
        } catch (err) {
          console.error('PDF解析失败:', file.name, err);
          App.showToast(`解析失败: ${file.name} - ${err.message}`, 'error');
        }
      }
    }

    return { totalAdded, totalDup, importedIds, engineUsed };
  },

  _finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup) {
    if (importedIds.length > 0) {
      const totalSize = files.reduce((s, f) => s + f.size, 0);
      const name = files.length === 1 ? files[0].name : `${files.length} 个文件`;
      ImportManager.recordImport(name, totalSize, importedIds, engineUsed);
    }
    if (totalAdded > 0) {
      const catCount = Object.keys(AutoCategorizerKnowledge || {}).length;
      App.showToast(`成功导入 ${totalAdded} 道题目（已自动分类到${catCount}个领域）${totalDup > 0 ? `，跳过 ${totalDup} 道重复` : ''}`, 'success');
      this._promptAiForMissing(importedIds);
    } else {
      App.showToast(`未能导入新题目（${totalDup} 道重复）`, 'info');
    }
  },

  _promptAiForMissing(importedIds) {
    const missing = importedIds.filter(id => { const q = QuestionBank.getById(id); return q && (!q.answer || !q.analysis); });
    if (missing.length === 0) return;
    setTimeout(() => {
      if (ApiConfig.hasDeepSeekApiKey()) {
        if (confirm(`新导入的题目中有 ${missing.length} 道缺少答案或解析。是否使用AI智能分析自动补全？`)) App.aiAnalyzeMissing();
      } else {
        if (confirm(`新导入的题目中有 ${missing.length} 道缺少答案或解析。配置DeepSeek API Key后可使用AI自动补全。是否现在配置？`)) App.showApiKeyModal();
      }
    }, 500);
  },

  // ─── 导入历史 ───

  renderImportHistory() {
    const container = document.getElementById('import-history-list');
    if (!container) return;
    const batches = ImportManager.getAll();
    if (batches.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding:16px;">暂无导入记录</p>';
      this._updateImportSummary(batches);
      return;
    }
    const sorted = [...batches].reverse();
    container.innerHTML = sorted.map(b => {
      const date = new Date(b.importedAt).toLocaleString('zh-CN');
      const sizeStr = b.fileSize > 1048576 ? (b.fileSize / 1048576).toFixed(1) + ' MB' : (b.fileSize / 1024).toFixed(0) + ' KB';
      const displayName = b.filename.length > 28 ? b.filename.slice(0, 28) + '...' : b.filename;
      return `<div class="import-batch-item" id="batch-${b.id}">
        <div class="import-batch-info">
          <span class="import-batch-name" title="${Utils.escapeHtml(b.filename)}">${Utils.escapeHtml(displayName)}</span>
          <span class="import-batch-meta">${b.questionCount} 题 | ${sizeStr} | ${date}</span>
          ${b.engine ? `<span class="question-tag tag-type" style="font-size:10px;">${b.engine}</span>` : ''}
        </div>
        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="ImportController.deleteImportBatch('${b.id}')" title="删除该批次全部题目">删除</button>
      </div>`;
    }).join('');
    this._updateImportSummary(batches);
  },

  deleteImportBatch(batchId) {
    if (!confirm('确定删除该批次导入的所有题目吗？此操作不可恢复。')) return;
    const removed = ImportManager.removeBatch(batchId);
    if (removed > 0) App.showToast(`已删除 ${removed} 道题目`, 'info');
    App.renderQuestionBank();
    this.renderImportHistory();
    App.updateStats();
  },

  _updateImportSummary(batches) {
    const el = document.getElementById('import-summary');
    if (!el) return;
    if (batches.length === 0) { el.textContent = ''; return; }
    const total = batches.reduce((s, b) => s + b.questionCount, 0);
    el.textContent = `共 ${batches.length} 次导入，合计 ${total} 道题目`;
  },
};
