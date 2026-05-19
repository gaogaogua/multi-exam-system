/**
 * 终极解析 — 逐题审查，不容有失
 * 基于MinerU JSON精确提取：题目→选项→答案→解析
 */
const fs = require('fs'); const path = require('path');
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
        t = t.trim();
        if (t) lines.push(t);
      }
    }
  }
  return lines;
}

function buildQ(title, options, answer, analysis, source) {
  title = title.replace(/\s+/g, ' ').trim();
  if (title.length < 5) return null;
  if (/^(第[一二三四五六七八九十\d]+[章节篇]|\d+\.\d+\s)/.test(title) && title.length < 40) return null;
  if (/^[A-H][.、\s]/.test(title)) return null;

  options = (options || []).filter(o => o.text && o.text.length >= 1);
  const seen = new Set();
  options = options.filter(o => { if (seen.has(o.label)) return false; seen.add(o.label); return true; });

  answer = (answer || '').trim();
  const clean = answer.replace(/[^A-H]/g, '').toUpperCase();
  const hasZH = /[一-龥]/.test(answer);

  let type = 'single';
  if (clean.length >= 2 && !hasZH) type = 'multiple';
  else if (clean.length === 1 && !hasZH) type = 'single';
  else if (hasZH && answer.length > 8) type = 'essay';
  else if (hasZH && answer.length <= 8) type = 'fill';
  else if (options.length >= 2 && clean.length === 0) type = 'single';
  else if (!options.length && !answer) type = 'fill';
  if (options.length === 2 && ((options[0].text||'').includes('正确')||(options[0].text||'').includes('对')) && ((options[1].text||'').includes('错误')||(options[1].text||'').includes('错'))) type = 'judge';

  const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
  return { title, type, options, answer, analysis: analysis || '', category: typeNames[type] || '单选题', difficulty: '中等', source: 'tumu_import', _sourceFile: source };
}

