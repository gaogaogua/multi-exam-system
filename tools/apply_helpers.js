const fs = require('fs');
const path = require('path');
const dir = 'I:/公基自动化备考计划通/exam-master/js';

const files = ['app.js', 'practice.js', 'plan.js', 'exam.js'];

for (const file of files) {
  const filePath = path.join(dir, file);
  let s = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace this.escapeHtml(...) → Utils.escapeHtml(...)
  const escCount = (s.match(/this\.escapeHtml\(/g) || []).length;
  if (escCount > 0) {
    s = s.replace(/this\.escapeHtml\(/g, 'Utils.escapeHtml(');
    changed = true;
    console.log(`${file}: replaced ${escCount} escapeHtml calls`);
  }

  // Replace this._esc(...) → Utils.escapeHtml(...) in plan.js
  const escCount2 = (s.match(/this\._esc\(/g) || []).length;
  if (escCount2 > 0) {
    s = s.replace(/this\._esc\(/g, 'Utils.escapeHtml(');
    changed = true;
    console.log(`${file}: replaced ${escCount2} _esc calls`);
  }

  // Replace this.shuffle( → Utils.shuffle(
  const shufCount = (s.match(/this\.shuffle\(/g) || []).length;
  if (shufCount > 0) {
    s = s.replace(/this\.shuffle\(/g, 'Utils.shuffle(');
    changed = true;
    console.log(`${file}: replaced ${shufCount} shuffle calls`);
  }

  // Remove the escapeHtml method definition (in app.js and practice.js)
  const escDef = /  escapeHtml\(str\) \{\s+const d = document\.createElement\('div'\);\s+d\.textContent = str \|\| '';\s+return d\.innerHTML;\s+\},\s+/;
  if (escDef.test(s)) {
    s = s.replace(escDef, '');
    changed = true;
    console.log(`${file}: removed escapeHtml definition`);
  }

  // Remove _esc method in plan.js
  const escDef2 = /  _esc\(s\) \{ const d = document\.createElement\('div'\); d\.textContent = s; return d\.innerHTML; \},\s+/;
  if (escDef2.test(s)) {
    s = s.replace(escDef2, '');
    changed = true;
    console.log(`${file}: removed _esc definition`);
  }

  // Remove shuffle method definition in practice.js
  const shufDef = /  shuffle\(arr\) \{\s+for \(let i = arr\.length - 1; i > 0; i--\) \{\s+const j = Math\.floor\(Math\.random\(\) \* \(i \+ 1\)\);\s+\[arr\[i\], arr\[j\]\] = \[arr\[j\], arr\[i\]\];\s+\}\s+return arr;\s+\},\s+/;
  if (shufDef.test(s)) {
    s = s.replace(shufDef, '');
    changed = true;
    console.log(`${file}: removed shuffle definition`);
  } else {
    // Try exam.js variant
    const shufDef2 = /  shuffle\(arr\) \{ return Practice\.shuffle\(arr\); \},\s+/;
    if (shufDef2.test(s)) {
      s = s.replace(shufDef2, '');
      changed = true;
      console.log(`${file}: removed shuffle delegate`);
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, s);
    console.log(`${file}: saved`);
  } else {
    console.log(`${file}: no changes`);
  }
}
