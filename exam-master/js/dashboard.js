/**
 * 仪表盘模块 — 统计、近期练习、分类图表、演示数据
 */
const Dashboard = {

  /** 更新仪表盘统计数据 */
  updateStats() {
    const stats = QuestionBank.getStats();
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-practiced').textContent = stats.practiced;

    const sm2Stats = ErrorNotebook.getSM2Stats();
    const reviewEl = document.getElementById('stat-errors');
    if (sm2Stats.total > 0) {
      reviewEl.textContent = `${sm2Stats.dueToday + sm2Stats.overdue}待复习/${sm2Stats.total}`;
      reviewEl.title = `SM-2间隔复习: ${sm2Stats.dueToday}题今日到期, ${sm2Stats.overdue}题已逾期, 平均间隔${sm2Stats.avgInterval}天`;
    } else {
      reviewEl.textContent = '0';
    }

    document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';
  },

  /** 更新 localStorage 用量 */
  updateStorageInfo() {
    const usage = Storage.getUsage();
    const el = document.getElementById('storage-usage');
    if (el) el.textContent = Storage.formatBytes(usage);
  },

  /** 渲染近期练习记录 */
  renderRecentPractice() {
    const container = document.getElementById('recent-practice');
    if (!container) return;
    const log = (Storage.get(Storage.KEYS.PRACTICE_LOG) || []).slice(-15).reverse();
    if (log.length === 0) { container.innerHTML = '<p class="empty-state">暂无练习记录</p>'; return; }

    const allQ = QuestionBank.getAll();
    const qMap = new Map(allQ.map(q => [q.id, q]));

    container.innerHTML = log.map(l => {
      const q = qMap.get(l.questionId);
      const title = q ? q.title.substring(0, 50) : '已删除的题目';
      const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="practice-log-item" style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
        <span style="color:${l.correct ? 'var(--success)' : 'var(--danger)'};font-weight:600;">${l.correct ? '✓' : '✗'}</span>
        <span style="margin-left:6px;">${Utils.escapeHtml(title)}</span>
        <span style="color:var(--text-secondary);float:right;">${time}</span>
      </div>`;
    }).join('');
  },

  /** 渲染分类分布图 */
  renderCategoryChart() {
    const container = document.getElementById('category-chart');
    if (!container) return;
    const allQ = QuestionBank.getAll();
    if (allQ.length === 0) { container.innerHTML = '<p class="empty-state">暂无数据</p>'; return; }

    const cats = {};
    allQ.forEach(q => { const c = q.category || '未分类'; cats[c] = (cats[c] || 0) + 1; });
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted[0]?.[1] || 1;

    container.innerHTML = sorted.map(([name, count]) => `
      <div class="chart-bar-row">
        <span class="chart-bar-label">${name}</span>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(count/max*100)}%">${count}</div></div>
      </div>`).join('');
  },

  /** 初始化演示数据 */
  initDemoData() {
    if (Storage.get(Storage.KEYS.QUESTIONS)) return;
    const demoQuestions = [
      { title:'以下哪个是HTTP状态码中"未找到"的含义？', type:'single', options:[{label:'A',text:'200'},{label:'B',text:'301'},{label:'C',text:'404'},{label:'D',text:'500'}], answer:'C', analysis:'404 Not Found 表示服务器无法找到请求的资源。', category:'计算机网络', difficulty:'简单' },
      { title:'TCP协议中，三次握手的目的是什么？', type:'single', options:[{label:'A',text:'传输数据'},{label:'B',text:'建立可靠连接'},{label:'C',text:'关闭连接'},{label:'D',text:'加密通信'}], answer:'B', analysis:'TCP三次握手的目的是在通信双方之间建立可靠的连接，同步序列号。', category:'计算机网络', difficulty:'中等' },
      { title:'下列哪些属于NoSQL数据库？', type:'multiple', options:[{label:'A',text:'MongoDB'},{label:'B',text:'MySQL'},{label:'C',text:'Redis'},{label:'D',text:'Cassandra'}], answer:'ACD', analysis:'MongoDB是文档型NoSQL，Redis是键值存储NoSQL，MySQL是关系型数据库。', category:'数据库', difficulty:'中等' },
      { title:'JavaScript中，===运算符会进行类型转换后再比较。', type:'judge', options:[{label:'A',text:'正确'},{label:'B',text:'错误'}], answer:'B', analysis:'===是严格相等运算符，不会进行类型转换。', category:'前端开发', difficulty:'简单' },
      { title:'CSS中，以下哪个属性用于设置元素的外边距？', type:'single', options:[{label:'A',text:'padding'},{label:'B',text:'margin'},{label:'C',text:'border'},{label:'D',text:'outline'}], answer:'B', analysis:'margin设置元素的外边距。', category:'前端开发', difficulty:'简单' },
      { title:'算法的空间复杂度是指算法执行所需的____空间。', type:'fill', options:[], answer:'存储（内存）', analysis:'空间复杂度衡量算法运行过程中临时占用的存储空间大小。', category:'数据结构与算法', difficulty:'中等' },
      { title:'下列关于RESTful API设计的描述，正确的有哪些？', type:'multiple', options:[{label:'A',text:'使用HTTP动词表示操作类型'},{label:'B',text:'所有请求都应该使用POST方法'},{label:'C',text:'URL应该使用名词而非动词'},{label:'D',text:'状态信息应保存在服务端Session中'}], answer:'AC', analysis:'RESTful核心原则：HTTP动词表示操作，URL用名词表示资源。', category:'后端开发', difficulty:'中等' },
      { title:'什么是闭包（Closure）？请简要说明其原理和应用场景。', type:'essay', options:[], answer:'闭包是指函数能够访问其外部作用域中的变量，即使外部函数已经返回。', analysis:'内部函数保留对外部函数变量对象的引用。常见应用：私有变量、工厂函数、事件处理器。', category:'前端开发', difficulty:'困难' },
      { title:'Git中，git merge和git rebase的主要区别是什么？', type:'single', options:[{label:'A',text:'merge会保留分支历史，rebase会创建线性历史'},{label:'B',text:'merge更快，rebase更慢'},{label:'C',text:'merge只能用于本地分支'},{label:'D',text:'rebase会丢失所有提交'}], answer:'A', analysis:'merge创建合并提交保留分支历史，rebase创建线性历史。', category:'DevOps', difficulty:'中等' },
      { title:'Docker容器的数据在容器删除后仍然保留。', type:'judge', options:[{label:'A',text:'正确'},{label:'B',text:'错误'}], answer:'B', analysis:'默认情况下容器删除后数据会丢失，需用Volume持久化。', category:'DevOps', difficulty:'简单' },
      { title:'React中，以下哪个Hook用于在函数组件中管理状态？', type:'single', options:[{label:'A',text:'useEffect'},{label:'B',text:'useContext'},{label:'C',text:'useState'},{label:'D',text:'useRef'}], answer:'C', analysis:'useState是React最基本的状态管理Hook。', category:'前端开发', difficulty:'简单' },
      { title:'下列排序算法中，平均时间复杂度为O(n log n)的有哪些？', type:'multiple', options:[{label:'A',text:'快速排序'},{label:'B',text:'冒泡排序'},{label:'C',text:'归并排序'},{label:'D',text:'堆排序'}], answer:'ACD', analysis:'快速排序平均O(n log n)，归并/堆排序始终O(n log n)，冒泡O(n²)。', category:'数据结构与算法', difficulty:'中等' },
      { title:'HTTPS相比HTTP增加了____层来保证通信安全。', type:'fill', options:[], answer:'SSL/TLS', analysis:'HTTPS = HTTP + SSL/TLS。', category:'计算机网络', difficulty:'简单' },
      { title:'在SQL中，以下哪些操作会使用索引？', type:'multiple', options:[{label:'A',text:'WHERE子句中的条件列'},{label:'B',text:'ORDER BY排序列'},{label:'C',text:'SELECT后的列名'},{label:'D',text:'JOIN的连接列'}], answer:'ABD', analysis:'索引用于加速WHERE、ORDER BY和JOIN，SELECT列名不直接使用索引。', category:'数据库', difficulty:'中等' },
      { title:'在Python中，列表和元组的主要区别是什么？', type:'single', options:[{label:'A',text:'列表有序，元组无序'},{label:'B',text:'列表可变，元组不可变'},{label:'C',text:'列表可以包含不同类型，元组不可以'},{label:'D',text:'没有区别'}], answer:'B', analysis:'列表可变（可增删改），元组不可变。', category:'Python', difficulty:'简单' },
    ];
    demoQuestions.forEach(q => { q.bank = q.bank || 'gongji'; });
    QuestionBank.batchImport(demoQuestions);
    const questions = QuestionBank.getAll();
    AutoCategorizer.classify(questions);
    Storage.set(Storage.KEYS.QUESTIONS, questions);
    QuestionBank.updateCategories(questions);
  },
};
