/**
 * 土木专业知识AI答案生成
 * 为无答案的题目调用DeepSeek生成答案
 * 用法: node tools/batch_ai_tumu.js --api-key=sk-xxx [--limit=N]
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.resolve(__dirname, '..', '考试资料', '中间产物', '土木_questions_parsed.json');
const OUTPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const PROGRESS = path.resolve(__dirname, '..', '考试资料', '.ai_progress_tumu.json');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('用法: node tools/batch_ai_tumu.js --api-key=sk-xxx [--limit=N] [--resume] [--dry-run]');
  process.exit(0);
}
function getArg(name, fb = '') {
  const a = args.find(a => a.startsWith(`--${name}=`));
  if (a) return a.split('=')[1];
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args.length > i + 1 && !args[i + 1].startsWith('--')) return args[i + 1];
  return fb;
}

const apiKey = getArg('api-key', process.env.DEEPSEEK_API_KEY || '');
const limit = parseInt(getArg('limit', '0')) || 0;
const resume = args.includes('--resume');
const dryRun = args.includes('--dry-run');
const BATCH = 8;

if (!apiKey && !dryRun) {
  console.error('请提供 --api-key=sk-xxx');
  process.exit(1);
}

function buildPrompt(q) {
  const typeHints = { single: '单选题-返回单个选项字母如A', multiple: '多选题-返回多个选项字母如ABD', judge: '判断题-A正确B错误' };
  let p = `你是一级建造师《建筑工程管理与实务》考试专家。请解答以下题目并以JSON返回答案。

题目：${q.title}`;
  if (q.options && q.options.length > 0) {
    p += '\n选项：\n' + q.options.map(o => `${o.label}. ${o.text}`).join('\n');
  }
  p += `\n\n返回JSON: {"answer": "正确答案", "analysis": "详细解析"}
要求：${typeHints[q.type] || '返回正确答案'}，解析要结合规范条款分析每个选项对错原因。`;
  return p;
}

async function callDeepSeek(q, key) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一级建造师考试专家，只返回JSON格式。' },
        { role: 'user', content: buildPrompt(q) },
      ],
      temperature: 0.3, max_tokens: 2048,
    }),
  });
  if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error?.message || `HTTP ${resp.status}`);
  const data = await resp.json();
  let content = data.choices[0].message.content.trim();
  if (content.includes('```')) content = content.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
  if (content.includes('{')) content = content.substring(content.indexOf('{'), content.lastIndexOf('}')+1);
  return JSON.parse(content);
}

async function main() {
  const all = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  const missing = all.filter(q => !q.answer);
  console.log(`Total: ${all.length}, need answers: ${missing.length}`);

  let toProcess = [...missing];
  let doneCount = 0;
  if (resume && fs.existsSync(OUTPUT)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    doneCount = existing.filter(q => q.answer).length - (all.length - missing.length);
    toProcess = all.filter(q => !q.answer);
    console.log(`Resume: ${doneCount} already done, ${toProcess.length} remaining`);
  } else {
    // Build the results array
    // Start from existing questions to preserve answers
  }
  if (limit > 0) toProcess = toProcess.slice(0, limit);
  console.log(`Processing: ${toProcess.length}`);

  if (dryRun) {
    toProcess.slice(0, 3).forEach((q,i) => {
      console.log(`\n--- Q${i+1} [${q.type}] ---`);
      console.log(buildPrompt(q).substring(0, 400));
    });
    return;
  }

  let processed = 0, failed = 0;
  const start = Date.now();

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    await Promise.all(batch.map(async (q) => {
      try {
        const r = await callDeepSeek(q, apiKey);
        q.answer = r.answer || '';
        q.analysis = r.analysis || '';
        processed++;
      } catch (e) {
        failed++;
        console.error(`  FAIL Q${q._qNum}: ${e.message}`);
      }
    }));
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`  Batch ${Math.floor(i/BATCH)+1}: ${processed}/${toProcess.length} (${elapsed}s)`);
    fs.writeFileSync(OUTPUT, JSON.stringify(all, null, 2), 'utf-8');
    if (i + BATCH < toProcess.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone! ${processed} processed, ${failed} failed in ${((Date.now()-start)/1000).toFixed(0)}s`);
  const withAns = all.filter(q => q.answer).length;
  console.log(`Answered: ${withAns}/${all.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
