/**
 * Direct Z.AI API test to verify JWT token generation against api.z.ai
 */
import jwt from 'jsonwebtoken';

const apiKey = process.env.ZAI_API_KEY || ''; // Will use from env
console.log('API Key loaded:', apiKey ? 'yes (length: ' + apiKey.length + ')' : 'no');

if (!apiKey.includes('.')) {
  console.error('API key does not have ID.Secret format');
  process.exit(1);
}

const [id, secret] = apiKey.split('.');
console.log('API Key ID:', id);

// Match official Zhipu SDK: milliseconds with 3.5 minute TTL
const API_TOKEN_TTL_SECONDS = 210;
const now = Math.round(Date.now());
const payload = {
  api_key: id,
  exp: now + API_TOKEN_TTL_SECONDS * 1000,
  timestamp: now,
};

console.log('Payload timestamp (ms):', now);

const token = jwt.sign(payload, secret, {
  algorithm: 'HS256',
  header: { alg: 'HS256', sign_type: 'SIGN' },
});

// Use the ORIGINAL URL
const URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
console.log('Testing URL:', URL);

// Test with GLM-4.7
const MODEL = 'GLM-4.7';

const response = await fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: 'Say hi' }],
    max_tokens: 50,
  }),
});

console.log('Response status:', response.status, response.statusText);
const text = await response.text();
console.log('Response body:', text);
