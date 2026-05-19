/**
 * 土木题库最终解析器 — 彻底修复所有已知问题
 *
 * 修复:
 *   1. 易错300题答案zone skip (之前只skip一行)
 *   2. 口诀500问多行答案+子问题
 *   3. RS破题合集真正的参考答案section
 *   4. 母题拆解【解析】嵌入title
 */

const fs = require('fs');
const path = require('path');
const INPUT = path.resolve(__dirname, '..', '考试资料', '原始文件', '土木原数据');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');

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

function buildQ(title, options, answer, srcFile) {
  title = title.replace(/\s+/g, ' ').trim();
  if (title.length < 5) return null;
  if (/^[A-H][.、\s]/.test(title)) return null;
  if (/^(第[一二三四五六七八九十\d]+[章节篇]|\d+\.\d+\s)/.test(title) && title.length < 40) return null;

  answer = (answer || '').trim();
  options = (options || []).filter(o => o.text && o.text.length >= 1);
  const seen = new Set();
  options = options.filter(o => { if (seen.has(o.label)) return false; seen.add(o.label); return true; });

  let type = 'single';
  const clean = answer.replace(/[^A-H]/g, '').toUpperCase();
  const hasZH = /[一-龥]/.test(answer);

  if (clean.length >= 2 && !hasZH) type = 'multiple';
  else if (clean.length === 1 && !hasZH) type = 'single';
  else if (hasZH && answer.length > 8) type = 'essay';
  else if (hasZH && answer.length <= 8) type = 'fill';
  else if (options.length >= 2 && clean.length === 0) type = 'single';
  else if (!options.length && !answer) {
    if (/简[答述]|试述|列举|写出|简述|叙述/.test(title)) type = 'essay';
    else if (/问题/.test(title)) type = 'essay';
    else type = 'fill';
  }

  if (options.length === 2) {
    const a = (options[0].text||'').replace(/\s/g,''), b = (options[1].text||'').replace(/\s/g,'');
    if ((a.includes('正确')||a.includes('对')) && (b.includes('错误')||b.includes('错'))) type = 'judge';
  }
  if (/^(正确|错误|对|错)$/.test(answer) && /正确|错误/.test(title)) type = 'judge';

  return { title, type, options, answer, analysis: '', category: '未分类', difficulty: '中等', source: 'tumu_import', _sourceFile: srcFile };
}

// ══════════════════════════════════════
// PARSER 1: Standard inline answers (母题课, 选择题讲义)
// ══════════════════════════════════════
function parseStandard(lines, src) {
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_A = /^(?:\d{1,3}[.、]\s*)?【答案】\s*(.+)$/;
  const RE_O = /^([A-H])[.、\s]+(.+)$/;

  const qs = [];
  let cur = null;
  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    const q = buildQ(cur.title, cur.options, cur.answer, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (const line of lines) {
    const qm = line.match(RE_Q);
    if (qm) { push(); cur = { title: qm[2].trim(), options: [], answer: '' }; continue; }
    if (!cur) continue;
    const am = line.match(RE_A);
    if (am) { cur.answer = am[1].trim(); push(); continue; }
    const om = line.match(RE_O);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }
    if (/^知识点/.test(line)) continue;
    if (cur.options.length === 0) cur.title += ' ' + line;
    else cur.options[cur.options.length-1].text += ' ' + line;
  }
  push();
  return qs;
}

