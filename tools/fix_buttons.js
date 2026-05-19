const fs = require('fs');
let s = fs.readFileSync('I:/公基自动化备考计划通/exam-master/js/practice.js', 'utf8');

const fixes = [
  // AI analyze (has analysis)
  [/class="btn btn-sm btn-outline ai-analyze-btn" data-qid="\${q.id}" style="margin-top:4px;color:var\(--accent\);border-color:var\(--accent\);font-size:11px;">🔄 AI重新解析<\/button>/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiAnalyze(\'${q.id}\')" style="margin-top:4px;color:var(--accent);border-color:var(--accent);font-size:11px;">🔄 AI重新解析</button>'],
  // AI analyze (no analysis)
  [/class="btn btn-sm btn-outline ai-analyze-btn" data-qid="\${q.id}" style="margin-top:4px;color:var\(--accent\);border-color:var\(--accent\);">🤖 AI解析此题<\/button>/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiAnalyze(\'${q.id}\')" style="margin-top:4px;color:var(--accent);border-color:var(--accent);">🤖 AI解析此题</button>'],
  // Followup input
  [/class="ai-followup-input" data-qid="\${q.id}" placeholder="追问AI\.\.\."/g,
   'placeholder="追问AI..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();Practice._aiFollowUp(\'${q.id}\')}"'],
  // Followup button
  [/class="btn btn-sm btn-outline ai-followup-btn" data-qid="\${q.id}"/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiFollowUp(\'${q.id}\')"'],
  // AI grade
  [/class="btn btn-sm btn-outline ai-grade-btn" data-qid="\${q.id}"/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGradeEssay(\'${q.id}\')"'],
  // Edit
  [/class="btn btn-sm btn-outline edit-btn" data-qid="\${q.id}"/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._showEdit(\'${q.id}\')"'],
  // Unpractice
  [/class="btn btn-sm btn-outline unpractice-btn" data-qid="\${q.id}"/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._markUnpracticed(\'${q.id}\')"'],
  // Variant
  [/class="btn btn-sm btn-outline variant-btn" data-qid="\${q.id}"/g,
   'class="btn btn-sm btn-outline" onclick="event.stopPropagation();Practice._aiGenVariant(\'${q.id}\')"'],
];

for (const [from, to] of fixes) {
  const before = (s.match(from) || []).length;
  s = s.replace(from, to);
  const after = (s.match(from) || []).length;
  if (before > 0) console.log(`Fixed ${before} instances, remaining: ${after}`);
}

const remaining = (s.match(/data-qid/g) || []).length;
console.log(`\nRemaining data-qid: ${remaining}`);
fs.writeFileSync('I:/公基自动化备考计划通/exam-master/js/practice.js', s);
console.log('Done');
