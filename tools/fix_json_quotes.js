const fs = require('fs');
const path = 'I:/公基自动化备考计划通/考试资料/待导入题库/一建建筑实务_章节题库.json';

let s = fs.readFileSync(path, 'utf8');

// Find and fix all Chinese-style double quotes that are ASCII " inside strings
// Pattern: Chinese text followed by "keyword" which breaks JSON
const fixes = [
  [/的"五大伤害"中/g, '的「五大伤害」中'],
  [/的"三算对比"/g, '的「三算对比」'],
  [/"三宝"/g, '「三宝」'],
  [/"四口"/g, '「四口」'],
  [/"四节一环保"/g, '「四节一环保」'],
  [/"四节"/g, '「四节」'],
  [/"五牌一图"/g, '「五牌一图」'],
  [/"一图"/g, '「一图」'],
];

for (const [from, to] of fixes) {
  s = s.replace(from, to);
}

try {
  const data = JSON.parse(s);
  console.log('Fixed! Questions:', data.length);
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log('Written OK');
} catch (e) {
  console.log('Error:', e.message);
  // Show context around error
  const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
  if (pos) console.log('Context:', JSON.stringify(s.substring(pos - 30, pos + 30)));
}
