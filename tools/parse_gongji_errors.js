/**
 * 公基错题合集解析器
 * 将OCR提取的Markdown文件解析为结构化JSON题目数组
 * 输入: 考试资料/公基错题合集1（20250529）_2056301767936380928.md
 * 输出: 考试资料/公基错题合集_parsed.json
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '..', '考试资料', '原始文件', '公基错题合集1（20250529）_2056301767936380928.md');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '中间产物', '公基错题合集_parsed.json');

// ---- patterns ----
const RE_SECTION_HEADER = /^# 公基-湖南错题下载\d+题/;
const RE_SUB_SECTION = /^# （[一二三四五六七八九十\d]+）/;
const RE_IMAGE = /^!\[image\]/;
const RE_QR_BLOCK = /^扫一扫|^打开粉笔|^扫描二维码|^听课刷题|^[②③] /;
const RE_QUESTION_NUM = /^(\d{1,3})\.\s*/;
const RE_OPTION_LETTER = /^([A-H])[.、\s]+(.*)$/;
const RE_TYPE_MULTI = /^（多选题）/;
const RE_TYPE_JUDGE = /^（判断题）/;

// ---- helpers ----
function isHeaderLine(line) {
  return RE_SECTION_HEADER.test(line) || RE_SUB_SECTION.test(line);
}

function isSkipLine(line) {
  return !line
    || RE_IMAGE.test(line)
    || RE_QR_BLOCK.test(line)
    || line.trim() === ''
    || line.trim().startsWith('听课刷题')
    || line.trim() === '扫描二维码 下载「粉笔」APP';
}

function detectType(title) {
  if (RE_TYPE_JUDGE.test(title)) return 'judge';
  if (RE_TYPE_MULTI.test(title)) return 'multiple';
  return 'single';
}

function cleanTitle(rawTitle) {
  // Remove type labels from title
  let t = rawTitle.replace(/^（多选题）/g, '').replace(/^（判断题）/g, '').trim();
  // Collapse whitespace
  t = t.replace(/\s+/g, ' ');
  // Remove leading number and dot if it became part of text (OCR artifact fix)
  // Keep it as is since the number is the question identifier
  return t;
}

function extractQuestionNumber(line) {
  const m = line.match(RE_QUESTION_NUM);
  return m ? parseInt(m[1], 10) : null;
}

function hasQuestionStart(line) {
  return RE_QUESTION_NUM.test(line);
}

/**
 * Main parser - line-by-line state machine
 */
function parse(content) {
  const lines = content.split(/\r?\n/);
  const questions = [];
  let state = 'idle';       // idle | in_title | in_options
  let current = null;       // current question being built
  let titleLines = [];
  let options = [];
  let qNum = 0;
  let sectionNum = 0;
  let lastQuestionNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Track section
    if (RE_SECTION_HEADER.test(line)) {
      sectionNum++;
      console.log(`  Section ${sectionNum}: ${line}`);
      continue;
    }

    // Skip sub-section headers (case study intros)
    if (RE_SUB_SECTION.test(line)) {
      // Save the sub-section name as context
      if (current && titleLines.length > 0) {
        // This is a case study intro - attach to next question as context
      }
      continue;
    }

    // Skip noise
    if (isSkipLine(line)) continue;

    // Check for question start
    const numMatch = line.match(RE_QUESTION_NUM);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);

      // Skip if this looks like a false positive (large number likely not a question)
      if (num > 500) continue;

      // Save previous question
      if (current && titleLines.length > 0) {
        finalizeQuestion(questions, current, titleLines, options, sectionNum);
      }

      // Start new question
      qNum = num;
      lastQuestionNum = num;
      titleLines = [line.substring(numMatch[0].length)];
      options = [];
      state = 'in_title';
      current = { rawStart: i + 1 };
      continue;
    }

    // Check for option line
    const optMatch = line.match(RE_OPTION_LETTER);
    if (optMatch && state === 'in_title') {
      // First option detected - transition to options
      state = 'in_options';
      options.push({ label: optMatch[1], text: optMatch[2].trim() });
      continue;
    }

    if (optMatch && state === 'in_options') {
      options.push({ label: optMatch[1], text: optMatch[2].trim() });
      continue;
    }

    // Check for merged question on same line (e.g., "D.xxx 国家市场...111.履行...")
    if (state === 'in_options') {
      const mergedMatch = line.match(/(\d{1,3})\.\s*(.+)$/);
      if (mergedMatch && options.length > 0) {
        const nextNum = parseInt(mergedMatch[1], 10);
        // Heuristic: if number is close to current question + 1, it's a new question
        if (nextNum === qNum + 1 || nextNum === qNum + 2) {
          // Save current question with partial title
          if (current && titleLines.length > 0) {
            finalizeQuestion(questions, current, titleLines, options, sectionNum);
          }
          // Start new question from this line
          qNum = nextNum;
          titleLines = [mergedMatch[2]];
          options = [];
          state = 'in_title';
          current = { rawStart: i + 1 };
          continue;
        }
      }
    }

    // Accumulate title lines
    if (state === 'in_title') {
      // Check for OCR-embedded question number within the title text (e.g., "独26.立自主")
      // Pattern: a Chinese char followed by digits + period + Chinese char
      const embedMatch = line.match(/[^\x00-\x7f](\d{1,3})\.\s*([^\x00-\x7f])/);
      if (embedMatch) {
        const embeddedNum = parseInt(embedMatch[1], 10);
        if (embeddedNum === lastQuestionNum + 1 && embeddedNum <= 270) {
          // Split the line at the embedded number
          const splitIdx = line.indexOf(embedMatch[0]) + embedMatch[0].indexOf(embedMatch[1] + '.');
          const part1 = line.substring(0, splitIdx).trim();
          const part2 = line.substring(splitIdx).replace(/^\d{1,3}\.\s*/, '').trim();

          if (part1) titleLines.push(part1);

          // Save current question with partial title from part1
          if (current && titleLines.length > 0) {
            const prevType = detectType(titleLines.join(' '));
            const prevTitle = cleanTitle(titleLines.join(' '));
            pushQuestion(questions, prevTitle, prevType, options);
          }

          // Start new question
          qNum = embeddedNum;
          lastQuestionNum = embeddedNum;
          titleLines = [part2];
          options = [];
          state = 'in_title';
          current = { rawStart: i + 1 };
          continue;
        }
      }
      titleLines.push(line);
    }
    // In options state, non-option lines could be continuation of last option text
    else if (state === 'in_options' && options.length > 0 && line.length > 0) {
      // Could be option text continuation or noise - skip if looks like noise
      if (!isSkipLine(line)) {
        // Append to last option text
        options[options.length - 1].text += ' ' + line;
      }
    }
  }

  // Don't forget the last question
  if (current && titleLines.length > 0) {
    finalizeQuestion(questions, current, titleLines, options, sectionNum);
  }

  return questions;
}

