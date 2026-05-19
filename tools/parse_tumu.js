/**
 * 土木知识解析V2 - 智能双遍扫描
 * 处理多种MinerU输出格式:
 *   格式A: 题目在前，答案及解析在后 (易错易考300题)
 *   格式B: 题目+【答案】交替 (母题拆解讲义)
 *   格式C: Q&A问答 (口诀简答500问)
 *   格式D: 密集题目+选项混合 (RS破题提分)
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.resolve(__dirname, '..', '考试资料', '原始文件', '土木原数据');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '中间产物', '土木_questions_parsed.json');

const RE_QUESTION_NUM = /^(\d{1,3})[.、]\s*/;
const RE_OPTION = /^([A-H])[.、]\s*(.+)$/;
const RE_ANSWER_NUM = /^(\d{1,3})[.、]?\s*【答案】\s*(.+)$/;
const RE_ANSWER_INLINE = /【答案】\s*([A-H√×正确错误对错]+)/;
const RE_ANSWER_HEADER = /^答案及解析|^参考答案|^答案$/;
const RE_SKIP_SECTION = /^(第[一二三四五六七八九十\d]+[章节篇]|目录|CONTENTS)/;

function extractAllLines(jsonData) {
  const allLines = [];
  if (!jsonData.pdf_info) return allLines;
  for (const page of jsonData.pdf_info) {
    if (!page.preproc_blocks) continue;
    for (const block of page.preproc_blocks) {
      if (block.type === 'image') continue;
      for (const line of (block.lines || [])) {
        let text = '';
        for (const span of (line.spans || [])) {
          if (span.content) text += span.content;
        }
        const trimmed = text.trim();
        if (trimmed) allLines.push(trimmed);
      }
    }
  }
  return allLines;
}

function buildFingerprint(title) {
  return title.replace(/\s+/g, '').replace(/[^一-龥a-zA-Z0-9]/g, '').substring(0, 80);
}

function detectType(title, answer, options) {
  // Judge type
  if (options.length === 2 && (
    (options[0].text.includes('正确') || options[0].text.includes('对')) &&
    (options[1].text.includes('错误') || options[1].text.includes('错'))
  )) return 'judge';
  if (answer.includes('正确') || answer.includes('错误') || answer.includes('对') || answer.includes('错')) return 'judge';
  // Multiple choice
  const ans = answer.replace(/[^A-H]/g, '');
  if (ans.length >= 2 || title.includes('多选题') || title.includes('多项')) return 'multiple';
  return 'single';
}

