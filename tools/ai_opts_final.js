/** 批量生成选择题选项 — 50题/批，高效补全 */
const fs = require('fs'); const path = require('path');
const KEY = 'sk-b6f376ed49ec4c0ca1f626a4c615c82e';
const INPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');

const tm = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

// Find questions needing options
const todo = [];
tm.forEach((q, i) => {
  if (q.type === 'essay') return;
  if (q.options && q.options.length >= 2 && q.options[0].text && q.options[0].text.length > 4 && !q.options[0].text.startsWith('✓')) return;
  todo.push({ idx: i, title: q.title.substring(0, 200), type: q.type, answer: (q.answer||'').replace(/[^A-H]/g,'').toUpperCase() });
});

console.log('Need options: ' + todo.length);

async function genBatch(batch) {
  const items = batch.map((item, i) =>
    `${i+1}. [${item.type==='multiple'?'多选':'单选'}] ${item.title}\n   答案:${item.answer}`
  ).join('\n\n');

  const prompt = `你是资深一级建造师考试命题专家。请为以下${batch.length}道选择题生成选项文本（每题4-5个选项，A-E）。

${items}

请严格按以下JSON格式返回（只返回JSON数组）：
[
  {"options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"]},
  ...
]

要求：
1. 每题生成4-5个选项，标签分别为A/B/C/D(/E)
2. 正确答案内容必须符合答案字母（如答案=B则B选项为正确描述，其余为干扰项）
3. 选项简洁（每项10-30字）、专业、符合一级建造师考试风格
4. 涉及规范条款写出具体数值
5. 干扰项有迷惑性但不明显荒谬`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: '你是一级建造师命题专家，只返回JSON。' }, { role: 'user', content: prompt }],
      temperature: 0.5, max_tokens: 4096,
    }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  let content = data.choices[0].message.content.trim();
  if (content.includes('```')) content = content.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
  return JSON.parse(content);
}

async function main() {
  const BATCH = 30;
  let done = 0, fail = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      const results = await genBatch(batch);
      if (!Array.isArray(results)) throw new Error('Not array');

      for (let j = 0; j < Math.min(results.length, batch.length); j++) {
        const opts = results[j]?.options;
        if (opts && opts.length >= 2) {
          tm[batch[j].idx].options = opts.map((t, k) => ({ label: String.fromCharCode(65 + k), text: t }));
          done++;
        }
      }
    } catch(e) {
      fail += batch.length;
      console.error(`Batch ${Math.floor(i/BATCH)+1} FAIL: ${e.message}`);
    }

    console.log(`  ${done}/${todo.length} options generated`);
    fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
    if (i + BATCH < todo.length) await new Promise(r => setTimeout(r, 500));
  }

  const remaining = tm.filter(q => {
    if (q.type === 'essay') return false;
    return !q.options || q.options.length < 2 || !q.options[0].text || q.options[0].text.length <= 2 || q.options[0].text.startsWith('✓');
  });
  console.log(`\nDone! Generated: ${done}, Failed: ${fail}, Still need: ${remaining.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
