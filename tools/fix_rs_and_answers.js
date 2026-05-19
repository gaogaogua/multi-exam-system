const fs = require('fs'); const path = require('path');
const INPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const KEY = 'sk-b6f376ed49ec4c0ca1f626a4c615c82e';

const tm = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// Fix _sourceFile
let fixed = 0;
for (const q of tm) {
  if (!q._sourceFile) {
    q._sourceFile = 'MinerU_json_25一建建筑-RS破题提分合集【推荐】_2054794647273381892.json';
    fixed++;
  }
}
console.log('Fixed sourceFile: ' + fixed);

// Answers to generate
const todo = tm.map((q,i) => ({q,i})).filter(x => !x.q.answer);
console.log('Need answers: ' + todo.length);

async function genBatch(batch) {
  const items = batch.map((x,n) =>
    (n+1) + '. [' + x.q.type + '] ' + x.q.title.substring(0, 200)
  ).join('\n\n');

  const prompt = '你是资深一级建造师考试专家。请为以下题目给出正确答案和解析。返回JSON数组。\n\n' + items +
    '\n\n返回格式: {"results":[{"answer":"答案","analysis":"解析"},...]}';

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: '一级建造师专家，只返回JSON。' }, { role: 'user', content: prompt }],
      temperature: 0.3, max_tokens: 2048,
    }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  let c = data.choices[0].message.content.trim();
  if (c.includes('```')) c = c.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(c).results;
}

async function main() {
  let done = 0;
  for (let b = 0; b < todo.length; b += 10) {
    const batch = todo.slice(b, b + 10);
    try {
      const results = await genBatch(batch);
      for (let j = 0; j < Math.min(results.length, batch.length); j++) {
        tm[batch[j].i].answer = results[j].answer || '';
        tm[batch[j].i].analysis = results[j].analysis || '';
        done++;
      }
    } catch(e) { console.error('Batch ' + b + ' FAIL: ' + e.message); }
    console.log('  ' + (b + batch.length) + '/' + todo.length);
    fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
    if (b + 10 < todo.length) await new Promise(r => setTimeout(r, 300));
  }

  const withAns = tm.filter(q => q.answer).length;
  console.log('Done! Answers: ' + withAns + '/' + tm.length);

  const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
  tm.forEach(q => { q.category = typeNames[q.type] || '单选题'; });
  fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
}

main().catch(e => { console.error(e); process.exit(1); });
