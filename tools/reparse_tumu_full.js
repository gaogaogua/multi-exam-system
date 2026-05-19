/**
 * 土木题库完整重解析 — 逐文件精确解析 + 智能去重 + 类型判定
 * 正确处理所有11个MinerU JSON文件的各异格式
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.resolve(__dirname, '..', '考试资料', '原始文件', '土木原数据');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');

// ══════════════════════════════════════
// Step 1: Extract clean text lines from each file
// ══════════════════════════════════════

function extractLines(jsonData) {
  const lines = [];
  if (!jsonData.pdf_info) return lines;
  for (const page of jsonData.pdf_info) {
    if (!page.preproc_blocks) continue;
    for (const block of page.preproc_blocks) {
      if (block.type === 'image') continue;
      for (const ln of (block.lines || [])) {
        let text = '';
        for (const s of (ln.spans || [])) { if (s.content) text += s.content; }
        const t = text.trim();
        if (t) lines.push(t);
      }
    }
  }
  return lines;
}

// ══════════════════════════════════════
// Step 2: Per-file parsers
// ══════════════════════════════════════

function parseQuestionAnswerFormat(lines, sourceFile) {
  const questions = [];
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_ANS = /^(?:\d{1,3}[.、]\s*)?【答案】\s*(.+)$/;
  const RE_OPT = /^([A-H])[.、]\s*(.+)$/;

  // Check if this file has answer sections (separate from questions)
  const hasAnswerSections = lines.some(l => /答案及解析/.test(l));

  let globalAnswers = [];
  if (hasAnswerSections) {
    let inZone = false;
    for (const line of lines) {
      if (/答案及解析/.test(line)) { inZone = true; continue; }
      if (!inZone) continue;
      // Turn off zone only at NEXT 答案及解析 or end of file markers (not at 一、单选题 which is inside answer section)
      if (/答案及解析/.test(line)) { inZone = false; continue; }
      const am = line.match(RE_ANS);
      if (am) globalAnswers.push(am[1].trim());
    }
  }

  let cur = null;
  let answerIdx = 0;

  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    if (!cur.answer && hasAnswerSections && answerIdx < globalAnswers.length) {
      cur.answer = globalAnswers[answerIdx++];
    }
    const q = buildQuestion(cur.title, cur.options, cur.answer, sourceFile);
    if (q) questions.push(q);
    cur = null;
  }

  for (const line of lines) {
    if (/答案及解析/.test(line)) continue;
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 30) continue;
    if (/^第[一二三四五六七八九十\d]+章|^第[一二三四五六七八九十\d]+节/.test(line) && line.length < 35) continue;
    if (/^\d+\.\d+\s/.test(line) && line.length < 30) continue; // section numbers

    const qm = line.match(RE_Q);
    if (qm) {
      push();
      cur = { title: qm[2].trim(), options: [], answer: '' };
      continue;
    }
    if (!cur) continue;
    const am = line.match(RE_ANS);
    if (am) { cur.answer = am[1].trim(); push(); continue; }
    const om = line.match(RE_OPT);
    if (om) { cur.options.push({ label: om[1], text: om[2].trim() }); continue; }
    if (/^知识点/.test(line)) continue;
    if (cur.options.length === 0) {
      cur.title += ' ' + line;
    } else {
      cur.options[cur.options.length - 1].text += ' ' + line;
    }
  }
  push();

  // Post-match for answer-section format
  if (hasAnswerSections) {
    let qi = 0;
    for (const q of questions) {
      if (!q.answer && qi < globalAnswers.length) {
        q.answer = globalAnswers[qi];
        const ca = q.answer.replace(/[^A-H]/g, '').toUpperCase();
        if (ca.length === 1 && !q.options.length) q.type = 'single';
        else if (ca.length >= 2 && !q.options.length) q.type = 'multiple';
      }
      qi++;
    }
  }
  return questions;
}

function parseAnswerSectionFormat(lines, sourceFile) {
  /** Format: questions first (numbered), answers in separate section at end */
  const questions = [];
  const RE_Q = /^(\d{1,3})[.、]\s*(.+)/;
  const RE_OPT = /^([A-H])[.、]\s*(.+)$/;

  // Find answer section start
  let answerStartLine = -1;
  for (let i = Math.floor(lines.length * 0.6); i < lines.length; i++) {
    if (/^答案及解析|^参考答案/.test(lines[i])) { answerStartLine = i; break; }
  }

  // Parse answer key from answer section
  const answerMap = {};
  if (answerStartLine > 0) {
    const RE_ANS_KEY = /^(\d{1,3})[.、]?\s*【答案】\s*(.+)$/;
    for (let i = answerStartLine; i < Math.min(answerStartLine + 800, lines.length); i++) {
      const am = lines[i].match(RE_ANS_KEY);
      if (am) answerMap[parseInt(am[1])] = am[2].trim();
    }
  }

  // Parse questions from first part
  let cur = null;
  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    const q = buildQuestion(cur.title, cur.options, cur.answer, sourceFile);
    if (q) questions.push(q);
    cur = null;
  }

  for (let i = 0; i < (answerStartLine > 0 ? answerStartLine : lines.length); i++) {
    const line = lines[i];
    if (/答案及解析|参考答案/.test(line)) break;
    if (/^[一二三四五六七八九十]、|^第[一二三]章|^[一二三]\.\d/.test(line)) continue;

    const qm = line.match(RE_Q);
    if (qm) {
      push();
      const num = parseInt(qm[1]);
      cur = { title: qm[2].trim(), options: [], answer: answerMap[num] || '' };
      continue;
    }
    if (!cur) continue;
    const om = line.match(RE_OPT);
    if (om) {
      cur.options.push({ label: om[1], text: om[2].trim() });
      continue;
    }
    if (cur.options.length === 0) {
      cur.title += ' ' + line;
    } else {
      cur.options[cur.options.length - 1].text += ' ' + line;
    }
  }
  push();
  return questions;
}