// ══════════════════════════════════════
// PARSER: Standard format — Q + 【答案】inline + 【解析】
// Used by: 母题课1-3章, 选择题4-5/6-13, 组合母题
// ══════════════════════════════════════
function parseStandard(lines, src) {
  const qs = [];
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_A = /^(?:\d{1,3}[.、]\s*)?【答案】\s*(.+)$/;
  const RE_X = /^【解析】\s*(.+)$/;
  const RE_O = /^([A-H])[.、\s]+(.+)$/;

  let cur = null;
  function push() {
    if (!cur || !cur.title || cur.title.length < 3) { cur = null; return; }
    const q = buildQ(cur.title, cur.options, cur.answer, cur.analysis, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (const line of lines) {
    if (/^知识点|^第[一二三]章|^第[一二三]节|^\d+\.\d+\s/.test(line) && line.length < 40) continue;
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;

    const qm = line.match(RE_Q);
    if (qm) { push(); cur = { title: qm[2].trim(), options: [], answer: '', analysis: '' }; continue; }
    if (!cur) continue;

    const am = line.match(RE_A);
    if (am) { cur.answer = am[1].trim(); continue; }

    const xm = line.match(RE_X);
    if (xm) { if (!cur.analysis) cur.analysis = xm[1].trim(); else cur.analysis += ' ' + xm[1].trim(); continue; }

    const om = line.match(RE_O);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }

    // Accumulate — could be continuation of title, option, or analysis
    if (cur.options.length === 0 && !cur.answer) {
      cur.title += ' ' + line;
    } else if (cur.options.length > 0 && !cur.answer) {
      cur.options[cur.options.length-1].text += ' ' + line;
    } else if (cur.answer && !/【考点来源】/.test(line)) {
      if (cur.analysis) cur.analysis += ' ' + line;
    }
  }
  push();
  return qs;
}

// ══════════════════════════════════════
// PARSER: 易错300题 — Q only (no inline options), answers in答案及解析 sections
// ══════════════════════════════════════
function parse300(lines, src) {
  const qs = [];
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_A = /^(?:\d{1,3}[.、]\s*)?【答案】\s*(.+)$/;
  const RE_X = /^【解析】\s*(.+)$/;

  // Pass 1: collect ALL answers from答案及解析 zones
  const answers = [];
  let inZone = false;
  for (const line of lines) {
    if (/答案及解析/.test(line)) { inZone = true; continue; }
    if (!inZone) continue;
    if (/^第\s*\d+\s*章/.test(line)) { inZone = false; continue; }
    const am = line.match(RE_A);
    if (am) answers.push({ answer: am[1].trim(), analysis: '' });
  }

  // Pass 2: parse questions, attach answers from answer zones
  let cur = null, ansIdx = 0, skip = false;

  function push() {
    if (!cur || !cur.title || cur.title.length < 3) { cur = null; return; }
    if (!cur.answer && ansIdx < answers.length) {
      cur.answer = answers[ansIdx].answer;
      cur.analysis = answers[ansIdx].analysis || '';
      ansIdx++;
    }
    const q = buildQ(cur.title, cur.options, cur.answer, cur.analysis, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (const line of lines) {
    if (/答案及解析/.test(line)) { skip = true; continue; }
    if (skip) {
      if (/^第\s*\d+\s*章/.test(line)) skip = false;
      else continue;
    }
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;
    if (/^第[一二三四五六七八九十\d]+章|^\d+\.\d+\s/.test(line) && line.length < 40) continue;

    const qm = line.match(RE_Q);
    if (qm) { push(); cur = { title: qm[2].trim(), options: [], answer: '', analysis: '' }; continue; }
    if (!cur) continue;
    // In question section, accumulate title
    if (!skip) cur.title += ' ' + line;
  }
  push();
  return qs;
}

// ══════════════════════════════════════
// PARSER: RS破题提分 — Q001-607 with options, answers at end
// ══════════════════════════════════════
function parseRS(lines, src) {
  const qs = [];
  const RE_Q = /^(\d{1,3})[.\s]\s*(.+)/;
  const RE_O = /^([A-H])[.、\s]+(.+)$/;

  // Build answer map from 参考答案 sections (skip #1 = ToC)
  const ansMap = {};
  let refN = 0, inR = false;
  for (const line of lines) {
    if (/^参考答案/.test(line)) { refN++; inR = refN >= 2; continue; }
    if (!inR) continue;
    const m = line.match(/^(\d{1,3})\s+([A-H]+)$/);
    if (m) ansMap[parseInt(m[1])] = m[2];
  }

  // Parse questions
  let cur = null, stopAt = lines.length;
  refN = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^参考答案/.test(lines[i])) { refN++; if (refN >= 2) { stopAt = i; break; } }
  }

  function push() {
    if (!cur || !cur.title || cur.title.length < 3) { cur = null; return; }
    const q = buildQ(cur.title, cur.options, cur.answer, src);
    if (q) qs.push(q);
    cur = null;
  }

  for (let i = 0; i < stopAt; i++) {
    const line = lines[i];
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;
    if (/^\d+\.\d+\s/.test(line) && line.length < 40) continue;
    if (/^第[一二三四五六七八九十\d]+/.test(line) && line.length < 25) continue;

    const qm = line.match(RE_Q);
    if (qm) {
      push();
      const num = parseInt(qm[1]);
      cur = { title: qm[2].trim(), options: [], answer: ansMap[num] || '', qNum: num };
      continue;
    }
    if (!cur) continue;

    const om = line.match(RE_O);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }

    // Accumulate title or option continuation
    if (cur.options.length === 0) cur.title += ' ' + line;
    else if (!/^荣胜|^【问题】|^\d+\.\d+/.test(line)) cur.options[cur.options.length-1].text += ' ' + line;
  }
  push();
  return qs;
}