function cleanTitle(title) {
  return title
    .replace(/^（多选题）|^（单选题）|^（判断题）|^（不定项）/, '')
    .replace(/【答案】[^\s]*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Main parser ----
function parseFile(jsonData, sourceFile) {
  const lines = extractAllLines(jsonData);
  const questions = [];
  const answerMap = {}; // questionNumber → { answer, analysis }

  // ---- Pass 1: Collect answers ----
  let inAnswerSection = false;
  let answerLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of answer section
    if (RE_ANSWER_HEADER.test(line)) {
      inAnswerSection = true;
      continue;
    }

    if (inAnswerSection) {
      answerLines.push(line);
      // Check if answer section ended (next major header or end)
      if (i > 0 && /^(一、|二、|三、|第[一二三]篇)/.test(line)) {
        inAnswerSection = false;
      }
    }

    // Inline answer: "1.【答案】A" format
    const ansMatch = line.match(RE_ANSWER_NUM);
    if (ansMatch) {
      const num = parseInt(ansMatch[1], 10);
      answerMap[num] = { answer: ansMatch[2].trim(), analysis: '' };
    }

    // Pure 【答案】 without number prefix
    const inlineAns = line.match(/^【答案】\s*(.+)$/);
    if (inlineAns && !ansMatch) {
      // This might be answer to the previous question
      answerMap['_last'] = { answer: inlineAns[1].trim(), analysis: '' };
    }
  }

  // ---- Pass 2: Parse answer section for numbered answers ----
  if (answerLines.length > 0) {
    for (let i = 0; i < answerLines.length; i++) {
      const line = answerLines[i];
      const ansMatch = line.match(RE_ANSWER_NUM);
      if (ansMatch) {
        const num = parseInt(ansMatch[1], 10);
        if (!answerMap[num]) {
          answerMap[num] = { answer: ansMatch[2].trim(), analysis: '' };
        }
      }
    }
  }

  // ---- Pass 3: Parse questions ----
  let current = null;
  let titleLines = [];
  let options = [];
  let state = 'idle';
  let qNum = 0;

  function reset() {
    current = null; titleLines = []; options = []; state = 'idle'; qNum = 0;
  }

  function pushQuestion(overrideAnswer) {
    if (titleLines.length === 0) return;
    const rawTitle = titleLines.join(' ').replace(/\s+/g, ' ').trim();
    if (rawTitle.length < 5) { reset(); return; }

    const ansData = answerMap[qNum] || {};
    const answer = (overrideAnswer || ansData.answer || '').toUpperCase().replace(/[^A-H正确错误对错√×\d]/g, '');
    const title = cleanTitle(rawTitle);
    const type = detectType(rawTitle, answer, options);

    if (title.length < 5) { reset(); return; }

    questions.push({
      title,
      type,
      options: options.length > 0 ? options.map(o => ({ label: o.label, text: o.text.substring(0, 600) })) : [],
      answer,
      analysis: '',
      category: '土木专业知识',
      difficulty: '中等',
      source: 'tumu_import',
      _sourceFile: sourceFile,
      _qNum: qNum,
    });
    reset();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (RE_SKIP_SECTION.test(line)) continue;

    // Skip answer section (already processed)
    if (RE_ANSWER_HEADER.test(line)) {
      if (state !== 'idle') pushQuestion('');
      // Skip all answer section lines
      while (i + 1 < lines.length && !/^(一、|二、|三、|第[一二三]篇)/.test(lines[i + 1])) {
        i++;
      }
      continue;
    }

    // Detect question number
    const qMatch = line.match(RE_QUESTION_NUM);
    if (qMatch) {
      const num = parseInt(qMatch[1], 10);
      // Save previous
      if (titleLines.length > 0) pushQuestion('');

      qNum = num;
      titleLines = [line.substring(qMatch[0].length)];
      options = [];
      state = 'title';
      current = {};
      continue;
    }

    // Check for inline answer in title
    if (state === 'title') {
      const inlineAns = line.match(/^【答案】\s*(.+)$/);
      if (inlineAns) {
        pushQuestion(inlineAns[1].trim());
        continue;
      }
    }

    // Check for option
    const optMatch = line.match(RE_OPTION);
    if (optMatch) {
      if (state === 'title') state = 'options';
      if (state === 'options') {
        // Only add if it looks like a real option (not just text starting with A-H)
        const optText = optMatch[2].trim();
        if (optText.length > 0 && !/^\d/.test(optText)) {
          options.push({ label: optMatch[1], text: optText });
        }
      }
      continue;
    }

    // Accumulate title or option continuation
    if (state === 'title') {
      titleLines.push(line);
    } else if (state === 'options' && options.length > 0) {
      options[options.length - 1].text += ' ' + line;
    }
  }

  // Last question
  if (titleLines.length > 0) pushQuestion('');

  return questions;
}

// ---- Dedup ----
function deduplicate(questions) {
  const unique = [];
  const seen = new Set();

  for (const q of questions) {
    const fp = buildFingerprint(q.title);
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(q);
  }
  return unique;
}

// ---- Main ----
console.log('=== 土木知识解析 V2 ===\n');

const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json') && !f.includes('组合'));
console.log(`Files: ${files.length}`);

let allQuestions = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8');
  const jsonData = JSON.parse(raw);
  const qs = parseFile(jsonData, file);
  console.log(`  ${file.substring(0, 50)}: ${qs.length} questions`);
  allQuestions.push(...qs);
}

console.log(`\nBefore dedup: ${allQuestions.length}`);
const unique = deduplicate(allQuestions);
console.log(`After dedup: ${unique.length} (removed ${allQuestions.length - unique.length})`);

const withAns = unique.filter(q => q.answer);
const withoutAns = unique.filter(q => !q.answer);
console.log(`\nWith answers: ${withAns.length}`);
console.log(`Without answers: ${withoutAns.length}`);

fs.writeFileSync(OUTPUT, JSON.stringify(unique, null, 2), 'utf-8');
console.log(`\nOutput: ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB)`);

// Show answer coverage by source file
console.log('\n=== Per-file answer coverage ===');
const fileGroups = {};
unique.forEach(q => {
  const key = q._sourceFile.substring(0, 50);
  if (!fileGroups[key]) fileGroups[key] = { total: 0, answered: 0 };
  fileGroups[key].total++;
  if (q.answer) fileGroups[key].answered++;
});
for (const [k, v] of Object.entries(fileGroups)) {
  console.log(`  ${k}: ${v.answered}/${v.total} (${(v.answered/v.total*100).toFixed(0)}%)`);
}

// Show samples
console.log('\n=== Samples ===');
unique.filter(q => q.answer).slice(0, 5).forEach((q, i) => {
  console.log(`\n[${i+1}] [${q.type}] ${q.title.substring(0, 100)}`);
  console.log(`  Answer: ${q.answer}`);
  if (q.options.length) console.log(`  Options: ${q.options.map(o => o.label).join('')}`);
});

console.log('\n=== Without answers ===');
unique.filter(q => !q.answer).slice(0, 5).forEach((q, i) => {
  console.log(`\n[${i+1}] [${q.type}] ${q.title.substring(0, 100)}`);
});