// ══════════════════════════════════════
// PARSER 2: Answer-section format (易错300题)
// ══════════════════════════════════════
function parseWithAnswerSections(lines, src) {
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_A = /^(?:\d{1,3}[.、]\s*)?【答案】\s*(.+)$/;
  const RE_O = /^([A-H])[.、\s]+(.+)$/;

  // Pass 1: collect all answers from answer zones
  const answers = [];
  let inZone = false;
  for (const line of lines) {
    if (/答案及解析/.test(line)) { inZone = true; continue; }
    if (!inZone) continue;
    if (/^第\s*\d+\s*章/.test(line)) { inZone = false; continue; }
    const am = line.match(RE_A);
    if (am) answers.push(am[1].trim());
  }

  // Pass 2: parse questions, skipping answer zones
  const qs = [];
  let cur = null;
  let ansIdx = 0;
  let skipZone = false;

  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    if (!cur.answer && ansIdx < answers.length) cur.answer = answers[ansIdx++];
    const q = buildQ(cur.title, cur.options, cur.answer, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (const line of lines) {
    // Zone control
    if (/答案及解析/.test(line)) { skipZone = true; continue; }
    if (skipZone) {
      if (/^第\s*\d+\s*章/.test(line)) skipZone = false; // exit zone, process this line
      else continue; // still in zone, skip
    }
    // Headers
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;
    if (/^(第[一二三四五六七八九十\d]+[章节]|\d+\.\d+\s)/.test(line) && line.length < 40) continue;

    const qm = line.match(RE_Q);
    if (qm) { push(); cur = { title: qm[2].trim(), options: [], answer: '' }; continue; }
    if (!cur) continue;
    const am = line.match(RE_A);
    if (am && !skipZone) { cur.answer = am[1].trim(); push(); continue; }
    const om = line.match(RE_O);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }
    if (/^知识点/.test(line)) continue;
    if (cur.options.length === 0) cur.title += ' ' + line;
    else cur.options[cur.options.length-1].text += ' ' + line;
  }
  push();

  // Post-match remaining answers
  let qi = 0;
  for (const q of qs) {
    if (!q.answer && qi < answers.length) {
      q.answer = answers[qi];
      const c = q.answer.replace(/[^A-H]/g,'').toUpperCase();
      if (c.length === 1) q.type = 'single';
      else if (c.length >= 2) q.type = 'multiple';
    }
    qi++;
  }
  return qs;
}

// ══════════════════════════════════════
// PARSER 3: RS破题提分合集 (001-607 numbered + answers at end)
// ══════════════════════════════════════
function parseRS(lines, src) {
  const RE_Q = /^(\d{3})\s+(.+)/;
  const RE_O = /^([A-H])[.、\s]+(.+)$/;

  // Build answer map from 参考答案 sections (skip 1st - it's in ToC)
  const ansMap = {};
  let refSeen = 0, inRef = false;
  for (const line of lines) {
    if (/^参考答案/.test(line)) { refSeen++; inRef = refSeen >= 2; continue; }
    if (!inRef) continue;
    const m = line.match(/^(\d{3})\s+([A-H]+)$/);
    if (m) ansMap[parseInt(m[1])] = m[2];
  }

  // Parse questions (stop before real answer section)
  let stopAt = lines.length;
  refSeen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^参考答案/.test(lines[i])) { refSeen++; if (refSeen >= 2) { stopAt = i; break; } }
  }

  const qs = [];
  let cur = null;
  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    const ans = cur.qNum && ansMap[cur.qNum] ? ansMap[cur.qNum] : '';
    const q = buildQ(cur.title, cur.options, cur.answer || ans, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (let i = 0; i < stopAt; i++) {
    const line = lines[i];
    if (/^\d+\.\d+\s/.test(line) && line.length < 40) continue;
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;
    const qm = line.match(RE_Q);
    if (qm) {
      push();
      cur = { title: qm[2].trim(), options: [], answer: '', qNum: parseInt(qm[1]) };
      continue;
    }
    if (!cur) continue;
    const om = line.match(RE_O);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }
    if (cur.options.length === 0) cur.title += ' ' + line;
  }
  push();
  return qs;
}

// ══════════════════════════════════════
// PARSER 4: 口诀简答500问 (Q&A pairs)
// ══════════════════════════════════════
function parseEssay(lines, src) {
  const RE_Q = /^(\d{1,3})[.、]\s*问题[：:]\s*(.+)/;
  const RE_A = /^(?:【答案】[：:]?|答案[：:])\s*(.+)/;
  const RE_SUB = /^(\d{1,2})[)）.、]\s*(.+)/; // sub-questions

  const qs = [];
  let cur = null;

  for (const line of lines) {
    const qm = line.match(RE_Q);
    if (qm) {
      if (cur && cur.title) {
        const q = buildQ(cur.title, [], cur.answer, src);
        if (q) { q.type = 'essay'; qs.push(q); }
      }
      cur = { title: qm[2].trim(), answer: '' };
      continue;
    }
    if (!cur) continue;
    const am = line.match(RE_A);
    if (am) {
      // Accumulate answer (some answers span multiple 答案: lines for sub-parts)
      if (cur.answer) cur.answer += '\n' + am[1].trim();
      else cur.answer = am[1].trim();
      // Don't push yet — may have more sub-answers
      continue;
    }
    // If we have an answer and encounter another question number or 口诀, push
    if (cur.answer) {
      if (/^\d+[.、]\s*问题/.test(line)) continue; // handled above
      if (/队长口诀/.test(line)) {
        const q = buildQ(cur.title, [], cur.answer, src);
        if (q) { q.type = 'essay'; qs.push(q); }
        cur = null;
        continue;
      }
      // Multi-line answer continuation
      if (!/^\d/.test(line) && !/^第/.test(line)) {
        cur.answer += ' ' + line;
      }
    }
  }
  // Last question
  if (cur && cur.title) {
    const q = buildQ(cur.title, [], cur.answer, src);
    if (q) { q.type = 'essay'; qs.push(q); }
  }
  return qs;
}