// ══════════════════════════════════════
// PARSER: 口诀简答500问 — Q&A
// ══════════════════════════════════════
function parse500(lines, src) {
  const qs = [];
  const RE_Q = /^(\d{1,3})[.、]\s*问题[：:]\s*(.+)/;
  const RE_A = /^(?:【答案】[：:]?|答案[：:])\s*(.+)/;

  let cur = null;
  for (const line of lines) {
    const qm = line.match(RE_Q);
    if (qm) {
      if (cur && cur.title) {
        const q = buildQ(cur.title, [], cur.answer, '', src);
        if (q) { q.type = 'essay'; q.category = '简答题'; qs.push(q); }
      }
      cur = { title: qm[2].trim(), answer: '' };
      continue;
    }
    if (!cur) continue;
    const am = line.match(RE_A);
    if (am) { if (cur.answer) cur.answer += '\n' + am[1].trim(); else cur.answer = am[1].trim(); continue; }
    // Multi-line answer continuation
    if (cur.answer && !/^队长口诀|^\d+[.、]\s*问题/.test(line) && !/^\d+[.、]/.test(line) && !/^第[一二三]/.test(line)) {
      cur.answer += ' ' + line;
    }
    if (/队长口诀/.test(line) && cur.answer) {
      const q = buildQ(cur.title, [], cur.answer, '', src);
      if (q) { q.type = 'essay'; q.category = '简答题'; qs.push(q); }
      cur = null;
    }
  }
  if (cur && cur.title) {
    const q = buildQ(cur.title, [], cur.answer, '', src);
    if (q) { q.type = 'essay'; q.category = '简答题'; qs.push(q); }
  }
  return qs;
}

// ══════════════════════════════════════
// MAIN
// ══════════════════════════════════════

function dedup(qs) {
  const uniq = []; const fps = new Map();
  for (const q of qs) {
    const fp = q.title.replace(/\s+/g,'').substring(0,100);
    if (fps.has(fp)) {
      const ex = uniq[fps.get(fp)];
      if (q.options.length > ex.options.length) ex.options = q.options;
      if (q.answer && !ex.answer) ex.answer = q.answer;
      if (q.analysis && !ex.analysis) ex.analysis = q.analysis;
      continue;
    }
    fps.set(fp, uniq.length);
    uniq.push(q);
  }
  return uniq;
}

console.log('═══════════════════════════════════════');
console.log('  终极解析 — 逐题审查');
console.log('═══════════════════════════════════════\n');

const jsonFiles = fs.readdirSync(INPUT).filter(f => f.endsWith('.json'));
const all = [];

for (const file of jsonFiles) {
  const raw = fs.readFileSync(path.join(INPUT, file), 'utf-8');
  const json = JSON.parse(raw);
  const lines = extractLines(json);
  let qs = [];

  if (file.includes('口诀简答500问')) qs = parse500(lines, file);
  else if (file.includes('RS破题提分合集')) qs = parseRS(lines, file);
  else if (file.includes('易错易考300题')) qs = parse300(lines, file);
  else qs = parseStandard(lines, file);

  const withAns = qs.filter(q => q.answer).length;
  const withOpts = qs.filter(q => q.options.length >= 2).length;
  console.log(`${file.substring(0,55)}: ${qs.length}题 | 答案:${withAns} | 选项:${withOpts}`);
  all.push(...qs);
}

const uniq = dedup(all);
console.log(`\n合并: ${all.length} → 去重: ${uniq.length}`);

const withAns = uniq.filter(q => q.answer).length;
const withOpts = uniq.filter(q => q.options.length >= 2).length;
console.log(`有答案: ${withAns}/${uniq.length} | 有选项: ${withOpts}/${uniq.length}`);

const types = {}; uniq.forEach(q => { types[q.type] = (types[q.type]||0)+1; });
console.log('题型: ' + JSON.stringify(types));

fs.writeFileSync(OUTPUT, JSON.stringify(uniq, null, 2), 'utf-8');
console.log(`\n输出: ${OUTPUT}`);
