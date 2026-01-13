import fetch from 'node-fetch';
const API_KEY = '31efe178-15ef-45b9-a7e8-98bef9d2e9b7';

async function check() {
  try {
    const r = await fetch('http://localhost:3008/api/agent/queue/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({}),
    });
    console.log(`Status: ${r.status} ${r.statusText}`);
    const text = await r.text();
    console.log('Body:', text.substring(0, 200));
  } catch (e) {
    console.error(e);
  }
}
check();
