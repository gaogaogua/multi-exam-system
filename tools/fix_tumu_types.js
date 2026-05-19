/**
 * 修复土木题目类型判定
 *
 * 三类来源：
 *   口诀简答500问 → 全部是 essay (简答题)
 *   母题课/选择题/300题/破题 → 单/多选题，按答案字母数判
 *   母题拆解总讲义 → 混合，按答案内容判
 *
 * 判定逻辑：
 *   答案仅含A-H字母 → 1字母=single, 多字母=multiple
 *   答案含中文/长文本/数字 → essay (或 fill)
 *   有选项+答案 → 类型不动，只修正无选项的情况
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const tumu = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

let fixed = 0;
const changes = [];

tumu.forEach((q, i) => {
  const oldType = q.type;
  const src = q._sourceFile || '';
  const answer = (q.answer || '').trim();
  const hasOptions = q.options && q.options.length >= 2;

  // If already has options and classified, keep it
  if (hasOptions) return;

  let newType = oldType;

  // ── 判句简答500问 → essay ──
  if (src.includes('口诀简答500问')) {
    newType = 'essay';
    if (oldType !== newType) {
      changes.push({ idx: i, old: oldType, new: newType, reason: '口诀简答', title: q.title.slice(0, 40) });
      q.type = newType;
      fixed++;
    }
    return;
  }

  // ── 判句来源为 judge 的保持 ──
  if (oldType === 'judge') return;

  // ── 通用判句 ──
  const cleanAns = answer.replace(/[^A-Ha-h]/g, '').toUpperCase();

  if (cleanAns.length === 0) {
    // 答案不含A-H字母 → 看内容长度
    if (answer.length > 5 && /[一-龥]/.test(answer)) {
      newType = 'essay';
    } else if (answer.length === 0) {
      // 无答案 → 如果是"简答/简述/问题"开头，判essay
      if (/简[答述]|试述|列举|写出|问题/.test(q.title)) {
        newType = 'essay';
      }
      // 否则保持原类型，给个空填空
      else newType = 'fill';
    } else {
      newType = 'fill';
    }
  } else if (cleanAns.length === 1) {
    newType = 'single';
  } else {
    newType = 'multiple';
  }

  // Judge check: if options look like 正确/错误
  if (hasOptions && q.options.length === 2) {
    const texts = q.options.map(o => (o.text || '').replace(/\s/g, ''));
    if ((texts[0].includes('正确') && texts[1].includes('错误')) ||
        (texts[0].includes('对') && texts[1].includes('错'))) {
      newType = 'judge';
    }
  }

  if (oldType !== newType) {
    changes.push({ idx: i, old: oldType, new: newType, reason: 'answer-based', title: q.title.slice(0, 40) });
    q.type = newType;
    fixed++;
  }
});

// Write
fs.writeFileSync(INPUT, JSON.stringify(tumu, null, 2), 'utf-8');

const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
const dist = {};
tumu.forEach(q => { dist[q.type] = (dist[q.type]||0)+1; });

console.log('Fixed: ' + fixed + ' questions');
console.log('\n新类型分布:');
Object.entries(dist).sort((a,b)=>b[1]-a[1]).forEach(([t,n]) => {
  console.log('  ' + (typeNames[t]||t) + ': ' + n);
});

// Show first few changes
console.log('\n变更抽样:');
changes.slice(0, 10).forEach(c => {
  console.log(`  [${c.old}→${c.new}] ${c.reason}: ${c.title}`);
});
if (changes.length > 10) console.log(`  ... and ${changes.length - 10} more`);