function parseRSFormat(lines, sourceFile) {
  /** RS破题提分合集: questions 001-607 with options, answers at end in 参考答案 sections */
  const questions = [];
  const RE_Q3 = /^(\d{3})\s+(.+)/;   // 001 题目...
  const RE_Q2 = /^(\d{2})\s+(.+)/;   // 01 题目... (for section-internal)
  const RE_CASE = /^(\d{1,2})[.、]\s*(.+)/; // case study sub-question
  const RE_OPT = /^([A-H])[.、]\s*(.+)$/;
  const RE_ANS_LINE = /^(\d{3})\s+([A-H]+)$/; // 001 B

  // Build answer map from all 参考答案 sections (skip first ToC one)
  const answerMap = {};
  let inAnswerSection = false;
  let refCount2 = 0;
  for (const line of lines) {
    if (/^参考答案/.test(line)) {
      refCount2++;
      inAnswerSection = refCount2 >= 2;
      continue;
    }
    if (!inAnswerSection) continue;
    if (/^第[一二三四五六七八九十\d]+[篇章节]/.test(line) && line.length < 30 && !/^\d/.test(line)) {
      continue;
    }
    const al = line.match(RE_ANS_LINE);
    if (al) answerMap[parseInt(al[1])] = al[2];
  }

  // Parse questions
  let cur = null;
  let sectionTitle = '';

  function push() {
    if (!cur || !cur.title || cur.title.length < 3) return;
    let answer = '';
    if (cur.qNum && answerMap[cur.qNum]) answer = answerMap[cur.qNum];
    const q = buildQuestion(cur.title, cur.options, cur.answer || answer, sourceFile);
    if (q) questions.push(q);
    cur = null;
  }

  // Skip first '参考答案' in ToC — find the real answer section
  let stopLine = lines.length;
  let refCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^参考答案/.test(lines[i])) {
      refCount++;
      if (refCount >= 2) { stopLine = i; break; }
    }
  }

  for (let i = 0; i < stopLine; i++) {
    const line = lines[i];

    // Section headers
    if (/^\d+\.\d+\s/.test(line) && line.length < 40) { sectionTitle = line; continue; }
    if (/^[一二三四五六七八九十]、/.test(line) && line.length < 40) continue;

    // Question start (001-999)
    const qm3 = line.match(RE_Q3);
    if (qm3) {
      push();
      cur = { title: qm3[2].trim(), options: [], answer: '', qNum: parseInt(qm3[1]) };
      continue;
    }

    if (!cur) continue;

    const om = line.match(RE_OPT);
    if (om) {
      cur.options.push({ label: om[1], text: om[2].trim() });
      continue;
    }

    // Numeric continuation (could be part of question text like "6m")
    if (/^\d/.test(line) && cur.options.length === 0 && !/^\d{3}\s/.test(line)) {
      cur.title += ' ' + line;
      continue;
    }
  }
  push();
  return questions;
}

