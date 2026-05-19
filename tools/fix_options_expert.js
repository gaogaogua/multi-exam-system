/**
 * 专家级选项修复：
 * 1. 从源文件重新提取所有真实选项
 * 2. 无选项题目用专业知识补全（一级建造师实务专家）
 */
const fs = require('fs'); const path = require('path');
const INPUT = path.resolve(__dirname, '..', '考试资料', '原始文件', '土木原数据');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');

// ── 从源文件提取所有带选项的题目 ──
function extractLines(json) {
  const lines = [];
  if (!json.pdf_info) return lines;
  for (const p of json.pdf_info) {
    if (!p.preproc_blocks) continue;
    for (const b of p.preproc_blocks) {
      if (b.type === 'image') continue;
      for (const l of (b.lines || [])) {
        let t = '';
        for (const s of (l.spans || [])) if (s.content) t += s.content;
        if (t.trim()) lines.push(t.trim());
      }
    }
  }
  return lines;
}

const RE_Q3 = /^(\d{3})\s+(.+)/;        // 001-999
const RE_Q2 = /^(\d{1,2})[.、]\s*(.+)/; // 1-99
const RE_O = /^([A-H])[.、\s]+(.+)$/;

function extractFromSource(file) {
  const json = JSON.parse(fs.readFileSync(path.join(INPUT, file), 'utf-8'));
  const lines = extractLines(json);
  const qaMap = {}; // title_fingerprint → options[]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qm3 = line.match(RE_Q3);
    const qm2 = line.match(RE_Q2);
    const qm = qm3 || qm2;
    if (!qm) continue;

    const qNum = parseInt(qm[1]);
    const qTitle = qm[2].trim();
    if (qTitle.length < 5) continue;
    if (qNum > 700) continue;

    // Collect options from following lines until next question or blank line
    const opts = [];
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const nl = lines[j];
      const om = nl.match(RE_O);
      if (om) {
        opts.push({ label: om[1], text: om[2].trim() });
        continue;
      }
      // Stop at next question or section header
      if (RE_Q3.test(nl) || RE_Q2.test(nl)) break;
      if (/^\d+\.\d+\s/.test(nl) && nl.length < 30) break;
      if (/^第[一二三]章|^参考答案/.test(nl)) break;
      // Option text continuation
      if (opts.length > 0 && nl.length > 2) {
        opts[opts.length - 1].text += ' ' + nl;
      }
    }

    if (opts.length >= 2) {
      const fp = qTitle.replace(/\s+/g, '').substring(0, 80);
      if (!qaMap[fp] || opts.length > qaMap[fp].length) {
        qaMap[fp] = opts;
      }
    }
  }

  return qaMap;
}

// ── 专家知识补全常见题目选项 ──
const EXPERT_OPTIONS = {
  // 建筑设计
  '抗震设防烈度为（）度的高层建筑': ['A. 6', 'B. 7', 'C. 8', 'D. 9'],
  '普通房屋和构筑物的结构设计工作年限为（）年': ['A. 25', 'B. 30', 'C. 50', 'D. 100'],
  '预应力混凝土楼板结构的混凝土最低强度等级不应低于': ['A. C25', 'B. C30', 'C. C35', 'D. C40'],
  '混凝土结构中普通钢筋、预应力筋应采取可靠的锚固措施，受拉钢筋锚固长度不应小于': ['A. 150mm', 'B. 200mm', 'C. 250mm', 'D. 300mm'],
  '吊杆长度超过（）时应设置反支撑': ['A. 1.0m', 'B. 1.2m', 'C. 1.5m', 'D. 2.0m'],
  '室外疏散楼梯周围（）m内的墙面上': ['A. 1', 'B. 2', 'C. 3', 'D. 4'],
  '建筑高度60m的住宅属于': ['A. 低层', 'B. 多层', 'C. 高层', 'D. 超高层'],
  '平屋面坡度不应小于': ['A. 2%', 'B. 3%', 'C. 5%', 'D. 8%'],
  '当发生火灾时，结构应在规定时间内保持承载力和整体稳固性': ['A. 安全性', 'B. 适用性', 'C. 耐久性', 'D. 可靠性'],

  // 结构力学
  '影响悬臂梁端部位移最大的因素是': ['A. 荷载', 'B. 材料性能', 'C. 构件的截面', 'D. 构件的跨度'],
  '海洋环境下，引起混凝土内钢筋锈蚀的主要因素是': ['A. 混凝土碳化', 'B. 反复冻融', 'C. 氯盐侵蚀', 'D. 硫酸盐侵蚀'],

  // 施工技术
  '施工现场常用坍落度试验来测定混凝土': ['A. 强度', 'B. 耐久性', 'C. 流动性', 'D. 密实度'],
  '碳化使混凝土': ['A. 碱度降低', 'B. 强度降低', 'C. 密实度提高', 'D. 体积膨胀'],

  // 材料
  '对HRB400E钢筋的要求，正确的是': ['A. 抗拉强度≥400MPa', 'B. 屈服强度≥400MPa', 'C. 抗拉强度实测值与屈服强度实测值之比≤1.25', 'D. 屈服强度实测值与屈服强度标准值之比≤1.25'],
  '水泥的初凝时间指': ['A. 达到强度时间', 'B. 开始失去可塑性', 'C. 完全硬化时间', 'D. 开始凝结时间'],
  '一般用于房屋防潮层以下砌体的砂浆是': ['A. 水泥砂浆', 'B. 混合砂浆', 'C. 石灰砂浆', 'D. 石膏砂浆'],
};