function finalizeQuestion(questions, current, titleLines, options, sectionNum) {
  const rawTitle = titleLines.join(' ').replace(/\s+/g, ' ').trim();
  const type = detectType(rawTitle);
  let title = cleanTitle(rawTitle);

  // Try to split merged questions (OCR artifact where next question number is embedded in title)
  // Pattern: "content（ ） digits.content..." or "content. digits.content..."
  const splitResult = splitMergedTitle(title, type);
  if (splitResult) {
    // Push first question
    pushQuestion(questions, splitResult[0].title, splitResult[0].type, options);
    // Push subsequent split questions (they won't have options parsed yet, handle later)
    for (let i = 1; i < splitResult.length; i++) {
      const sq = splitResult[i];
      const sqType = detectType(sq.title);
      pushQuestion(questions, cleanTitle(sq.title), sqType, []);
    }
    return;
  }

  pushQuestion(questions, title, type, options);
}

function splitMergedTitle(title, currentType) {
  // Detect pattern: "judge_question_text（ ） digits. actual_question_start..."
  // Only split if current type is judge (no options means next question merges in)
  if (currentType !== 'judge') return null;

  const re = /（\s*）\s*(\d{1,3}\.)\s*(.+)$/;
  const m = title.match(re);
  if (!m) return null;

  const nextNum = parseInt(m[2], 10);
  if (nextNum < 1 || nextNum > 300) return null;

  const firstTitle = title.substring(0, title.indexOf('（ ）') + 3);
  const restTitle = m[3];

  // Try to split the rest further
  const parts = [{ title: firstTitle }];
  let remaining = restTitle;

  // Recursively detect more question numbers in remaining text
  const innerRe = /(\d{1,3})\.\s*(.+?)(?=\d{1,3}\.\s|$)/g;
  let innerMatch;
  let lastIdx = 0;
  while ((innerMatch = innerRe.exec(remaining)) !== null) {
    if (innerMatch.index > lastIdx) {
      // There's text before this number - it belongs to the previous split part
    }
    const num = parseInt(innerMatch[1], 10);
    if (num >= 1 && num <= 300) {
      parts.push({ title: innerMatch[2].trim() });
      lastIdx = innerMatch.index + innerMatch[0].length;
    }
  }

  return parts.length > 1 ? parts : null;
}

function pushQuestion(questions, title, type, options) {
  if (title.length < 10) return; // skip garbage/fragments
  if (title === '（ ）') return;

  // Skip fragments that are clearly just the tail of a merged question
  // Pattern: matches text ending with close paren or period without a proper stem
  if (/^[^，。？]{0,3}[）)]/.test(title) && title.length < 15) return;

  // Ensure judge questions always have A/B options
  if (type === 'judge' && options.length === 0) {
    options = [
      { label: 'A', text: '正确' },
      { label: 'B', text: '错误' },
    ];
  }

  // Validate options: for single/multiple/judge, need at least 2 options
  if ((type === 'single' || type === 'multiple') && options.length < 2) return;

  // Remove duplicate question (by title similarity)
  const isDup = questions.some(q => q.title === title);
  if (isDup) return;

  questions.push({
    title,
    type,
    options,
    answer: '',
    analysis: '',
    category: '未分类',
    difficulty: '中等',
    source: 'fenbi_error_import',
  });
}

// ---- main ----
console.log('Reading input file...');
const content = fs.readFileSync(INPUT, 'utf-8');
console.log(`File size: ${(content.length / 1024).toFixed(0)} KB`);

const questions = parse(content);

console.log(`\nParsed ${questions.length} questions total`);

// Stats
const types = {};
const hasOptions = questions.filter(q => q.options.length > 0).length;
questions.forEach(q => {
  types[q.type] = (types[q.type] || 0) + 1;
});

console.log('By type:');
Object.entries(types).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => {
  console.log(`  ${t}: ${c}`);
});
console.log(`With options: ${hasOptions}`);
console.log(`Without options: ${questions.length - hasOptions}`);

// Write output
fs.writeFileSync(OUTPUT, JSON.stringify(questions, null, 2), 'utf-8');
console.log(`\nOutput written to: ${OUTPUT}`);

// Print some samples
console.log('\n--- Sample questions ---');
for (let i = 0; i < Math.min(5, questions.length); i++) {
  const q = questions[i];
  console.log(`\n[${i + 1}] ${q.type} | ${q.title.substring(0, 80)}...`);
  if (q.options.length > 0) {
    console.log(`    Options: ${q.options.map(o => o.label + '. ' + o.text.substring(0, 30)).join(' | ')}`);
  }
}
