/**
 * 题目去重去错模块 - 基于相似度检测的智能去重
 */
const Dedup = {
  // Jaccard相似度阈值（超过此值视为重复）
  SIMILARITY_THRESHOLD: 0.75,

  /**
   * 对题库进行去重扫描
   */
  scanAndDedup() {
    const questions = Storage.get(Storage.KEYS.QUESTIONS) || [];
    if (questions.length < 2) {
      App.showToast('题目数量不足，无法去重', 'info');
      return;
    }

    const duplicates = this.findDuplicates(questions);
    if (duplicates.length === 0) {
      App.showToast('未发现重复题目，题目质量良好！', 'success');
      return;
    }

    // 显示去重结果对话框
    this.showDedupDialog(duplicates, questions);
  },

  /**
   * 找出重复题目组
   */
  findDuplicates(questions) {
    const groups = [];
    const visited = new Set();

    for (let i = 0; i < questions.length; i++) {
      if (visited.has(i)) continue;
      const group = [i];

      for (let j = i + 1; j < questions.length; j++) {
        if (visited.has(j)) continue;
        const sim = this.calculateSimilarity(questions[i], questions[j]);
        if (sim >= this.SIMILARITY_THRESHOLD) {
          group.push(j);
          visited.add(j);
        }
      }

      if (group.length > 1) {
        visited.add(i);
        groups.push(group.map(idx => questions[idx]));
      }
    }

    return groups;
  },

  /**
   * 计算两道题的相似度
   */
  calculateSimilarity(q1, q2) {
    // 使用Jaccard相似度 + 题目标题编辑距离
    const tokens1 = this.tokenize(q1.title);
    const tokens2 = this.tokenize(q2.title);

    const intersection = tokens1.filter(t => tokens2.includes(t));
    const union = [...new Set([...tokens1, ...tokens2])];

    const jaccard = union.length === 0 ? 0 : intersection.length / union.length;

    // 选项相似度（如果有选项）
    let optionSim = 0;
    if (q1.options && q2.options && q1.options.length > 0 && q2.options.length > 0) {
      const optTexts1 = q1.options.map(o => o.text).join(' ');
      const optTexts2 = q2.options.map(o => o.text).join(' ');
      const optTokens1 = this.tokenize(optTexts1);
      const optTokens2 = this.tokenize(optTexts2);
      const optIntersection = optTokens1.filter(t => optTokens2.includes(t));
      const optUnion = [...new Set([...optTokens1, ...optTokens2])];
      optionSim = optUnion.length === 0 ? 0 : optIntersection.length / optUnion.length;
    }

    // 答案相同加权
    const answerBonus = q1.answer === q2.answer ? 0.15 : 0;

    return jaccard * 0.55 + optionSim * 0.3 + answerBonus;
  },

  /**
   * 分词
   */
  tokenize(text) {
    // 简单的中文分词：按字符切分 + 过滤标点
    const cleaned = text.replace(/[，。、；：""''！？（）《》\s,.!?;:'"()\[\]{}<>]/g, ' ');
    return cleaned.split(/\s+/).filter(w => w.length > 0);
  },

  /**
   * 显示去重对话框
   */
  showDedupDialog(duplicates, allQuestions) {
    let html = `<div class="dedup-report">`;
    html += `<p style="margin-bottom:12px;color:var(--text-secondary)">发现 <strong>${duplicates.length}</strong> 组重复题目，请选择每组保留的题目：</p>`;

    duplicates.forEach((group, idx) => {
      html += `<div class="dedup-group">`;
      html += `<h4>重复组 #${idx + 1} (${group.length} 道相似题目)</h4>`;
      group.forEach((q, qIdx) => {
        html += `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:8px;background:var(--bg);border-radius:6px;">
            <input type="radio" name="keep_${idx}" value="${q.id}" ${qIdx === 0 ? 'checked' : ''} style="flex-shrink:0;">
            <span style="flex:1;font-size:13px;">${q.title.substring(0, 80)}...</span>
            <span class="question-tag tag-type">${App.getTypeName(q.type)}</span>
          </div>`;
      });
      html += `</div>`;
    });

    html += `</div>`;
    html += `
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" id="dedup-confirm-btn">确认去重</button>
      </div>`;

    document.getElementById('modal-title').textContent = '智能去重';
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').style.display = 'flex';

    document.getElementById('dedup-confirm-btn').onclick = () => {
      this.executeDedup(duplicates, allQuestions);
    };
  },

  /**
   * 执行去重
   */
  executeDedup(duplicates, allQuestions) {
    const keepIds = new Set();
    duplicates.forEach((group, idx) => {
      const selected = document.querySelector(`input[name="keep_${idx}"]:checked`);
      if (selected) keepIds.add(selected.value);
    });

    const removeIds = new Set();
    duplicates.forEach(group => {
      group.forEach(q => {
        if (!keepIds.has(q.id)) removeIds.add(q.id);
      });
    });

    const filtered = allQuestions.filter(q => !removeIds.has(q.id));
    Storage.set(Storage.KEYS.QUESTIONS, filtered);

    // 同步清理错题本
    const errors = Storage.get(Storage.KEYS.ERROR_BOOK) || [];
    const filteredErrors = errors.filter(e => !removeIds.has(e.questionId));
    Storage.set(Storage.KEYS.ERROR_BOOK, filteredErrors);

    App.closeModal();
    App.showToast(`去重完成，移除 ${removeIds.size} 道重复题目`, 'success');
    App.navigateTo('bank');
    App.renderQuestionBank();
    App.updateStats();
  },

  /**
   * 单题去重检查（添加新题时）
   */
  checkDuplicate(newQuestion, existingQuestions) {
    for (const q of existingQuestions) {
      const sim = this.calculateSimilarity(newQuestion, q);
      if (sim >= this.SIMILARITY_THRESHOLD) {
        return q; // 返回重复的已有题目
      }
    }
    return null;
  },

  /**
   * 题目纠错 - 检测明显错误的答案
   */
  validateQuestion(question) {
    const issues = [];

    // 检查答案是否在选项中
    if (question.type === 'single' || question.type === 'multiple') {
      if (question.options && question.options.length > 0) {
        const labels = question.options.map(o => o.label);
        const answerLabels = question.answer.split('');
        for (const a of answerLabels) {
          if (!labels.includes(a) && /[A-H]/.test(a)) {
            issues.push(`答案选项 "${a}" 不在候选选项中`);
          }
        }
      }
    }

    // 检查题干是否为空
    if (!question.title || question.title.trim().length < 2) {
      issues.push('题干过短或为空');
    }

    // 单选题答案不应超过1个字母
    if (question.type === 'single' && question.answer.length > 1 && /^[A-H]+$/.test(question.answer)) {
      issues.push('单选题答案不应包含多个选项');
    }

    return issues;
  },
};
