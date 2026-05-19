/** AI生成选择题选项文本（一级建造师专家） */
const fs = require('fs'); const path = require('path');
const INPUT = path.resolve(__dirname, '..', '考试资料', '最终题库', '土木_questions_complete.json');
const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-b6f376ed49ec4c0ca1f626a4c615c82e';

const tm = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const todo = [];
tm.forEach((q, i) => {
  if (q.type === 'essay') return;
  if (q.options && q.options.length >= 2 && q.options[0].text && !q.options[0].text.startsWith('✓') && !q.options[0].text.startsWith('选项') && q.options[0].text.length > 3) return;
  todo.push({ idx: i, q });
});
console.log('Need option generation: ' + todo.length);

async function genOpts(q) {
  const typeName = q.type === 'multiple' ? '多选题' : '单选题';
  const ans = q.answer || '';
  const letterCount = Math.max(4, ans.replace(/[^A-H]/g,'').length + 1);

  const prompt = `你是一级建造师《建筑工程管理与实务》考试专家。请为以下题目生成${letterCount}个选项（A-${String.fromCharCode(64+letterCount)}）。

题目：${q.title.substring(0, 200)}
题目类型：${typeName}
${ans ? '正确答案：' + ans : ''}

请只返回JSON格式（不要任何其他内容）：
{"options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"]}

要求：
1. 选项之间内容相关但互不相同，有迷惑性
2. 只有一个正确答案（或多选题有多个正确答案，对应${ans}字母的选项应为正确内容）
3. 选项简洁（每项不超过30字）
4. 符合一级建造师考试实际出题风格
5. 涉及规范条款的要写出具体数值或条文`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: '你是一级建造师考试专家，只返回JSON。' }, { role: 'user', content: prompt }],
      temperature: 0.5, max_tokens: 800,
    }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  let content = data.choices[0].message.content.trim();
  if (content.includes('```')) content = content.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
  if (content.includes('{')) content = content.substring(content.indexOf('{'), content.lastIndexOf('}')+1);
  const result = JSON.parse(content);
  return (result.options || []).map((t, i) => ({ label: String.fromCharCode(65 + i), text: t }));
}

async function main() {
  const BATCH = 20;
  let done = 0, fail = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    await Promise.all(batch.map(async (item) => {
      try {
        const opts = await genOpts(item.q);
        tm[item.idx].options = opts;
        done++;
      } catch(e) { fail++; console.error('FAIL ' + item.idx + ': ' + e.message); }
    }));

    console.log(`  ${done}/${todo.length} (failed: ${fail})`);
    fs.writeFileSync(INPUT, JSON.stringify(tm, null, 2), 'utf-8');
    if (i + BATCH < todo.length) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone! ${done} generated, ${fail} failed`);
  const remaining = tm.filter(q => {
    if (q.type === 'essay') return false;
    if (!q.options || q.options.length < 2) return true;
    const t0 = q.options[0].text || '';
    return t0.startsWith('✓') || t0.startsWith('选项') || t0.length <= 2;
  });
  console.log('Still need options: ' + remaining.length);
}

main().catch(e => { console.error(e); process.exit(1); });
