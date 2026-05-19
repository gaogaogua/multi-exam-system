// Replace app.js function bodies with delegations to new modules
const fs = require('fs');
const path = 'I:/公基自动化备考计划通/exam-master/js/app.js';
let s = fs.readFileSync(path, 'utf8');

const delegations = {
  // Dashboard
  'updateStats() {': 'updateStats() { Dashboard.updateStats(); ',
  'updateStorageInfo() {': 'updateStorageInfo() { Dashboard.updateStorageInfo(); ',
  'renderRecentPractice() {': 'renderRecentPractice() { Dashboard.renderRecentPractice(); ',
  'renderCategoryChart() {': 'renderCategoryChart() { Dashboard.renderCategoryChart(); ',
  'initDemoData() {': 'initDemoData() { Dashboard.initDemoData(); ',

  // ImportController
  '_ensurePdfJs() {': '_ensurePdfJs() { return ImportController._ensurePdfJs(); ',
  'handlePdfUpload(input) {': 'handlePdfUpload(input) { ImportController.handlePdfUpload(input); ',
  '_processPdfFiles(files) {': '_processPdfFiles(files) { return ImportController._processPdfFiles(files); ',
  '_finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup) {': '_finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup) { ImportController._finishPdfImport(files, importedIds, engineUsed, totalAdded, totalDup); ',
  '_promptAiForMissing(importedIds) {': '_promptAiForMissing(importedIds) { ImportController._promptAiForMissing(importedIds); ',
  'renderImportHistory() {': 'renderImportHistory() { ImportController.renderImportHistory(); ',
  'deleteImportBatch(batchId) {': 'deleteImportBatch(batchId) { ImportController.deleteImportBatch(batchId); ',
  'updateImportSummary(batches) {': 'updateImportSummary(batches) { ImportController._updateImportSummary(batches); ',

  // UIController
  'showToast(msg, type) {': 'showToast(msg, type) { UIController.showToast(msg, type); ',
  'showQuestionDetail(id) {': 'showQuestionDetail(id) { UIController.showQuestionDetail(id); ',
  'closeModal() {': 'closeModal() { UIController.closeModal(); ',
  'showAddQuestionModal(editId) {': 'showAddQuestionModal(editId) { UIController.showAddQuestionModal(editId); ',
  'addOptionRow() {': 'addOptionRow() { UIController.addOptionRow(); ',
  'onTypeChange() {': 'onTypeChange() { UIController.onTypeChange(); ',
  'showApiKeyModal() {': 'showApiKeyModal() { UIController.showApiKeyModal(); ',
  'showAiProgress(total) {': 'showAiProgress(total) { UIController.showAiProgress(total); ',
  'updateAiProgress(current, total, status) {': 'updateAiProgress(current, total, status) { UIController.updateAiProgress(current, total, status); ',
  'closeAiProgress() {': 'closeAiProgress() { UIController.closeAiProgress(); ',
};

for (const [sig, del] of Object.entries(delegations)) {
  // Find the function and replace its opening to delegate
  // Only replace the function signature match, keeping old body as dead code (won't execute after return)
  const idx = s.indexOf(sig);
  if (idx >= 0) {
    // Find matching closing brace
    let depth = 0, end = idx;
    for (let i = idx; i < s.length; i++) {
      if (s[i] === '{') depth++;
      if (s[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    // Replace entire function body with delegation
    const newBody = sig.replace(' {', ' { ') + 'return; }';
    // But actually we need to replace just the opening to delegate, keeping old body as unreachable
    // Simpler: replace the entire function
    const oldFn = s.substring(idx, end);
    // Find function name
    const name = sig.split('(')[0].trim();
    // Get params from sig
    const params = sig.substring(sig.indexOf('('), sig.indexOf(')') + 1);
    const delCall = del.replace(' {', '');
    const newFn = `  ${name}${params} { ${delCall} }`;
    s = s.replace(oldFn, newFn);
    console.log('Delegated:', name);
  }
}

// Remove the duplicated large function bodies (they're now unreachable after delegation)
// Actually keep them — they're just dead code now but won't execute

fs.writeFileSync(path, s);
console.log('Done');