function parseEssayFormat(lines, sourceFile) {
  /** 口诀简答500问: Q&A format with 问题/答案 */
  const questions = [];
  const RE_Q = /^(\d{1,3})[.、]\s*问题[：:]\s*(.+)/;
  const RE_ANS = /^答案[：:]\s*(.+)/;

  let cur = null;

  for (const line of lines) {
    const qm = line.match(RE_Q);
    if (qm) {
      if (cur && cur.title) {
        const q = buildQuestion(cur.title, [], cur.answer, sourceFile);
        if (q) { q.type = 'essay'; questions.push(q); }
      }
      cur = { title: qm[2].trim(), answer: '' };
      continue;
    }
    if (!cur) continue;
    const am = line.match(RE_ANS);
    if (am) {
      cur.answer = am[1].trim();
      const q = buildQuestion(cur.title, [], cur.answer, sourceFile);
      if (q) { q.type = 'essay'; questions.push(q); }
      cur = null;
    }
  }
  return questions;
}

function parseMixtureFormat(lines, sourceFile) {
  /** 组合_1, 组合母题: mixed format with 【练习】, 【考点】 markers */
  const questions = [];
  const RE_PRACTICE = /^【练习[.·]\s*(单选|多选|判断)】\s*(.+)/;
  const RE_CASE_Q = /^(\d{1,2})[.、]\s*(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pm = line.match(RE_PRACTICE);
    if (pm) {
      let typeHint = pm[1].includes('多选') ? 'multiple' : 'single';
      let title = pm[2].trim();
      let options = [];
      let answer = '';
      // Collect options and answer from following lines
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const nl = lines[j];
        if (/【练习|【考点|【课程/.test(nl)) break;
        const om = nl.match(/^([A-H])[.、]\s*(.+)$/);
        if (om) { options.push({ label: om[1], text: om[2].trim() }); continue; }
        const am = nl.match(/【答案】\s*(.+)/);
        if (am) { answer = am[1].trim(); break; }
      }
      const q = buildQuestion(title, options, answer, sourceFile);
      if (q) { if (typeHint === 'multiple' && q.type === 'single') q.type = 'multiple'; questions.push(q); }
    }
  }
  return questions;
}

// ══════════════════════════════════════
// Common: build question object
// ══════════════════════════════════════

function buildQuestion(title, options, answer, sourceFile) {
  title = title.replace(/\s+/g, ' ').trim();
  if (title.length < 5) return null;
  if (/^[A-H][.、]/.test(title)) return null;
  if (/^第[一二三四五六七八九十\d]+章|^第[一二三四五六七八九十\d]+节|^第[一二三四五六七八九十\d]+篇/.test(title) && title.length < 40) return null;
  if (/^\d+\.\d+\s/.test(title) && title.length < 30) return null;
  // Filter section sub-headers that look like questions but are just section titles
  if (/^(建筑物的构成与设计要求|建筑构造设计|建筑结构体系|结构工程材料|装饰装修|建筑功能材料|施工测量|土石方工程|地基与基础|主体结构)/.test(title) && title.length < 30) return null;

  // Clean answer
  answer = (answer || '').trim().replace(/[^A-Ha-h一-龥0-9，,、.。；;：:（）()【】\[\]℃°%㎡m³²³\-×/\\\s]/g, '').trim();

  // Filter noise options
  options = (options || []).filter(o => o.text && o.text.length >= 1 && !/^\d+$/.test(o.text));
  // Dedup options by label
  const seenLabels = new Set();
  options = options.filter(o => {
    if (seenLabels.has(o.label)) return false;
    seenLabels.add(o.label);
    return true;
  });

  // Determine type
  let type = 'single';
  const cleanAns = answer.replace(/[^A-H]/g, '').toUpperCase();
  const hasChinese = /[一-龥]/.test(answer);
  const hasLongAnswer = answer.length > 8;

  if (cleanAns.length >= 2 && !hasChinese) {
    type = 'multiple';                              // e.g. "ABD" or "BCE"
  } else if (cleanAns.length === 1 && !hasChinese) {
    type = 'single';                                // e.g. "C"
  } else if (hasChinese && hasLongAnswer) {
    type = 'essay';                                 // long Chinese text answer
  } else if (hasChinese && answer.length <= 8) {
    type = 'fill';                                  // short Chinese answer
  } else if (options.length >= 2 && cleanAns.length === 0) {
    type = 'single';                                // has options but answer is non-A-H → likely single
  } else if (options.length === 0 && answer.length === 0) {
    // Infer from title
    if (/简[答述]|试述|列举|写出|简述|简述|叙述/.test(title)) {
      type = 'essay';
    } else if (/问题/.test(title)) {
      type = 'essay';
    } else {
      type = 'fill';                                // default no-options → fill, not essay
    }
  }

  // Judge detection
  if (options.length === 2) {
    const t0 = (options[0].text || '').replace(/\s/g, '');
    const t1 = (options[1].text || '').replace(/\s/g, '');
    if ((t0.includes('正确') || t0.includes('对')) && (t1.includes('错误') || t1.includes('错'))) {
      type = 'judge';
    }
  }
  // Only classify as judge if answer literally says 正确/错误/对/错 and title contains 正确/错误
  if ((answer === '正确' || answer === '错误' || answer === '对' || answer === '错') && /正确|错误/.test(title)) type = 'judge';

  return { title, type, options, answer, analysis: '', category: '未分类', difficulty: '中等', source: 'tumu_import', _sourceFile: sourceFile };
}

