// 清理 bloated sync data
const https = require('https');
const fs = require('fs');

const TOKEN = '49beec2e645c27defc16ac1c52eaacdb';
const API = 'https://gitee.com/api/v5/repos/how-are-you-gao-gao-hang/multi-exam-system/contents/sync/data.json';

// Step 1: Get current SHA
console.log('Getting SHA...');
https.get(API + '?access_token=' + TOKEN, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const info = JSON.parse(d);
    console.log('Current size:', Math.round(info.size / 1024), 'KB');
    console.log('SHA:', info.sha);

    // Step 2: Download raw content (via raw URL directly, not download_url)
    console.log('Downloading raw data...');
    const rawUrl = 'https://gitee.com/how-are-you-gao-gao-hang/multi-exam-system/raw/master/sync/data.json';
    https.get(rawUrl, (res2) => {
      // Follow redirect if needed
      if (res2.statusCode >= 300 && res2.statusCode < 400) {
        https.get(res2.headers.location, (res3) => {
          let raw = '';
          res3.on('data', c => raw += c);
          res3.on('end', () => processRaw(raw, old => true));
        });
        return;
      }
      let raw = '';
      res2.on('data', c => raw += c);
      res2.on('end', () => {
        const j = JSON.parse(raw);
        const oldAI = j.aiQuestions ? j.aiQuestions.length : 0;
        j.aiQuestions = (j.aiQuestions || []).slice(-50); // Keep only last 50
        j.updatedAt = new Date().toISOString();
        const cleaned = JSON.stringify(j, null, 2);
        console.log('AI questions:', oldAI, '→', j.aiQuestions.length);
        console.log('Cleaned size:', Math.round(cleaned.length / 1024), 'KB');

        // Step 3: Push cleaned version
        const content = Buffer.from(cleaned).toString('base64');
        const body = JSON.stringify({
          access_token: TOKEN,
          sha: info.sha,
          message: 'sync: clean up bloated data',
          content: content,
        });

        const url = new URL(API);
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Content-Length': Buffer.byteLength(body),
          },
        };

        console.log('Uploading cleaned data...');
        const req = https.request(options, (res3) => {
          let r = '';
          res3.on('data', c => r += c);
          res3.on('end', () => {
            console.log('Response:', r.substring(0, 200));
            console.log('Done!');
          });
        });
        req.write(body);
        req.end();
      });
    });
  });
}).on('error', e => console.error('Error:', e.message));
