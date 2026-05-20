/**
 * 全局配置 — 消除魔法字符串和硬编码值
 */
const CONFIG = {

  // ─── 题库 ───
  BANKS: {
    gongji: { label: '公基', color: '#722ed1' },
    tumu:   { label: '土木', color: '#13c2c2' },
  },

  // ─── 题型 ───
  QUESTION_TYPES: {
    single:   { name: '单选题', icon: '①' },
    multiple: { name: '多选题', icon: '②' },
    judge:    { name: '判断题', icon: '③' },
    fill:     { name: '填空题', icon: '④' },
    essay:    { name: '问答题', icon: '⑤' },
  },

  /** 获取题型名称 */
  getTypeName(type) { return (this.QUESTION_TYPES[type] || {}).name || type; },

  // ─── 优先级 ───
  PRIORITY: { CRITICAL: '!1', NORMAL: '!2', LOW: '!3' },
  PRIORITY_ORDER: { '!1': 0, '!2': 1, '!3': 2 },
  MIN_P1_RATIO: 0.6, // !1 任务占比不低于 60%

  // ─── API ───
  DEEPSEEK_URL: 'https://api.deepseek.com/v1/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',
  DEFAULT_TIMEOUT: 120000,   // 2min
  AI_TIMEOUT: 300000,        // 5min
  HEALTH_CHECK_TIMEOUT: 3000, // 3s

  // ─── SM-2 间隔复习 ───
  SM2_DEFAULTS: { interval: 1, repetition: 0, efactor: 2.5, nextReviewAt: null },
  SM2_MIN_EFACTOR: 1.3,
  SM2_MASTERY_THRESHOLD: 3, // 连续答对 N 次自动标记掌握

  // ─── 时间槽 ───
  TIME_SLOTS: [
    { time: '7:30-8:00',  type: 'warmup', label: '晨间唤醒',       taskType: 'recall' },
    { time: '8:00-9:00',  type: 'memory',  label: '黄金记忆①',     taskType: 'memory' },
    { time: '9:15-10:15', type: 'logic',   label: '逻辑高峰①',     taskType: 'logic' },
    { time: '10:30-11:30',type: 'normal',  label: '普通学习①',     taskType: 'normal' },
    { time: '14:00-15:00',type: 'normal',  label: '普通学习②',     taskType: 'normal' },
    { time: '15:15-16:15',type: 'logic',   label: '逻辑高峰②',     taskType: 'logic' },
    { time: '16:30-17:30',type: 'normal',  label: '普通学习③',     taskType: 'output' },
    { time: '19:00-20:00',type: 'memory',  label: '黄金记忆②',     taskType: 'memory' },
    { time: '20:15-21:15',type: 'normal',  label: '普通学习④',     taskType: 'normal' },
    { time: '21:30-22:30',type: 'review',  label: '复盘总结',       taskType: 'review' },
  ],

  REST_SLOTS: [
    '8:00前 起床洗漱早餐', '9:00-9:15 休息', '10:15-10:30 休息', '11:30-14:00 午餐午休',
    '15:00-15:15 休息', '16:15-16:30 休息', '17:30-19:00 晚餐休息', '20:00-20:15 休息',
    '21:15-21:30 休息', '22:30 就寝',
  ],

  // ─── 土木章节顺序 ───
  TUMU_CHAPTERS: [
    '建筑设计技术',
    '主要建筑工程材料的性能与应用',
    '建筑工程施工技术',
    '相关法规',
    '相关标准',
    '建筑工程企业资质与施工组织',
    '工程招标投标与合同管理',
    '施工进度管理',
    '施工质量管理',
    '施工成本管理',
    '施工安全管理',
    '绿色建造及施工现场环境管理',
    '施工资源管理',
  ],

  // ─── 标签 ───
  TAGS: ['#一建', '#公基', '#国考', '#土木专业', '#写作', '#时政', '#错题复盘', '#模考'],

  // ─── 默认比例 ───
  DEFAULT_GONGJI_RATIO: 30,
  DEFAULT_TUMU_RATIO: 70,

  // ─── 分页 ───
  DEFAULT_PAGE_SIZE: 15,

  // ─── 同步 ───
  SYNC_MAX_AI_QUESTIONS: 100,

  // ─── 演示数据 ───
  DEMO_BANK: 'gongji',
};