// ══════════════════════════════════════
// Step 3: Smart dedup
// ══════════════════════════════════════

function deduplicate(questions) {
  const unique = [];
  const fingerprints = new Map(); // fp → index in unique

  for (const q of questions) {
    const fp = q.title.replace(/\s+/g, '').substring(0, 100);

    if (fingerprints.has(fp)) {
      const existingIdx = fingerprints.get(fp);
      const existing = unique[existingIdx];
      // Merge: keep the one with more data
      if (q.options.length > existing.options.length) existing.options = q.options;
      if (q.answer && !existing.answer) existing.answer = q.answer;
      if (q._sourceFile && !existing._sourceFile.includes(q._sourceFile.split('.')[0].slice(-10))) {
        existing._sourceFile += ' | ' + q._sourceFile;
      }
      continue;
    }

    fingerprints.set(fp, unique.length);
    unique.push(q);
  }

  return unique;
}

// ══════════════════════════════════════
// Main
// ══════════════════════════════════════

console.log('═══════════════════════════════════════');
console.log('  土木题库完整重解析');
console.log('═══════════════════════════════════════\n');

const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));
const allQuestions = [];

const FILE_PARSERS = {};

for (const file of files) {
  const raw = fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8');
  const json = JSON.parse(raw);
  const lines = extractLines(json);
  let qs = [];

  // Detect format and parse
  if (file.includes('口诀简答500问')) {
    qs = parseEssayFormat(lines, file);
  } else if (file.includes('RS破题提分合集')) {
    qs = parseRSFormat(lines, file);
  } else if (file.includes('组合_1')) {
    qs = parseMixtureFormat(lines, file);
    const rest = parseQuestionAnswerFormat(lines, file);
    qs = [...qs, ...rest];
  } else if (file.includes('组合母题')) {
    qs = parseQuestionAnswerFormat(lines, file);
  } else if (file.includes('母题拆解总讲义')) {
    qs = parseQuestionAnswerFormat(lines, file);
  } else if (file.includes('母题课') || file.includes('选择题_')) {
    qs = parseQuestionAnswerFormat(lines, file);
  } else if (file.includes('易错易考300题')) {
    qs = parseQuestionAnswerFormat(lines, file); // answers are inline 【答案】
  } else {
    qs = parseQuestionAnswerFormat(lines, file);
  }

  console.log(`${file.substring(0, 55)}: ${qs.length} 题`);
  FILE_PARSERS[file] = qs.length;
  allQuestions.push(...qs);
}

console.log(`\n合并前: ${allQuestions.length} 题`);

const unique = deduplicate(allQuestions);
console.log(`去重后: ${unique.length} 题 (移除 ${allQuestions.length - unique.length} 重复)`);

// Type classification
const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
const tDist = {};
unique.forEach(q => { q.category = typeNames[q.type] || '单选题'; tDist[q.type] = (tDist[q.type]||0)+1; });

console.log('\n题型分布:');
Object.entries(tDist).sort((a,b)=>b[1]-a[1]).forEach(([t,n]) => {
  console.log(`  ${typeNames[t]||t}: ${n} (${(n/unique.length*100).toFixed(1)}%)`);
});

const withAns = unique.filter(q => q.answer);
console.log(`\n有答案: ${withAns.length}/${unique.length} (${(withAns.length/unique.length*100).toFixed(1)}%)`);

// Answer letter distribution
const ansDist = {};
unique.filter(q => q.answer).forEach(q => {
  const clean = q.answer.replace(/[^A-H]/g, '').toUpperCase();
  if (clean.length <= 4) ansDist[clean.length] = (ansDist[clean.length]||0)+1;
});
console.log('答案字母数分布: ' + JSON.stringify(ansDist));

fs.writeFileSync(OUTPUT, JSON.stringify(unique, null, 2), 'utf-8');
console.log(`\n输出: ${OUTPUT} (${(fs.statSync(OUTPUT).size/1024).toFixed(0)} KB)`);