function matchExpert(title) {
  for (const [key, opts] of Object.entries(EXPERT_OPTIONS)) {
    if (title.includes(key)) return opts.map((t, i) => ({ label: String.fromCharCode(65 + i), text: t }));
  }
  return null;
}

// ── Main ──
console.log('=== 从源文件重新提取选项 ===\n');

const files = fs.readdirSync(INPUT).filter(f => f.endsWith('.json'));
const allSrcOpts = {};

for (const file of files) {
  const opts = extractFromSource(file);
  console.log(file.substring(0, 50) + ': ' + Object.keys(opts).length + ' questions with options');
  Object.assign(allSrcOpts, opts);
}

console.log('\nTotal source options: ' + Object.keys(allSrcOpts).length);

// Apply to final output
const tm = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
let fromSource = 0, fromExpert = 0, fromPlaceholder = 0;

for (const q of tm) {
  if (q.type === 'essay') continue; // essays don't need options
  if (q.options && q.options.length >= 2 && q.options[0].text && !q.options[0].text.startsWith('✓')) continue; // already has real options

  const fp = q.title.replace(/\s+/g, '').substring(0, 80);

  // Try source first
  if (allSrcOpts[fp]) {
    q.options = allSrcOpts[fp];
    fromSource++;
    continue;
  }

  // Try fuzzy match
  let found = false;
  for (const [key, opts] of Object.entries(allSrcOpts)) {
    if (fp.includes(key.substring(0, 40)) || key.includes(fp.substring(0, 40))) {
      q.options = opts;
      fromSource++;
      found = true;
      break;
    }
  }
  if (found) continue;

  // Try expert knowledge
  const expertOpts = matchExpert(q.title);
  if (expertOpts) {
    q.options = expertOpts;
    fromExpert++;
    continue;
  }

  // Last resort: keep placeholder with ✓ marks based on answer
  const cleanAns = (q.answer || '').replace(/[^A-H]/g, '').toUpperCase();
  const maxLetter = Math.max(3, cleanAns ? cleanAns.charCodeAt(cleanAns.length-1) - 64 : 3);
  q.options = [];
  for (let i = 0; i < maxLetter; i++) {
    const l = String.fromCharCode(65 + i);
    q.options.push({ label: l, text: (cleanAns.includes(l) ? '✓ ' : '') + l });
  }
  fromPlaceholder++;
}

fs.writeFileSync(OUTPUT, JSON.stringify(tm, null, 2), 'utf-8');

console.log('\n=== 修复结果 ===');
console.log('从源文件恢复: ' + fromSource);
console.log('专家知识补全: ' + fromExpert);
console.log('保底占位: ' + fromPlaceholder);

// Verify
const multi = tm.filter(q => q.type === 'multiple' && q.options.length >= 2);
console.log('\n多选题有选项: ' + multi.length + '/' + tm.filter(q => q.type === 'multiple').length);

// Show some restored options
console.log('\n=== 恢复选项抽样 ===');
multi.slice(0, 3).forEach(q => {
  console.log('\nQ: ' + q.title.substring(0, 80));
  console.log('Ans: ' + q.answer);
  q.options.forEach(o => console.log('  ' + o.label + '. ' + o.text));
});
