const https = require('https');
const TOKEN = '49beec2e645c27defc16ac1c52eaacdb';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function httpPut(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname, path: u.pathname, method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(d)); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    // Get SHA
    const infoRaw = await httpGet(`https://gitee.com/api/v5/repos/how-are-you-gao-gao-hang/multi-exam-system/contents/sync/data.json?access_token=${TOKEN}`);
    const info = JSON.parse(infoRaw);
    console.log('Size:', Math.round(info.size/1024), 'KB  SHA:', info.sha);

    // Download raw
    const raw = await httpGet('https://gitee.com/how-are-you-gao-gao-hang/multi-exam-system/raw/master/sync/data.json');
    const j = JSON.parse(raw);
    console.log('AI questions:', j.aiQuestions?.length || 0, '→ 50');

    // Clean
    j.aiQuestions = (j.aiQuestions || []).slice(-50);
    j.updatedAt = new Date().toISOString();
    const cleaned = JSON.stringify(j);
    console.log('Cleaned:', Math.round(cleaned.length/1024), 'KB');

    // Push
    const content = Buffer.from(cleaned).toString('base64');
    const body = JSON.stringify({ access_token: TOKEN, sha: info.sha, message: 'sync: clean', content });
    const resp = await httpPut('https://gitee.com/api/v5/repos/how-are-you-gao-gao-hang/multi-exam-system/contents/sync/data.json', body);
    console.log('Response:', JSON.parse(resp).content ? 'OK' : resp.substring(0,100));
  } catch(e) { console.error('Error:', e.message); }
})();