// ══════════════════════════════════════
// PARSER 5: 组合_1 mixed format (练习 markers)
// ══════════════════════════════════════
function parseMixture(lines, src) {
  const RE_P = /^【练习[.·]\s*(单选|多选)】\s*(.+)/;
  const RE_O = /^([A-H])[.、]\s*(.+)$/;
  const qs = [];

  for (let i = 0; i < lines.length; i++) {
    const pm = lines[i].match(RE_P);
    if (!pm) continue;
    let type = pm[1].includes('多选') ? 'multiple' : 'single';
    let title = pm[2].trim();
    let opts = [], ans = '';
    for (let j = i+1; j < Math.min(i+15, lines.length); j++) {
      const nl = lines[j];
      if (/【练习|【考点|【课程/.test(nl)) break;
      const om = nl.match(RE_O);
      if (om) { opts.push({ label: om[1], text: om[2].trim() }); continue; }
      const am = nl.match(/【答案】\s*(.+)/);
      if (am) { ans = am[1].trim(); break; }
    }
    const q = buildQ(title, opts, ans, src);
    if (q) { if (type === 'multiple') q.type = 'multiple'; qs.push(q); }
  }
  return qs;
}

// ══════════════════════════════════════
// MAIN
// ══════════════════════════════════════

function smartDedup(qs) {
  const unique = [];
  const fps = new Map();
  for (const q of qs) {
    const fp = q.title.replace(/\s+/g, '').substring(0, 100);
    if (fps.has(fp)) {
      const ex = unique[fps.get(fp)];
      if (q.options.length > ex.options.length) ex.options = q.options;
      if (q.answer && !ex.answer) ex.answer = q.answer;
      continue;
    }
    fps.set(fp, unique.length);
    unique.push(q);
  }
  return unique;
}

console.log('═══════════════════════════════════════');
console.log('  土木题库最终解析');
console.log('═══════════════════════════════════════\n');

const files = fs.readdirSync(INPUT).filter(f => f.endsWith('.json'));
const all = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(INPUT, file), 'utf-8');
  const json = JSON.parse(raw);
  const lines = extractLines(json);
  let qs = [];

  if (file.includes('口诀简答500问')) {
    qs = parseEssay(lines, file);
  } else if (file.includes('RS破题提分合集')) {
    qs = parseRS(lines, file);
  } else if (file.includes('易错易考300题')) {
    qs = parseWithAnswerSections(lines, file);
  } else if (file.includes('组合_1')) {
    qs = [...parseMixture(lines, file), ...parseStandard(lines, file)];
  } else {
    qs = parseStandard(lines, file);
  }

  console.log(`${file.substring(0,55)}: ${qs.length} 题`);
  all.push(...qs);
}

console.log(`\n合并: ${all.length} → `);
const uniq = smartDedup(all);
console.log(`去重: ${uniq.length} (移除 ${all.length - uniq.length})`);

const withAns = uniq.filter(q => q.answer);
console.log(`\n有答案: ${withAns.length}/${uniq.length} (${(withAns.length/uniq.length*100).toFixed(1)}%)`);

const tDist = {};
const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
uniq.forEach(q => { q.category = typeNames[q.type] || '单选题'; tDist[q.type] = (tDist[q.type]||0)+1; });

console.log('\n题型:');
Object.entries(tDist).sort((a,b)=>b[1]-a[1]).forEach(([t,n]) => console.log(`  ${typeNames[t]}: ${n}`));

fs.writeFileSync(OUTPUT, JSON.stringify(uniq, null, 2), 'utf-8');
console.log(`\n输出: ${OUTPUT}`);
