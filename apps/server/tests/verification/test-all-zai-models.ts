/**
 * Z.AI Multi-Model Test
 *
 * Tests all Z.AI models to ensure they respond correctly.
 * Run with: npx tsx tests/verification/test-all-zai-models.ts
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const ZAI_API_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

// All models from zai-provider.ts (verified real models only)
const MODELS = [
  { id: 'glm-4.7', apiName: 'GLM-4.7', description: 'Flagship with Interleaved Thinking' },
  { id: 'glm-4.6', apiName: 'GLM-4.6', description: 'Agentic with streaming tools' },
  { id: 'glm-4.5-flash', apiName: 'GLM-4.5-Flash', description: 'Fast lightweight' },
];

function generateToken(apiKey: string): string {
  const [id, secret] = apiKey.split('.');
  if (!id || !secret) return apiKey;

  const API_TOKEN_TTL_SECONDS = 210;
  const now = Math.round(Date.now());
  const payload = {
    api_key: id,
    exp: now + API_TOKEN_TTL_SECONDS * 1000,
    timestamp: now,
  };

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    header: { alg: 'HS256', sign_type: 'SIGN' },
  });
}

async function testModel(
  model: (typeof MODELS)[0],
  token: string
): Promise<{ success: boolean; error?: string; latencyMs: number }> {
  const startTime = Date.now();

  try {
    const response = await fetch(ZAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: model.apiName,
        messages: [{ role: 'user', content: 'Say "Hello" in one word.' }],
        max_tokens: 10,
        stream: false,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
        latencyMs,
      };
    }

    const data = (await response.json()) as {
      choices?: {
        message?: {
          content?: string;
          reasoning_content?: string; // GLM-4.7 thinking mode
          thinking?: string; // Alternative field
        };
      }[];
      // Debug: check for other response structures
      output?: string;
      result?: string;
    };

    // Check all possible content locations
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.message?.reasoning_content ||
      data.choices?.[0]?.message?.thinking ||
      data.output ||
      data.result;

    if (!content) {
      // Debug: show actual response structure
      console.log(`\n   DEBUG Response: ${JSON.stringify(data).slice(0, 500)}`);
      return { success: false, error: 'No content in response', latencyMs };
    }

    return { success: true, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}

async function main() {
  console.log('=== Z.AI Multi-Model Test ===\n');

  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    console.error('❌ ZAI_API_KEY not set');
    process.exit(1);
  }

  const token = generateToken(apiKey);
  console.log(`API Key ID: ${apiKey.split('.')[0]}\n`);

  const results: { model: string; status: string; latency: string; error?: string }[] = [];

  for (const model of MODELS) {
    process.stdout.write(`Testing ${model.id} (${model.description})... `);

    const result = await testModel(model, token);

    if (result.success) {
      console.log(`✅ OK (${result.latencyMs}ms)`);
      results.push({ model: model.id, status: '✅ PASS', latency: `${result.latencyMs}ms` });
    } else {
      console.log(`❌ FAIL`);
      console.log(`   Error: ${result.error}`);
      results.push({
        model: model.id,
        status: '❌ FAIL',
        latency: `${result.latencyMs}ms`,
        error: result.error,
      });
    }
  }

  console.log('\n=== Summary ===\n');
  console.table(results.map((r) => ({ Model: r.model, Status: r.status, Latency: r.latency })));

  const failures = results.filter((r) => r.status.includes('FAIL'));
  if (failures.length > 0) {
    console.log(`\n⚠️ ${failures.length} model(s) failed`);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${MODELS.length} models passed!`);
  }
}

main();
