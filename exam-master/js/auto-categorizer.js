/**
 * 智能分类引擎 - 关键词匹配 + 贝叶斯加权 + 自学习
 *
 * 分类流程:
 *   1. 提取题目全文特征词
 *   2. 与预定义分类词库匹配（加权计分）
 *   3. 与已有题库分类特征比对（自学习）
 *   4. 返回置信度最高的分类
 */

const AutoCategorizer = {
  // ─── 预定义分类词库（领域 → 关键词 → 权重） ───
  KNOWLEDGE_BASE: {
    '马克思主义哲学': {
      keywords: ['唯物论','唯心','辩证法','唯物辩证','矛盾','对立统一','量变','质变','否定之否定',
        '实践','认识','真理','检验真理','感性','理性','意识','物质','意识能动','主观能动',
        '规律','客观规律','本质','现象','必然','偶然','可能','现实','内容','形式',
        '生产力','生产关系','经济基础','上层建筑','社会存在','社会意识','人民群众','历史创造',
        '价值','使用价值','剩余价值','绝对剩余','相对剩余','资本','有机构成','平均利润',
        '哲学基本问题','思维与存在','物质与意识','同一性','斗争性','普遍性','特殊性',
        '主要矛盾','次要矛盾','矛盾主要方面','内因','外因','否定','扬弃','辩证否定'],
      weight: 1.0,
    },
    '毛泽东思想与党史': {
      keywords: ['毛泽东','毛泽东思想','新民主主义','新民主主义革命','社会主义改造','农村包围城市',
        '武装夺取政权','工农武装割据','枪杆子','八七会议','遵义会议','古田会议','瓦窑堡',
        '洛川会议','中共一大','中共二大','中共七大','七届二中全会','十一届三中全会',
        '三湾改编','秋收起义','南昌起义','百团大战','长征','红军','八路军','新四军',
        '整风运动','反对本本主义','实践论','矛盾论','论联合政府','星星之火',
        '持久战','游击战','土地革命','抗日战争','解放战争','三大战役','西柏坡',
        '实事求是','群众路线','独立自主','活的灵魂','思想建党','政治建军',
        '两个务必','进京赶考','延安精神','井冈山','红色政权','革命根据地',
        '共产党宣言','陈望道','李大钊','一大代表','历史决议'],
      weight: 1.0,
    },
    '中国特色社会主义': {
      keywords: ['中国特色社会主义','邓小平','邓小平理论','社会主义本质','社会主义初级阶段',
        '改革开放','解放思想','三个代表','科学发展观','习近平新时代中国特色社会主义思想',
        '新时代','中国梦','中华民族伟大复兴','共同富裕','全面小康','现代化强国',
        '中国式现代化','总体布局','战略布局','五位一体','四个全面','四个自信','四个意识',
        '两个维护','两个确立','以人民为中心','人民至上','党的领导','全面从严治党',
        '全面深化改革','全面依法治国','治理体系','治理能力','制度优势',
        '新发展理念','新发展格局','高质量发展','扩大内需','供给侧','双循环',
        '一国两制','和平统一','人类命运共同体','一带一路','乡村振兴','美丽中国'],
      weight: 1.0,
    },
    '经济学': {
      keywords: ['经济','市场','商品','货币','资本','价值规律','市场经济','计划经济',
        '宏观调控','财政政策','货币政策','税收','利率','汇率','通货膨胀','通货紧缩',
        'GDP','国内生产总值','CPI','失业率','基尼系数','恩格尔','公共财政','预算',
        '赤字','国债','央行','商业银行','金融','证券','股票','债券','基金',
        '保险','再分配','社会保障','按劳分配','生产要素','公有制','非公有制',
        '混合所有制','现代企业制度','公司治理','产业结构','供给侧改革'],
      weight: 1.0,
    },
    '法律基础': {
      keywords: ['宪法','法律','法规','立法','司法','执法','守法','违法','犯罪',
        '行政法','行政处罚','行政许可','行政强制','行政复议','行政诉讼','行政赔偿',
        '刑法','刑罚','有期徒刑','无期徒刑','死刑','故意','过失','正当防卫','紧急避险',
        '民法','民法典','合同','侵权','物权','债权','婚姻','继承','知识产权',
        '公务员法','事业单位','人事管理','聘用','考核','处分','回避','申诉',
        '诉讼法','证据','管辖','审判','检察','律师','法律援助',
        '公民权利','基本权利','人身自由','选举权','被选举权','言论自由'],
      weight: 1.0,
    },
    '公文写作': {
      keywords: ['公文','行文','发文','收文','拟办','批办','承办','催办',
        '通知','公告','通告','通报','报告','请示','批复','函','纪要','决定','意见',
        '上行文','下行文','平行文','越级行文','逐级行文','多级行文',
        '公文格式','版头','主体','版记','发文字号','标题','主送','抄送',
        '密级','保密','紧急程度','签发','签署','印章','成文日期',
        '命令','议案','决议','公报','条例','规定','办法','细则'],
      weight: 1.0,
    },
    '管理常识': {
      keywords: ['管理','行政','组织','决策','领导','控制','计划','协调','指挥',
        '公共管理','行政管理','政府职能','公共服务','非营利',
        '组织结构','层级','幅度','直线','职能','矩阵','事业部',
        '激励','期望理论','双因素','需求层次','公平理论','强化理论',
        '领导风格','民主','专制','放任','权变','情境','变革','交易型','魅力型',
        '沟通','冲突','谈判','团队','群体','角色','规范','凝聚力',
        '政府职能转变','放管服','营商环境','电子政务','数字政府'],
      weight: 1.0,
    },
    '文史科技': {
      keywords: ['古代','现代','近代','历史','朝代','唐朝','宋朝','明朝','清朝','秦','汉','三国',
        '文学','诗词','诗人','词','赋','曲','小说','散文','戏剧',
        '孔子','孟子','老子','庄子','韩非','墨子','百家争鸣','儒家','道家','法家',
        '文化','传统','节日','习俗','礼仪','中医','中药','针灸',
        '科学','技术','科技','发明','创新','航天','卫星','火箭','空间站',
        '计算机','互联网','大数据','人工智能','5G','芯片','新能源','生物技术',
        '地理','地形','气候','河流','山脉','湖泊','灾害','地震','台风','洪涝',
        '中国之最','世界之最','诺贝尔','四大发明','丝绸之路','郑和','长城'],
      weight: 0.9,
    },
    '时政热点': {
      keywords: ['二十大','二十届','十四五','2035','双碳','碳达峰','碳中和',
        '乡村振兴','农业农村','粮食安全','脱贫攻坚','共同富裕',
        '国家安全','总体国家安全观','生物安全','网络安全','数据安全',
        '疫情防控','公共卫生','应急管理','防灾减灾',
        '数字经济','平台经济','反垄断','专精特新','新质生产力',
        '一带一路','RCEP','自贸区','进博会','服贸会',
        '北京冬奥','杭州亚运','全运会','奥运会','世界杯',
        '载人航天','探月','探火','深海探测','量子','超算',
        '习近平','总书记','重要讲话','重要指示','考察','调研'],
      weight: 1.0,
    },
  },

  // ─── 公共API ───

  /**
   * 对题目列表自动分类
   * @returns {Array} 分类后的题目（已修改原数组的category字段）
   */
  classify(questions) {
    if (!questions || questions.length === 0) return questions;

    // 获取已有题库的分类特征（自学习）
    const existing = QuestionBank.getAll();
    const learnedBase = this._learnFromExisting(existing);

    for (const q of questions) {
      // 已有明确分类的不覆盖（除非是"未分类"）
      if (q.category && q.category !== '未分类') continue;

      const category = this._predict(q, learnedBase);
      if (category) {
        q.category = category;
      }
    }

    return questions;
  },

  /**
   * 对单道题目分类
   */
  classifyOne(question) {
    return this.classify([question])[0];
  },

  /**
   * 添加自定义分类规则
   */
  addRule(category, keywords, weight = 0.8) {
    if (!this.KNOWLEDGE_BASE[category]) {
      this.KNOWLEDGE_BASE[category] = { keywords: [], weight };
    }
    this.KNOWLEDGE_BASE[category].keywords.push(...keywords);
  },

  // ─── 核心预测逻辑 ───

  _predict(question, learnedBase) {
    const text = this._extractFullText(question);
    const tokens = this._tokenize(text);

    if (tokens.length === 0) return null;

    const scores = {};

    // 预定义词库匹配
    for (const [category, config] of Object.entries(this.KNOWLEDGE_BASE)) {
      scores[category] = this._scoreCategory(tokens, config.keywords, config.weight);
    }

    // 自学习词库匹配（使用已有题库的分类特征）
    for (const [category, keywords] of Object.entries(learnedBase)) {
      const learnedScore = this._scoreCategory(tokens, keywords, 0.7);
      scores[category] = Math.max(scores[category] || 0, learnedScore);
    }

    // 找最高分
    let bestCategory = null;
    let bestScore = 0;
    for (const [cat, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = cat;
      }
    }

    // 置信度阈值
    if (bestScore < 0.12) return '未分类';
    return bestCategory;
  },

  _scoreCategory(tokens, keywords, baseWeight) {
    let score = 0;
    const matched = new Set();

    for (const token of tokens) {
      for (const kw of keywords) {
        if (matched.has(kw)) continue;
        if (token.includes(kw) || kw.includes(token)) {
          // 匹配长度越长权重越高
          const matchQuality = Math.min(kw.length / token.length, token.length / kw.length);
          score += baseWeight * (0.5 + 0.5 * matchQuality);
          matched.add(kw);
        }
      }
    }

    // 归一化
    return score / Math.max(1, Math.sqrt(tokens.length));
  },

  _extractFullText(question) {
    const parts = [question.title || ''];
    if (question.options) {
      for (const opt of question.options) {
        parts.push(opt.text || '');
      }
    }
    if (question.analysis) parts.push(question.analysis);
    return parts.join(' ');
  },

  _tokenize(text) {
    // 中文按标点分词 + 英文按空格分词
    const cleaned = text.toLowerCase().replace(/[，。、；：""''！？（）《》【】\s,.!?;:'"()\[\]{}<>/\\-]+/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);
    // 中文单字也保留（对于短关键词）
    const chineseChars = text.replace(/[a-zA-Z0-9\s,.!?;:'"()\[\]{}<>/\\-]+/g, '');
    const unique = [...new Set(words.concat([...chineseChars]))];
    return unique;
  },

  /**
   * 自学习：从已有题库中提取分类特征词
   */
  _learnFromExisting(questions) {
    const byCategory = {};
    for (const q of questions) {
      const cat = q.category || '未分类';
      if (cat === '未分类') continue;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(this._extractFullText(q));
    }

    const learned = {};
    for (const [cat, texts] of Object.entries(byCategory)) {
      if (texts.length < 3) continue;
      // TF-IDF 选出该类别的特征词
      const allTokens = texts.flatMap(t => this._tokenize(t));
      const freq = {};
      for (const t of allTokens) {
        freq[t] = (freq[t] || 0) + 1;
      }
      // 取高频词（排除停用词）
      const stopWords = new Set(['下列','哪个','以下','正确','错误','关于','属于','描述','主要',
        '是否','不是','可以','进行','使用','什么','特点','包括','需要','其中','一个','一种']);
      const keywords = Object.entries(freq)
        .filter(([w, c]) => c >= 2 && w.length >= 2 && !stopWords.has(w))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(e => e[0]);
      learned[cat] = keywords;
    }

    return learned;
  },
};
