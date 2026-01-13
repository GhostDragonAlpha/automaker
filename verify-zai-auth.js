const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Load .env
const envPath = path.join(__dirname, 'apps/server/.env');
console.log('Loading .env from:', envPath);
let apiKey = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/ZAI_API_KEY=(.+)/);
  if (match) {
    apiKey = match[1].trim();
    console.log('Found API Key:', apiKey.substring(0, 10) + '...');
  }
}

if (!apiKey) {
  console.error('Error: ZAI_API_KEY not found in .env');
  process.exit(1);
}

// 2. Generate JWT
function generateToken(apiKey) {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) {
    return apiKey;
  }

  const now = Date.now();
  const payload = {
    api_key: id,
    exp: now + 3 * 60 * 1000,
    timestamp: now,
  };

  const header = {
    alg: 'HS256',
    sign_type: 'SIGN',
  };

  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(unsignedToken)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signature}`;
}

const token = generateToken(apiKey);
console.log('Generated JWT Token');

// 3. Make Request
const data = JSON.stringify({
  model: 'GLM-4.5-Flash',
  messages: [{ role: 'user', content: 'Respond with "Z.AI is working" if you receive this.' }],
});

const options = {
  hostname: 'api.z.ai',
  path: '/api/coding/paas/v4/chat/completions',
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

console.log('Sending request to Z.AI...');
const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);

  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('Success! Response:', responseBody);
      try {
        const parsed = JSON.parse(responseBody);
        const content = parsed.choices[0].message.content;
        console.log('\n--- VERIFICATION RESULT ---');
        console.log('Content:', content);
        console.log('Z.AI Integration: VERIFIED ✅');
      } catch (e) {
        console.error('Failed to parse response JSON', e);
      }
    } else {
      console.error('Request failed:', responseBody);
    }
  });
});

req.on('error', (error) => {
  console.error('Network Error:', error);
});

req.write(data);
req.end();
