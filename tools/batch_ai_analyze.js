/**
 * 公基错题AI批量解析脚本
 * 调用DeepSeek API为题目生成答案和解析
 *
 * 用法:
 *   node tools/batch_ai_analyze.js --api-key=sk-xxx [--limit=20] [--resume]
 *   node tools/batch_ai_analyze.js --help
 *
 * 选项:
 *   --api-key=KEY   DeepSeek API Key (或设置环境变量 DEEPSEEK_API_KEY)
 *   --limit=N       只处理N题 (默认全部)
 *   --resume        从上次中断处继续
 *   --dry-run       试运行: 只显示前5题的prompt不调用API
 *   --batch-size=N  每批题目数 (默认10)
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '..', '考试资料', '中间产物', '公基错题合集_parsed.json');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '公基错题合集_complete.json');
const PROGRESS = path.resolve(__dirname, '..', '考试资料', '.ai_progress_gongji.json');

// ---- parse args ----
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(fs.readFileSync(__filename, 'utf-8').match(/用法:[\s\S]*?$/)[0]);
  process.exit(0);
}

function getArg(name, fallback = '') {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  const flagIdx = args.indexOf(`--${name}`);
  if (flagIdx >= 0 && args.length > flagIdx + 1 && !args[flagIdx + 1].startsWith('--')) {
    return args[flagIdx + 1];
  }
  return fallback;
}

const apiKey = getArg('api-key', process.env.DEEPSEEK_API_KEY || '');
const limit = parseInt(getArg('limit', '0')) || 0;
const resume = args.includes('--resume');
const dryRun = args.includes('--dry-run');
const batchSize = parseInt(getArg('batch-size', '10')) || 10;

if (!apiKey && !dryRun) {
  console.error('错误: 请提供 DeepSeek API Key');
  console.error('用法: node tools/batch_ai_analyze.js --api-key=sk-xxx [--limit=20]');
  process.exit(1);
}

// ---- helpers ----
const typeNames = {
  single: '单选题', multiple: '多选题', judge: '判断题',
  fill: '填空题', essay: '问答题',
};

const answerHints = {
  single: '返回单个选项字母，如 A',
  multiple: '返回多个选项字母，如 ABD（按字母顺序排列）',
  judge: '返回 A（正确/对）或 B（错误/错）',
  fill: '返回填空答案文本',
  essay: '返回参考答案要点',
};

function buildPrompt(q) {
  const typeName = typeNames[q.type] || '单选题';
  let text = `你是一个专业的考试题目解析助手。请分析以下题目并提供正确答案和详细解析。

题目类型：${typeName}
题目内容：${q.title}`;

  if (q.options && q.options.length > 0) {
    text += '\n选项：\n' + q.options.map(o => `${o.label}. ${o.text}`).join('\n');
  }

  text += `

请以JSON格式返回（只返回JSON，不要包含其他内容）：
{"answer": "正确答案", "analysis": "详细解析"}

要求：
1. 答案格式：${answerHints[q.type] || '返回选项字母'}
2. 解析要详细、准确，解释选择该答案的原因，对选择题需逐一分析每个选项
3. 对于判断题，A表示正确/对，B表示错误/错`;

  return text;
}

async function callDeepSeek(q, apiKey) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的考试题目解析助手，只返回JSON格式的结果。' },
        { role: 'user', content: buildPrompt(q) },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `API请求失败 (${resp.status})`);
  }

  const data = await resp.json();
  let content = data.choices[0].message.content.trim();

  // Extract JSON from possible markdown code fences
  if (content.includes('```')) {
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  }
  if (content.includes('{')) {
    content = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
  }

  const parsed = JSON.parse(content);
  return { answer: parsed.answer || '', analysis: parsed.analysis || '' };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- main ----
async function main() {
  console.log('Reading input...');
  const allQuestions = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`Total questions: ${allQuestions.length}`);

  // Load progress for resume
  let doneIds = new Set();
  if (resume && fs.existsSync(PROGRESS)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS, 'utf-8'));
    prog.doneIds.forEach(id => doneIds.add(id));
    console.log(`Resuming: ${doneIds.size} already processed`);
  } else if (resume && fs.existsSync(OUTPUT)) {
    // Fallback: check output file for already-processed questions
    const existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    existing.forEach(q => { if (q.answer) doneIds.add(q._origIdx); });
    console.log(`Resuming: ${doneIds.size} already processed (from output)`);
  }

  let queue = allQuestions.map((q, i) => ({ ...q, _origIdx: i }));
  const toProcess = queue.filter((_, i) => !doneIds.has(i));

  if (limit > 0) {
    console.log(`Limiting to ${limit} questions`);
    toProcess.splice(limit);
  }

  console.log(`To process: ${toProcess.length} (${doneIds.size} already done)`);

  if (dryRun) {
    console.log('\n=== DRY RUN ===');
    toProcess.slice(0, 5).forEach((q, i) => {
      console.log(`\n--- Question ${q._origIdx + 1} [${q.type}] ---`);
      console.log(buildPrompt(q).substring(0, 500));
    });
    console.log('\nDry run complete. Remove --dry-run to execute.');
    return;
  }

  // Build results array (start from existing output if resuming)
  let results;
  if (resume && fs.existsSync(OUTPUT)) {
    results = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
  } else {
    results = allQuestions.map((q, i) => ({ ...q, _origIdx: i }));
  }

  let processed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let batchStart = 0; batchStart < toProcess.length; batchStart += batchSize) {
    const batch = toProcess.slice(batchStart, batchStart + batchSize);
    const batchPromises = batch.map(async (q) => {
      try {
        const result = await callDeepSeek(q, apiKey);
        // Update result in the results array
        const idx = q._origIdx;
        results[idx].answer = result.answer;
        results[idx].analysis = result.analysis;
        processed++;
        return { success: true, idx };
      } catch (e) {
        failed++;
        console.error(`  [${q._origIdx + 1}] FAIL: ${e.message}`);
        return { success: false, idx: q._origIdx };
      }
    });

    await Promise.all(batchPromises);

    // Save progress
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  Batch ${Math.floor(batchStart / batchSize) + 1}: ${processed}/${toProcess.length} done, ${failed} failed (${elapsed}s)`);

    // Write output
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
    // Write progress tracking
    const doneSet = new Set(doneIds);
    results.forEach((r, i) => { if (r.answer) doneSet.add(i); });
    fs.writeFileSync(PROGRESS, JSON.stringify({ doneIds: [...doneSet], lastBatch: batchStart + batchSize }), 'utf-8');

    // Rate limiting: small delay between batches
    if (batchStart + batchSize < toProcess.length) {
      await sleep(500);
    }
  }

  // Clean up progress file
  if (fs.existsSync(PROGRESS)) fs.unlinkSync(PROGRESS);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone! ${processed} processed, ${failed} failed in ${totalTime}s`);
  console.log(`Output: ${OUTPUT}`);

  // Stats
  const answered = results.filter(r => r.answer).length;
  const byType = {};
  results.forEach(r => {
    byType[r.type] = (byType[r.type] || 0) + 1;
  });
  console.log(`\nResults: ${answered}/${results.length} with answers`);
  console.log('By type:', JSON.stringify(byType));
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
