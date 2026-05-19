/**
 * UI 控制器 — 侧边栏导航、模态框、Toast 通知、题目编辑表单
 */
const UIController = {

  /** Toast 通知 */
  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2000);
    setTimeout(() => toast.remove(), 2500);
  },

  // ─── 模态框 ───

  showQuestionDetail(id) {
    const q = QuestionBank.getById(id);
    if (!q) return;
    document.getElementById('modal-title').textContent = '题目详情';
    const optsHtml = (q.options || []).map(o =>
      `<span style="display:inline-block;margin:2px 4px;padding:2px 8px;background:#f0f0f0;border-radius:4px;">${o.label}. ${Utils.escapeHtml(o.text)}</span>`
    ).join('');
    document.getElementById('modal-body').innerHTML = `
      <p style="margin-bottom:8px;line-height:1.8;">${Utils.escapeHtml(q.title)}</p>
      ${optsHtml ? `<div style="margin-bottom:8px;">${optsHtml}</div>` : ''}
      <p style="color:var(--success);"><strong>答案：</strong>${Utils.escapeHtml(q.answer || '无')}</p>
      <p style="margin-top:8px;line-height:1.8;"><strong>解析：</strong>${Utils.escapeHtml(q.analysis || '暂无解析')}</p>
      <p style="color:var(--text-secondary);margin-top:8px;">分类: ${q.category || '未分类'} | 题型: ${App.getTypeName(q.type)} | 难度: ${q.difficulty || '未知'}</p>`;
    document.getElementById('modal-overlay').style.display = 'flex';
  },

  closeModal() { document.getElementById('modal-overlay').style.display = 'none'; },

  // ─── 添加/编辑题目模态框 ───

  showAddQuestionModal(editId) {
    const isEdit = !!editId;
    document.getElementById('add-modal-title').textContent = isEdit ? '编辑题目' : '添加题目';
    let q = { type: 'single', title: '', answer: '', analysis: '', category: '', difficulty: '中等' };
    if (isEdit) {
      const existing = QuestionBank.getById(editId);
      if (existing) q = existing;
    }
    const cats = App._getCategoryOptions ? App._getCategoryOptions() : [];
    const catOpts = [...new Set(cats)].map(c => `<option value="${c}" ${c === q.category ? 'selected' : ''}>${c}</option>`).join('');

    document.getElementById('add-modal-body').innerHTML = `
      <div class="form-group"><label>题型</label><select id="q-type" onchange="UIController.onTypeChange()">${['single','multiple','judge','fill','essay'].map(t => `<option value="${t}" ${q.type===t?'selected':''}>${App.getTypeName(t)}</option>`).join('')}</select></div>
      <div class="form-group"><label>题目内容</label><textarea id="q-title" rows="3">${Utils.escapeHtml(q.title)}</textarea></div>
      <div class="form-group" id="q-options-group" style="display:${['single','multiple','judge'].includes(q.type)?'block':'none'};"><label>选项 <button class="btn btn-sm btn-outline" onclick="UIController.addOptionRow()" type="button">+</button></label><div id="q-options-container">${(q.options||[]).map((o,i) => `<div class="option-row" style="display:flex;gap:6px;margin-bottom:4px;"><input value="${o.label}" placeholder="标签" style="width:40px;"><input value="${Utils.escapeHtml(o.text)}" placeholder="选项内容" style="flex:1;"></div>`).join('')}</div></div>
      <div class="form-group"><label>正确答案</label><input id="q-answer" value="${Utils.escapeHtml(q.answer||'')}"></div>
      <div class="form-group"><label>解析</label><textarea id="q-analysis" rows="3">${Utils.escapeHtml(q.analysis||'')}</textarea></div>
      <div class="form-group"><label>分类</label><input id="q-category" value="${Utils.escapeHtml(q.category||'')}" list="q-cat-list"><datalist id="q-cat-list">${catOpts}</datalist></div>
      <div class="form-group"><label>难度</label><select id="q-difficulty">${['简单','中等','困难'].map(d => `<option value="${d}" ${q.difficulty===d?'selected':''}>${d}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button class="btn btn-outline" onclick="App.closeAddModal()">取消</button><button class="btn btn-primary" onclick="App.saveQuestion('${editId||''}')">保存</button></div>`;
    document.getElementById('add-modal-overlay').style.display = 'flex';
  },

  addOptionRow() {
    const container = document.getElementById('q-options-container');
    if (!container) return;
    const idx = container.children.length;
    const label = String.fromCharCode(65 + idx);
    container.insertAdjacentHTML('beforeend', `<div class="option-row" style="display:flex;gap:6px;margin-bottom:4px;"><input value="${label}" placeholder="标签" style="width:40px;"><input placeholder="选项内容" style="flex:1;"></div>`);
  },

  onTypeChange() {
    const type = document.getElementById('q-type')?.value;
    const group = document.getElementById('q-options-group');
    if (group) group.style.display = ['single','multiple','judge'].includes(type) ? 'block' : 'none';
  },

  // ─── API Key 模态框 ───

  showApiKeyModal() {
    const currentKey = ApiConfig.getDeepSeekApiKey();
    const masked = currentKey ? currentKey.slice(0, 6) + '****' + currentKey.slice(-4) : '';
    const ghToken = Sync.getToken();
    const ghMasked = ghToken ? ghToken.slice(0, 4) + '****' + ghToken.slice(-4) : '';
    document.getElementById('apikey-modal-title').textContent = 'API 设置';
    document.getElementById('apikey-modal-body').innerHTML = `
      <div class="form-group"><label>DeepSeek API Key <small>(AI智能解析)</small></label><input type="password" id="apikey-input" value="${currentKey}" placeholder="sk-xxxxxxxxxxxxxxxx" autocomplete="off">${currentKey ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">当前: ${masked}</p>` : ''}<div class="api-key-help" style="font-size:12px;margin-top:4px;">获取: <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a></div></div>
      <hr style="margin:16px 0;border:none;border-top:1px solid #f0f0f0;">
      <div class="form-group"><label>Gitee Token <small>(跨设备同步)</small></label><input type="password" id="github-token-input" value="${ghToken}" placeholder="gitee_token_xxxxxxxx" autocomplete="off">${ghToken ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">当前: ${ghMasked}</p>` : ''}<div class="api-key-help" style="font-size:12px;margin-top:4px;">获取: <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">创建 Gitee Token</a> (勾选 projects)</div>${ghToken ? '<button class="btn btn-sm btn-outline" onclick="Sync.push().then(r=>UIController.showToast(r.pushed?\'同步成功\':\'失败:\'+r.error,r.pushed?\'success\':\'error\'))" style="margin-top:8px;">手动同步</button>' : ''}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">${currentKey||ghToken?'<button class="btn btn-outline btn-danger" onclick="App.clearAllKeys()">清除全部</button>':''}<button class="btn btn-outline" onclick="App.closeApiKeyModal()">取消</button><button class="btn btn-primary" onclick="App.saveApiKey()">保存</button></div>`;
    document.getElementById('apikey-modal-overlay').style.display = 'flex';
  },

  // ─── AI 进度模态框 ───

  showAiProgress(total) {
    document.getElementById('ai-progress-body').innerHTML = `<div style="text-align:center;padding:20px;"><p>AI 智能解析中...</p><p style="font-size:13px;color:var(--text-secondary);">共 ${total} 题</p><div id="ai-progress-list" style="max-height:300px;overflow-y:auto;margin-top:12px;text-align:left;"></div></div>`;
    document.getElementById('ai-progress-close').style.display = 'none';
    document.getElementById('ai-progress-overlay').style.display = 'flex';
  },

  updateAiProgress(current, total, status) {
    const list = document.getElementById('ai-progress-list');
    if (list) list.innerHTML += `<div style="font-size:12px;padding:2px 0;">${current}/${total} ${status}</div>`;
  },

  closeAiProgress() { document.getElementById('ai-progress-overlay').style.display = 'none'; },
};
