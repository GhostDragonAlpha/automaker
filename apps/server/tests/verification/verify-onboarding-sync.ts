import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3008/api';
const API_KEY = 'automaker_api_key_123';

async function run() {
  console.log('1. Checking Initial State...');
  const initialRes = await fetch(`${BASE_URL}/settings/credentials`, {
    headers: { 'x-api-key': API_KEY },
  });
  const initial = await initialRes.json();
  console.log('Initial Z.AI Configured:', initial.credentials?.zai?.configured);

  console.log('\n2. Simulating Onboarding (POST /api/setup/store-api-key)...');
  // This is the call the Onboarding Wizard makes
  const setupRes = await fetch(`${BASE_URL}/setup/store-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Setup doesn't require x-api-key usually? Or does it? index.ts says unauthenticated.
    body: JSON.stringify({
      provider: 'zai',
      apiKey: 'test_zai_key_from_onboarding',
    }),
  });
  console.log('Setup Response:', setupRes.status, await setupRes.json());

  console.log('\n3. Checking State Again (Sync Verification)...');
  const finalRes = await fetch(`${BASE_URL}/settings/credentials`, {
    headers: { 'x-api-key': API_KEY },
  });
  const final = await finalRes.json();
  console.log('Final Z.AI Configured:', final.credentials?.zai?.configured);

  if (final.credentials?.zai?.configured === true) {
    console.log('\n✅ Onboarding Sync Validated: Key persisted to SettingsService.');
  } else {
    console.log('\n❌ Onboarding Sync Failed: Key NOT found in SettingsService.');
    process.exit(1);
  }
}

run().catch(console.error);
