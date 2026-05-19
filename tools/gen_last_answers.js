const fs = require('fs'); const path = require('path');
const INPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const KEY = 'sk-b6f376ed49ec4c0ca1f626a4c615c82e';
const tm = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const todo = tm.map((q,i) => ({q,i})).filter(x => !x.q.answer);
console.log('Remaining: ' + todo.length);

async function gen() {
  for (let b = 0; b < todo.length; b += 10) {
    const batch = todo.slice(b, b+10);
    const p = '一级建造师考试专家。请为以下题目给出正确答案和解析。\n\n' +
      batch.map((x,n) => (n+1) + '. [' + x.q.type + '] ' + x.q.title.substring(0, 200)).join('\n\n') +
      '\n\n返回JSON: {"results":[{"answer":"答案","analysis":"解析"},...]}';
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'system', content: '一级建造师专家，只返回JSON。' }, { role: 'user', content: p }],
          temperature: 0.3, max_tokens: 2048,
        }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const d = await resp.json();
      let c = d.choices[0].message.content.trim();
      if (c.includes('```')) c = c.replace(/```json/gi, '').replace(/```/g, '').trim();
      const r = JSON.parse(c).results;
      for (let j = 0; j < Math.min(r.length, batch.length); j++) {
        tm[batch[j].i].answer = r[j].answer || '';
        tm[batch[j].i].analysis = r[j].analysis || '';
      }
      console.log('  ' + Math.min(b + batch.length, todo.length) + '/' + todo.length);
    } catch (e) { console.error('Batch ' + b + ' FAIL: ' + e.message); }
    fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
    if (b + 10 < todo.length) await new Promise(r => setTimeout(r, 300));
  }
  const typeNames = { single: '单选题', multiple: '多选题', judge: '判断题', essay: '简答题', fill: '填空题' };
  tm.forEach(q => { q.category = typeNames[q.type] || '单选题'; });
  fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
  console.log('Done! ' + tm.filter(q => q.answer).length + '/' + tm.length);
}
gen().catch(e => { console.error(e); process.exit(1); });
