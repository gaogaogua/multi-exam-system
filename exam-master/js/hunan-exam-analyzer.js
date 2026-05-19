/**
 * 湖南省事业单位公基考试 - 智能分析引擎
 * 输入解析 + 多维度分析 + 可操作性诊断建议
 */
const HunanExamAnalyzer = {

  // 九大模块定义
  MODULES: [
    { key: '法律', label: '法律', icon: '⚖️' },
    { key: '政治', label: '政治', icon: '📜' },
    { key: '经济', label: '经济', icon: '💰' },
    { key: '公文', label: '公文', icon: '📋' },
    { key: '管理', label: '管理', icon: '🏛️' },
    { key: '文史科技', label: '文史科技', icon: '📚' },
    { key: '时政', label: '时政', icon: '📰' },
    { key: '湖南省情', label: '湖南省情', icon: '🏠' },
    { key: '土木专业知识', label: '土木专业知识', icon: '🔧' },
  ],

  // 错误类型
  ERROR_TYPES: ['知识点盲区', '概念混淆', '审题失误', '记忆模糊', '计算错误'],

  // 分析历史存储key
  STORAGE_KEY: 'hunan_exam_analysis_history',

  /**
   * 解析输入文本
   */
  parse(input) {
    const text = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!text) throw new Error('请输入考试数据');

    const result = {
      examName: '',
      examDate: '',
      totalQuestions: 0,
      totalTime: 0,
      modules: {},
      errorDetails: [],
      parseErrors: [],
    };

    // 解析考试基本信息
    const nameMatch = text.match(/考试名称[：:]\s*(.+)/);
    if (nameMatch) result.examName = nameMatch[1].trim();

    const dateMatch = text.match(/考试时间[：:]\s*(.+)/);
    if (dateMatch) result.examDate = dateMatch[1].trim();

    const totalMatch = text.match(/总题量[：:]\s*(\d+)/);
    if (totalMatch) result.totalQuestions = parseInt(totalMatch[1]);

    const timeMatch = text.match(/用时[：:]\s*(\d+)/);
    if (timeMatch) result.totalTime = parseInt(timeMatch[1]);

    // 解析各模块答题情况
    const moduleSection = text.match(/【各模块答题情况】([\s\S]*?)(?=【错题详情】|$)/);
    if (moduleSection) {
      const lines = moduleSection[1].trim().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 匹配格式：X. 法律模块：总题X，做对X，做错X，错题题号：1,3,5...
        const m = trimmed.match(/(\d+)\.\s*(.+?)[模块]?[：:]\s*总题(\d+)[，,]\s*做对(\d+)[，,]\s*做错(\d+)(?:[，,]\s*错题题号[：:]\s*(.*))?/);
        if (m) {
          const moduleName = m[2].replace('模块', '').trim();
          const total = parseInt(m[3]);
          const correct = parseInt(m[4]);
          const wrong = parseInt(m[5]);
          const wrongNums = m[6] ? m[6].split(/[,，]/).map(s => s.trim()).filter(Boolean).map(Number) : [];

          // 匹配到标准模块名
          const stdModule = this.MODULES.find(mod => moduleName.includes(mod.key));
          const key = stdModule ? stdModule.key : moduleName;

          result.modules[key] = {
            total,
            correct,
            wrong,
            wrongNums: wrongNums.filter(n => !isNaN(n)),
          };
        }
      }
    }

    // 解析错题详情
    const errorSection = text.match(/【错题详情】([\s\S]*)/);
    if (errorSection) {
      const lines = errorSection[1].trim().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 格式：题号-模块-错误原因1；错误原因2
        // 或：3-法律-知识点盲区；7-政治-记忆模糊
        const m = trimmed.match(/(\d+)\s*[-—]\s*(.+?)\s*[-—]\s*(.+)/);
        if (m) {
          const qNum = parseInt(m[1]);
          const moduleRaw = m[2].trim();
          const reasonsRaw = m[3].trim();

          const stdModule = this.MODULES.find(mod => moduleRaw.includes(mod.key));
          const module = stdModule ? stdModule.key : moduleRaw;

          const reasons = reasonsRaw.split(/[；;]/).map(s => {
            const r = s.trim();
            const std = this.ERROR_TYPES.find(t => r.includes(t));
            return std || r;
          }).filter(Boolean);

          result.errorDetails.push({ qNum, module, reasons });
        }
      }
    }

    return result;
  },

  /**
   * 执行全维度分析
   */
  analyze(parsedData) {
    const { modules, errorDetails, totalQuestions, totalTime, examName } = parsedData;

    // 汇总所有答题
    let totalCorrect = 0;
    let totalWrong = 0;
    for (const [, m] of Object.entries(modules)) {
      totalCorrect += m.correct;
      totalWrong += m.wrong;
    }
    const overallAccuracy = totalCorrect + totalWrong > 0
      ? (totalCorrect / (totalCorrect + totalWrong) * 100) : 0;

    // 各模块正确率
    const moduleStats = [];
    for (const [name, m] of Object.entries(modules)) {
      const accuracy = m.total > 0 ? (m.correct / m.total * 100) : 0;
      let level;
      if (accuracy >= 85) level = 'excellent';
      else if (accuracy >= 60) level = 'average';
      else level = 'weak';
      moduleStats.push({ name, ...m, accuracy, level });
    }
    moduleStats.sort((a, b) => b.accuracy - a.accuracy);

    // 错误类型统计
    const errorTypeCount = {};
    for (const t of this.ERROR_TYPES) errorTypeCount[t] = 0;
    for (const err of errorDetails) {
      for (const r of err.reasons) {
        if (errorTypeCount.hasOwnProperty(r)) errorTypeCount[r]++;
      }
    }

    // 各模块错误类型分布
    const moduleErrorTypes = {};
    for (const [name] of Object.entries(modules)) {
      moduleErrorTypes[name] = {};
      for (const t of this.ERROR_TYPES) moduleErrorTypes[name][t] = 0;
    }
    for (const err of errorDetails) {
      if (!moduleErrorTypes[err.module]) continue;
      for (const r of err.reasons) {
        if (moduleErrorTypes[err.module].hasOwnProperty(r)) {
          moduleErrorTypes[err.module][r]++;
        }
      }
    }

    // 薄弱模块TOP3
    const weakModules = moduleStats
      .filter(m => m.accuracy < 85)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);

    // 诊断薄弱模块的核心问题
    const weakModuleDiagnosis = weakModules.map(m => {
      const errTypes = moduleErrorTypes[m.name] || {};
      const primary = Object.entries(errTypes)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])[0];
      return {
        module: m.name,
        accuracy: m.accuracy,
        primaryErrorType: primary ? primary[0] : null,
        primaryCount: primary ? primary[1] : 0,
        diagnosis: this._diagnoseModule(m.name, m, errTypes),
      };
    });

    // 用时评估
    let timeAssessment;
    if (totalQuestions > 0 && totalTime > 0) {
      const perQuestion = totalTime / totalQuestions;
      if (perQuestion < 0.7) timeAssessment = { label: '偏快', cssClass: 'warning', detail: `平均每题${perQuestion.toFixed(1)}分钟，答题速度偏快，可能存在审题不仔细的问题。建议适当放慢速度，确保理解题意后再作答。` };
      else if (perQuestion > 1.8) timeAssessment = { label: '偏慢', cssClass: 'warning', detail: `平均每题${perQuestion.toFixed(1)}分钟，答题速度偏慢，可能影响考试时间分配。建议通过刷题提升熟练度，目标控制在每题1-1.5分钟。` };
      else timeAssessment = { label: '正常', cssClass: 'success', detail: `平均每题${perQuestion.toFixed(1)}分钟，答题节奏合理。` };
    } else {
      timeAssessment = { label: '无数据', cssClass: '', detail: '缺少用时数据，无法评估。' };
    }

    // 生成可操作性建议
    const recommendations = this._generateRecommendations(moduleStats, errorTypeCount, weakModuleDiagnosis, moduleErrorTypes, parsedData);

    // 湖南省特色分析
    const hunanAnalysis = this._analyzeHunanFeatures(modules, errorDetails);

    return {
      examName,
      totalCorrect,
      totalWrong,
      totalQuestions: totalCorrect + totalWrong,
      overallAccuracy,
      moduleStats,
      errorTypeCount,
      moduleErrorTypes,
      weakModules: weakModuleDiagnosis,
      timeAssessment,
      recommendations,
      hunanAnalysis,
    };
  },

  /**
   * 诊断单个模块
   */
  _diagnoseModule(moduleName, stats, errTypes) {
    const dominant = Object.entries(errTypes)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (dominant.length === 0) {
      return `该模块暂无详细错题数据，建议补充错题原因标注以便精准诊断。`;
    }

    const primary = dominant[0];
    const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100) : 0;

    const templates = {
      '知识点盲区': {
        high: `${moduleName}模块存在严重知识盲区，"${primary[0]}"类错误占主导（${primary[1]}题）。说明对${moduleName}的核心考点缺乏系统性掌握，需要从教材/讲义的基础章节开始重新梳理，建立完整的知识框架。`,
        mid: `${moduleName}模块存在部分知识盲区，"${primary[0]}"类错误较多（${primary[1]}题）。建议对照考试大纲逐一排查未掌握的知识点，重点补齐薄弱环节。`,
        low: `${moduleName}模块偶有知识盲区，整体掌握尚可。`,
      },
      '概念混淆': {
        high: `${moduleName}模块概念混淆严重（${primary[1]}题），对相似概念/制度/原则的区分不清。建议制作对比表格，将易混淆的概念并列对比记忆，如"行政处罚vs行政处分""通告vs公告"等。`,
        mid: `${moduleName}模块存在概念混淆（${primary[1]}题），建议对易混概念进行专项梳理和对比记忆。`,
        low: `${moduleName}模块偶有概念混淆，注意辨析相似概念。`,
      },
      '记忆模糊': {
        high: `${moduleName}模块记忆不牢（${primary[1]}题），对需要精确记忆的法条、数据、时间节点等掌握不扎实。建议使用记忆卡片/口诀，定期回顾强化。`,
        mid: `${moduleName}模块部分知识点记忆模糊（${primary[1]}题），建议加强重复记忆和定期复习。`,
        low: `${moduleName}模块记忆基本牢固，偶有遗忘属正常现象。`,
      },
      '审题失误': {
        high: `${moduleName}模块审题失误严重（${primary[1]}题），大量失分源于读题不仔细而非知识缺陷。建议刻意放慢读题速度，圈画题干关键词（如"错误的是""不属于""不包括"），养成先排除再确认的答题习惯。`,
        mid: `${moduleName}模块存在审题失误（${primary[1]}题），需提升审题严谨性。`,
        low: `${moduleName}模块审题基本准确。`,
      },
      '计算错误': {
        high: `${moduleName}模块计算错误较多（${primary[1]}题），建议加强计算基本功训练，注意检查验算。`,
        mid: `${moduleName}模块存在计算错误（${primary[1]}题），注意仔细检查。`,
        low: `${moduleName}模块计算基本正确。`,
      },
    };

    const typeKey = primary[0];
    const severity = accuracy < 50 ? 'high' : accuracy < 75 ? 'mid' : 'low';

    if (templates[typeKey] && templates[typeKey][severity]) {
      return templates[typeKey][severity];
    }
    return `${moduleName}模块正确率${accuracy.toFixed(1)}%，主要问题为${typeKey}，需针对性加强。`;
  },

  /**
   * 生成可操作性建议
   */
  _generateRecommendations(moduleStats, errorTypeCount, weakModuleDiagnosis, moduleErrorTypes, parsedData) {
    const recs = [];
    const totalErrors = Object.values(errorTypeCount).reduce((a, b) => a + b, 0);

    // 1. 基于主要错误类型的建议
    const sortedErrors = Object.entries(errorTypeCount)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sortedErrors.length > 0) {
      const top = sortedErrors[0];
      const topPct = totalErrors > 0 ? (top[1] / totalErrors * 100) : 0;

      if (top[0] === '知识点盲区' && topPct > 40) {
        recs.push({
          priority: 'P0',
          action: `每天安排1小时系统学习${weakModuleDiagnosis[0]?.module || '薄弱模块'}的基础知识，按照考试大纲章节顺序通读教材，每学完一章做配套练习题巩固。`,
          reason: `"知识点盲区"占总失分的${topPct.toFixed(0)}%，是最主要的失分原因，必须从基础上补齐。`,
        });
      }
      if (top[0] === '概念混淆' && topPct > 30) {
        recs.push({
          priority: 'P1',
          action: `制作易混淆概念对比表（至少5组），例如"行政处罚vs行政处分""行政复议vs行政诉讼""通告vs公告vs通知"，每天复习1-2组，做到能准确区分。`,
          reason: `"概念混淆"占比${topPct.toFixed(0)}%，说明相似知识点的辨析能力不足，需要专项训练。`,
        });
      }
      if (top[0] === '记忆模糊' && topPct > 30) {
        recs.push({
          priority: 'P1',
          action: `采用"间隔复习法"：当天错题当晚复习→第3天再复习→第7天再复习→第15天再复习。将易忘的知识点制作成Anki/纸质记忆卡片，利用碎片时间反复记忆。`,
          reason: `"记忆模糊"占比${topPct.toFixed(0)}%，需要通过科学的间隔复习巩固记忆。`,
        });
      }
      if (top[0] === '审题失误' && topPct > 20) {
        recs.push({
          priority: 'P0',
          action: `每次做题前强制执行"三读法"：一读题干完整内容→二读圈画关键词（"错误的""属于""不属于""除外"等）→三读确认理解无误后再看选项。做完后回头检查是否有审题偏差。`,
          reason: `"审题失误"占比${topPct.toFixed(0)}%，这是可以快速改善的问题——只要改变答题习惯，就能立即提升${(topPct/2).toFixed(0)}%左右的正确率。`,
        });
      }
      if (top[0] === '计算错误' && topPct > 15) {
        recs.push({
          priority: 'P2',
          action: `每天做5道计算专项练习，重点训练经济模块和土木专业模块中的计算题型。养成"算完验算"的习惯，草稿保持工整便于检查。`,
          reason: `"计算错误"占比${topPct.toFixed(0)}%，通过专项训练和验算习惯可以快速减少。`,
        });
      }
    }

    // 2. 基于最弱模块的建议
    if (weakModuleDiagnosis.length > 0) {
      const weakest = weakModuleDiagnosis[0];
      const accuracy = weakest.accuracy;

      if (accuracy < 40) {
        recs.push({
          priority: 'P0',
          action: `【${weakest.module}冲刺计划】本周每天至少投入1.5小时专攻${weakest.module}：第1-2天通读该模块教材/讲义，第3-4天做专项练习题至少50道，第5天整理错题并分析规律，第6天针对错题对应知识点回炉重学，第7天再做一套该模块的模拟题检验效果。`,
          reason: `${weakest.module}正确率仅${accuracy.toFixed(1)}%，是所有模块中最薄弱的，需要集中突破。`,
        });
      } else if (accuracy < 60) {
        recs.push({
          priority: 'P1',
          action: `【${weakest.module}提升计划】每天安排40分钟专攻${weakest.module}：重点做该模块的真题和错题，每道错题写清楚错误原因和正确思路，周末集中回顾本周错题。`,
          reason: `${weakest.module}正确率${accuracy.toFixed(1)}%，有较大提升空间。`,
        });
      }
    }

    // 3. 基于湖南省考特色的建议
    if (parsedData.modules['湖南省情'] && parsedData.modules['湖南省情'].total > 0) {
      const hnAcc = parsedData.modules['湖南省情'].correct / parsedData.modules['湖南省情'].total * 100;
      if (hnAcc < 60) {
        recs.push({
          priority: 'P1',
          action: `关注"湖南省人民政府网"公众号，每天浏览15分钟湖南新闻；重点了解：湖南"三高四新"战略、长株潭一体化进展、湖南历史文化名人（如屈原、贾谊、周敦颐、王夫之、曾国藩、毛泽东、刘少奇等）、湖南地理特点（洞庭湖、湘资沅澧四水、张家界地貌等）。`,
          reason: `湖南省情模块正确率${hnAcc.toFixed(1)}%，作为湖南省考试的必考特色内容，必须重点掌握。`,
        });
      }
    }
    if (parsedData.modules['时政'] && parsedData.modules['时政'].total > 0) {
      const szAcc = parsedData.modules['时政'].correct / parsedData.modules['时政'].total * 100;
      if (szAcc < 60) {
        recs.push({
          priority: 'P1',
          action: `每天用"学习强国"APP学习20分钟，重点关注：党的二十大及历次全会精神、2025-2026年重大科技成就、湖南省政府工作报告要点、重大国际事件中的中国立场。每周整理一次本周时政要点清单。`,
          reason: `时政模块正确率${szAcc.toFixed(1)}%，时政是公基考试的重要板块且有固定分值，需要持续积累。`,
        });
      }
    }

    // 4. 基于整体正确率的总体建议
    const overallAcc = parsedData.totalCorrect + parsedData.totalWrong > 0
      ? parsedData.totalCorrect / (parsedData.totalCorrect + parsedData.totalWrong) * 100 : 0;

    if (overallAcc >= 85) {
      recs.push({
        priority: 'P3',
        action: `整体水平优秀，建议进入冲刺提分阶段：重点攻克难题和偏题，同时保持每周1-2套模拟卷的节奏以维持手感。重点关注湖南省情和时政的最新动态。`,
        reason: `整体正确率${overallAcc.toFixed(1)}%，已进入高分段，当前目标是巩固优势、查漏补缺。`,
      });
    } else if (overallAcc >= 70) {
      recs.push({
        priority: 'P2',
        action: `当前处于提分关键期：每周至少完成2套真题/模拟卷，每套做完后花至少1小时复盘分析。将错题按照"粗心失误"和"确实不会"分类处理——粗心的立即纠正答题习惯，不会的回归教材学习。`,
        reason: `整体正确率${overallAcc.toFixed(1)}%，通过系统训练有较大提升空间。`,
      });
    } else {
      recs.push({
        priority: 'P0',
        action: `建议采用"三轮复习法"：第一轮（2周）通读各模块教材建立知识框架→第二轮（2周）分模块刷题+整理错题→第三轮（1周）模拟考试+查漏补缺。每轮结束后自测检验效果，正确率提升到70%后再进入下一轮。`,
        reason: `整体正确率${overallAcc.toFixed(1)}%，基础较为薄弱，需要系统性的复习计划。`,
      });
    }

    // 去重并按优先级排序
    const seen = new Set();
    const unique = recs.filter(r => {
      const key = r.action.substring(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => {
      const order = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
      return order[a.priority] - order[b.priority];
    });

    return unique;
  },

  /**
   * 湖南省特色分析
   */
  _analyzeHunanFeatures(modules, errorDetails) {
    const result = {
      provincialStatus: '',
      currentAffairsStatus: '',
      keyRecommendations: [],
    };

    if (modules['湖南省情']) {
      const m = modules['湖南省情'];
      const acc = m.total > 0 ? (m.correct / m.total * 100) : 0;
      if (acc >= 80) {
        result.provincialStatus = '湖南省情掌握扎实，对湖南的省情省策有较好的了解。';
      } else if (acc >= 60) {
        result.provincialStatus = '湖南省情掌握一般，建议加强对湖南历史、地理、经济、文化等方面的系统学习。';
      } else if (m.total > 0) {
        result.provincialStatus = '湖南省情是薄弱环节，必须重点加强——省情题在湖南省事业单位考试中每年必考且分值固定，是"送分题"不应失分。';
      }
    } else {
      result.provincialStatus = '本次未涉及省情题目或未录入省情模块数据。';
    }

    if (modules['时政']) {
      const m = modules['时政'];
      const acc = m.total > 0 ? (m.correct / m.total * 100) : 0;
      if (acc >= 80) {
        result.currentAffairsStatus = '时政热点敏感度高，关注时事动态的习惯保持良好。';
      } else if (acc >= 60) {
        result.currentAffairsStatus = '时政敏感度一般，建议增加对国家和湖南时政热点的日常关注。';
      } else if (m.total > 0) {
        result.currentAffairsStatus = '时政敏感度不足，建议每日关注"学习强国""湖南日报"等渠道，积累时政知识。';
      }
    }

    // 生成湖南省特色备考建议
    result.keyRecommendations = [
      '重点关注湖南"三高四新"战略定位和使命任务，这是近年湖南公基考试高频考点。',
      '湖南地理常识：14个市州名称及分布、洞庭湖、湘江流域、武陵山脉等基础知识需熟练掌握。',
      '湖南历史文化：马王堆汉墓、岳麓书院、韶山、岳阳楼、凤凰古城等文化名片相关知识。',
      '2025-2026年湖南省政府工作报告要点、重大项目和民生政策需持续关注。',
      '长株潭都市圈发展规划、湖南自贸试验区建设进展等最新政策热点。',
    ];

    return result;
  },

  /**
   * 保存分析结果到历史
   */
  saveToHistory(parsedData, analysisResult) {
    const history = this.getHistory();
    const record = {
      id: 'ha_' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      examName: parsedData.examName || '未命名考试',
      examDate: parsedData.examDate || '',
      overallAccuracy: analysisResult.overallAccuracy,
      totalQuestions: analysisResult.totalQuestions,
      totalCorrect: analysisResult.totalCorrect,
      moduleStats: analysisResult.moduleStats.map(m => ({
        name: m.name, accuracy: m.accuracy, total: m.total, correct: m.correct,
      })),
      weakModules: analysisResult.weakModules.map(w => w.module),
    };
    history.push(record);
    // 只保留最近20条
    const trimmed = history.slice(-20);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    return record;
  },

  /**
   * 获取分析历史
   */
  getHistory() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * 删除某条历史记录
   */
  deleteHistory(id) {
    const history = this.getHistory().filter(h => h.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  },

  /**
   * 获取精度趋势数据（用于趋势图）
   */
  getTrendData() {
    const history = this.getHistory();
    return history.map(h => ({
      date: h.createdAt.split('T')[0],
      accuracy: h.overallAccuracy,
      label: h.examName,
    }));
  },
};
