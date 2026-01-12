import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const API_KEY = 'c417419764af44faa0607354cf483ad6.IrYFbzCIvcUJ0zox';
const URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

function generateToken(apiKey: string, useMs = true) {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) return apiKey;

  const now = Date.now();
  const payload = {
    api_key: id,
    exp: useMs ? now + 3600 * 1000 : Math.floor(now / 1000) + 3600,
    timestamp: useMs ? now : Math.floor(now / 1000),
  };

  console.log(`Generating Token (Use MS: ${useMs})`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    header: {
      alg: 'HS256',
      sign_type: 'SIGN',
    },
  });
}

async function testCall(useMs: boolean) {
  const token = generateToken(API_KEY, useMs);
  console.log('\n--- Testing with Token ---');

  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'GLM-4.7',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Body:', text);
  } catch (e) {
    console.error('Fetch Failed:', e);
  }
}

async function main() {
  console.log('Test 1: Milliseconds (Zhipu Default)');
  await testCall(true);

  console.log('\n\nTest 2: Seconds (Standard JWT)');
  await testCall(false);
}

main();
