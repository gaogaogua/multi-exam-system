/**
 * AI批量补全答案 — 公基+土木剩余缺答案题目
 * 用法: node tools/ai_fill_answers.js --api-key=sk-xxx [--limit=N] [--resume]
 */
const fs = require('fs');
const path = require('path');

const WORK = path.resolve(__dirname, '..', '考试资料', '.ai_work.json');
const GJ = path.resolve(__dirname, '..', '考试资料', '最终题库', '公基错题合集_complete.json');
const TM = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const PROG = path.resolve(__dirname, '..', '考试资料', '.ai_fill_progress.json');

const args = process.argv.slice(2);
function arg(n, fb) { const a=args.find(x=>x.startsWith('--'+n+'=')); if(a)return a.split('=')[1]; const i=args.indexOf('--'+n); if(i>=0&&args.length>i+1&&!args[i+1].startsWith('--'))return args[i+1]; return fb; }
const apiKey = arg('api-key', process.env.DEEPSEEK_API_KEY || '');
const limit = parseInt(arg('limit', '0')) || 0;
const resume = args.includes('--resume');
const BATCH = 8;

if (!apiKey) { console.error('需要 --api-key=sk-xxx'); process.exit(1); }

function buildPrompt(item) {
  const q = item.q || item; // support both formats
  const isGongji = item.bank === 'gongji';
  const expertHint = isGongji
    ? '你是事业单位公共基础知识考试专家，精通马哲、党史、中特、法律、经济、公文、管理、文史、时政。'
    : '你是一级建造师《建筑工程管理与实务》考试专家，精通建筑设计、结构力学、施工技术、材料性能、工程管理法规。';

  const typeHints = {
    single: '单选题 — 返回单个选项字母如 A',
    multiple: '多选题 — 返回多个选项字母如 ABD（按字母顺序）',
    judge: '判断题 — A=正确/对, B=错误/错',
    essay: '简答题 — 返回参考答案要点',
    fill: '填空题 — 返回填入的答案文本',
  };

  let prompt = `${expertHint}请解答以下题目并返回JSON。

题目类型：${typeHints[q.type] || '单选题'}
题目内容：${q.title}`;

  if (q.options && q.options.length > 0) {
    prompt += '\n选项：\n' + q.options.map(o => `${o.label}. ${o.text}`).join('\n');
  }

  prompt += `\n\n返回JSON格式（只返回JSON）：
{"answer": "正确答案", "analysis": "详细解析"}

要求：
1. 答案格式：${typeHints[q.type] || '返回选项字母'}
2. 解析要详细准确，解释选择该答案的原因，逐项分析
3. 对于判断题，A表示正确/对，B表示错误/错
4. 对于简答题，给出参考答案要点
5. 提及相关规范条款或原理依据`;

  return prompt;
}

async function callDeepSeek(item, key) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的考试题目解析助手，只返回JSON格式的结果。' },
        { role: 'user', content: buildPrompt(item) },
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
  const work = JSON.parse(fs.readFileSync(WORK, 'utf-8'));
  const gj = JSON.parse(fs.readFileSync(GJ, 'utf-8'));
  const tm = JSON.parse(fs.readFileSync(TM, 'utf-8'));

  let toProcess = [...work];
  let done = 0;

  // Resume support
  if (resume && fs.existsSync(PROG)) {
    const prog = JSON.parse(fs.readFileSync(PROG, 'utf-8'));
    done = prog.done || 0;
    toProcess = toProcess.slice(done);
    console.log(`Resuming from ${done}/${work.length}`);
  }

  if (limit > 0) toProcess = toProcess.slice(0, limit);
  console.log(`Processing ${toProcess.length} questions (${done} already done)`);

  let processed = 0, failed = 0;
  const start = Date.now();

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    await Promise.all(batch.map(async (item) => {
      try {
        const result = await callDeepSeek(item, apiKey);
        // Apply answer back to source bank
        if (item.bank === 'gongji') {
          gj[item.idx].answer = result.answer || '';
          gj[item.idx].analysis = result.analysis || '';
        } else {
          tm[item.idx].answer = result.answer || '';
          tm[item.idx].analysis = result.analysis || '';
        }
        processed++;
      } catch (e) {
        failed++;
        console.error(`  FAIL [${item.bank}:${item.idx}]: ${e.message}`);
      }
    }));

    const elapsed = ((Date.now()-start)/1000).toFixed(0);
    const pct = ((done+processed)/work.length*100).toFixed(1);
    console.log(`  ${done+processed}/${work.length} (${pct}%) in ${elapsed}s`);

    // Save incrementally
    fs.writeFileSync(GJ, JSON.stringify(gj, null, 2), 'utf-8');
    fs.writeFileSync(TM, JSON.stringify(tm, null, 2), 'utf-8');
    fs.writeFileSync(PROG, JSON.stringify({ done: done + i + batch.length, total: work.length }));

    if (i + BATCH < toProcess.length) await new Promise(r => setTimeout(r, 300));
  }

  // Cleanup
  if (fs.existsSync(PROG)) fs.unlinkSync(PROG);
  if (fs.existsSync(WORK)) fs.unlinkSync(WORK);

  const total = ((Date.now()-start)/1000).toFixed(0);
  console.log(`\nDone! ${processed} processed, ${failed} failed in ${total}s`);

  const gjAns = gj.filter(q => q.answer).length;
  const tmAns = tm.filter(q => q.answer).length;
  console.log(`公基: ${gjAns}/${gj.length} | 土木: ${tmAns}/${tm.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
