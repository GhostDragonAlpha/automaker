import { describe, it, expect } from 'vitest';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3008/api';
const API_KEY = 'automaker_api_key_123'; // Default dev key

describe('Z.AI Full Stack Integration', () => {
  it('should have GLM-4.7 as default phase model', async () => {
    const res = await fetch(`${BASE_URL}/settings/global`, {
      headers: { 'x-api-key': API_KEY },
    });
    expect(res.status).toBe(200);
    const data = await res.json();

    // Check Phase Models
    expect(data.settings).toBeDefined();
    expect(data.settings.phaseModels.specGenerationModel.model).toBe('GLM-4.7');
  });

  it('should accept Z.AI credentials', async () => {
    // 1. Update Creds
    const updateRes = await fetch(`${BASE_URL}/settings/credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        apiKeys: {
          zai: 'c417419764af44faa0607354cf483ad6.IrYFbzCIvcUJ0zox',
        },
      }),
    });
    expect(updateRes.status).toBe(200);

    // 2. Verify Masking
    const getRes = await fetch(`${BASE_URL}/settings/credentials`, {
      headers: { 'x-api-key': API_KEY },
    });
    const resFunc = await getRes.json();
    const creds = resFunc.credentials;

    expect(creds.zai).toBeDefined();
    expect(creds.zai.masked).toBeDefined();
    expect(creds.zai.masked).toContain('...');
    // API returns 'configured' (boolean), not 'isSet'
    expect(creds.zai.configured).toBe(true);
  });

  it('should create and persist a Z.AI profile', async () => {
    // 1. Get current settings
    const getRes = await fetch(`${BASE_URL}/settings/global`, {
      headers: { 'x-api-key': API_KEY },
    });
    const data = await getRes.json();
    const currentProfiles = data.settings.aiProfiles || [];

    const newProfile = {
      id: `zai-test-${Date.now()}`,
      name: 'Integration Test Agent (Z.AI)',
      provider: 'zai',
      model: 'GLM-4.7',
      description: 'Created by Integration Test',
      icon: 'Brain',
    };

    const newSettings = {
      aiProfiles: [...currentProfiles, newProfile],
    };

    // 2. Save
    const saveRes = await fetch(`${BASE_URL}/settings/global`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(newSettings),
    });
    expect(saveRes.status).toBe(200);

    // 3. Verify Persistence
    const verifyRes = await fetch(`${BASE_URL}/settings/global`, {
      headers: { 'x-api-key': API_KEY },
    });
    const verifyData = await verifyRes.json();
    const found = verifyData.settings.aiProfiles.find(
      (p) => p.name === 'Integration Test Agent (Z.AI)'
    );
    expect(found).toBeDefined();
    expect(found.provider).toBe('zai');
    expect(found.model).toBe('GLM-4.7');
  });
});
